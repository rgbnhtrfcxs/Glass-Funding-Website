import { z } from "zod";

export const deliveryWindows = [
  "weekly_digest",
  "biweekly_digest",
  "immediate",
] as const;

export const verificationStatus = [
  "glass_verified",
  "partner_verified",
  "unverified",
] as const;

export const labRequestCoreSchema = z.object({
  labId: z.number().int().positive("Lab selection is required"),
  labName: z.string().min(1, "Lab name is required"),
  requesterName: z.string().min(1, "Your name is required"),
  requesterEmail: z.string().email("Enter a valid email"),
  organization: z.string().min(2, "Organization or team name is required"),
  roleTitle: z.string().min(2, "Add your role/title"),
  projectSummary: z.string().min(50, "Share at least a short project overview"),
  workTimeline: z.string().min(1, "Select your expected start timeline"),
  weeklyHoursNeeded: z.string().min(1, "Estimated weekly hours are required"),
  teamSize: z.string().min(1, "Let us know roughly how many people"),
  equipmentNeeds: z.string().optional().default(""),
  complianceNotes: z.string().optional().default(""),
  specialRequirements: z.string().optional().default(""),
  referencesOrLinks: z.string().optional().default(""),
  verification: z.enum(verificationStatus).default("unverified"),
  verificationProof: z.string().optional().default(""),
  preferredContactMethod: z.enum(["email", "video_call", "phone"]).default("email"),
  preferredDeliveryWindow: z.enum(deliveryWindows).default("weekly_digest"),
  agreeToReview: z.boolean().refine(Boolean, {
    message: "Please confirm the request can be reviewed for spam",
  }),
});

export const labRequestSchema = labRequestCoreSchema.extend({
  id: z.number().int().positive(),
  status: z.enum(["pending_review", "approved", "sent", "rejected"]).default("pending_review"),
  submittedAt: z.string(),
  reviewedAt: z.string().nullable().default(null),
  reviewNotes: z.string().optional().default(""),
});

export const insertLabRequestSchema = labRequestCoreSchema;
export const updateLabRequestStatusSchema = z.object({
  status: z.enum(["pending_review", "approved", "sent", "rejected"]),
  reviewNotes: z.string().optional(),
});

export type LabRequest = z.infer<typeof labRequestSchema>;
export type InsertLabRequest = z.infer<typeof insertLabRequestSchema>;
export type UpdateLabRequestStatus = z.infer<typeof updateLabRequestStatusSchema>;
