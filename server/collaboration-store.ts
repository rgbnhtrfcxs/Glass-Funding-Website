import { supabase } from "./supabaseClient";
import { insertLabCollaborationSchema, type InsertLabCollaboration } from "@shared/collaborations";

export class LabCollaborationStore {
  async create(payload: InsertLabCollaboration & { labName: string }) {
    const data = insertLabCollaborationSchema.parse(payload);
    const { data: inserted, error } = await supabase
      .from("lab_collaborations")
      .insert({
        lab_name: payload.labName,
        contact_name: data.contactName,
        contact_email: data.contactEmail,
        target_labs: data.targetLabs,
        collaboration_focus: data.collaborationFocus,
        resources_offered: data.resourcesOffered ?? "",
        desired_timeline: data.desiredTimeline,
        additional_notes: data.additionalNotes ?? "",
      })
      .select("id, lab_name, contact_name, contact_email, target_labs, collaboration_focus, resources_offered, desired_timeline, additional_notes, created_at")
      .single();

    if (error || !inserted) {
      throw error ?? new Error("Failed to submit collaboration request");
    }

    return inserted;
  }
}

export const labCollaborationStore = new LabCollaborationStore();
