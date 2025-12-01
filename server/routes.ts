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

import { ZodError } from "zod";

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
      await supabase.from("lab_contact_requests").insert({
        lab_id: payload.labId,
        lab_name: lab.name,
        contact_name: payload.requesterName,
        contact_email: payload.requesterEmail,
        message: payload.projectSummary ?? "",
      });
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
          `Verification: ${payload.verification}`,
          `Verification proof: ${payload.verificationProof}`,
          `Preferred contact: ${payload.preferredContactMethod}`,
          `Delivery window: ${payload.preferredDeliveryWindow}`,
          `Agree to review: ${payload.agreeToReview}`,
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
          preferredContact: payload.preferredContactMethod,
          deliveryWindow: payload.preferredDeliveryWindow,
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
            `Preferred contact: ${payload.preferredContactMethod}`,
            `Delivery window: ${payload.preferredDeliveryWindow}`,
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
            preferredContact: payload.preferredContactMethod,
            deliveryWindow: payload.preferredDeliveryWindow,
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
          "id, name, subscription_tier, location, logo_url, is_visible, lab_photos (url, name), lab_equipment (item)",
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
      if (!["premier", "custom"].includes(tier)) {
        return res.status(403).json({ message: "Analytics available for premier or custom labs only" });
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
