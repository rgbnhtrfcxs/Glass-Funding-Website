import {
  insertLabSchema,
  labListSchema,
  orgRoleOptions,
  labSchema,
  updateLabSchema,
  type InsertLab,
  type LabPartner,
  type MediaAsset,
  type PartnerLogo,
  type OfferOption,
  type UpdateLab,
} from "@shared/labs";
import { supabase } from "./supabaseClient";

const LAB_SELECT = `
  id,
  name,
  owner_user_id,
  created_at,
  is_visible,
  lab_status,
  audit_passed,
  audit_passed_at,
  org_role,
  lab_contacts (contact_email, website, linkedin, tags),
  lab_location (address_line1, address_line2, city, state, postal_code, country),
  lab_profile (lab_manager, siret_number, description_short, description_long, field, public, alternate_names, logo_url, hal_structure_id, hal_person_id),
  lab_settings (offers_lab_space),
  lab_partner_logos (name, url, website),
  lab_photos (name, url),
  lab_compliance_labels (label),
  lab_compliance_docs (name, url),
  lab_team_members (name, title, linkedin, website, is_lead, team_name, role_rank),
  lab_equipment (item, is_priority),
  lab_techniques (name, description),
  lab_focus_areas (focus_area),
  lab_offers (offer)
`;

type LabRow = {
  id: number;
  name: string;
  owner_user_id: string | null;
  created_at: string | null;
  is_visible: boolean | string | null;
  lab_status: string | null;
  audit_passed: boolean | string | null;
  audit_passed_at: string | null;
  org_role: string | null;
  lab_contacts: Array<{
    contact_email: string | null;
    website: string | null;
    linkedin: string | null;
    tags: string[] | null;
  }> | null;
  lab_location: Array<{
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
  }> | null;
  lab_profile: Array<{
    lab_manager: string | null;
    siret_number: string | null;
    description_short: string | null;
    description_long: string | null;
    field: string | null;
    public: boolean | string | null;
    alternate_names: string[] | null;
    logo_url: string | null;
    hal_structure_id: string | null;
    hal_person_id: string | null;
  }> | null;
  lab_settings: Array<{ offers_lab_space: boolean | string | null }> | null;
  lab_partner_logos: Array<{ name: string; url: string; website: string | null }> | null;
  lab_photos: Array<{ name: string; url: string }> | null;
  lab_compliance_labels: Array<{ label: string }> | null;
  lab_compliance_docs: Array<{ name: string; url: string }> | null;
  lab_team_members: Array<{
    name: string;
    title: string;
    linkedin: string | null;
    website: string | null;
    is_lead: boolean | string | null;
    team_name: string | null;
    role_rank: number | string | null;
  }> | null;
  lab_equipment: Array<{ item: string; is_priority: boolean | string | null }> | null;
  lab_techniques: Array<{ name: string; description: string | null }> | null;
  lab_focus_areas: Array<{ focus_area: string }> | null;
  lab_offers: Array<{ offer: OfferOption }> | null;
};

function parseBoolean(value: boolean | string | null | undefined, fallback = false): boolean {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = value.toString().toLowerCase();
  return normalized === "true" || normalized === "t" || normalized === "1";
}

function normalizeOrgRole(value?: string | null): LabPartner["orgRole"] {
  if (!value) return null;
  const normalized = value.trim();
  const legacyMap: Record<string, string> = {
    "Core Facility/Platform": "Core Facility / Platform",
    "CRO (Contract Research Organisation)": "CRO (Contract Research Organization)",
    "CDMO/CMO": "CDMO / CMO",
    "Clinical Site/Hospital Lab": "Clinical Site / Hospital Lab",
    "Testing/Certification Lab": "Testing / Certification Lab",
    "Bioinformatics/Data": "Bioinformatics / Data",
    "Regulatory/QA/ Consulting": "Regulatory / QA / Consulting",
    "Regulatory/QA/Consulting": "Regulatory / QA / Consulting",
  };
  const canonical = legacyMap[normalized] ?? normalized;
  return (orgRoleOptions as readonly string[]).includes(canonical)
    ? (canonical as LabPartner["orgRole"])
    : null;
}

function normalizeLabStatus(value?: string | null): LabPartner["labStatus"] {
  const raw = (value || "listed").toLowerCase();
  if (raw === "confirmed") return "confirmed";
  if (raw === "verified_passive") return "verified_passive";
  if (raw === "verified_active") return "verified_active";
  if (raw === "premier") return "premier";
  return "listed";
}

async function resolveOwnerUserId(explicit?: string | null): Promise<string | null> {
  // Security rule: contact email is for communication only, never ownership linkage.
  return explicit ?? null;
}

function mapLabRow(row: LabRow): LabPartner {
  const pickOne = <T>(value: T[] | T | null | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? null;
  const contactRow = pickOne(row.lab_contacts);
  const locationRow = pickOne(row.lab_location);
  const profileRow = pickOne(row.lab_profile);
  const settingsRow = pickOne(row.lab_settings);
  const photos = (row.lab_photos ?? []).filter(photo => (photo?.url || "").trim().length > 0).map(photo => ({
    name: photo.name,
    url: photo.url,
  }));
  const partnerLogos = (row.lab_partner_logos ?? [])
    .filter(logo => (logo?.url || "").trim().length > 0)
    .map(logo => ({
      name: logo.name,
      url: logo.url,
      website: logo.website ?? null,
    }));
  const equipmentRows = row.lab_equipment ?? [];
  const equipment = equipmentRows.map(item => item.item).filter(Boolean);
  const priorityEquipment = equipmentRows
    .filter(item => parseBoolean(item.is_priority, false))
    .map(item => item.item)
    .filter(Boolean);
  const mapped = {
    id: Number(row.id),
    name: row.name,
    labManager: (profileRow?.lab_manager ?? "").trim(),
    contactEmail: (contactRow?.contact_email ?? "").trim(),
    ownerUserId: row.owner_user_id || null,
    siretNumber: profileRow?.siret_number || null,
    logoUrl: profileRow?.logo_url || null,
    descriptionShort: profileRow?.description_short || null,
    descriptionLong: profileRow?.description_long || null,
    orgRole: normalizeOrgRole(row.org_role),
    offersLabSpace: parseBoolean(settingsRow?.offers_lab_space, false),
    addressLine1: locationRow?.address_line1 || null,
    addressLine2: locationRow?.address_line2 || null,
    city: locationRow?.city || null,
    state: locationRow?.state || null,
    postalCode: locationRow?.postal_code || null,
    country: locationRow?.country || null,
    website: contactRow?.website || null,
    linkedin: contactRow?.linkedin || null,
    partnerLogos,
    compliance: (row.lab_compliance_labels ?? []).map(item => item.label),
    complianceDocs: (row.lab_compliance_docs ?? []).map(doc => ({ name: doc.name, url: doc.url })),
    halStructureId: profileRow?.hal_structure_id || null,
    halPersonId: profileRow?.hal_person_id || null,
    teamMembers: (row.lab_team_members ?? [])
      .map(member => ({
        name: member.name,
        title: member.title,
        linkedin: member.linkedin || null,
        website: member.website || null,
        teamName: member.team_name || null,
        roleRank: member.role_rank === null || member.role_rank === undefined
          ? null
          : (() => {
              const value = typeof member.role_rank === "number" ? member.role_rank : Number(member.role_rank);
              return Number.isNaN(value) ? null : value;
            })(),
        isLead: parseBoolean(member.is_lead, false),
      }))
      .sort((a, b) => {
        if (a.isLead !== b.isLead) return Number(b.isLead) - Number(a.isLead);
        const rankA = a.roleRank ?? 999;
        const rankB = b.roleRank ?? 999;
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name);
      }),
    auditPassed: parseBoolean(row.audit_passed, false),
    auditPassedAt: row.audit_passed_at || null,
    labStatus: normalizeLabStatus(row.lab_status),
    isVisible: parseBoolean(row.is_visible, true),
    equipment,
    priorityEquipment,
    techniques: (row.lab_techniques ?? []).map(item => ({
      name: item.name,
      description: item.description ?? null,
    })),
    focusAreas: (row.lab_focus_areas ?? []).map(item => item.focus_area),
    offers: (row.lab_offers ?? []).map(item => item.offer),
    field: profileRow?.field || null,
    public: parseBoolean(profileRow?.public, false),
    alternateNames: profileRow?.alternate_names ?? [],
    tags: contactRow?.tags ?? [],
    photos,
  };
  return labSchema.parse(mapped);
}

async function replaceLabPhotos(labId: number, photos: MediaAsset[]) {
  const del = await supabase.from("lab_photos").delete().eq("lab_id", labId);
  if (del.error) throw del.error;
  if (!photos.length) return;
  const ins = await supabase
    .from("lab_photos")
    .insert(photos.map(p => ({ lab_id: labId, name: p.name, url: p.url })));
  if (ins.error) throw ins.error;
}

async function replaceLabComplianceLabels(labId: number, labels: string[]) {
  const del = await supabase.from("lab_compliance_labels").delete().eq("lab_id", labId);
  if (del.error) throw del.error;
  if (!labels.length) return;
  const ins = await supabase
    .from("lab_compliance_labels")
    .insert(labels.map(label => ({ lab_id: labId, label })));
  if (ins.error) throw ins.error;
}

async function replaceLabComplianceDocs(labId: number, docs: MediaAsset[]) {
  const del = await supabase.from("lab_compliance_docs").delete().eq("lab_id", labId);
  if (del.error) throw del.error;
  if (!docs.length) return;
  const ins = await supabase
    .from("lab_compliance_docs")
    .insert(docs.map(doc => ({ lab_id: labId, name: doc.name, url: doc.url })));
  if (ins.error) throw ins.error;
}

async function replaceLabTeamMembers(labId: number, members: Array<{
  name: string;
  title: string;
  linkedin?: string | null;
  website?: string | null;
  teamName?: string | null;
  roleRank?: number | null;
  isLead?: boolean | null;
}>) {
  const del = await supabase.from("lab_team_members").delete().eq("lab_id", labId);
  if (del.error) throw del.error;
  if (!members.length) return;
  const ins = await supabase.from("lab_team_members").insert(
    members.map(member => ({
      lab_id: labId,
      name: member.name,
      title: member.title,
      linkedin: member.linkedin ?? null,
      website: member.website ?? null,
      team_name: member.teamName ?? null,
      role_rank: member.roleRank ?? null,
      is_lead: member.isLead ?? false,
    })),
  );
  if (ins.error) throw ins.error;
}

async function replaceLabEquipment(labId: number, equipment: string[], priorityEquipment: string[] = []) {
  const del = await supabase.from("lab_equipment").delete().eq("lab_id", labId);
  if (del.error) throw del.error;
  if (!equipment.length) return;
  const prioritySet = new Set(priorityEquipment);
  const ins = await supabase
    .from("lab_equipment")
    .insert(equipment.map(item => ({ lab_id: labId, item, is_priority: prioritySet.has(item) })));
  if (ins.error) throw ins.error;
}

async function replaceLabTechniques(labId: number, techniques: InsertLab["techniques"]) {
  const del = await supabase.from("lab_techniques").delete().eq("lab_id", labId);
  if (del.error) throw del.error;
  if (!techniques.length) return;
  const ins = await supabase.from("lab_techniques").insert(
    techniques.map(technique => ({
      lab_id: labId,
      name: technique.name,
      description: technique.description ?? null,
    })),
  );
  if (ins.error) throw ins.error;
}

async function replaceLabFocusAreas(labId: number, areas: string[]) {
  const del = await supabase.from("lab_focus_areas").delete().eq("lab_id", labId);
  if (del.error) throw del.error;
  if (!areas.length) return;
  const ins = await supabase
    .from("lab_focus_areas")
    .insert(areas.map(area => ({ lab_id: labId, focus_area: area })));
  if (ins.error) throw ins.error;
}

async function replaceLabOffers(labId: number, offers: OfferOption[]) {
  const del = await supabase.from("lab_offers").delete().eq("lab_id", labId);
  if (del.error) throw del.error;
  if (!offers.length) return;
  const ins = await supabase.from("lab_offers").insert(offers.map(offer => ({ lab_id: labId, offer })));
  if (ins.error) throw ins.error;
}

async function replaceLabPartnerLogos(labId: number, logos: PartnerLogo[]) {
  const del = await supabase.from("lab_partner_logos").delete().eq("lab_id", labId);
  if (del.error) throw del.error;
  if (!logos.length) return;
  const ins = await supabase
    .from("lab_partner_logos")
    .insert(
      logos.map(logo => ({
        lab_id: labId,
        name: logo.name,
        url: logo.url,
        website: logo.website ?? null,
      })),
    );
  if (ins.error) throw ins.error;
}

async function upsertLabContacts(labId: number, data: {
  contactEmail: string | null;
  website: string | null;
  linkedin: string | null;
  tags: string[];
}) {
  const { error } = await supabase
    .from("lab_contacts")
    .upsert(
      {
        lab_id: labId,
        contact_email: data.contactEmail ?? null,
        website: data.website ?? null,
        linkedin: data.linkedin ?? null,
        tags: data.tags ?? [],
      },
      { onConflict: "lab_id" },
    );
  if (error) throw error;
}

async function upsertLabLocation(labId: number, data: {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}) {
  const { error } = await supabase
    .from("lab_location")
    .upsert(
      {
        lab_id: labId,
        address_line1: data.addressLine1 ?? null,
        address_line2: data.addressLine2 ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        postal_code: data.postalCode ?? null,
        country: data.country ?? null,
      },
      { onConflict: "lab_id" },
    );
  if (error) throw error;
}

async function upsertLabProfile(labId: number, data: {
  labManager: string | null;
  siretNumber: string | null;
  descriptionShort: string | null;
  descriptionLong: string | null;
  field: string | null;
  public: boolean | null;
  alternateNames: string[];
  logoUrl: string | null;
  halStructureId: string | null;
  halPersonId: string | null;
}) {
  const { error } = await supabase
    .from("lab_profile")
    .upsert(
      {
        lab_id: labId,
        lab_manager: data.labManager ?? null,
        siret_number: data.siretNumber ?? null,
        description_short: data.descriptionShort ?? null,
        description_long: data.descriptionLong ?? null,
        field: data.field ?? null,
        public: data.public ?? null,
        alternate_names: data.alternateNames ?? [],
        logo_url: data.logoUrl ?? null,
        hal_structure_id: data.halStructureId ?? null,
        hal_person_id: data.halPersonId ?? null,
      },
      { onConflict: "lab_id" },
    );
  if (error) throw error;
}

async function upsertLabSettings(labId: number, data: { offersLabSpace: boolean | null }) {
  const { error } = await supabase
    .from("lab_settings")
    .upsert(
      {
        lab_id: labId,
        offers_lab_space: data.offersLabSpace ?? null,
      },
      { onConflict: "lab_id" },
    );
  if (error) throw error;
}

async function writeLabRelations(labId: number, lab: InsertLab | LabPartner) {
  await replaceLabPhotos(labId, lab.photos);
  await replaceLabPartnerLogos(labId, (lab as any).partnerLogos ?? []);
  await replaceLabComplianceLabels(labId, lab.compliance);
  await replaceLabComplianceDocs(labId, lab.complianceDocs);
  await replaceLabTeamMembers(labId, (lab as any).teamMembers ?? []);
  await replaceLabEquipment(labId, lab.equipment, (lab as any).priorityEquipment ?? []);
  await replaceLabTechniques(labId, (lab as any).techniques ?? []);
  await replaceLabFocusAreas(labId, lab.focusAreas);
  await replaceLabOffers(labId, lab.offers);
}

export class LabStore {
  async list(): Promise<LabPartner[]> {
    const { data, error } = await supabase.from("labs").select(LAB_SELECT).order("id", { ascending: true });
    if (error) throw error;
    const labs = (data as LabRow[] | null) ?? [];
    const mapped: LabPartner[] = [];
    for (const row of labs) {
      try {
        mapped.push(mapLabRow(row));
      } catch (err) {
        console.warn("[labs-store] Skipping lab with invalid data", { id: row.id, name: row.name, error: err });
      }
    }
    return labListSchema.parse(mapped);
  }

  async listVisible(): Promise<LabPartner[]> {
    const { data, error } = await supabase
      .from("labs")
      .select(LAB_SELECT)
      .eq("is_visible", true)
      .order("id", { ascending: true });
    if (error) throw error;
    const labs = (data as LabRow[] | null) ?? [];
    const mapped: LabPartner[] = [];
    for (const row of labs) {
      try {
        mapped.push(mapLabRow(row));
      } catch (err) {
        console.warn("[labs-store] Skipping lab with invalid data", { id: row.id, name: row.name, error: err });
      }
    }
    return labListSchema.parse(mapped);
  }

  async findById(id: number): Promise<LabPartner | undefined> {
    const { data, error } = await supabase.from("labs").select(LAB_SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    const row = data as LabRow;
    return mapLabRow(row);
  }

  async create(payload: InsertLab): Promise<LabPartner> {
    const data = insertLabSchema.parse(payload);
    const ownerUserId = await resolveOwnerUserId(data.ownerUserId ?? null);
    const auditPassed = Boolean(data.auditPassed);
    const auditPassedAt = auditPassed ? (data.auditPassedAt ?? new Date().toISOString()) : null;
    const initialStatus = data.labStatus ?? "listed";
    const labStatus = ownerUserId && initialStatus === "listed" ? "confirmed" : initialStatus;
    const { data: inserted, error } = await supabase
      .from("labs")
      .insert({
        name: data.name,
        owner_user_id: ownerUserId,
        lab_status: labStatus,
        audit_passed: auditPassed,
        audit_passed_at: auditPassedAt,
        is_visible: data.isVisible,
        org_role: normalizeOrgRole(data.orgRole ?? null),
      })
      .select("id")
      .single();

    if (error || !inserted) {
      throw error ?? new Error("Failed to insert lab");
    }

    const labId = Number(inserted.id);
    await upsertLabContacts(labId, {
      contactEmail: data.contactEmail ?? null,
      website: data.website ?? null,
      linkedin: data.linkedin ?? null,
      tags: data.tags ?? [],
    });
    await upsertLabLocation(labId, {
      addressLine1: data.addressLine1 ?? null,
      addressLine2: data.addressLine2 ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      postalCode: data.postalCode ?? null,
      country: data.country ?? null,
    });
    await upsertLabProfile(labId, {
      labManager: data.labManager ?? null,
      siretNumber: data.siretNumber ?? null,
      descriptionShort: data.descriptionShort ?? null,
      descriptionLong: data.descriptionLong ?? null,
      field: data.field ?? null,
      public: data.public ?? null,
      alternateNames: data.alternateNames ?? [],
      logoUrl: data.logoUrl ?? null,
      halStructureId: data.halStructureId ?? null,
      halPersonId: data.halPersonId ?? null,
    });
    await upsertLabSettings(labId, { offersLabSpace: data.offersLabSpace ?? true });
    await writeLabRelations(labId, data);
    const lab = await this.findById(labId);
    if (!lab) throw new Error("Lab not found after creation");
    return lab;
  }

  async update(id: number, updates: UpdateLab): Promise<LabPartner> {
    const existing = await this.findById(id);
    if (!existing) throw new Error("Lab not found");

    const parsed = updateLabSchema.parse(updates);
    const has = (key: keyof UpdateLab) => Object.prototype.hasOwnProperty.call(updates, key);
    const requestedOwner = has("ownerUserId") ? parsed.ownerUserId ?? null : existing.ownerUserId ?? null;
    const ownerUserId = await resolveOwnerUserId(requestedOwner ?? null);
    const auditPassed = has("auditPassed") ? Boolean(parsed.auditPassed) : existing.auditPassed;
    let auditPassedAt = existing.auditPassedAt ?? null;
    if (has("auditPassedAt")) {
      auditPassedAt = parsed.auditPassedAt ?? null;
    } else if (has("auditPassed")) {
      auditPassedAt = auditPassed ? (existing.auditPassedAt ?? new Date().toISOString()) : null;
    }

    const baseUpdates: Record<string, unknown> = {};
    if (has("name")) baseUpdates.name = parsed.name;
    if (has("ownerUserId") || has("contactEmail")) baseUpdates.owner_user_id = ownerUserId ?? null;
    if (has("labStatus")) baseUpdates.lab_status = parsed.labStatus ?? "listed";
    if (has("orgRole")) baseUpdates.org_role = normalizeOrgRole(parsed.orgRole ?? null);
    if (has("isVisible")) baseUpdates.is_visible = parsed.isVisible;
    if (has("auditPassed") || has("auditPassedAt")) {
      baseUpdates.audit_passed = auditPassed;
      baseUpdates.audit_passed_at = auditPassedAt;
    }

    if (Object.keys(baseUpdates).length) {
      const upd = await supabase.from("labs").update(baseUpdates).eq("id", id).select("id").single();
      if (upd.error) throw upd.error;
    }

    if (has("contactEmail") || has("website") || has("linkedin") || has("tags")) {
      await upsertLabContacts(id, {
        contactEmail: has("contactEmail") ? parsed.contactEmail ?? null : existing.contactEmail ?? null,
        website: has("website") ? parsed.website ?? null : existing.website ?? null,
        linkedin: has("linkedin") ? parsed.linkedin ?? null : existing.linkedin ?? null,
        tags: has("tags") ? parsed.tags ?? [] : existing.tags ?? [],
      });
    }

    if (
      has("addressLine1") ||
      has("addressLine2") ||
      has("city") ||
      has("state") ||
      has("postalCode") ||
      has("country")
    ) {
      await upsertLabLocation(id, {
        addressLine1: has("addressLine1") ? parsed.addressLine1 ?? null : existing.addressLine1 ?? null,
        addressLine2: has("addressLine2") ? parsed.addressLine2 ?? null : existing.addressLine2 ?? null,
        city: has("city") ? parsed.city ?? null : existing.city ?? null,
        state: has("state") ? parsed.state ?? null : existing.state ?? null,
        postalCode: has("postalCode") ? parsed.postalCode ?? null : existing.postalCode ?? null,
        country: has("country") ? parsed.country ?? null : existing.country ?? null,
      });
    }

    if (
      has("labManager") ||
      has("siretNumber") ||
      has("descriptionShort") ||
      has("descriptionLong") ||
      has("field") ||
      has("public") ||
      has("alternateNames") ||
      has("logoUrl") ||
      has("halStructureId") ||
      has("halPersonId")
    ) {
      await upsertLabProfile(id, {
        labManager: has("labManager") ? parsed.labManager ?? null : existing.labManager ?? null,
        siretNumber: has("siretNumber") ? parsed.siretNumber ?? null : existing.siretNumber ?? null,
        descriptionShort: has("descriptionShort") ? parsed.descriptionShort ?? null : existing.descriptionShort ?? null,
        descriptionLong: has("descriptionLong") ? parsed.descriptionLong ?? null : existing.descriptionLong ?? null,
        field: has("field") ? parsed.field ?? null : existing.field ?? null,
        public: has("public") ? parsed.public ?? null : existing.public ?? null,
        alternateNames: has("alternateNames") ? parsed.alternateNames ?? [] : existing.alternateNames ?? [],
        logoUrl: has("logoUrl") ? parsed.logoUrl ?? null : existing.logoUrl ?? null,
        halStructureId: has("halStructureId") ? parsed.halStructureId ?? null : existing.halStructureId ?? null,
        halPersonId: has("halPersonId") ? parsed.halPersonId ?? null : existing.halPersonId ?? null,
      });
    }

    if (has("offersLabSpace")) {
      await upsertLabSettings(id, { offersLabSpace: parsed.offersLabSpace ?? true });
    }

    if (Object.prototype.hasOwnProperty.call(updates, "photos")) await replaceLabPhotos(id, parsed.photos ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "compliance")) await replaceLabComplianceLabels(id, parsed.compliance ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "complianceDocs")) await replaceLabComplianceDocs(id, parsed.complianceDocs ?? []);
    if (
      Object.prototype.hasOwnProperty.call(updates, "equipment") ||
      Object.prototype.hasOwnProperty.call(updates, "priorityEquipment")
    ) {
      const equipment = Object.prototype.hasOwnProperty.call(updates, "equipment")
        ? parsed.equipment ?? []
        : existing.equipment ?? [];
      const priority = Object.prototype.hasOwnProperty.call(updates, "priorityEquipment")
        ? parsed.priorityEquipment ?? []
        : existing.priorityEquipment ?? [];
      await replaceLabEquipment(id, equipment, priority);
    }
    if (Object.prototype.hasOwnProperty.call(updates, "techniques")) {
      await replaceLabTechniques(id, parsed.techniques ?? []);
    }
    if (Object.prototype.hasOwnProperty.call(updates, "focusAreas")) await replaceLabFocusAreas(id, parsed.focusAreas ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "offers")) await replaceLabOffers(id, parsed.offers ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "partnerLogos"))
      await replaceLabPartnerLogos(id, (parsed as any).partnerLogos ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "teamMembers"))
      await replaceLabTeamMembers(id, (parsed as any).teamMembers ?? []);

    const updated = await this.findById(id);
    if (!updated) throw new Error("Lab not found after update");
    return updated;
  }

  async delete(id: number): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) throw new Error("Lab not found");
    const { error } = await supabase.from("labs").delete().eq("id", id);
    if (error) throw error;
  }
}

export const labStore = new LabStore();
