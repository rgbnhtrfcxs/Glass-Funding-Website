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
  location,
  lab_manager,
  contact_email,
  is_verified,
  is_visible,
  price_privacy,
  minimum_stay,
  rating,
  subscription_tier,
  lab_photos (name, url),
  lab_compliance_labels (label),
  lab_compliance_docs (name, url),
  lab_equipment (item),
  lab_focus_areas (focus_area),
  lab_offers (offer)
`;

type LabRow = {
  id: number;
  name: string;
  location: string;
  lab_manager: string;
  contact_email: string;
  is_verified: boolean | string | null;
  is_visible: boolean | string | null;
  price_privacy: boolean;
  minimum_stay: string | null;
  rating: number | string | null;
  subscription_tier: string | null;
  lab_photos: Array<{ name: string; url: string }> | null;
  lab_compliance_labels: Array<{ label: string }> | null;
  lab_compliance_docs: Array<{ name: string; url: string }> | null;
  lab_equipment: Array<{ item: string }> | null;
  lab_focus_areas: Array<{ focus_area: string }> | null;
  lab_offers: Array<{ offer: OfferOption }> | null;
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

function mapLabRow(row: LabRow): LabPartner {
  const mapped = {
    id: Number(row.id),
    name: row.name,
    location: row.location,
    labManager: row.lab_manager,
    contactEmail: row.contact_email,
    compliance: (row.lab_compliance_labels ?? []).map(item => item.label),
    complianceDocs: (row.lab_compliance_docs ?? []).map(doc => ({ name: doc.name, url: doc.url })),
    isVerified: parseBoolean(row.is_verified),
    isVisible: parseBoolean(row.is_visible, true),
    equipment: (row.lab_equipment ?? []).map(item => item.item),
    focusAreas: (row.lab_focus_areas ?? []).map(item => item.focus_area),
    offers: (row.lab_offers ?? []).map(item => item.offer),
    pricePrivacy: Boolean(row.price_privacy),
    minimumStay: row.minimum_stay ?? "",
    rating: parseRating(row.rating),
    subscriptionTier: (row.subscription_tier as LabPartner["subscriptionTier"]) ?? "base",
    photos: (row.lab_photos ?? []).map(photo => ({ name: photo.name, url: photo.url })),
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

async function writeLabRelations(labId: number, lab: InsertLab | LabPartner) {
  await replaceLabPhotos(labId, lab.photos);
  await replaceLabComplianceLabels(labId, lab.compliance);
  await replaceLabComplianceDocs(labId, lab.complianceDocs);
  await replaceLabEquipment(labId, lab.equipment);
  await replaceLabFocusAreas(labId, lab.focusAreas);
  await replaceLabOffers(labId, lab.offers);
}

export class LabStore {
  async list(): Promise<LabPartner[]> {
    const { data, error } = await supabase.from("labs").select(LAB_SELECT).order("id", { ascending: true });
    if (error) throw error;
    const labs = (data as LabRow[] | null) ?? [];
    return labListSchema.parse(labs.map(mapLabRow));
  }

  async findById(id: number): Promise<LabPartner | undefined> {
    const { data, error } = await supabase.from("labs").select(LAB_SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return mapLabRow(data as LabRow);
  }

  async create(payload: InsertLab): Promise<LabPartner> {
    const data = insertLabSchema.parse(payload);
    const { data: inserted, error } = await supabase
      .from("labs")
      .insert({
        name: data.name,
        location: data.location,
        lab_manager: data.labManager,
        contact_email: data.contactEmail,
        is_verified: data.isVerified,
        is_visible: data.isVisible,
        price_privacy: data.pricePrivacy,
        minimum_stay: data.minimumStay ?? "",
        rating: data.rating ?? 0,
        subscription_tier: data.subscriptionTier,
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
    const baseUpdates: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(updates, "name")) baseUpdates.name = parsed.name;
    if (Object.prototype.hasOwnProperty.call(updates, "location")) baseUpdates.location = parsed.location;
    if (Object.prototype.hasOwnProperty.call(updates, "labManager")) baseUpdates.lab_manager = parsed.labManager;
    if (Object.prototype.hasOwnProperty.call(updates, "contactEmail")) baseUpdates.contact_email = parsed.contactEmail;
    if (Object.prototype.hasOwnProperty.call(updates, "isVerified")) baseUpdates.is_verified = parsed.isVerified;
    if (Object.prototype.hasOwnProperty.call(updates, "isVisible")) baseUpdates.is_visible = parsed.isVisible;
    if (Object.prototype.hasOwnProperty.call(updates, "pricePrivacy")) baseUpdates.price_privacy = parsed.pricePrivacy;
    if (Object.prototype.hasOwnProperty.call(updates, "minimumStay")) baseUpdates.minimum_stay = parsed.minimumStay ?? "";
    if (Object.prototype.hasOwnProperty.call(updates, "rating")) baseUpdates.rating = parsed.rating ?? 0;
    if (Object.prototype.hasOwnProperty.call(updates, "subscriptionTier")) baseUpdates.subscription_tier = parsed.subscriptionTier;

    if (Object.keys(baseUpdates).length) {
      const upd = await supabase.from("labs").update(baseUpdates).eq("id", id).select("id").single();
      if (upd.error) throw upd.error;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "photos")) await replaceLabPhotos(id, parsed.photos ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "compliance")) await replaceLabComplianceLabels(id, parsed.compliance ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "complianceDocs")) await replaceLabComplianceDocs(id, parsed.complianceDocs ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "equipment")) await replaceLabEquipment(id, parsed.equipment ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "focusAreas")) await replaceLabFocusAreas(id, parsed.focusAreas ?? []);
    if (Object.prototype.hasOwnProperty.call(updates, "offers")) await replaceLabOffers(id, parsed.offers ?? []);

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
