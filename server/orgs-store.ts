import {
  insertOrgSchema,
  orgListSchema,
  orgSchema,
  updateOrgSchema,
  type InsertOrg,
  type Org,
  type OrgLab,
  type UpdateOrg,
} from "@shared/orgs";
import { supabase } from "./supabaseClient";

const isMissingRelationError = (error: any) =>
  error?.code === "42P01" ||
  error?.code === "PGRST200" ||
  error?.code === "PGRST201" ||
  error?.code === "PGRST205" ||
  /does not exist/i.test(String(error?.message ?? ""));

const ORG_SELECT = `
  id,
  slug,
  name,
  short_description,
  long_description,
  logo_url,
  website,
  linkedin,
  org_type,
  owner_user_id,
  is_visible,
  created_at
`;

type OrgRow = {
  id: number;
  slug: string;
  name: string;
  short_description: string | null;
  long_description: string | null;
  logo_url: string | null;
  website: string | null;
  linkedin: string | null;
  org_type: string | null;
  owner_user_id: string | null;
  is_visible: boolean | string | null;
};

type OrgLabLinkRow = {
  org_id: number | string;
  labs:
    | {
        id: number;
        slug: string | null;
        name: string;
        lab_status: string | null;
        lab_location: Array<{ city: string | null; country: string | null }> | null;
        lab_profile: Array<{ logo_url: string | null }> | null;
      }
    | Array<{
        id: number;
        slug: string | null;
        name: string;
        lab_status: string | null;
        lab_location: Array<{ city: string | null; country: string | null }> | null;
        lab_profile: Array<{ logo_url: string | null }> | null;
      }>
    | null;
};

function parseBoolean(value: boolean | string | null | undefined, fallback = false): boolean {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = value.toString().toLowerCase();
  return normalized === "true" || normalized === "t" || normalized === "1";
}

function normalizeLabStatus(value?: string | null): OrgLab["labStatus"] {
  const normalized = (value || "listed").toLowerCase();
  if (normalized === "confirmed") return "confirmed";
  if (normalized === "verified_passive") return "verified_passive";
  if (normalized === "verified_active") return "verified_active";
  if (normalized === "premier") return "premier";
  return "listed";
}

function normalizeOrgType(value?: string | null): Org["orgType"] {
  const normalized = (value || "research_org").trim();
  if (
    normalized === "research_org" ||
    normalized === "university" ||
    normalized === "hospital_network" ||
    normalized === "industry" ||
    normalized === "other"
  ) {
    return normalized;
  }
  return "research_org";
}

const pickOne = <T>(value: T[] | T | null | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? null;

async function loadLabsMap(orgIds: number[]): Promise<Map<number, OrgLab[]>> {
  const map = new Map<number, OrgLab[]>();
  if (!orgIds.length) return map;

  const { data, error } = await supabase
    .from("lab_organization_links")
    .select(`
      org_id,
      labs (
        id,
        slug,
        name,
        lab_status,
        lab_location (city, country),
        lab_profile (logo_url)
      )
    `)
    .in("org_id", orgIds);
  if (error) {
    if (isMissingRelationError(error)) return map;
    throw error;
  }

  ((data as OrgLabLinkRow[] | null) ?? []).forEach(row => {
    const orgId = Number(row.org_id);
    if (Number.isNaN(orgId)) return;
    const lab = pickOne(row.labs);
    if (!lab) return;
    const location = pickOne(lab.lab_location);
    const profile = pickOne(lab.lab_profile);
    const current = map.get(orgId) ?? [];
    current.push({
      id: Number(lab.id),
      slug: lab.slug ?? null,
      name: lab.name,
      city: location?.city ?? null,
      country: location?.country ?? null,
      logoUrl: profile?.logo_url ?? null,
      labStatus: normalizeLabStatus(lab.lab_status),
    });
    map.set(orgId, current);
  });

  return map;
}

async function mapOrgRows(rows: OrgRow[]): Promise<Org[]> {
  const orgIds = rows.map(row => Number(row.id)).filter(id => !Number.isNaN(id));
  const labsMap = await loadLabsMap(orgIds);

  return orgListSchema.parse(
    rows.map(row => ({
      id: Number(row.id),
      slug: row.slug,
      name: row.name,
      shortDescription: row.short_description ?? null,
      longDescription: row.long_description ?? null,
      logoUrl: row.logo_url ?? null,
      website: row.website ?? null,
      linkedin: row.linkedin ?? null,
      orgType: normalizeOrgType(row.org_type),
      ownerUserId: row.owner_user_id ?? null,
      isVisible: parseBoolean(row.is_visible, true),
      memberLabIds: (labsMap.get(Number(row.id)) ?? []).map(item => item.id),
      members: labsMap.get(Number(row.id)) ?? [],
      labs: labsMap.get(Number(row.id)) ?? [],
    })),
  );
}

async function ensureOwnerMembership(orgId: number, ownerUserId?: string | null) {
  if (!ownerUserId) return;
  const { error } = await supabase
    .from("org_members")
    .upsert(
      {
        org_id: orgId,
        user_id: ownerUserId,
        org_role: "owner",
      },
      { onConflict: "org_id,user_id" },
    );
  if (error) throw error;
}

async function replaceOrgLabLinks(orgId: number, labIds: number[]) {
  const del = await supabase.from("lab_organization_links").delete().eq("org_id", orgId);
  if (del.error) {
    if (isMissingRelationError(del.error)) {
      if (!labIds.length) return;
      throw new Error("Organization lab links are not configured yet. Create public.lab_organization_links first.");
    }
    throw del.error;
  }
  if (!labIds.length) return;
  const ins = await supabase
    .from("lab_organization_links")
    .insert(labIds.map(labId => ({ org_id: orgId, lab_id: labId })));
  if (ins.error) {
    if (isMissingRelationError(ins.error)) {
      throw new Error("Organization lab links are not configured yet. Create public.lab_organization_links first.");
    }
    throw ins.error;
  }
}

export class OrgStore {
  async list(): Promise<Org[]> {
    const { data, error } = await supabase.from("organizations").select(ORG_SELECT).order("id", { ascending: true });
    if (error) throw error;
    return mapOrgRows((data as OrgRow[] | null) ?? []);
  }

  async listVisible(): Promise<Org[]> {
    const { data, error } = await supabase
      .from("organizations")
      .select(ORG_SELECT)
      .eq("is_visible", true)
      .order("id", { ascending: true });
    if (error) throw error;
    return mapOrgRows((data as OrgRow[] | null) ?? []);
  }

  async findById(id: number): Promise<Org | undefined> {
    const { data, error } = await supabase.from("organizations").select(ORG_SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    const rows = await mapOrgRows([data as OrgRow]);
    return rows[0];
  }

  async findBySlug(slug: string): Promise<Org | undefined> {
    const { data, error } = await supabase.from("organizations").select(ORG_SELECT).eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    const rows = await mapOrgRows([data as OrgRow]);
    return rows[0];
  }

  async listByOwner(ownerUserId: string): Promise<Org[]> {
    const { data, error } = await supabase
      .from("organizations")
      .select(ORG_SELECT)
      .eq("owner_user_id", ownerUserId)
      .order("id", { ascending: true });
    if (error) throw error;
    return mapOrgRows((data as OrgRow[] | null) ?? []);
  }

  async listByLabId(labId: number): Promise<Org[]> {
    const { data, error } = await supabase
      .from("organizations")
      .select(`
        ${ORG_SELECT},
        lab_organization_links!inner (lab_id)
      `)
      .eq("lab_organization_links.lab_id", labId)
      .order("id", { ascending: true });
    if (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }
    return mapOrgRows((data as OrgRow[] | null) ?? []);
  }

  async create(payload: InsertOrg): Promise<Org> {
    const data = insertOrgSchema.parse(payload);
    const { data: inserted, error } = await supabase
      .from("organizations")
      .insert({
        slug: data.slug,
        name: data.name,
        short_description: data.shortDescription ?? null,
        long_description: data.longDescription ?? null,
        logo_url: data.logoUrl ?? null,
        website: data.website ?? null,
        linkedin: data.linkedin ?? null,
        org_type: data.orgType,
        owner_user_id: data.ownerUserId,
        is_visible: data.isVisible,
      })
      .select("id")
      .single();
    if (error || !inserted) throw error ?? new Error("Failed to insert organization");

    const orgId = Number(inserted.id);
    await ensureOwnerMembership(orgId, data.ownerUserId);
    await replaceOrgLabLinks(orgId, data.memberLabIds ?? []);
    const org = await this.findById(orgId);
    if (!org) throw new Error("Organization not found after creation");
    return org;
  }

  async update(id: number, updates: UpdateOrg): Promise<Org> {
    const existing = await this.findById(id);
    if (!existing) throw new Error("Organization not found");
    const parsed = updateOrgSchema.parse(updates);

    const baseUpdates: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(updates, "slug")) baseUpdates.slug = parsed.slug;
    if (Object.prototype.hasOwnProperty.call(updates, "name")) baseUpdates.name = parsed.name;
    if (Object.prototype.hasOwnProperty.call(updates, "shortDescription")) baseUpdates.short_description = parsed.shortDescription ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "longDescription")) baseUpdates.long_description = parsed.longDescription ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "logoUrl")) baseUpdates.logo_url = parsed.logoUrl ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "website")) baseUpdates.website = parsed.website ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "linkedin")) baseUpdates.linkedin = parsed.linkedin ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "orgType")) baseUpdates.org_type = parsed.orgType;
    if (Object.prototype.hasOwnProperty.call(updates, "ownerUserId")) baseUpdates.owner_user_id = parsed.ownerUserId ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "isVisible")) baseUpdates.is_visible = parsed.isVisible;

    if (Object.keys(baseUpdates).length) {
      const { error } = await supabase.from("organizations").update(baseUpdates).eq("id", id);
      if (error) throw error;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "ownerUserId")) {
      await ensureOwnerMembership(id, parsed.ownerUserId ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(updates, "memberLabIds")) {
      await replaceOrgLabLinks(id, parsed.memberLabIds ?? []);
    }

    const org = await this.findById(id);
    if (!org) throw new Error("Organization not found after update");
    return orgSchema.parse(org);
  }

  async delete(id: number): Promise<void> {
    const { error } = await supabase.from("organizations").delete().eq("id", id);
    if (error) throw error;
  }
}

export const orgStore = new OrgStore();
