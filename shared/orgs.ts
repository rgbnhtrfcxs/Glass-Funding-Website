import { z } from "zod";

const normalizeUrl = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export const orgTypeOptions = [
  "research_org",
  "university",
  "hospital_network",
  "industry",
  "other",
] as const;

export type OrgTypeOption = (typeof orgTypeOptions)[number];

export const orgLabSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1).optional().nullable(),
  name: z.string().min(1),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  labStatus: z.enum([
    "listed",
    "confirmed",
    "verified_passive",
    "verified_active",
    "premier",
  ]).nullable().optional(),
});

export const orgMemberSchema = orgLabSchema;

export const orgCoreSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
  name: z.string().min(1, "Organization name is required"),
  shortDescription: z.string().max(350).optional().nullable(),
  longDescription: z.string().max(8000).optional().nullable(),
  logoUrl: z.string().url("Logo must be a valid URL").optional().nullable(),
  website: z.preprocess(
    normalizeUrl,
    z.string().url("Website must be a valid URL").optional().nullable(),
  ),
  linkedin: z.string().url("LinkedIn must be a valid URL").optional().nullable(),
  orgType: z.enum(orgTypeOptions).default("research_org"),
  ownerUserId: z.string().uuid().optional().nullable(),
  isVisible: z.boolean().default(true),
  memberLabIds: z.array(z.number().int().positive()).default([]),
});

export const orgSchema = orgCoreSchema.extend({
  id: z.number().int().positive(),
  members: z.array(orgMemberSchema).default([]),
  labs: z.array(orgLabSchema).default([]),
});

export const orgLabLinkRequestStatusOptions = [
  "pending",
  "approved",
  "declined",
  "cancelled",
] as const;

export const orgLabLinkRequestStatusSchema = z.enum(orgLabLinkRequestStatusOptions);

export const orgLabLinkRequestSchema = z.object({
  id: z.number().int().positive(),
  orgId: z.number().int().positive(),
  labId: z.number().int().positive(),
  requestedByUserId: z.string().uuid().nullable().optional(),
  status: orgLabLinkRequestStatusSchema,
  createdAt: z.string().nullable().optional(),
  respondedAt: z.string().nullable().optional(),
  lab: orgLabSchema.nullable().optional(),
  org: orgSchema.pick({
    id: true,
    slug: true,
    name: true,
    shortDescription: true,
    logoUrl: true,
    orgType: true,
    isVisible: true,
  }).nullable().optional(),
});

export const orgLabLinkRequestListSchema = z.array(orgLabLinkRequestSchema);

export const orgListSchema = z.array(orgSchema);
export const insertOrgSchema = orgCoreSchema;
export const updateOrgSchema = orgCoreSchema.partial().refine(
  data => Object.keys(data).length > 0,
  { message: "At least one field must be provided for an update" },
);

export type OrgMember = z.infer<typeof orgMemberSchema>;
export type OrgLab = z.infer<typeof orgLabSchema>;
export type Org = z.infer<typeof orgSchema>;
export type InsertOrg = z.infer<typeof insertOrgSchema>;
export type UpdateOrg = z.infer<typeof updateOrgSchema>;
export type OrgLabLinkRequest = z.infer<typeof orgLabLinkRequestSchema>;
export type OrgLabLinkRequestStatus = z.infer<typeof orgLabLinkRequestStatusSchema>;
