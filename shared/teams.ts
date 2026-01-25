import { z } from "zod";

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

export const teamMemberSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1, "Name is required"),
  role: z.string().min(1, "Role is required"),
  email: z.string().email("Valid email is required").optional().nullable(),
  linkedin: z.string().url("LinkedIn must be a valid URL").optional().nullable(),
  website: z.string().url("Website must be a valid URL").optional().nullable(),
  isLead: z.boolean().optional().default(false),
});

export const teamTechniqueSchema = z.object({
  name: z.string().min(1, "Technique name is required"),
  description: z.string().min(1).max(2000).optional().nullable(),
});

export const teamLabSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  city: z.string().min(1).optional().nullable(),
  country: z.string().min(1).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  subscriptionTier: z.string().optional().nullable(),
});

export const teamCoreSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  descriptionShort: z.string().max(350).optional().nullable(),
  descriptionLong: z.string().max(8000).optional().nullable(),
  ownerUserId: z.string().uuid().optional().nullable(),
  logoUrl: z.string().url("Logo must be a valid URL").optional().nullable(),
  website: z.preprocess(
    normalizeUrl,
    z.string().url("Website must be a valid URL").optional().nullable(),
  ),
  linkedin: z.string().url("LinkedIn must be a valid URL").optional().nullable(),
  field: z.string().min(1).optional().nullable(),
  isVisible: z.boolean().default(true),
  equipment: z.array(z.string().min(1)).default([]),
  priorityEquipment: z.array(z.string().min(1)).max(3).default([]),
  techniques: z.array(teamTechniqueSchema).default([]),
  focusAreas: z.array(z.string().min(1)).default([]),
  members: z.array(teamMemberSchema).default([]),
  labIds: z.array(z.number().int().positive()).default([]),
  photos: z.array(mediaAssetSchema).max(2).default([]),
});

export const teamSchema = teamCoreSchema.extend({
  id: z.number().int().positive(),
  labs: z.array(teamLabSchema).default([]),
});

export const teamListSchema = z.array(teamSchema);
export const insertTeamSchema = teamCoreSchema;
export const updateTeamSchema = teamCoreSchema.partial().refine(
  data => Object.keys(data).length > 0,
  { message: "At least one field must be provided for an update" },
);

export type TeamMember = z.infer<typeof teamMemberSchema>;
export type TeamTechnique = z.infer<typeof teamTechniqueSchema>;
export type TeamLab = z.infer<typeof teamLabSchema>;
export type Team = z.infer<typeof teamSchema>;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type UpdateTeam = z.infer<typeof updateTeamSchema>;
export type TeamMediaAsset = z.infer<typeof mediaAssetSchema>;
