import { supabase } from "./supabaseClient";
import type { InsertOrganization, UpdateOrganization, OrgMemberRole } from "@shared/organizations";

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
  created_at,
  updated_at,
  org_members (
    id,
    user_id,
    org_role,
    created_at
  )
`;

const toSnakeCase = (payload: InsertOrganization | UpdateOrganization) => ({
  ...(payload.slug !== undefined && { slug: payload.slug }),
  ...(payload.name !== undefined && { name: payload.name }),
  ...(payload.shortDescription !== undefined && { short_description: payload.shortDescription }),
  ...(payload.longDescription !== undefined && { long_description: payload.longDescription }),
  ...(payload.logoUrl !== undefined && { logo_url: payload.logoUrl }),
  ...(payload.website !== undefined && { website: payload.website }),
  ...(payload.linkedin !== undefined && { linkedin: payload.linkedin }),
  ...(payload.orgType !== undefined && { org_type: payload.orgType }),
  ...(payload.isVisible !== undefined && { is_visible: payload.isVisible }),
});

export const organizationStore = {
  async list() {
    const { data, error } = await supabase
      .from("organizations")
      .select(ORG_SELECT)
      .eq("is_visible", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async listAll() {
    const { data, error } = await supabase
      .from("organizations")
      .select(ORG_SELECT)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async findById(id: number) {
    const { data, error } = await supabase
      .from("organizations")
      .select(ORG_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async findBySlug(slug: string) {
    const { data, error } = await supabase
      .from("organizations")
      .select(ORG_SELECT)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async listForUser(userId: string) {
    // Orgs where the user is an explicit member
    const { data: memberRows, error: memberError } = await supabase
      .from("org_members")
      .select(`org_id, org_role, organizations (${ORG_SELECT})`)
      .eq("user_id", userId);
    if (memberError) throw new Error(memberError.message);

    // Orgs where the user is the owner_user_id but may not have an org_members row
    const { data: ownedRows, error: ownedError } = await supabase
      .from("organizations")
      .select(ORG_SELECT)
      .eq("owner_user_id", userId);
    if (ownedError) throw new Error(ownedError.message);

    const seen = new Set<number>();
    const results: any[] = [];

    for (const row of memberRows ?? []) {
      const org = row.organizations as any;
      if (!org) continue;
      seen.add(org.id);
      results.push({ ...org, myRole: row.org_role });
    }

    for (const org of ownedRows ?? []) {
      if (seen.has(org.id)) continue;
      results.push({ ...org, myRole: "owner" });
    }

    return results;
  },

  async create(payload: InsertOrganization, ownerUserId: string) {
    const { data, error } = await supabase
      .from("organizations")
      .insert({ ...toSnakeCase(payload), owner_user_id: ownerUserId })
      .select(ORG_SELECT)
      .single();
    if (error) throw new Error(error.message);
    // Auto-add creator as owner in org_members
    await supabase.from("org_members").insert({
      org_id: data.id,
      user_id: ownerUserId,
      org_role: "owner",
    });
    return data;
  },

  async update(id: number, payload: UpdateOrganization) {
    const { data, error } = await supabase
      .from("organizations")
      .update(toSnakeCase(payload))
      .eq("id", id)
      .select(ORG_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async delete(id: number) {
    const { error } = await supabase.from("organizations").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async listLabsByOrg(orgId: number) {
    const { data, error } = await supabase
      .from("labs")
      .select(`
        id,
        name,
        lab_status,
        organization_id,
        lab_location (city, country),
        lab_profile (logo_url)
      `)
      .eq("organization_id", orgId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async addMember(orgId: number, userId: string, orgRole: OrgMemberRole = "member") {
    const { data, error } = await supabase
      .from("org_members")
      .upsert({ org_id: orgId, user_id: userId, org_role: orgRole }, { onConflict: "org_id,user_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async removeMember(orgId: number, userId: string) {
    const { error } = await supabase
      .from("org_members")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  },

  async setLabOrg(labId: number, orgId: number | null) {
    const { error } = await supabase
      .from("labs")
      .update({ organization_id: orgId })
      .eq("id", labId);
    if (error) throw new Error(error.message);
  },

  async isMemberOrOwner(orgId: number, userId: string): Promise<boolean> {
    const { data } = await supabase
      .from("organizations")
      .select("id, owner_user_id, org_members!inner(user_id)")
      .eq("id", orgId)
      .or(`owner_user_id.eq.${userId},org_members.user_id.eq.${userId}`)
      .maybeSingle();
    return !!data;
  },

  async isManagerOrOwner(orgId: number, userId: string): Promise<boolean> {
    const org = await this.findById(orgId);
    if (!org) return false;
    if ((org as any).owner_user_id === userId) return true;
    const member = ((org as any).org_members ?? []).find(
      (m: any) => m.user_id === userId && (m.org_role === "manager" || m.org_role === "owner"),
    );
    return !!member;
  },

  async isOwner(orgId: number, userId: string): Promise<boolean> {
    const org = await this.findById(orgId);
    return (org as any)?.owner_user_id === userId;
  },
};
