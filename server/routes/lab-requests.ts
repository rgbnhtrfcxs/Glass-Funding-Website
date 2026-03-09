// server/routes/lab-requests.ts
import { type Express } from "express";
import { ZodError } from "zod";
import { supabase } from "../supabaseClient.js";
import { labStore } from "../labs-store.js";
import { labRequestStore } from "../lab-requests-store.js";
import { sendMail } from "../mailer.js";
import { insertLabRequestSchema, updateLabRequestStatusSchema } from "@shared/labRequests";
import {
  authenticate,
  fetchProfileCapabilities,
  normalizeLabStatus,
  canForwardLabRequests,
  resolveInboxEmailNotificationsEnabled,
  createRateLimiter,
} from "./shared/helpers.js";

export function registerLabRequestRoutes(app: Express): void {
  const publicRequestRateLimit = createRateLimiter("public-request", 20, 10 * 60 * 1000);

  // --------- Lab Requests ----------
  app.get("/api/lab-requests", authenticate, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(400).json({ message: "No user on request" });
    const profile = await fetchProfileCapabilities(userId);
    if (!profile?.isAdmin) {
      return res.status(403).json({ message: "Only admins can access lab requests." });
    }
    const requests = await labRequestStore.list();
    res.json(requests);
  });

  app.post("/api/lab-requests", publicRequestRateLimit, async (req, res) => {
    try {
      const payload = insertLabRequestSchema.parse(req.body);
      const lab = await labStore.findById(payload.labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const status = normalizeLabStatus(lab.labStatus);
      if (status === "listed" || status === "confirmed") {
        return res.status(403).json({ message: "This lab is not accepting requests yet." });
      }
      const ownerProfile = lab.ownerUserId ? await fetchProfileCapabilities(lab.ownerUserId) : null;
      const canForward = ownerProfile?.canBrokerRequests;
      const inboxEmailsEnabled = resolveInboxEmailNotificationsEnabled(ownerProfile, status);

      console.log("[lab-requests] creating request", { labId: payload.labId, labName: lab.name });
      const created = await labRequestStore.create({
        ...payload,
        labName: lab.name,
      });
      // Also persist a simple contact record in Supabase for linkage by lab_id
      console.log("[lab-requests] inserting contact record");
      const baseContact = {
        lab_id: payload.labId,
        lab_name: lab.name,
        requester_name: payload.requesterName,
        requester_email: payload.requesterEmail,
        organization: payload.organization ?? "",
        message: payload.projectSummary ?? "",
        type: "request",
      };
      const { error: contactError } = await supabase.from("lab_contact_requests").insert({
        ...baseContact,
        preferred_contact_methods: payload.preferredContactMethods ?? ["email"],
      });
      if (contactError) {
        console.error("[lab-requests] contact insert failed, retrying without preferred_contact_methods", contactError);
        const retry = await supabase.from("lab_contact_requests").insert(baseContact);
        if (retry.error) {
          throw retry.error;
        }
      }
      console.log("[lab-requests] sending admin email");
      await sendMail({
        to: process.env.ADMIN_INBOX ?? "contact@glass-funding.com",
        from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
        subject: `New lab request for ${lab.name}`,
        text: [
          `Lab: ${lab.name} (id: ${payload.labId})`,
          `Requester: ${payload.requesterName} <${payload.requesterEmail}>`,
          `Org/Role: ${payload.organization} / ${payload.roleTitle}`,
          `Project: ${payload.projectSummary}`,
          `Timeline: ${payload.workTimeline}`,
          `Weekly hours: ${payload.weeklyHoursNeeded}`,
          `Team size: ${payload.teamSize}`,
          `Equipment: ${payload.equipmentNeeds}`,
          `Compliance notes: ${payload.complianceNotes}`,
          `Requirements: ${payload.specialRequirements}`,
          `Links: ${payload.referencesOrLinks}`,
          `Preferred contact: ${payload.preferredContactMethods?.join(", ") || "N/A"}`,
        ].join("\n"),
        templateId: process.env.BREVO_TEMPLATE_LABREQ_ADMIN
          ? Number(process.env.BREVO_TEMPLATE_LABREQ_ADMIN)
          : undefined,
        params: {
          labName: lab.name,
          requesterName: payload.requesterName,
          requesterEmail: payload.requesterEmail,
          organization: payload.organization,
          roleTitle: payload.roleTitle,
          projectSummary: payload.projectSummary,
          workTimeline: payload.workTimeline,
          weeklyHoursNeeded: payload.weeklyHoursNeeded,
          teamSize: payload.teamSize,
          equipmentNeeds: payload.equipmentNeeds,
          complianceNotes: payload.complianceNotes,
          specialRequirements: payload.specialRequirements,
          referencesOrLinks: payload.referencesOrLinks,
          preferredContact: payload.preferredContactMethods?.join(", ") || "N/A",
          logoUrl: process.env.MAIL_LOGO_URL || undefined,
        },
      });
      // Notify lab contact if available
      if (lab.contactEmail && canForward && canForwardLabRequests(status) && inboxEmailsEnabled) {
        console.log("[lab-requests] sending lab email");
        await sendMail({
          to: lab.contactEmail,
          from: process.env.MAIL_FROM_LAB || process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
          subject: `New lab request for ${lab.name}`,
          text: [
            `You have a new request for ${lab.name}.`,
            `Requester: ${payload.requesterName} <${payload.requesterEmail}>`,
            `Org/Role: ${payload.organization} / ${payload.roleTitle}`,
            `Project: ${payload.projectSummary}`,
            `Timeline: ${payload.workTimeline}`,
            `Weekly hours: ${payload.weeklyHoursNeeded}`,
            `Team size: ${payload.teamSize}`,
            `Equipment: ${payload.equipmentNeeds}`,
            `Compliance notes: ${payload.complianceNotes}`,
            `Requirements: ${payload.specialRequirements}`,
            `Links: ${payload.referencesOrLinks}`,
            `Preferred contact: ${payload.preferredContactMethods?.join(", ") || "N/A"}`,
          ].join("\n"),
          templateId: process.env.BREVO_TEMPLATE_LABREQ_LAB
            ? Number(process.env.BREVO_TEMPLATE_LABREQ_LAB)
            : undefined,
          params: {
            labName: lab.name,
            requesterName: payload.requesterName,
            requesterEmail: payload.requesterEmail,
            organization: payload.organization,
            roleTitle: payload.roleTitle,
            projectSummary: payload.projectSummary,
            workTimeline: payload.workTimeline,
            weeklyHoursNeeded: payload.weeklyHoursNeeded,
            teamSize: payload.teamSize,
            equipmentNeeds: payload.equipmentNeeds,
            complianceNotes: payload.complianceNotes,
            specialRequirements: payload.specialRequirements,
            referencesOrLinks: payload.referencesOrLinks,
            preferredContact: payload.preferredContactMethods?.join(", ") || "N/A",
            logoUrl: process.env.MAIL_LOGO_URL || undefined,
          },
        });
      }
      res.status(201).json(created);
    } catch (error) {
      console.error("[lab-requests] failed", error);
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res
          .status(400)
          .json({ message: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid lab request payload" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to submit lab request" });
    }
  });

  app.patch("/api/lab-requests/:id/status", authenticate, async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid request id" });

    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAdmin) {
        return res.status(403).json({ message: "Only admins can update request status." });
      }

      const data = updateLabRequestStatusSchema.parse(req.body);
      const updated = await labRequestStore.updateStatus(id, data);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res
          .status(400)
          .json({ message: issue?.message ?? "Invalid status update" });
      }
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Unable to update request status" });
    }
  });
}
