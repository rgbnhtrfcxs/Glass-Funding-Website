// server/routes/auditor.ts
import { type Express, type Request, type Response } from "express";
import { supabase } from "../supabaseClient.js";
import { requireUserId, fetchProfileCapabilities } from "./shared/helpers.js";

export function registerAuditorRoutes(app: Express): void {
  // =========================================================
  // AUDITOR PORTAL: Phase 1 (online bookings)
  // =========================================================

  // Auditor: my assigned online bookings
  app.get("/api/auditor/my-bookings", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAuditor) return res.status(403).json({ message: "Auditor access required." });

      const { data, error } = await supabase
        .from("audit_bookings")
        .select(`
          id, slot_id, lab_id, requester_user_id, requester_email, status,
          assigned_auditor_user_id, phase1_completed_at, auditor_notes, created_at,
          audit_slots (starts_at, ends_at, timezone),
          labs (id, name, lab_location (city, country))
        `)
        .eq("assigned_auditor_user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      res.json(data ?? []);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to fetch bookings." });
    }
  });

  // Audit manager: all bookings
  app.get("/api/audit-manager/all-bookings", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAuditManager) return res.status(403).json({ message: "Audit manager access required." });

      const { data, error } = await supabase
        .from("audit_bookings")
        .select(`
          id, slot_id, lab_id, requester_user_id, requester_email, status,
          assigned_auditor_user_id, phase1_completed_at, auditor_notes, created_at,
          audit_slots (starts_at, ends_at, timezone),
          labs (id, name, lab_location (city, country))
        `)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      res.json(data ?? []);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to fetch bookings." });
    }
  });

  // Audit manager: assign auditor to a booking
  app.put("/api/auditor/booking/:id/assign-auditor", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAuditManager) return res.status(403).json({ message: "Audit manager access required." });

      const bookingId = Number(req.params.id);
      if (isNaN(bookingId)) return res.status(400).json({ message: "Invalid booking ID." });
      const { auditorUserId } = req.body ?? {};
      if (!auditorUserId) return res.status(400).json({ message: "auditorUserId is required." });

      const { error } = await supabase
        .from("audit_bookings")
        .update({ assigned_auditor_user_id: auditorUserId })
        .eq("id", bookingId);
      if (error) throw new Error(error.message);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to assign auditor." });
    }
  });

  // Auditor: mark Phase 1 complete
  app.put("/api/auditor/booking/:id/phase1-complete", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAuditor) return res.status(403).json({ message: "Auditor access required." });

      const bookingId = Number(req.params.id);
      if (isNaN(bookingId)) return res.status(400).json({ message: "Invalid booking ID." });

      const { auditorNotes } = req.body ?? {};
      const { error } = await supabase
        .from("audit_bookings")
        .update({ phase1_completed_at: new Date().toISOString(), auditor_notes: auditorNotes ?? null })
        .eq("id", bookingId);
      if (error) throw new Error(error.message);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to complete Phase 1." });
    }
  });

  // =========================================================
  // AUDITOR PORTAL: Phase 2 (IRL assignments)
  // =========================================================

  // Auditor: my IRL assignments
  app.get("/api/auditor/my-irl-assignments", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAuditor) return res.status(403).json({ message: "Auditor access required." });

      const { data, error } = await supabase
        .from("irl_audit_assignments")
        .select(`
          id, scheduled_date, area_label, notes, status, created_at,
          irl_assignment_labs (
            id, lab_id, visit_status, visited_at,
            labs (id, name, lab_location (city, country, address_line1))
          )
        `)
        .eq("assigned_auditor_user_id", userId)
        .order("scheduled_date", { ascending: true });
      if (error) throw new Error(error.message);
      res.json(data ?? []);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to fetch IRL assignments." });
    }
  });

  // Audit manager: all IRL assignments
  app.get("/api/audit-manager/irl-assignments", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAuditManager) return res.status(403).json({ message: "Audit manager access required." });

      const { data, error } = await supabase
        .from("irl_audit_assignments")
        .select(`
          id, scheduled_date, area_label, notes, status, created_at, assigned_auditor_user_id,
          irl_assignment_labs (
            id, lab_id, visit_status, visited_at,
            labs (id, name, lab_location (city, country))
          )
        `)
        .order("scheduled_date", { ascending: false });
      if (error) throw new Error(error.message);
      res.json(data ?? []);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to fetch IRL assignments." });
    }
  });

  // Audit manager: create IRL assignment
  app.post("/api/audit-manager/irl-assignments", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAuditManager) return res.status(403).json({ message: "Audit manager access required." });

      const { auditorUserId, scheduledDate, areaLabel, notes, labIds } = req.body ?? {};
      if (!auditorUserId || !scheduledDate || !Array.isArray(labIds) || labIds.length === 0) {
        return res.status(400).json({ message: "auditorUserId, scheduledDate, and labIds[] are required." });
      }

      const { data: assignment, error: assignErr } = await supabase
        .from("irl_audit_assignments")
        .insert({
          assigned_auditor_user_id: auditorUserId,
          created_by_user_id: userId,
          scheduled_date: scheduledDate,
          area_label: areaLabel ?? null,
          notes: notes ?? null,
        })
        .select()
        .single();
      if (assignErr) throw new Error(assignErr.message);

      const labRows = (labIds as number[]).map((labId) => ({
        assignment_id: assignment.id,
        lab_id: labId,
      }));
      const { error: labsErr } = await supabase.from("irl_assignment_labs").insert(labRows);
      if (labsErr) throw new Error(labsErr.message);

      res.status(201).json(assignment);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to create IRL assignment." });
    }
  });

  // Auditor/manager: update lab visit status in an IRL assignment
  app.put("/api/auditor/irl/:assignmentId/labs/:labId/status", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAuditor) return res.status(403).json({ message: "Auditor access required." });

      const assignmentId = Number(req.params.assignmentId);
      const labId = Number(req.params.labId);
      if (isNaN(assignmentId) || isNaN(labId)) return res.status(400).json({ message: "Invalid ID." });

      const { visitStatus } = req.body ?? {};
      if (!["pending", "visited", "skipped"].includes(visitStatus)) {
        return res.status(400).json({ message: "visitStatus must be pending, visited, or skipped." });
      }

      const updates: Record<string, unknown> = { visit_status: visitStatus };
      if (visitStatus === "visited") updates.visited_at = new Date().toISOString();

      const { error } = await supabase
        .from("irl_assignment_labs")
        .update(updates)
        .eq("assignment_id", assignmentId)
        .eq("lab_id", labId);
      if (error) throw new Error(error.message);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to update visit status." });
    }
  });

  // Audit manager: lab readiness overview
  app.get("/api/audit-manager/lab-readiness", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAuditManager) return res.status(403).json({ message: "Audit manager access required." });

      const { data: labs, error } = await supabase
        .from("labs")
        .select(`
          id, name, lab_status,
          lab_location (city, country, address_line1),
          lab_profile (logo_url, description_short),
          lab_equipment (id),
          lab_contact (email),
          audit_bookings (id, phase1_completed_at, assigned_auditor_user_id)
        `)
        .order("name");
      if (error) throw new Error(error.message);

      const result = (labs ?? []).map((lab: any) => {
        const equipmentCount = (lab.lab_equipment ?? []).length;
        const location = lab.lab_location;
        const contact = Array.isArray(lab.lab_contact) ? lab.lab_contact[0] : lab.lab_contact;
        const profile = Array.isArray(lab.lab_profile) ? lab.lab_profile[0] : lab.lab_profile;

        const checks = {
          hasName: Boolean(lab.name),
          hasDescription: Boolean(profile?.description_short),
          hasLocation: Boolean(location?.city && location?.country),
          hasContactEmail: Boolean(contact?.email),
          hasEnoughEquipment: equipmentCount >= 5,
        };
        const passedCount = Object.values(checks).filter(Boolean).length;
        const totalChecks = Object.keys(checks).length;
        const completenessScore = Math.round((passedCount / totalChecks) * 100);

        const phase1Booking = (lab.audit_bookings ?? []).find((b: any) => b.phase1_completed_at != null);
        const irlReady = completenessScore === 100 && Boolean(phase1Booking);

        return {
          id: lab.id,
          name: lab.name,
          labStatus: lab.lab_status,
          city: location?.city ?? null,
          country: location?.country ?? null,
          equipmentCount,
          completenessScore,
          checks,
          phase1Completed: Boolean(phase1Booking),
          irlReady,
        };
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to fetch lab readiness." });
    }
  });

  // Auditor: submit/update audit report for a lab in an IRL assignment
  app.put("/api/auditor/irl/:assignmentId/labs/:labId/report", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAuditor) return res.status(403).json({ message: "Auditor access required." });

      const assignmentId = Number(req.params.assignmentId);
      const labId = Number(req.params.labId);
      if (isNaN(assignmentId) || isNaN(labId)) return res.status(400).json({ message: "Invalid ID." });

      const { data: assignmentLab, error: alErr } = await supabase
        .from("irl_assignment_labs")
        .select("id")
        .eq("assignment_id", assignmentId)
        .eq("lab_id", labId)
        .maybeSingle();
      if (alErr || !assignmentLab) return res.status(404).json({ message: "Assignment lab not found." });

      const { reportSummary, equipmentVerified } = req.body ?? {};
      const { error } = await supabase
        .from("audit_reports")
        .upsert(
          {
            irl_assignment_lab_id: assignmentLab.id,
            lab_id: labId,
            auditor_user_id: userId,
            report_summary: reportSummary ?? null,
            equipment_verified: equipmentVerified ?? null,
          },
          { onConflict: "irl_assignment_lab_id" },
        );
      if (error) throw new Error(error.message);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to save report." });
    }
  });
}
