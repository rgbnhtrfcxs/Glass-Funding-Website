import { z } from "zod";

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
  preferredContactMethods: z
    .array(z.enum(["email", "video_call", "phone"]))
    .min(1, "Select at least one contact method")
    .default(["email"]),
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
