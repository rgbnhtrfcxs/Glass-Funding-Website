import { z } from "zod";

export const offerOptions = [
  "Monthly rent",
  "Hourly rate",
  "Equipment use rate",
  "Day rate",
] as const;

export type OfferOption = (typeof offerOptions)[number];

export const orgRoleOptions = [
  "Research Lab",
  "Core Facility / Platform",
  "CRO (Contract Research Organization)",
  "CDMO / CMO",
  "Clinical Site / Hospital Lab",
  "Biobank",
  "Testing / Certification Lab",
  "Bioinformatics / Data",
  "Regulatory / QA / Consulting",
] as const;

export type OrgRoleOption = (typeof orgRoleOptions)[number];
export const ercDomainOptions = ["PE", "LS", "SH"] as const;
export type ErcDomainOption = (typeof ercDomainOptions)[number];

export const ercDisciplineCodeSchema = z
  .string()
  .regex(/^(PE(1[0-1]|[1-9])|LS[1-9]|SH[1-8])$/, "ERC discipline code must match PE1-PE11, LS1-LS9, or SH1-SH8");

export const ercDisciplineOptionSchema = z.object({
  code: ercDisciplineCodeSchema,
  domain: z.enum(ercDomainOptions),
  title: z.string().min(1),
});

const normalizeUrl = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export const mediaAssetSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  url: z.string().min(1, "Asset URL is required"),
});

export const partnerLogoSchema = mediaAssetSchema.extend({
  website: z.preprocess(
    normalizeUrl,
    z.string().url("Partner website must be a valid URL").optional().nullable(),
  ),
});

export const teamMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  title: z.string().min(1, "Title is required"),
  linkedin: z.string().url("LinkedIn must be a valid URL").optional().nullable(),
  website: z.string().url("Website must be a valid URL").optional().nullable(),
  teamName: z.string().min(1).optional().nullable(),
  roleRank: z.number().int().min(1).max(99).optional().nullable(),
  isLead: z.boolean().optional().default(false),
});

export const labTechniqueSchema = z.object({
  name: z.string().min(1, "Technique name is required"),
  description: z.string().min(1).max(2000).optional().nullable(),
});

export const labCoreSchema = z.object({
  name: z.string().min(1, "Lab name is required"),
  labManager: z.preprocess(
    value => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().min(1, "Lab manager name is required").optional().nullable(),
  ),
  contactEmail: z.preprocess(
    value => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().email("Valid contact email is required").optional().nullable(),
  ),
  ownerUserId: z.string().uuid().optional().nullable(),
  descriptionShort: z.string().max(350).optional().nullable(),
  descriptionLong: z.string().max(8000).optional().nullable(),
  orgRole: z.preprocess(
    value => (typeof value === "string" && value.trim() === "" ? null : value),
    z.enum(orgRoleOptions).optional().nullable(),
  ),
  offersLabSpace: z.boolean().default(false),
  addressLine1: z.string().min(1).optional().nullable(),
  addressLine2: z.string().min(1).optional().nullable(),
  city: z.string().min(1).optional().nullable(),
  state: z.string().min(1).optional().nullable(),
  postalCode: z.string().min(1).optional().nullable(),
  country: z.string().min(1).optional().nullable(),
  siretNumber: z.string().min(4).optional().nullable(),
  logoUrl: z.string().url("Logo must be a valid URL").optional().nullable(),
  website: z.preprocess(
    normalizeUrl,
    z.string().url("Website must be a valid URL").optional().nullable(),
  ),
  linkedin: z.string().url("LinkedIn must be a valid URL").optional().nullable(),
  partnerLogos: z.array(partnerLogoSchema).default([]),
  compliance: z.array(z.string().min(1)).default([]),
  complianceDocs: z.array(mediaAssetSchema).default([]),
  halStructureId: z.string().min(1).optional().nullable(),
  halPersonId: z.string().min(1).optional().nullable(),
  teamMembers: z.array(teamMemberSchema).default([]),
  auditPassed: z.boolean().default(false),
  auditPassedAt: z.string().optional().nullable(),
  labStatus: z.enum([
    "listed",
    "confirmed",
    "verified_passive",
    "verified_active",
    "premier",
  ]).default("listed"),
  isVisible: z.boolean().default(true),
  equipment: z.array(z.string().min(1)).default([]),
  priorityEquipment: z.array(z.string().min(1)).max(3).default([]),
  techniques: z.array(labTechniqueSchema).default([]),
  focusAreas: z.array(z.string().min(1)).default([]),
  ercDisciplineCodes: z.array(ercDisciplineCodeSchema).default([]),
  primaryErcDisciplineCode: z.preprocess(
    value => (typeof value === "string" && value.trim() === "" ? null : value),
    ercDisciplineCodeSchema.optional().nullable(),
  ),
  ercDisciplines: z.array(ercDisciplineOptionSchema).default([]),
  offers: z.array(z.enum(offerOptions)).default([]),
  photos: z.array(mediaAssetSchema).min(0),
  field: z.string().min(1).optional().nullable(),
  public: z.boolean().optional().nullable(),
  alternateNames: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
});

export const labSchema = labCoreSchema.extend({
  id: z.number().int().positive(),
});

export const insertLabSchema = labCoreSchema;

export const updateLabSchema = labCoreSchema.partial().refine(
  data => Object.keys(data).length > 0,
  { message: "At least one field must be provided for an update" },
);

export const labListSchema = z.array(labSchema);

export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type PartnerLogo = z.infer<typeof partnerLogoSchema>;
export type LabTechnique = z.infer<typeof labTechniqueSchema>;
export type LabPartner = z.infer<typeof labSchema>;
export type InsertLab = z.infer<typeof insertLabSchema>;
export type UpdateLab = z.infer<typeof updateLabSchema>;
export type ErcDisciplineOption = z.infer<typeof ercDisciplineOptionSchema>;
