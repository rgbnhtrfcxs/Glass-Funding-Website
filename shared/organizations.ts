import { z } from "zod";

export const ORG_TYPES = ["research_org", "university", "hospital_network", "industry", "other"] as const;
export const ORG_MEMBER_ROLES = ["member", "manager", "owner"] as const;
export const USER_ROLES = ["user", "auditor", "audit_manager", "admin"] as const;

export type OrgType = (typeof ORG_TYPES)[number];
export type OrgMemberRole = (typeof ORG_MEMBER_ROLES)[number];
export type UserRole = (typeof USER_ROLES)[number];

export const insertOrganizationSchema = z.object({
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(80, "Slug must be at most 80 characters")
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  name: z.string().min(1, "Name is required").max(200),
  shortDescription: z.string().max(300).optional().nullable(),
  longDescription: z.string().max(5000).optional().nullable(),
  logoUrl: z.string().url("Invalid logo URL").optional().nullable(),
  website: z.string().url("Invalid website URL").optional().nullable(),
  linkedin: z.string().url("Invalid LinkedIn URL").optional().nullable(),
  orgType: z.enum(ORG_TYPES).default("research_org"),
  isVisible: z.boolean().default(true),
});

export const updateOrganizationSchema = insertOrganizationSchema.partial();

export const addOrgMemberSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  orgRole: z.enum(ORG_MEMBER_ROLES).default("member"),
});

export const setUserRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
export type AddOrgMember = z.infer<typeof addOrgMemberSchema>;
export type SetUserRole = z.infer<typeof setUserRoleSchema>;
