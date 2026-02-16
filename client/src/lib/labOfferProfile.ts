import type {
  LabOfferProfile,
  LabOfferTaxonomyOption,
  UpsertLabOfferProfile,
} from "@shared/labOffers";
import type { OfferOption } from "@shared/labs";

export type LabOfferProfileDraft = {
  supportsBenchRental: boolean;
  supportsEquipmentAccess: boolean;
  rentableLabLevels: string[];
  offerFormats: string[];
  applicationModes: string[];
  operationalStatus: "open" | "opening_future" | "renovation_or_closed";
  expectedOpeningYear: string;
  technicalServices: string[];
  generalServices: string[];
  pricingModel: "request_quote" | "price_from" | "fixed_price" | "range";
  priceFrom: string;
  priceTo: string;
  currency: string;
  pricingNotes: string;
  additionalInfo: string;
  totalAreaM2: string;
  minRentAreaM2: string;
  maxRentAreaM2: string;
};

export const defaultLabOfferProfileDraft: LabOfferProfileDraft = {
  supportsBenchRental: false,
  supportsEquipmentAccess: false,
  rentableLabLevels: [],
  offerFormats: [],
  applicationModes: [],
  operationalStatus: "open",
  expectedOpeningYear: "",
  technicalServices: [],
  generalServices: [],
  pricingModel: "request_quote",
  priceFrom: "",
  priceTo: "",
  currency: "",
  pricingNotes: "",
  additionalInfo: "",
  totalAreaM2: "",
  minRentAreaM2: "",
  maxRentAreaM2: "",
};

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map(entry => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    : [];

const parseNullableNumber = (value: string): number | null => {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toStringValue = (value: number | string | null | undefined): string =>
  value === null || value === undefined ? "" : String(value);

export const draftFromProfile = (
  profile: LabOfferProfile | null | undefined,
  fallback?: { offersLabSpace?: boolean; offers?: OfferOption[] | null },
): LabOfferProfileDraft => {
  if (!profile) {
    const benchFallback =
      Boolean(fallback?.offersLabSpace) ||
      (fallback?.offers ?? []).some(offer => offer === "Monthly rent" || offer === "Hourly rate" || offer === "Day rate");
    const equipmentFallback = (fallback?.offers ?? []).includes("Equipment use rate") ?? false;
    return {
      ...defaultLabOfferProfileDraft,
      supportsBenchRental: benchFallback,
      supportsEquipmentAccess: equipmentFallback,
    };
  }
  return {
    supportsBenchRental: profile.supportsBenchRental,
    supportsEquipmentAccess: profile.supportsEquipmentAccess,
    rentableLabLevels: normalizeStringArray(profile.rentableLabLevels),
    offerFormats: normalizeStringArray(profile.offerFormats),
    applicationModes: normalizeStringArray(profile.applicationModes),
    operationalStatus: profile.operationalStatus,
    expectedOpeningYear: toStringValue(profile.expectedOpeningYear),
    technicalServices: normalizeStringArray(profile.technicalServices),
    generalServices: normalizeStringArray(profile.generalServices),
    pricingModel: profile.pricingModel,
    priceFrom: toStringValue(profile.priceFrom),
    priceTo: toStringValue(profile.priceTo),
    currency: profile.currency ?? "",
    pricingNotes: profile.pricingNotes ?? "",
    additionalInfo: profile.additionalInfo ?? "",
    totalAreaM2: toStringValue(profile.totalAreaM2),
    minRentAreaM2: toStringValue(profile.minRentAreaM2),
    maxRentAreaM2: toStringValue(profile.maxRentAreaM2),
  };
};

export const draftToProfilePayload = (
  draft: LabOfferProfileDraft,
  opts?: { forceSupportsBenchRental?: boolean; forceSupportsEquipmentAccess?: boolean },
): UpsertLabOfferProfile => {
  const supportsBenchRental = opts?.forceSupportsBenchRental ?? draft.supportsBenchRental;
  const supportsEquipmentAccess = opts?.forceSupportsEquipmentAccess ?? draft.supportsEquipmentAccess;
  return {
    supportsBenchRental,
    supportsEquipmentAccess,
    rentableLabLevels: normalizeStringArray(draft.rentableLabLevels),
    offerFormats: normalizeStringArray(draft.offerFormats),
    applicationModes: normalizeStringArray(draft.applicationModes),
    operationalStatus: draft.operationalStatus,
    expectedOpeningYear: draft.expectedOpeningYear.trim() ? Number(draft.expectedOpeningYear.trim()) : null,
    technicalServices: normalizeStringArray(draft.technicalServices),
    generalServices: normalizeStringArray(draft.generalServices),
    pricingModel: draft.pricingModel,
    priceFrom: parseNullableNumber(draft.priceFrom),
    priceTo: parseNullableNumber(draft.priceTo),
    currency: draft.currency.trim().toUpperCase() || null,
    pricingNotes: draft.pricingNotes.trim() || null,
    additionalInfo: draft.additionalInfo.trim() || null,
    totalAreaM2: parseNullableNumber(draft.totalAreaM2),
    minRentAreaM2: parseNullableNumber(draft.minRentAreaM2),
    maxRentAreaM2: parseNullableNumber(draft.maxRentAreaM2),
  };
};

export const draftToLegacyOffers = (draft: LabOfferProfileDraft): OfferOption[] => {
  const offers: OfferOption[] = [];
  if (draft.supportsBenchRental) offers.push("Monthly rent");
  if (draft.supportsEquipmentAccess) offers.push("Equipment use rate");
  return offers;
};

export const toggleSelection = (items: string[], value: string, nextState?: boolean) => {
  const set = new Set(items);
  const shouldAdd = typeof nextState === "boolean" ? nextState : !set.has(value);
  if (shouldAdd) set.add(value);
  else set.delete(value);
  return Array.from(set);
};

export const parseCsvList = (value: string) =>
  value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

export const listToCsv = (value: string[]) => value.join(", ");

export async function fetchLabOfferTaxonomy(signal?: AbortSignal): Promise<LabOfferTaxonomyOption[]> {
  const response = await fetch("/api/lab-offer-taxonomy", { signal });
  if (!response.ok) throw new Error("Unable to load offer taxonomy");
  return (await response.json()) as LabOfferTaxonomyOption[];
}

export async function fetchLabOfferProfile(
  labId: number,
  init?: { token?: string | null; signal?: AbortSignal },
): Promise<LabOfferProfile | null> {
  const response = await fetch(`/api/labs/${labId}/offers-profile`, {
    signal: init?.signal,
    headers: init?.token ? { Authorization: `Bearer ${init.token}` } : {},
  });
  if (!response.ok) throw new Error("Unable to load offer profile");
  const payload = await response.json();
  return payload ? (payload as LabOfferProfile) : null;
}

export async function upsertLabOfferProfile(
  labId: number,
  payload: UpsertLabOfferProfile,
  token?: string | null,
): Promise<LabOfferProfile> {
  const response = await fetch(`/api/labs/${labId}/offers-profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.message || "Unable to save offer profile");
  }
  return (await response.json()) as LabOfferProfile;
}
