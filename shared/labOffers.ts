import { z } from "zod";

export const rentableLabLevelOptions = [
  "l1",
  "l2",
  "l3_possible",
  "cleanroom_possible",
  "animal_facility",
  "na",
] as const;

export const offerFormatOptions = [
  "shell_space",
  "mixed_offer",
  "plug_and_play",
  "na",
] as const;

export const applicationModeOptions = [
  "rolling",
  "periodic_calls",
  "invite_only",
  "na",
] as const;

export const operationalStatusOptions = [
  "open",
  "opening_future",
  "renovation_or_closed",
] as const;

export const pricingModelOptions = [
  "request_quote",
  "price_from",
  "fixed_price",
  "range",
] as const;

export const labOfferTaxonomyGroupOptions = [
  "rentable_lab_level",
  "offer_format",
  "application_mode",
  "pricing_model",
  "technical_service",
  "general_service",
] as const;

const uppercaseCurrency = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim().toUpperCase();
  return trimmed || null;
};

const nullableNumber = z.preprocess(
  value => (value === "" || value === undefined ? null : value),
  z.number().nonnegative().nullable(),
);

export const labOfferTaxonomyOptionSchema = z.object({
  optionGroup: z.enum(labOfferTaxonomyGroupOptions),
  code: z.string().min(1),
  labelEn: z.string().min(1),
  labelFr: z.string().min(1),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(100),
});

export const labOfferTaxonomyListSchema = z.array(labOfferTaxonomyOptionSchema);

const labOfferProfileCoreObjectSchema = z.object({
  supportsBenchRental: z.boolean().default(false),
  supportsEquipmentAccess: z.boolean().default(false),
  rentableLabLevels: z.array(z.enum(rentableLabLevelOptions)).default([]),
  offerFormats: z.array(z.enum(offerFormatOptions)).default([]),
  applicationModes: z.array(z.enum(applicationModeOptions)).default([]),
  operationalStatus: z.enum(operationalStatusOptions).default("open"),
  expectedOpeningYear: z.preprocess(
    value => (value === "" || value === undefined ? null : value),
    z.number().int().min(2024).max(2100).nullable(),
  ),
  technicalServices: z.array(z.string().min(1)).default([]),
  generalServices: z.array(z.string().min(1)).default([]),
  pricingModel: z.enum(pricingModelOptions).default("request_quote"),
  priceFrom: nullableNumber.default(null),
  priceTo: nullableNumber.default(null),
  currency: z.preprocess(
    uppercaseCurrency,
    z.string().length(3, "Currency must be 3-letter ISO code").nullable(),
  ).default(null),
  pricingNotes: z.preprocess(
    value => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().max(4000).nullable(),
  ).default(null),
  additionalInfo: z.preprocess(
    value => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().max(8000).nullable(),
  ).default(null),
  totalAreaM2: nullableNumber.default(null),
  minRentAreaM2: nullableNumber.default(null),
  maxRentAreaM2: nullableNumber.default(null),
});

const withLabOfferRules = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .refine(
      (data: any) => data.priceFrom == null || data.priceTo == null || data.priceTo >= data.priceFrom,
      { message: "priceTo must be greater than or equal to priceFrom", path: ["priceTo"] },
    )
    .refine(
      (data: any) =>
        data.minRentAreaM2 == null || data.maxRentAreaM2 == null || data.maxRentAreaM2 >= data.minRentAreaM2,
      { message: "maxRentAreaM2 must be greater than or equal to minRentAreaM2", path: ["maxRentAreaM2"] },
    )
    .refine(
      (data: any) => data.operationalStatus !== "opening_future" || data.expectedOpeningYear != null,
      { message: "expectedOpeningYear is required when operationalStatus is opening_future", path: ["expectedOpeningYear"] },
    );

export const labOfferProfileCoreSchema = withLabOfferRules(labOfferProfileCoreObjectSchema);

export const labOfferProfileSchema = withLabOfferRules(labOfferProfileCoreObjectSchema.extend({
  labId: z.number().int().positive(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
}));

export const upsertLabOfferProfileSchema = withLabOfferRules(labOfferProfileCoreObjectSchema.partial()).refine(
  data => Object.keys(data).length > 0,
  { message: "At least one field must be provided" },
);

export type LabOfferTaxonomyOption = z.infer<typeof labOfferTaxonomyOptionSchema>;
export type LabOfferProfile = z.infer<typeof labOfferProfileSchema>;
export type UpsertLabOfferProfile = z.infer<typeof upsertLabOfferProfileSchema>;
