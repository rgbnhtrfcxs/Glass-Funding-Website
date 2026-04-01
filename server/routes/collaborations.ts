// server/routes/collaborations.ts
import { type Express } from "express";
import { ZodError } from "zod";
import { labStore } from "../labs-store.js";
import { labCollaborationStore } from "../collaboration-store.js";
import { sendMail } from "../mailer.js";
import { insertLabCollaborationSchema } from "@shared/collaborations";
import {
  fetchProfileCapabilities,
  normalizeLabStatus,
  canForwardLabRequests,
  resolveInboxEmailNotificationsEnabled,
  createRateLimiter,
} from "./shared/helpers.js";

export function registerCollaborationRoutes(app: Express): void {
  const publicRequestRateLimit = createRateLimiter("public-request", 20, 10 * 60 * 1000);

  // --------- Lab Collaborations ----------
  app.post("/api/lab-collaborations", publicRequestRateLimit, async (req, res) => {
    try {
      const payload = insertLabCollaborationSchema.parse(req.body);
      const lab = await labStore.findById(payload.labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const status = normalizeLabStatus(lab.labStatus);
      if (status === "listed" || status === "confirmed") {
        return res.status(403).json({ message: "This lab is not accepting collaboration requests yet." });
      }
      const ownerProfile = lab.ownerUserId ? await fetchProfileCapabilities(lab.ownerUserId) : null;
      const canForward = ownerProfile?.canBrokerRequests;
      const inboxEmailsEnabled = resolveInboxEmailNotificationsEnabled(ownerProfile, status);

      const created = await labCollaborationStore.create({
        ...payload,
        labName: lab.name,
      });
      // Notify internal inbox
      await sendMail({
        to: process.env.ADMIN_INBOX ?? "contact@glass-funding.com",
        from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
        subject: `New collaboration inquiry for ${lab.name}`,
        text: [
          `Lab: ${lab.name} (id: ${payload.labId})`,
          `Contact: ${payload.contactName} <${payload.contactEmail}>`,
          `Preferred contact: ${payload.preferredContact ?? "email"}`,
          `Targets: ${payload.targetLabs ?? "N/A"}`,
          `Focus: ${payload.collaborationFocus ?? "N/A"}`,
          `Resources offered: ${payload.resourcesOffered ?? "N/A"}`,
          `Timeline: ${payload.desiredTimeline ?? "N/A"}`,
          `Notes: ${payload.additionalNotes ?? "N/A"}`,
        ].join("\n"),
        templateId: process.env.BREVO_TEMPLATE_COLLAB_ADMIN
          ? Number(process.env.BREVO_TEMPLATE_COLLAB_ADMIN)
          : undefined,
        params: {
          labName: lab.name,
          contactName: payload.contactName,
          contactEmail: payload.contactEmail,
          preferredContact: payload.preferredContact ?? "email",
          targets: payload.targetLabs ?? "N/A",
          focus: payload.collaborationFocus ?? "N/A",
          resources: payload.resourcesOffered ?? "N/A",
          timeline: payload.desiredTimeline ?? "N/A",
          notes: payload.additionalNotes ?? "N/A",
          logoUrl: process.env.MAIL_LOGO_URL || undefined,
        },
      });
      // Notify lab contact if available
      if (lab.contactEmail && canForward && canForwardLabRequests(status) && inboxEmailsEnabled) {
        await sendMail({
          to: lab.contactEmail,
          from: process.env.MAIL_FROM_LAB || process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
          subject: `New collaboration request for ${lab.name}`,
          text: [
            `You have a new collaboration request for ${lab.name}.`,
            `Contact: ${payload.contactName} <${payload.contactEmail}>`,
            `Preferred contact: ${payload.preferredContact ?? "email"}`,
            `Focus: ${payload.collaborationFocus ?? "N/A"}`,
            `Timeline: ${payload.desiredTimeline ?? "N/A"}`,
            `Targets: ${payload.targetLabs ?? "N/A"}`,
            `Resources offered: ${payload.resourcesOffered ?? "N/A"}`,
            `Notes: ${payload.additionalNotes ?? "N/A"}`,
          ].join("\n"),
          templateId: process.env.BREVO_TEMPLATE_COLLAB_LAB
            ? Number(process.env.BREVO_TEMPLATE_COLLAB_LAB)
            : undefined,
          params: {
            labName: lab.name,
            contactName: payload.contactName,
            contactEmail: payload.contactEmail,
            preferredContact: payload.preferredContact ?? "email",
            targets: payload.targetLabs ?? "N/A",
            focus: payload.collaborationFocus ?? "N/A",
            resources: payload.resourcesOffered ?? "N/A",
            timeline: payload.desiredTimeline ?? "N/A",
            notes: payload.additionalNotes ?? "N/A",
            logoUrl: process.env.MAIL_LOGO_URL || undefined,
          },
        });
      }
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res
          .status(400)
          .json({ message: issue?.message ?? "Invalid collaboration payload" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to submit collaboration" });
    }
  });
}
