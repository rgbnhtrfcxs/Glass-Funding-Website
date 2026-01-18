// server/routes.ts
import express, { Express } from "express";
import { createServer } from "http";
import { supabase } from "./supabaseClient.js";
import { storage } from "./storage";
import { labStore } from "./labs-store";
import { labRequestStore } from "./lab-requests-store";
import { labCollaborationStore } from "./collaboration-store";
import { sendMail } from "./mailer";
import jwt from "jsonwebtoken";
import { supabasePublic } from "./supabasePublicClient.js";
import { Buffer } from "node:buffer";

import { z, ZodError } from "zod";

import {
  insertWaitlistSchema,
  insertContactSchema,
} from "@shared/schema";

import { insertLabCollaborationSchema } from "@shared/collaborations";
import {
  insertLabRequestSchema,
  updateLabRequestStatusSchema,
} from "@shared/labRequests";
import { insertLabViewSchema } from "@shared/views";

import { insertDonationSchema } from "@shared/donations";

// Avoid duplicate "viewed" notifications during a single server runtime
const viewedNotifyCache = new Set<string>();

const defaultPricing = [
  {
    name: "Base",
    monthly_price: 0,
    description: "Launch on GLASS-Connect with the essentials.",
    highlights: ["Profile page", "Equipment showcase", "Inbound contact form"],
    featured: false,
    sort_order: 1,
  },
  {
    name: "Verified",
    monthly_price: 99,
    description: "Add the badge researchers trust.",
    highlights: ["Remote/on-site verification", "Badge on listing", "Priority placement"],
    featured: false,
    sort_order: 2,
  },
  {
    name: "Premier",
    monthly_price: 199,
    description: "Flagship placement plus media support.",
    highlights: ["Free verification", "Direct collaboration management", "Seminar access"],
    featured: true,
    sort_order: 3,
  },
  {
    name: "Custom",
    monthly_price: null,
    description: "For networks or operators managing multiple labs.",
    highlights: ["Central billing", "Dedicated partner manager", "API & tooling access"],
    featured: false,
    sort_order: 4,
  },
] as const;

const insertNewsSchema = z.object({
  labId: z.number(),
  title: z.string().min(1, "Title is required"),
  summary: z.string().min(1, "Summary is required"),
  category: z.string().default("update"),
  images: z
    .array(
      z.object({
        url: z.string().url("Image URL must be valid"),
        name: z.string().min(1),
      }),
    )
    .max(4)
    .optional()
    .default([]),
  authorId: z.string().uuid().nullable().optional(),
});

const insertVerificationRequestSchema = z.object({
  labId: z.number(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

const insertInvestorRequestSchema = z.object({
  labId: z.number(),
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  company: z.string().optional().nullable(),
  website: z.string().url("Website must be a valid URL").optional().nullable(),
  message: z.string().min(10, "Please provide a short message"),
});

const insertLegalAssistSchema = z.object({
  labId: z.number().optional(),
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  topic: z.string().min(3, "Topic is required"),
  details: z.string().min(10, "Please add a short description"),
});

export function registerRoutes(app: Express) {
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // --------- Donations ----------
  app.post("/api/donations", async (req, res) => {
    try {
      const payload = insertDonationSchema.parse(req.body);
      const { data, error } = await supabase
        .from("donations")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      res.status(201).json(data);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res
          .status(400)
          .json({ message: issue?.message ?? "Invalid donation payload" });
      }
      res
        .status(500)
        .json({ message: error instanceof Error ? error.message : "Unable to save donation" });
    }
  });

  app.get("/api/donations", async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from("donations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json(data ?? []);
    } catch (error) {
      res
        .status(500)
        .json({ message: error instanceof Error ? error.message : "Unable to load donations" });
    }
  });

  // --------- Stripe Checkout for donations ----------
  app.post("/api/donations/checkout", async (req, res) => {
    try {
      const { amount, email, donorType, recurring, ...meta } = req.body ?? {};
      const amountNumber = Number(amount);
      if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }
      if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({ message: "Valid email is required" });
      }
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ message: "Stripe not configured" });

      const params = new URLSearchParams();
      params.append("amount", Math.round(amountNumber * 100).toString());
      params.append("currency", "eur");
      params.append("receipt_email", email.trim());
      params.append("description", "Glass Connect donation");
      params.append("automatic_payment_methods[enabled]", "true");

      const metaEntries = {
        donorType: donorType || "",
        recurring: recurring ? "true" : "false",
        ...meta,
      };
      Object.entries(metaEntries).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          params.append(`metadata[${key}]`, String(val));
        }
      });

      const response = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(500).json({ message: "Stripe error", detail: errorText });
      }
      const intent = await response.json();
      return res.status(200).json({ client_secret: intent.client_secret });
    } catch (error) {
      res
        .status(500)
        .json({ message: error instanceof Error ? error.message : "Unable to create payment intent" });
    }
  });

  // --------- Stripe Checkout for subscriptions ----------
  app.post("/api/subscriptions/checkout", async (req, res) => {
    try {
      const { plan, interval } = req.body ?? {};
      const planKey = typeof plan === "string" ? plan.toLowerCase() : "";
      const intervalKey = typeof interval === "string" ? interval.toLowerCase() : "monthly";
      if (!planKey || !["verified", "premier"].includes(planKey)) {
        return res.status(400).json({ message: "Invalid plan" });
      }
      if (!["monthly", "yearly"].includes(intervalKey)) {
        return res.status(400).json({ message: "Invalid interval" });
      }

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ message: "Stripe not configured" });

      const priceId =
        planKey === "verified"
          ? intervalKey === "yearly"
            ? process.env.STRIPE_PRICE_VERIFIED_YEARLY
            : process.env.STRIPE_PRICE_VERIFIED_MONTHLY
          : intervalKey === "yearly"
            ? process.env.STRIPE_PRICE_PREMIER_YEARLY
            : process.env.STRIPE_PRICE_PREMIER_MONTHLY;

      if (!priceId) {
        return res.status(500).json({ message: "Stripe price not configured" });
      }

      const successUrl =
        process.env.STRIPE_SUCCESS_URL ||
        `${req.protocol}://${req.get("host")}/account?status=subscription_success&plan=${planKey}`;
      const cancelUrl =
        process.env.STRIPE_CANCEL_URL ||
        `${req.protocol}://${req.get("host")}/pricing?status=subscription_cancel`;

      const params = new URLSearchParams();
      params.append("mode", "subscription");
      params.append("line_items[0][price]", priceId);
      params.append("line_items[0][quantity]", "1");
      params.append("success_url", successUrl);
      params.append("cancel_url", cancelUrl);

      if (req.user?.email) {
        params.append("customer_email", req.user.email);
      }
      params.append("metadata[plan]", planKey);
      params.append("metadata[interval]", intervalKey);

      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(500).json({ message: "Stripe error", detail: errorText });
      }
      const session = await response.json();
      return res.status(200).json({ url: session.url });
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Unable to create subscription session",
      });
    }
  });

  // --------- Stripe embedded subscription intent ----------
  app.post("/api/subscriptions/intent", async (req, res) => {
    try {
      const { plan, interval, email } = req.body ?? {};
      const planKey = typeof plan === "string" ? plan.toLowerCase() : "";
      const intervalKey = typeof interval === "string" ? interval.toLowerCase() : "yearly";
      const emailValue = typeof email === "string" ? email.trim() : "";

      if (!planKey || !["verified", "premier"].includes(planKey)) {
        return res.status(400).json({ message: "Invalid plan" });
      }
      if (!["monthly", "yearly"].includes(intervalKey)) {
        return res.status(400).json({ message: "Invalid interval" });
      }
      if (!emailValue) {
        return res.status(400).json({ message: "Email is required" });
      }

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ message: "Stripe not configured" });

      const priceId =
        planKey === "verified"
          ? intervalKey === "yearly"
            ? process.env.STRIPE_PRICE_VERIFIED_YEARLY
            : process.env.STRIPE_PRICE_VERIFIED_MONTHLY
          : intervalKey === "yearly"
            ? process.env.STRIPE_PRICE_PREMIER_YEARLY
            : process.env.STRIPE_PRICE_PREMIER_MONTHLY;

      if (!priceId) {
        return res.status(500).json({ message: "Stripe price not configured" });
      }

      const customerParams = new URLSearchParams();
      customerParams.append("email", emailValue);
      if (req.user?.id) {
        customerParams.append("metadata[user_id]", req.user.id);
      }
      const customerRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: customerParams.toString(),
      });
      if (!customerRes.ok) {
        const errorText = await customerRes.text();
        return res.status(500).json({ message: "Stripe error", detail: errorText });
      }
      const customer = await customerRes.json();

      const params = new URLSearchParams();
      params.append("customer", customer.id);
      params.append("items[0][price]", priceId);
      params.append("payment_behavior", "default_incomplete");
      params.append("collection_method", "charge_automatically");
      params.append("expand[]", "latest_invoice.payment_intent");
      params.append("metadata[plan]", planKey);
      params.append("metadata[interval]", intervalKey);

      const subRes = await fetch("https://api.stripe.com/v1/subscriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      if (!subRes.ok) {
        const errorText = await subRes.text();
        return res.status(500).json({ message: "Stripe error", detail: errorText });
      }
      const subscription = await subRes.json();
      const clientSecret = subscription?.latest_invoice?.payment_intent?.client_secret;
      if (!clientSecret) {
        return res.status(500).json({ message: "Missing payment intent" });
      }
      return res.status(200).json({ client_secret: clientSecret });
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Unable to create subscription intent",
      });
    }
  });

  // --------- HAL publications ----------
  app.get("/api/labs/:id/hal-publications", async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });

      const { data, error } = await supabase
        .from("labs")
        .select("hal_structure_id, hal_person_id")
        .eq("id", labId)
        .maybeSingle();
      if (error) throw error;
      const halStructureId = data?.hal_structure_id;
      const halPersonId = data?.hal_person_id;
      if (!halStructureId && !halPersonId) return res.status(404).json({ message: "HAL ID not set" });

      const params = new URLSearchParams();
      const queryParts: string[] = [];
      if (halStructureId) {
        const numericId = halStructureId.replace(/\D/g, "");
        queryParts.push(`structId_s:${halStructureId}`);
        if (numericId) {
          queryParts.push(`structId_i:${numericId}`);
        }
      }
      if (halPersonId) {
        const numericId = halPersonId.replace(/\D/g, "");
        queryParts.push(`authId_s:${halPersonId}`);
        if (numericId) {
          queryParts.push(`authId_i:${numericId}`);
        }
      }
      params.set("q", queryParts.length > 1 ? `(${queryParts.join(" OR ")})` : queryParts[0]);
      params.set("wt", "json");
      params.set("rows", "50");
      params.set("fl", "title_s,uri_s,doiId_s,publicationDateY_i,authFullName_s");

      const response = await fetch(`https://api.archives-ouvertes.fr/search/?${params.toString()}`);
      if (!response.ok) {
        const txt = await response.text();
        return res.status(500).json({ message: "HAL error", detail: txt });
      }
      const payload = await response.json();
      const docs = payload?.response?.docs ?? [];
      const items = docs.map((doc: any) => ({
        title: Array.isArray(doc.title_s) ? doc.title_s[0] : doc.title_s,
        url: doc.uri_s || doc.doiId_s || "",
        doi: doc.doiId_s || null,
        year: doc.publicationDateY_i || null,
        authors: doc.authFullName_s || [],
      }));
      res.json({ items });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load HAL publications" });
    }
  });

  // --------- HAL patents ----------
  app.get("/api/labs/:id/hal-patents", async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });

      const { data, error } = await supabase
        .from("labs")
        .select("hal_structure_id, hal_person_id")
        .eq("id", labId)
        .maybeSingle();
      if (error) throw error;
      const halStructureId = data?.hal_structure_id;
      const halPersonId = data?.hal_person_id;
      if (!halStructureId && !halPersonId) return res.status(404).json({ message: "HAL ID not set" });

      const params = new URLSearchParams();
      const queryParts: string[] = [];
      if (halStructureId) {
        const numericId = halStructureId.replace(/\D/g, "");
        queryParts.push(`structId_s:${halStructureId}`);
        if (numericId) {
          queryParts.push(`structId_i:${numericId}`);
        }
      }
      if (halPersonId) {
        const numericId = halPersonId.replace(/\D/g, "");
        queryParts.push(`authId_s:${halPersonId}`);
        if (numericId) {
          queryParts.push(`authId_i:${numericId}`);
        }
      }
      const query = queryParts.length > 1 ? `(${queryParts.join(" OR ")})` : queryParts[0];
      params.set("q", `${query} AND docType_s:patent`);
      params.set("wt", "json");
      params.set("rows", "50");
      params.set("fl", "title_s,uri_s,doiId_s,publicationDateY_i,authFullName_s");

      const response = await fetch(`https://api.archives-ouvertes.fr/search/?${params.toString()}`);
      if (!response.ok) {
        const txt = await response.text();
        return res.status(500).json({ message: "HAL error", detail: txt });
      }
      const payload = await response.json();
      const docs = payload?.response?.docs ?? [];
      const items = docs.map((doc: any) => ({
        title: Array.isArray(doc.title_s) ? doc.title_s[0] : doc.title_s,
        url: doc.uri_s || doc.doiId_s || "",
        doi: doc.doiId_s || null,
        year: doc.publicationDateY_i || null,
        authors: doc.authFullName_s || [],
      }));
      res.json({ items });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load HAL patents" });
    }
  });

  // --------- Waitlist ----------
  app.post("/api/waitlist", async (req, res) => {
    try {
      const data = insertWaitlistSchema.parse(req.body);
      const result = await storage.addToWaitlist(data);
      res.json(result);
    } catch (_error) {
      res.status(400).json({ message: "Invalid waitlist submission" });
    }
  });

  // --------- Contact ----------
  app.post("/api/contact", async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      const result = await storage.submitContact(data);
      res.json(result);
    } catch (_error) {
      res.status(400).json({ message: "Invalid contact submission" });
    }
  });

  // --------- Labs ----------
  app.get("/api/labs", async (req, res) => {
    const includeHidden = req.query.includeHidden === "true" || req.query.includeHidden === "1";
    const labs = includeHidden ? await labStore.list() : await labStore.listVisible();
    res.json(labs);
  });

  app.post("/api/labs", async (req, res) => {
    try {
      const ownerId = req.body?.ownerUserId || req.body?.owner_user_id || null;
      if (ownerId) {
        const { data: profileRow, error: profErr } = await supabase
          .from("profiles")
          .select("subscription_tier, role")
          .eq("user_id", ownerId)
          .maybeSingle();
        if (profErr) throw profErr;
        const tier = (profileRow?.subscription_tier || "base").toLowerCase();
        const role = (profileRow?.role || "").toLowerCase();
        const multiLab = role === "multi-lab" || role === "admin";
        if (!multiLab) {
          const { count, error: countErr } = await supabase
            .from("labs")
            .select("id", { count: "exact", head: true })
            .eq("owner_user_id", ownerId);
          if (countErr) throw countErr;
          if ((count ?? 0) >= 1) {
            return res
              .status(403)
              .json({ message: "Only multi-lab accounts can manage more than one lab. Upgrade to add another." });
          }
        }
      }
      const lab = await labStore.create(req.body);
      res.status(201).json(lab);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res
          .status(400)
          .json({ message: issue?.message ?? "Invalid lab payload" });
      }
      res.status(500).json({ message: "Unable to create lab" });
    }
  });

  app.put("/api/labs/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid lab id" });
    }
    try {
      const lab = await labStore.update(id, req.body);
      res.json(lab);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res
          .status(400)
          .json({ message: issue?.message ?? "Invalid lab update" });
      }
      if (error instanceof Error && error.message === "Lab not found") {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Unable to update lab" });
    }
  });

  app.delete("/api/labs/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid lab id" });
    }
    try {
      await labStore.delete(id);
      res.status(204).end();
    } catch (error) {
      if (error instanceof Error && error.message === "Lab not found") {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Unable to delete lab" });
    }
  });

  // --------- Lab Collaborations ----------
  app.post("/api/lab-collaborations", async (req, res) => {
    try {
      const payload = insertLabCollaborationSchema.parse(req.body);
      const lab = await labStore.findById(payload.labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });

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
      if (lab.contactEmail) {
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

  // --------- Lab Requests ----------
  app.get("/api/lab-requests", async (_req, res) => {
    const requests = await labRequestStore.list();
    res.json(requests);
  });

  app.post("/api/lab-requests", async (req, res) => {
    try {
      const payload = insertLabRequestSchema.parse(req.body);
      const lab = await labStore.findById(payload.labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });

      const created = await labRequestStore.create({
        ...payload,
        labName: lab.name,
      });
      // Also persist a simple contact record in Supabase for linkage by lab_id
      const { error: contactError } = await supabase.from("lab_contact_requests").insert({
        lab_id: payload.labId,
        lab_name: lab.name,
        contact_name: payload.requesterName,
        contact_email: payload.requesterEmail,
        message: payload.projectSummary ?? "",
        preferred_contact_methods: payload.preferredContactMethods ?? [],
      });
      if (contactError) {
        throw contactError;
      }
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
      if (lab.contactEmail) {
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
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res
          .status(400)
          .json({ message: issue?.message ?? "Invalid lab request payload" });
      }
      res.status(500).json({ message: "Unable to submit lab request" });
    }
  });

  app.patch("/api/lab-requests/:id/status", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid request id" });

    try {
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

  // Get a profile by ID
app.get("/api/profile/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return res.status(404).json({ error: error.message });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Create or update a profile
app.post("/api/profile/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body; // e.g., { full_name: "John Doe" }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert({ id, ...updates })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


// Signup
app.post("/api/signup", async (req, res) => {
  try {
    const { email, password, display_name } = req.body;

    const { data, error } = await supabasePublic.auth.signUp({
      email,
      password,
      options: {
        data: { display_name },
      },
    });

    if (error) throw error;

    res.status(201).json({ message: "Signup successful, check your email", user: data.user });
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Signup failed" });
  }
});

// Login
  app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabasePublic.auth.signInWithPassword({ email, password });

    if (error) throw error;

    // Return the session/token
    res.json({
      message: "Login successful",
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      user: data.user,
    });
  } catch (err) {
    res.status(401).json({ message: err instanceof Error ? err.message : "Login failed" });
  }
  });



const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Missing token" });

  const { data, error } = await supabasePublic.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ message: "Invalid token" });

  req.user = data.user;
  next();
};

// Example of a protected route
app.get("/api/profile", authenticate, async (req, res) => {
  res.json({ message: "Authenticated!", user: req.user });
});

  // --------- Lab Favorites ----------
  app.get("/api/labs/:id/favorite", authenticate, async (req, res) => {
    const labId = Number(req.params.id);
    if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
    try {
      const { data, error } = await supabase
        .from("lab_favorites")
        .select("id")
        .eq("lab_id", labId)
        .eq("user_id", req.user.id)
        .maybeSingle();
      if (error) throw error;
      res.json({ favorited: Boolean(data) });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to fetch favorite status" });
    }
  });

  app.post("/api/labs/:id/favorite", authenticate, async (req, res) => {
    const labId = Number(req.params.id);
    if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
    try {
      await supabase.from("lab_favorites").delete().eq("lab_id", labId).eq("user_id", req.user.id);
      const { error } = await supabase
        .from("lab_favorites")
        .insert({ lab_id: labId, user_id: req.user.id })
        .select("id")
        .single();
      if (error) throw error;
      res.json({ favorited: true });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to favorite lab" });
    }
  });

  app.delete("/api/labs/:id/favorite", authenticate, async (req, res) => {
    const labId = Number(req.params.id);
    if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
    try {
      const { error } = await supabase.from("lab_favorites").delete().eq("lab_id", labId).eq("user_id", req.user.id);
      if (error) throw error;
      res.json({ favorited: false });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to remove favorite" });
    }
  });

  app.get("/api/favorites", authenticate, async (req, res) => {
    try {
      const { data, error } = await supabase.from("lab_favorites").select("lab_id").eq("user_id", req.user.id);
      if (error) throw error;
      const labIds = (data ?? []).map(row => Number(row.lab_id)).filter(id => !Number.isNaN(id));
      res.json({ labIds });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load favorites" });
    }
  });

  // --------- Lab News (premier/custom) ----------
  app.post("/api/news", authenticate, async (req, res) => {
    try {
      const payload = insertNewsSchema.parse(req.body);
      const lab = await labStore.findById(payload.labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const tier = ((lab as any).subscriptionTier || (lab as any).subscription_tier || "base").toLowerCase();
      let ownerRole: string | null = null;
      if (lab.ownerUserId) {
        const { data: roleRow } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", lab.ownerUserId)
          .maybeSingle();
        ownerRole = (roleRow?.role as string | null)?.toLowerCase?.() ?? null;
      }
      const premium = tier === "premier" || ownerRole === "multi-lab";
      if (!premium) return res.status(403).json({ message: "Only premier labs or multi-lab accounts can post news" });
      const ownerUserId = (lab as any).ownerUserId || (lab as any).owner_user_id || null;
      if (ownerUserId && payload.authorId && ownerUserId !== payload.authorId) {
        return res.status(403).json({ message: "Not allowed to post for this lab" });
      }

      const { data, error } = await supabase
        .from("lab_news")
        .insert({
          lab_id: payload.labId,
          title: payload.title,
          summary: payload.summary,
          category: payload.category ?? "update",
          images: payload.images ?? [],
          created_by: payload.authorId ?? req.user.id ?? null,
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;
      res.status(201).json(data);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid news payload" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to post news" });
    }
  });

  app.get("/api/news/mine", authenticate, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("lab_news")
        .select("id, lab_id, title, summary, category, images, status, created_at, labs!inner(name, subscription_tier, owner_user_id)")
        .eq("labs.owner_user_id", req.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json({ news: data ?? [] });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load news" });
    }
  });

  app.get("/api/news/public", async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from("lab_news")
        .select("id, lab_id, title, summary, category, images, status, created_at, labs:lab_id (name, subscription_tier)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      res.json({ news: data ?? [] });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load news" });
    }
  });

  // --------- Investor contact (premier labs) ----------
  app.post("/api/labs/:id/investor", async (req, res) => {
    const labId = Number(req.params.id);
    if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
    try {
      const payload = insertInvestorRequestSchema.parse({ ...req.body, labId });
      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const tier = ((lab as any).subscriptionTier || (lab as any).subscription_tier || "base").toLowerCase();
      if (tier !== "premier") {
        return res.status(403).json({ message: "Investor contact is available for premier labs only" });
      }

      await supabase.from("lab_contact_requests").insert({
        lab_id: labId,
        lab_name: lab.name,
        contact_name: payload.name,
        contact_email: payload.email,
        message: payload.message,
        company: payload.company ?? null,
        website: payload.website ?? null,
        type: "investor",
      });

      const adminEmail = process.env.ADMIN_INBOX ?? "contact@glass-funding.com";
      const labEmail = lab.contactEmail || adminEmail;
      const lines = [
        `Lab: ${lab.name} (id: ${labId})`,
        `From: ${payload.name} <${payload.email}>`,
        payload.company ? `Company: ${payload.company}` : null,
        payload.website ? `Website: ${payload.website}` : null,
        "",
        payload.message,
      ]
        .filter(Boolean)
        .join("\n");

      await Promise.all([
        sendMail({
          to: labEmail,
          from: process.env.MAIL_FROM_LAB || process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
          subject: `Investor inquiry for ${lab.name}`,
          text: lines,
        }),
        sendMail({
          to: adminEmail,
          from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
          subject: `Investor inquiry for ${lab.name}`,
          text: lines,
        }),
      ]);

      res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid investor request" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to send investor request" });
    }
  });

  // --------- Legal assistance contact ----------
  app.post("/api/legal-assist", async (req, res) => {
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

  // --------- Pricing ----------
  app.get("/api/pricing", async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from("pricing_tiers")
        .select("name, monthly_price, description, highlights, featured, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;

      // Optional: load features from pricing_features table if it exists
      let featuresByTier: Record<string, string[]> = {};
      try {
        const { data: featData } = await supabase
          .from("pricing_features")
          .select("tier_name, feature, sort_order")
          .order("sort_order", { ascending: true });
        featuresByTier = (featData ?? []).reduce((acc: Record<string, string[]>, row: any) => {
          const key = row.tier_name;
          acc[key] = acc[key] || [];
          if (row.feature) acc[key].push(row.feature);
          return acc;
        }, {});
      } catch {
        // ignore if table is missing or RLS blocks
      }

      const list = (data ?? []).map(row => ({
        name: row.name,
        monthly_price: row.monthly_price,
        description: row.description,
        highlights:
          featuresByTier[row.name] && featuresByTier[row.name].length
            ? featuresByTier[row.name]
            : Array.isArray(row.highlights)
              ? row.highlights
              : defaultPricing.find(d => d.name === row.name)?.highlights ?? [],
        featured: row.featured ?? false,
        sort_order: row.sort_order ?? 999,
      }));
      res.json({ tiers: list.length ? list : defaultPricing });
    } catch (error) {
      res.json({ tiers: defaultPricing });
    }
  });

  // --------- Verification Requests ----------
  app.post("/api/verification-requests", authenticate, async (req, res) => {
    try {
      const payload = insertVerificationRequestSchema.parse(req.body);
      const lab = await labStore.findById(payload.labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const ownerId = (lab as any).ownerUserId || (lab as any).owner_user_id;
      if (ownerId && ownerId !== req.user.id) {
        return res.status(403).json({ message: "You cannot request verification for this lab" });
      }

      // Update address if provided
      const addressUpdate = {
        address_line1: payload.addressLine1 || null,
        address_line2: payload.addressLine2 || null,
        city: payload.city || null,
        state: payload.state || null,
        postal_code: payload.postalCode || null,
        country: payload.country || null,
      };
      const hasAddress = Object.values(addressUpdate).some(v => v && String(v).trim().length > 0);
      if (hasAddress) {
        await supabase.from("labs").update(addressUpdate).eq("id", payload.labId);
      }

      // Store request (requires table to exist)
      await supabase.from("lab_verification_requests").insert({
        lab_id: payload.labId,
        requested_by: req.user.id,
        address_line1: payload.addressLine1 || null,
        address_line2: payload.addressLine2 || null,
        city: payload.city || null,
        state: payload.state || null,
        postal_code: payload.postalCode || null,
        country: payload.country || null,
        status: "received",
      });

      const adminInbox = process.env.ADMIN_INBOX ?? "contact@glass-funding.com";
      const userEmail = req.user.email || (lab as any).contactEmail || (lab as any).contact_email;

      // Notify admin
      await sendMail({
        to: adminInbox,
        from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
        subject: `Verification request for ${lab.name}`,
        text: [
          `Lab: ${lab.name} (id: ${payload.labId})`,
          `Requested by user: ${req.user.id}`,
          `Address line1: ${payload.addressLine1 || (lab as any).addressLine1 || (lab as any).address_line1 || "N/A"}`,
          `Address line2: ${payload.addressLine2 || (lab as any).addressLine2 || (lab as any).address_line2 || "N/A"}`,
          `City: ${payload.city || (lab as any).city || "N/A"}`,
          `State: ${payload.state || (lab as any).state || "N/A"}`,
          `Postal code: ${payload.postalCode || (lab as any).postalCode || (lab as any).postal_code || "N/A"}`,
          `Country: ${payload.country || (lab as any).country || "N/A"}`,
          `Note: On-site verification requested; please follow up for scheduling and costs.`,
        ].join("\n"),
        templateId: process.env.BREVO_TEMPLATE_VERIFY_ADMIN
          ? Number(process.env.BREVO_TEMPLATE_VERIFY_ADMIN)
          : undefined,
        params: {
          labName: lab.name,
          requester: req.user.id,
          address: [
            payload.addressLine1 || (lab as any).addressLine1 || (lab as any).address_line1 || "",
            payload.addressLine2 || (lab as any).addressLine2 || (lab as any).address_line2 || "",
            payload.city || (lab as any).city || "",
            payload.state || (lab as any).state || "",
            payload.postalCode || (lab as any).postalCode || (lab as any).postal_code || "",
            payload.country || (lab as any).country || "",
          ]
            .filter(Boolean)
            .join(", "),
          logoUrl: process.env.MAIL_LOGO_URL || undefined,
        },
      });

      // Notify user
      if (userEmail) {
        await sendMail({
          to: userEmail,
          from: process.env.MAIL_FROM_USER || process.env.MAIL_FROM,
          subject: `We received your verification request for ${lab.name}`,
          text: `Thanks! We received your request to verify ${lab.name}. Our team will reach out to schedule an on-site visit (additional cost applies).\nAddress: ${
            payload.addressLine1 ||
            (lab as any).addressLine1 ||
            (lab as any).address_line1 ||
            ""
          } ${payload.city || (lab as any).city || ""} ${payload.country || (lab as any).country || ""}`.trim(),
          templateId: process.env.BREVO_TEMPLATE_VERIFY_USER
            ? Number(process.env.BREVO_TEMPLATE_VERIFY_USER)
            : 9,
          params: {
            labName: lab.name,
            address: [
              payload.addressLine1 || (lab as any).addressLine1 || (lab as any).address_line1 || "",
              payload.addressLine2 || (lab as any).addressLine2 || (lab as any).address_line2 || "",
              payload.city || (lab as any).city || "",
              payload.state || (lab as any).state || "",
              payload.postalCode || (lab as any).postalCode || (lab as any).postal_code || "",
              payload.country || (lab as any).country || "",
            ]
              .filter(Boolean)
              .join(", "),
            logoUrl: process.env.MAIL_LOGO_URL || undefined,
          },
        });
      }

      res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid verification request" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to submit verification request" });
    }
  });

  // --------- Subscription update (after payment confirmation) ----------
  app.post("/api/subscription/confirm", authenticate, async (req, res) => {
    const schema = z.object({
      tier: z.enum(["base", "verified", "premier", "custom"]),
    });
    try {
      const payload = schema.parse(req.body);
      const { error } = await supabase
        .from("profiles")
        .update({
          subscription_tier: payload.tier,
          subscription_status: payload.tier === "base" ? "none" : "active",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", req.user.id);
      if (error) throw error;
      res.json({ ok: true, tier: payload.tier });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid subscription payload" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to update subscription" });
    }
  });

  // --------- Lab Views ----------
  app.post("/api/labs/:id/view", async (req, res) => {
    const labId = Number(req.params.id);
    if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
    try {
      const parsed = insertLabViewSchema.parse(req.body);
      const now = new Date();
      const hourStart = new Date(now);
      hourStart.setMinutes(0, 0, 0);
      const sessionId = parsed.sessionId;
      const referrer = parsed.referrer ?? null;

      // Dedupe: one view per lab per session per hour
      const { data: existing, error: findError } = await supabase
        .from("lab_views")
        .select("id, created_at")
        .eq("lab_id", labId)
        .eq("session_id", sessionId)
        .gte("created_at", hourStart.toISOString())
        .limit(1)
        .maybeSingle();
      if (findError) throw findError;
      if (existing) {
        return res.json({ recorded: false });
      }

      const userToken = req.headers.authorization?.split(" ")[1];
      let userId: string | null = null;
      if (userToken) {
        const { data, error } = await supabasePublic.auth.getUser(userToken);
        if (!error && data?.user?.id) {
          userId = data.user.id;
        }
      }

      const { error } = await supabase
        .from("lab_views")
        .insert({ lab_id: labId, session_id: sessionId, referrer, user_id: userId });
      if (error) throw error;
      res.json({ recorded: true });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid view payload" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to record view" });
    }
  });

  // Lab manager endpoints: manage only the lab tied to their user id (owner_user_id) or claim an unowned lab by contact_email
  app.get("/api/my-lab", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId && !email) return res.status(400).json({ message: "No user on request" });

      let labRow = null;
      if (userId) {
        const { data, error } = await supabase.from("labs").select("id").eq("owner_user_id", userId).maybeSingle();
        if (error) throw error;
        if (data) labRow = data;
      }
      if (!labRow && userId && email) {
        const { data, error } = await supabase
          .from("labs")
          .select("id, owner_user_id")
          .eq("contact_email", email)
          .is("owner_user_id", null)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          await supabase.from("labs").update({ owner_user_id: userId }).eq("id", data.id);
          labRow = { id: data.id };
        }
      }
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      const lab = await labStore.findById(Number(labRow.id));
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      res.json(lab);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load lab" });
    }
  });

  app.get("/api/my-labs", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId && !email) return res.status(400).json({ message: "No user on request" });

      const clauses = [];
      if (userId) clauses.push(`owner_user_id.eq.${userId}`);
      if (email) clauses.push(`contact_email.eq.${email},contact_email.ilike.${email}`);
      const { data, error } = await supabase
        .from("labs")
        .select(
          "id, name, subscription_tier, city, country, logo_url, is_visible, lab_photos (url, name), lab_equipment (item)",
        )
        .or(clauses.join(","));
      if (error) throw error;
      res.json(data ?? []);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load labs" });
    }
  });

  app.get("/api/my-lab/:id", authenticate, async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId && !email) return res.status(400).json({ message: "No user on request" });

      // owner match first
      let labRow = null;
      if (userId) {
        const { data, error } = await supabase.from("labs").select("id").eq("id", labId).eq("owner_user_id", userId).maybeSingle();
        if (error) throw error;
        if (data) labRow = data;
      }
      if (!labRow && email && userId) {
        const { data, error } = await supabase
          .from("labs")
          .select("id, owner_user_id")
          .eq("id", labId)
          .eq("contact_email", email)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          if (!data.owner_user_id) {
            await supabase.from("labs").update({ owner_user_id: userId }).eq("id", data.id);
          }
          labRow = data;
        }
      }
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      res.json(lab);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load lab" });
    }
  });

  app.put("/api/my-lab/:id", authenticate, async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId && !email) return res.status(400).json({ message: "No user on request" });

      let labRow = null;
      if (userId) {
        const { data, error } = await supabase
          .from("labs")
          .select("id")
          .eq("id", labId)
          .eq("owner_user_id", userId)
          .maybeSingle();
        if (error) throw error;
        if (data) labRow = data;
      }
      if (!labRow && email && userId) {
        const { data, error } = await supabase
          .from("labs")
          .select("id, owner_user_id")
          .eq("id", labId)
          .eq("contact_email", email)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          if (!data.owner_user_id) {
            await supabase.from("labs").update({ owner_user_id: userId }).eq("id", data.id);
          }
          labRow = data;
        }
      }
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      const updated = await labStore.update(labId, req.body);
      res.json(updated);
    } catch (err) {
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid lab update" });
      }
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to update lab" });
    }
  });

  app.get("/api/my-lab/analytics", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId && !email) return res.status(400).json({ message: "No user on request" });

      let labRow = null;
      if (userId) {
        const { data, error } = await supabase
          .from("labs")
          .select("id, subscription_tier")
          .eq("owner_user_id", userId)
          .maybeSingle();
        if (error) throw error;
        if (data) labRow = data;
      }
      if (!labRow && userId && email) {
        const { data, error } = await supabase
          .from("labs")
          .select("id, subscription_tier, owner_user_id")
          .eq("contact_email", email)
          .is("owner_user_id", null)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          await supabase.from("labs").update({ owner_user_id: userId }).eq("id", data.id);
          labRow = data;
        }
      }
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      const labId = Number(labRow.id);
      const tier = ((labRow.subscription_tier as string) || "base").toLowerCase();
      let role: string | null = null;
      if (userId) {
        const { data: roleRow } = await supabase.from("profiles").select("role").eq("user_id", userId).maybeSingle();
        role = (roleRow?.role as string | null)?.toLowerCase?.() ?? null;
      }
      if (!(tier === "premier" || role === "multi-lab" || role === "admin")) {
        return res.status(403).json({ message: "Analytics available for premier labs or multi-lab accounts only" });
      }

      const now = new Date();
      const from7 = new Date(now);
      from7.setDate(from7.getDate() - 7);
      const from30 = new Date(now);
      from30.setDate(from30.getDate() - 30);

      const [{ count: views7 }, { count: views30 }, { data: favs }, { data: recentFavs, error: recentFavErr }] = await Promise.all([
        supabase.from("lab_views").select("id", { count: "exact", head: true }).eq("lab_id", labId).gte("created_at", from7.toISOString()),
        supabase.from("lab_views").select("id", { count: "exact", head: true }).eq("lab_id", labId).gte("created_at", from30.toISOString()),
        supabase.from("lab_favorites").select("id", { count: "exact", head: true }).eq("lab_id", labId),
        supabase
          .from("lab_favorites")
          .select("lab_id, user_id, created_at")
          .eq("lab_id", labId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (recentFavErr) throw recentFavErr;

      res.json({
        labId,
        views7d: views7 ?? 0,
        views30d: views30 ?? 0,
        favorites: (favs as any)?.count ?? 0,
        recentFavorites: (recentFavs ?? []).map(row => ({
          labId: labId,
          userId: row.user_id,
          createdAt: row.created_at,
        })),
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load analytics" });
    }
  });

  app.get("/api/my-labs/analytics", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId && !email) return res.status(400).json({ message: "No user on request" });

      const clauses = [];
      if (userId) clauses.push(`owner_user_id.eq.${userId}`);
      if (email) clauses.push(`contact_email.eq.${email},contact_email.ilike.${email}`);
      const { data: labs, error: labsError } = await supabase
        .from("labs")
        .select("id, name, is_visible, subscription_tier, owner_user_id")
        .or(clauses.join(","));
      if (labsError) throw labsError;
      if (!labs || labs.length === 0) return res.json({ labs: [] });

      const labIds = labs.map(l => Number(l.id)).filter(id => !Number.isNaN(id));
      if (!labIds.length) return res.json({ labs: [] });

      const now = new Date();
      const from7 = new Date(now);
      from7.setDate(from7.getDate() - 7);
      const from30 = new Date(now);
      from30.setDate(from30.getDate() - 30);

      const [view7, view30, favs] = await Promise.all([
        supabase.from("lab_views").select("lab_id").in("lab_id", labIds).gte("created_at", from7.toISOString()),
        supabase.from("lab_views").select("lab_id").in("lab_id", labIds).gte("created_at", from30.toISOString()),
        supabase.from("lab_favorites").select("lab_id").in("lab_id", labIds),
      ]);

      const toMap = (rows?: { lab_id: number }[] | null) => {
        const map: Record<number, number> = {};
        (rows ?? []).forEach(row => {
          const id = Number(row.lab_id);
          if (!Number.isNaN(id)) map[id] = (map[id] || 0) + 1;
        });
        return map;
      };

      const view7Map = toMap(view7?.data as any);
      const view30Map = toMap(view30?.data as any);
      const favMap = toMap(favs?.data as any);

      res.json({
        labs: labs.map(lab => ({
          id: lab.id,
          name: lab.name,
          isVisible: lab.is_visible,
          subscriptionTier: lab.subscription_tier,
          views7d: view7Map[lab.id] ?? 0,
          views30d: view30Map[lab.id] ?? 0,
          favorites: favMap[lab.id] ?? 0,
        })),
      });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load analytics" });
    }
  });

  app.get("/api/my-labs/requests", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId && !email) return res.status(400).json({ message: "No user on request" });

      const clauses = [];
      if (userId) clauses.push(`owner_user_id.eq.${userId}`);
      if (email) clauses.push(`contact_email.eq.${email},contact_email.ilike.${email}`);
      const { data: labs, error: labsError } = await supabase
        .from("labs")
        .select("id, name, owner_user_id")
        .or(clauses.join(","));
      if (labsError) throw labsError;
      if (!labs || labs.length === 0) return res.json({ labs: [], collaborations: [], contacts: [] });

      const labNames = labs.map(l => l.name).filter(Boolean);
      const labIds = labs.map(l => Number(l.id)).filter(id => !Number.isNaN(id));
      if (!labIds.length && !labNames.length) return res.json({ labs, collaborations: [], contacts: [] });

      // Prefer matching by lab_id; fall back to case-insensitive lab_name to catch legacy rows
      const [collabs, contacts] = await Promise.all([
        supabase.from("lab_collaborations").select("*").order("created_at", { ascending: false }),
        supabase.from("lab_contact_requests").select("*").order("created_at", { ascending: false }),
      ]);

      if (collabs.error) throw collabs.error;
      if (contacts.error) throw contacts.error;

      const nameSet = new Set(labNames.map(n => (n || "").toLowerCase()));
      const idSet = new Set(labIds);
      const filteredCollabs = (collabs.data ?? []).filter(row => {
        const rowId = Number((row as any).lab_id);
        if (!Number.isNaN(rowId) && idSet.has(rowId)) return true;
        return nameSet.has((row.lab_name || "").toLowerCase());
      });
      const filteredContacts = (contacts.data ?? []).filter(row => {
        const rowId = Number((row as any).lab_id);
        if (!Number.isNaN(rowId) && idSet.has(rowId)) return true;
        return nameSet.has((row.lab_name || "").toLowerCase());
      });

      res.json({
        labs,
        collaborations: filteredCollabs,
        contacts: filteredContacts,
      });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load requests" });
    }
  });

  app.post("/api/my-labs/requests/viewed", authenticate, async (req, res) => {
    try {
      const { contactEmail, labName, type } = req.body || {};
      if (!contactEmail) return res.status(400).json({ message: "Missing contact email" });

      // One notification per (email + labName + type) per runtime
      const cacheKey = `${(contactEmail || "").toLowerCase()}|${(labName || "").toLowerCase()}|${type || "request"}`;
      if (viewedNotifyCache.has(cacheKey)) {
        return res.json({ ok: true, skipped: "already_notified" });
      }

      try {
        await sendMail({
          to: contactEmail,
          from: process.env.MAIL_FROM_USER || process.env.MAIL_FROM,
          subject: `Your request to ${labName ?? "the lab"} is being reviewed`,
          text: `Thanks for reaching out about ${labName ?? "our lab"}. Our team is viewing your ${type ?? "request"} now and will respond soon.`,
          templateId: process.env.BREVO_TEMPLATE_REQUEST_VIEWED ? Number(process.env.BREVO_TEMPLATE_REQUEST_VIEWED) : undefined,
          params: {
            labName: labName ?? "our lab",
            requestType: type ?? "request",
            logoUrl: process.env.MAIL_LOGO_URL || undefined,
          },
        });
        viewedNotifyCache.add(cacheKey);
      } catch (mailErr) {
        // Swallow email errors to avoid blocking the UI
        console.error("Failed to send viewed notification", mailErr);
      }

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to record request view" });
    }
  });

  app.put("/api/my-lab", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId && !email) return res.status(400).json({ message: "No user on request" });

      let labRow = null;
      if (userId) {
        const { data, error } = await supabase.from("labs").select("id").eq("owner_user_id", userId).maybeSingle();
        if (error) throw error;
        if (data) labRow = data;
      }
      if (!labRow && email && userId) {
        const { data, error } = await supabase
          .from("labs")
          .select("id, owner_user_id")
          .eq("contact_email", email)
          .is("owner_user_id", null)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          await supabase.from("labs").update({ owner_user_id: userId }).eq("id", data.id);
          labRow = data;
        }
      }
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      const labId = Number(labRow.id);
      const updated = await labStore.update(labId, req.body);
      res.json(updated);
    } catch (err) {
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid lab update" });
      }
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to update lab" });
    }
  });



  // --------- Return HTTP server ----------
  return createServer(app);
}
