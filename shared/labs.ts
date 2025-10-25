import { z } from "zod";

export const offerOptions = [
  "Monthly rent",
  "Hourly rate",
  "Equipment use rate",
  "Day rate",
] as const;

export type OfferOption = (typeof offerOptions)[number];

export const mediaAssetSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  url: z.string().min(1, "Asset URL is required"),
});

export const labCoreSchema = z.object({
  name: z.string().min(1, "Lab name is required"),
  location: z.string().min(1, "Location is required"),
  labManager: z.string().min(1, "Lab manager name is required"),
  contactEmail: z.string().email("Valid contact email is required"),
  compliance: z.array(z.string().min(1)).default([]),
  complianceDocs: z.array(mediaAssetSchema).default([]),
  isVerified: z.boolean().default(false),
  equipment: z.array(z.string().min(1)).default([]),
  focusAreas: z.array(z.string().min(1)).default([]),
  offers: z.array(z.enum(offerOptions)).default([]),
  pricePrivacy: z.boolean().default(false),
  minimumStay: z.string().optional().default(""),
  rating: z.number().min(0).max(5).default(0),
  photos: z.array(mediaAssetSchema).min(1, "At least one lab photo is required"),
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
export type LabPartner = z.infer<typeof labSchema>;
export type InsertLab = z.infer<typeof insertLabSchema>;
export type UpdateLab = z.infer<typeof updateLabSchema>;
