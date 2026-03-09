// server/routes/public-forms.ts
import { type Express } from "express";
import { ZodError } from "zod";
import { storage } from "../storage.js";
import { labStore } from "../labs-store.js";
import { sendMail } from "../mailer.js";
import { insertWaitlistSchema, insertContactSchema } from "@shared/schema";
import { createRateLimiter } from "./shared/helpers.js";
import { z } from "zod";

const insertOnboardingCallRequestSchema = z.object({
  labName: z.string().trim().min(2, "Lab name is required").max(160, "Lab name is too long"),
  website: z.string().trim().min(3, "Website is required").max(255, "Website is too long"),
  contactName: z.string().trim().min(2, "Contact name is required").max(120, "Contact name is too long"),
  contactEmail: z.string().trim().email("Valid contact email is required"),
  contactPhone: z.string().trim().max(80, "Contact phone is too long").optional(),
  notes: z.string().trim().max(2000, "Notes are too long").optional(),
});

const insertLegalAssistSchema = z.object({
  labId: z.number().optional(),
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  topic: z.string().min(3, "Topic is required"),
  details: z.string().min(10, "Please add a short description"),
});

export function registerPublicFormRoutes(app: Express): void {
  const publicFormRateLimit = createRateLimiter("public-form", 20, 10 * 60 * 1000);
  const publicRequestRateLimit = createRateLimiter("public-request", 20, 10 * 60 * 1000);

  // --------- Waitlist ----------
  app.post("/api/waitlist", publicFormRateLimit, async (req, res) => {
    try {
      const data = insertWaitlistSchema.parse(req.body);
      const result = await storage.addToWaitlist(data);
      res.json(result);
    } catch (_error) {
      res.status(400).json({ message: "Invalid waitlist submission" });
    }
  });

  // --------- Contact ----------
  app.post("/api/contact", publicFormRateLimit, async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      const result = await storage.submitContact(data);
      res.json(result);
    } catch (_error) {
      res.status(400).json({ message: "Invalid contact submission" });
    }
  });

  app.post("/api/onboarding-call-request", publicFormRateLimit, async (req, res) => {
    try {
      const payload = insertOnboardingCallRequestSchema.parse(req.body);
      const adminEmail = process.env.ADMIN_INBOX ?? "contact@glass-funding.com";
      const phone = payload.contactPhone?.trim();
      const notes = payload.notes?.trim();

      const adminLines = [
        "New onboarding call request",
        "",
        `Lab: ${payload.labName}`,
        `Website: ${payload.website}`,
        `Contact: ${payload.contactName} <${payload.contactEmail}>`,
        phone ? `Phone: ${phone}` : null,
        notes ? "" : null,
        notes ? "Notes:" : null,
        notes || null,
      ]
        .filter(Boolean)
        .join("\n");

      const confirmationLines = [
        `Hi ${payload.contactName},`,
        "",
        "Thanks for requesting an onboarding call with GLASS.",
        "We received your request and will get back to you shortly.",
        "",
        `Lab: ${payload.labName}`,
        `Website: ${payload.website}`,
        phone ? `Phone: ${phone}` : null,
        notes ? `Notes: ${notes}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      await Promise.all([
        sendMail({
          to: adminEmail,
          from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
          subject: `Onboarding call request: ${payload.labName}`,
          text: adminLines,
        }),
        sendMail({
          to: payload.contactEmail,
          from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
          subject: "We received your onboarding request",
          text: confirmationLines,
        }),
      ]);

      res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid onboarding request" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to submit onboarding request" });
    }
  });

  // --------- Legal assistance contact ----------
  app.post("/api/legal-assist", publicRequestRateLimit, async (req, res) => {
    try {
      const payload = insertLegalAssistSchema.parse(req.body);
      const lab = payload.labId ? await labStore.findById(payload.labId) : null;
      const adminEmail = process.env.ADMIN_INBOX ?? "contact@glass-funding.com";
      const legalEmail = process.env.LEGAL_INBOX ?? adminEmail;
      const lines = [
        `From: ${payload.name} <${payload.email}>`,
        payload.topic ? `Topic: ${payload.topic}` : null,
        lab ? `Lab: ${lab.name} (id: ${lab.id})` : null,
        "",
        payload.details,
      ]
        .filter(Boolean)
        .join("\n");
      await Promise.all([
        sendMail({
          to: legalEmail,
          from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
          subject: lab ? `Legal assistance request for ${lab.name}` : "Legal assistance request",
          text: lines,
        }),
        sendMail({
          to: adminEmail,
          from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
          subject: lab ? `Legal assistance request for ${lab.name}` : "Legal assistance request",
          text: lines,
        }),
      ]);
      res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid legal assistance payload" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to send legal request" });
    }
  });
}
