import { z } from "zod";

// Matches your Supabase table columns
// public.lab_collaborations: lab_name, contact_name, contact_email,
// target_labs, collaboration_focus, resources_offered, desired_timeline, additional_notes
export const insertLabCollaborationSchema = z.object({
  labId: z.number().int().positive(), // used only to look up lab_name
  contactName: z.string().min(1, "Your name is required"),
  contactEmail: z.string().email("Valid email is required"),
  targetLabs: z.string().optional().default(""),
  collaborationFocus: z.string().min(1, "Please describe the focus"),
  resourcesOffered: z.string().optional().default(""),
  desiredTimeline: z.string().optional().default(""),
  additionalNotes: z.string().optional().default(""),
});

export type InsertLabCollaboration = z.infer<typeof insertLabCollaborationSchema>;
