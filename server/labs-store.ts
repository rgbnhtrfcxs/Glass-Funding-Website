import {
  insertLabSchema,
  labListSchema,
  labSchema,
  updateLabSchema,
  type InsertLab,
  type LabPartner,
  type MediaAsset,
  type OfferOption,
  type UpdateLab,
} from "@shared/labs";
import { supabase } from "./supabaseClient";

const LAB_SELECT = `
  id,
  name,
  lab_manager,
  contact_email,
  owner_user_id,
  siret_number,
  logo_url,
  description_short,
  description_long,
  field,
  offers_lab_space,
  address_line1,
  address_line2,
  city,
  state,
  postal_code,
  country,
  website,
  linkedin,
  lab_partner_logos (name, url),
  is_verified,
  is_visible,
  price_privacy,
  minimum_stay,
  rating,
  subscription_tier,
  lab_photos (name, url),
  lab_compliance_labels (label),
  lab_compliance_docs (name, url),
  lab_publications (title, url),
  lab_patents (title, url),
  hal_structure_id,
  hal_person_id,
  lab_equipment (item),
  lab_focus_areas (focus_area),
  lab_offers (offer)
`;

type LabRow = {
  id: number;
  name: string;
  lab_manager: string;
  contact_email: string;
  owner_user_id: string | null;
  siret_number: string | null;
  logo_url: string | null;
  description_short: string | null;
  description_long: string | null;
  offers_lab_space: boolean | string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  website: string | null;
  linkedin: string | null;
  lab_partner_logos: Array<{ name: string; url: string }> | null;
  is_verified: boolean | string | null;
  is_visible: boolean | string | null;
  price_privacy: boolean;
  minimum_stay: string | null;
  rating: number | string | null;
  subscription_tier: string | null;
  lab_photos: Array<{ name: string; url: string }> | null;
  lab_compliance_labels: Array<{ label: string }> | null;
  lab_compliance_docs: Array<{ name: string; url: string }> | null;
  lab_publications: Array<{ title: string; url: string }> | null;
  lab_patents: Array<{ title: string; url: string }> | null;
  hal_structure_id: string | null;
  hal_person_id: string | null;
  lab_equipment: Array<{ item: string }> | null;
  lab_focus_areas: Array<{ focus_area: string }> | null;
  lab_offers: Array<{ offer: OfferOption }> | null;
  field: string | null;
};

const normalizeTier = (tier?: string | null): LabPartner["subscriptionTier"] => {
  const raw = (tier || "base").toLowerCase();
  if (raw === "premier") return "premier";
  if (raw === "verified") return "verified";
  if (raw === "custom") return "verified";
  return "base";
};

function parseBoolean(value: boolean | string | null | undefined, fallback = false): boolean {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = value.toString().toLowerCase();
  return normalized === "true" || normalized === "t" || normalized === "1";
}

function parseRating(value: LabRow["rating"]): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

async function fetchProfileRole(userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data, error } = await supabase.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (error) return null;
  return typeof data?.role === "string" ? data.role.toLowerCase() : null;
}

async function resolveOwnerUserId(contactEmail: string | null | undefined, explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit;
  if (!contactEmail) return null;
  const email = contactEmail.trim().toLowerCase();
  if (!email) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("email", email)
    .maybeSingle();
  if (error) return null;
  return data?.user_id ?? null;
}

function mapLabRow(row: LabRow): LabPartner {
  const photos = (row.lab_photos ?? []).filter(photo => (photo?.url || "").trim().length > 0).map(photo => ({
    name: photo.name,
    url: photo.url,
  }));
  const partnerLogos = (row.lab_partner_logos ?? [])
    .filter(logo => (logo?.url || "").trim().length > 0)
    .map(logo => ({ name: logo.name, url: logo.url }));
  const mapped = {
    id: Number(row.id),
    name: row.name,
    labManager: row.lab_manager,
    contactEmail: (row.contact_email ?? "").trim(),
    ownerUserId: row.owner_user_id || null,
    siretNumber: row.siret_number || null,
    logoUrl: row.logo_url || null,
    descriptionShort: row.description_short || null,
    descriptionLong: row.description_long || null,
    offersLabSpace: parseBoolean(row.offers_lab_space, false),
    addressLine1: row.address_line1 || null,
    addressLine2: row.address_line2 || null,
    city: row.city || null,
    state: row.state || null,
    postalCode: row.postal_code || null,
    country: row.country || null,
    website: row.website || null,
    linkedin: row.linkedin || null,
    partnerLogos,
    compliance: (row.lab_compliance_labels ?? []).map(item => item.label),
    complianceDocs: (row.lab_compliance_docs ?? []).map(doc => ({ name: doc.name, url: doc.url })),
    publications: (row.lab_publications ?? []).map(item => ({ title: item.title, url: item.url })),
    patents: (row.lab_patents ?? []).map(item => ({ title: item.title, url: item.url })),
    halStructureId: row.hal_structure_id || null,
    halPersonId: row.hal_person_id || null,
    isVerified: parseBoolean(row.is_verified),
    isVisible: parseBoolean(row.is_visible, true),
    equipment: (row.lab_equipment ?? []).map(item => item.item),
    focusAreas: (row.lab_focus_areas ?? []).map(item => item.focus_area),
    offers: (row.lab_offers ?? []).map(item => item.offer),
    pricePrivacy: Boolean(row.price_privacy),
    minimumStay: row.minimum_stay ?? "",
    rating: parseRating(row.rating),
    subscriptionTier: normalizeTier(row.subscription_tier as string | null),
    field: row.field || null,
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

async function replaceLabPublications(labId: number, items: Array<{ title: string; url: string }>) {
  const del = await supabase.from("lab_publications").delete().eq("lab_id", labId);
  if (del.error) throw del.error;
  if (!items.length) return;
  const ins = await supabase
    .from("lab_publications")
    .insert(items.map(item => ({ lab_id: labId, title: item.title, url: item.url })));
  if (ins.error) throw ins.error;
}

async function replaceLabPatents(labId: number, items: Array<{ title: string; url: string }>) {
  const del = await supabase.from("lab_patents").delete().eq("lab_id", labId);
  if (del.error) throw del.error;
  if (!items.length) return;
  const ins = await supabase
    .from("lab_patents")
    .insert(items.map(item => ({ lab_id: labId, title: item.title, url: item.url })));
  if (ins.error) throw ins.error;
}

async function replaceLabEquipment(labId: number, equipment: string[]) {
  const del = await supabase.from("lab_equipment").delete().eq("lab_id", labId);
  if (del.error) throw del.error;
  if (!equipment.length) return;
  const ins = await supabase
    .from("lab_equipment")
    .insert(equipment.map(item => ({ lab_id: labId, item })));
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

async function replaceLabPartnerLogos(labId: number, logos: MediaAsset[]) {
  const del = await supabase.from("lab_partner_logos").delete().eq("lab_id", labId);
  if (del.error) throw del.error;
  if (!logos.length) return;
  const ins = await supabase
    .from("lab_partner_logos")
    .insert(logos.map(logo => ({ lab_id: labId, name: logo.name, url: logo.url })));
  if (ins.error) throw ins.error;
}

async function writeLabRelations(labId: number, lab: InsertLab | LabPartner) {
  await replaceLabPhotos(labId, lab.photos);
  await replaceLabPartnerLogos(labId, (lab as any).partnerLogos ?? []);
  await replaceLabComplianceLabels(labId, lab.compliance);
  await replaceLabComplianceDocs(labId, lab.complianceDocs);
  await replaceLabPublications(labId, (lab as any).publications ?? []);
  await replaceLabPatents(labId, (lab as any).patents ?? []);
  await replaceLabEquipment(labId, lab.equipment);
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
    const ownerUserId = await resolveOwnerUserId(data.contactEmail, data.ownerUserId ?? null);
    const ownerRole = await fetchProfileRole(ownerUserId);
    const subscriptionTier = ownerRole === "multi-lab"
      ? "verified"
      : normalizeTier(data.subscriptionTier ?? "base");
    const { data: inserted, error } = await supabase
      .from("labs")
      .insert({
        name: data.name,
        lab_manager: data.labManager,
        contact_email: data.contactEmail,
        owner_user_id: ownerUserId,
        siret_number: data.siretNumber ?? null,
        logo_url: data.logoUrl ?? null,
        description_short: data.descriptionShort ?? null,
        description_long: data.descriptionLong ?? null,
        offers_lab_space: data.offersLabSpace ?? true,
        address_line1: data.addressLine1 ?? null,
        address_line2: data.addressLine2 ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        postal_code: data.postalCode ?? null,
        country: data.country ?? null,
        website: data.website ?? null,
        linkedin: data.linkedin ?? null,
        field: data.field ?? null,
        hal_structure_id: data.halStructureId ?? null,
        hal_person_id: data.halPersonId ?? null,
        is_verified: data.isVerified,
        is_visible: data.isVisible,
        price_privacy: data.pricePrivacy,
        minimum_stay: data.minimumStay ?? "",
        rating: data.rating ?? 0,
        subscription_tier: subscriptionTier,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      throw error ?? new Error("Failed to insert lab");
    }

    const labId = Number(inserted.id);
    await writeLabRelations(labId, data);
    const lab = await this.findById(labId);
    if (!lab) throw new Error("Lab not found after creation");
    return lab;
  }

  async update(id: number, updates: UpdateLab): Promise<LabPartner> {
    const existing = await this.findById(id);
    if (!existing) throw new Error("Lab not found");

    const parsed = updateLabSchema.parse(updates);
    const nextContactEmail = Object.prototype.hasOwnProperty.call(updates, "contactEmail")
      ? parsed.contactEmail ?? existing.contactEmail
      : existing.contactEmail;
    const requestedOwner = Object.prototype.hasOwnProperty.call(updates, "ownerUserId")
      ? parsed.ownerUserId ?? null
      : existing.ownerUserId ?? null;
    const ownerUserId = await resolveOwnerUserId(nextContactEmail, requestedOwner ?? existing.ownerUserId ?? null);
    const ownerRole = await fetchProfileRole(ownerUserId);
    const subscriptionTier = normalizeTier(
      ownerRole === "multi-lab"
        ? "verified"
        : Object.prototype.hasOwnProperty.call(updates, "subscriptionTier")
          ? (updates as any).subscriptionTier
          : existing.subscriptionTier,
    );
    const baseUpdates: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(updates, "name")) baseUpdates.name = parsed.name;
    if (Object.prototype.hasOwnProperty.call(updates, "labManager")) baseUpdates.lab_manager = parsed.labManager;
    if (Object.prototype.hasOwnProperty.call(updates, "contactEmail")) baseUpdates.contact_email = parsed.contactEmail;
    baseUpdates.owner_user_id = ownerUserId ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "siretNumber")) baseUpdates.siret_number = parsed.siretNumber ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "logoUrl")) baseUpdates.logo_url = parsed.logoUrl ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "descriptionShort")) baseUpdates.description_short = parsed.descriptionShort ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "descriptionLong")) baseUpdates.description_long = parsed.descriptionLong ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "halStructureId")) baseUpdates.hal_structure_id = parsed.halStructureId ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "halPersonId")) baseUpdates.hal_person_id = parsed.halPersonId ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "offersLabSpace"))
      baseUpdates.offers_lab_space = parsed.offersLabSpace ?? true;
    if (Object.prototype.hasOwnProperty.call(updates, "addressLine1")) baseUpdates.address_line1 = parsed.addressLine1 ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "addressLine2")) baseUpdates.address_line2 = parsed.addressLine2 ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "city")) baseUpdates.city = parsed.city ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "state")) baseUpdates.state = parsed.state ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "postalCode")) baseUpdates.postal_code = parsed.postalCode ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "country")) baseUpdates.country = parsed.country ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "website")) baseUpdates.website = parsed.website ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "linkedin")) baseUpdates.linkedin = parsed.linkedin ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "field")) baseUpdates.field = parsed.field ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "isVerified")) baseUpdates.is_verified = parsed.isVerified;
    if (Object.prototype.hasOwnProperty.call(updates, "isVisible")) baseUpdates.is_visible = parsed.isVisible;
    if (Object.prototype.hasOwnProperty.call(updates, "pricePrivacy")) baseUpdates.price_privacy = parsed.pricePrivacy;
    if (Object.prototype.hasOwnProperty.call(updates, "minimumStay")) baseUpdates.minimum_stay = parsed.minimumStay ?? "";
    if (Object.prototype.hasOwnProperty.call(updates, "rating")) baseUpdates.rating = parsed.rating ?? 0;
    // Always sync tier from the profile so lab rows mirror profile subscription
    baseUpdates.subscription_tier = subscriptionTier;

    if (Object.keys(baseUpdates).length) {
      const upd = await supabase.from("labs").update(baseUpdates).eq("id", id).select("id").single();
      if (upd.error) throw upd.error;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "photos")) await replaceLabPhotos(id, parsed.photos ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "compliance")) await replaceLabComplianceLabels(id, parsed.compliance ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "complianceDocs")) await replaceLabComplianceDocs(id, parsed.complianceDocs ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "publications"))
      await replaceLabPublications(id, (parsed as any).publications ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "patents"))
      await replaceLabPatents(id, (parsed as any).patents ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "equipment")) await replaceLabEquipment(id, parsed.equipment ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "focusAreas")) await replaceLabFocusAreas(id, parsed.focusAreas ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "offers")) await replaceLabOffers(id, parsed.offers ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "partnerLogos"))
      await replaceLabPartnerLogos(id, (parsed as any).partnerLogos ?? []);

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
