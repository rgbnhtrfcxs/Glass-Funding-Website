// server/routes/labs.ts
import { type Express } from "express";
import { ZodError, z } from "zod";
import { supabase } from "../supabaseClient.js";
import { supabasePublic } from "../supabasePublicClient.js";
import { labStore } from "../labs-store.js";
import { sendMail } from "../mailer.js";
import { fetchInpiPatentsBySiren, isInpiConfigured, toSirenFromSiretOrSiren } from "../inpiClient.js";
import { upsertLabOfferProfileSchema } from "@shared/labOffers";
import { insertLabViewSchema } from "@shared/views";
import {
  authenticate,
  getOptionalUserIdFromAuthHeader,
  fetchProfileCapabilities,
  canAccessLabFromPublicRoute,
  sanitizePublicLab,
  isMissingRelationError,
  errorToMessage,
  createRateLimiter,
} from "./shared/helpers.js";
import {
  defaultCertificateTemplate,
  mergeTemplate,
  loadCertificateTemplate,
  upsertVerificationCertificateSchema,
  generateVerificationCertificatePdf,
  toCountryCode,
  ensureLabGlassId,
} from "./shared/certificate.js";
import { promises as fs } from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CERTIFICATE_TEMPLATE_PATH = path.resolve(__dirname, "..", "..", "server", "data", "certificate-template.json");

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

const insertInvestorRequestSchema = z.object({
  labId: z.number(),
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  company: z.string().optional().nullable(),
  website: z.string().url("Website must be a valid URL").optional().nullable(),
  message: z.string().min(10, "Please provide a short message"),
});

export function registerLabRoutes(app: Express): void {
  const publicRequestRateLimit = createRateLimiter("public-request", 20, 10 * 60 * 1000);

  // --------- Labs ----------
  app.get("/api/erc-disciplines", async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from("erc_disciplines")
        .select("code, domain, title")
        .eq("is_active", true)
        .order("domain", { ascending: true })
        .order("code", { ascending: true });
      if (error) throw error;
      res.json(data ?? []);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load ERC disciplines" });
    }
  });

  app.get("/api/lab-offer-taxonomy", async (_req, res) => {
    try {
      const options = await labStore.listOfferTaxonomy();
      res.json(options);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load offer taxonomy" });
    }
  });

  app.get("/api/labs", async (req, res) => {
    const includeHiddenRequested = req.query.includeHidden === "true" || req.query.includeHidden === "1";
    let includeHidden = false;
    if (includeHiddenRequested) {
      const userId = await getOptionalUserIdFromAuthHeader(req);
      if (userId) {
        const profile = await fetchProfileCapabilities(userId);
        includeHidden = Boolean(profile?.isAdmin);
      }
    }
    const labs = includeHidden ? await labStore.list() : await labStore.listVisible();
    res.json(includeHidden ? labs : labs.map(sanitizePublicLab));
  });

  app.get("/api/labs/:id/offers-profile", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid lab id" });
    }
    try {
      const lab = await labStore.findById(id);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const canAccess = await canAccessLabFromPublicRoute(req, lab);
      if (!canAccess) return res.status(404).json({ message: "Lab not found" });

      const profile = await labStore.findOfferProfileByLabId(id);
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load lab offers profile" });
    }
  });

  app.put("/api/labs/:id/offers-profile", authenticate, async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid lab id" });
    }
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const requesterProfile = await fetchProfileCapabilities(userId);
      const existingLab = await labStore.findById(id);
      if (!existingLab) return res.status(404).json({ message: "Lab not found" });
      const isOwner = existingLab.ownerUserId === userId;
      if (!isOwner && !requesterProfile?.isAdmin) {
        return res.status(403).json({ message: "Not authorized to update this lab offers profile" });
      }

      const payload = upsertLabOfferProfileSchema.parse(req.body);
      const profile = await labStore.upsertOfferProfile(id, payload);
      res.json(profile);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid offers profile payload" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to update lab offers profile" });
    }
  });

  app.post("/api/labs", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const requesterProfile = await fetchProfileCapabilities(userId);
      if (!requesterProfile) {
        return res.status(403).json({ message: "Profile permissions not found for this account." });
      }
      if (!requesterProfile.canCreateLab && !requesterProfile.isAdmin) {
        return res.status(403).json({ message: "This account is not allowed to create labs yet." });
      }

      const requestedOwnerId = req.body?.ownerUserId || req.body?.owner_user_id || null;
      const ownerId = requesterProfile.isAdmin && requestedOwnerId ? requestedOwnerId : userId;
      const ownerProfile = ownerId === userId ? requesterProfile : await fetchProfileCapabilities(ownerId);
      if (!ownerProfile && !requesterProfile.isAdmin) {
        return res.status(403).json({ message: "Profile permissions not found for this account." });
      }

      if (!requesterProfile.isAdmin && !ownerProfile?.canManageMultipleLabs) {
        const { count, error: countErr } = await supabase
          .from("labs")
          .select("id", { count: "exact", head: true })
          .eq("owner_user_id", ownerId);
        if (countErr) throw countErr;
        if ((count ?? 0) >= 1) {
          return res
            .status(403)
            .json({ message: "This account can manage only one lab right now. Contact Glass to add more." });
        }
      }

      const payload = {
        ...req.body,
        ownerUserId: ownerId,
      };
      delete (payload as any).owner_user_id;

      const lab = await labStore.create(payload);
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

  app.put("/api/labs/:id", authenticate, async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid lab id" });
    }
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const requesterProfile = await fetchProfileCapabilities(userId);
      if (!requesterProfile) {
        return res.status(403).json({ message: "Profile permissions not found for this account." });
      }
      const existing = await labStore.findById(id);
      if (!existing) return res.status(404).json({ message: "Lab not found" });

      const isOwner = existing.ownerUserId === userId;
      if (!isOwner && !requesterProfile.isAdmin) {
        return res.status(403).json({ message: "Not authorized to update this lab" });
      }

      const updates = { ...(req.body ?? {}) } as Record<string, unknown>;
      const requestedOwnerCamel = updates.ownerUserId;
      const requestedOwnerSnake = updates.owner_user_id;
      if (!requesterProfile.isAdmin) {
        if (requestedOwnerCamel !== undefined && requestedOwnerCamel !== existing.ownerUserId) {
          return res.status(403).json({ message: "Not authorized to transfer lab ownership" });
        }
        if (requestedOwnerSnake !== undefined && requestedOwnerSnake !== existing.ownerUserId) {
          return res.status(403).json({ message: "Not authorized to transfer lab ownership" });
        }
      }
      if (requestedOwnerCamel === undefined && requestedOwnerSnake !== undefined) {
        updates.ownerUserId = requestedOwnerSnake as string | null;
      }
      delete updates.owner_user_id;

      const lab = await labStore.update(id, updates);
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

  app.delete("/api/labs/:id", authenticate, async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid lab id" });
    }
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const requesterProfile = await fetchProfileCapabilities(userId);
      if (!requesterProfile) {
        return res.status(403).json({ message: "Profile permissions not found for this account." });
      }
      const existing = await labStore.findById(id);
      if (!existing) return res.status(404).json({ message: "Lab not found" });
      const isOwner = existing.ownerUserId === userId;
      if (!isOwner && !requesterProfile.isAdmin) {
        return res.status(403).json({ message: "Not authorized to delete this lab" });
      }

      await labStore.delete(id);
      res.status(204).end();
    } catch (error) {
      if (error instanceof Error && error.message === "Lab not found") {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Unable to delete lab" });
    }
  });

  app.get("/api/admin/labs/:id/verification-certificate", authenticate, async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAdmin) {
        return res.status(403).json({ message: "Only admins can access verification certificates." });
      }

      const { data, error } = await supabase
        .from("lab_verification_certificates")
        .select(
          [
            "id",
            "lab_id",
            "glass_id",
            "lab_signer_name",
            "lab_signer_title",
            "glass_signer_name",
            "glass_signer_title",
            "issued_at",
            "pdf_bucket",
            "pdf_path",
            "pdf_url",
            "created_at",
            "updated_at",
          ].join(","),
        )
        .eq("lab_id", labId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ message: "No certificate found for this lab." });

      res.json(data);
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(500).json({
          message: "Certificate table not found. Run server/sql/lab_verification_certificates.sql first.",
        });
      }
      res.status(500).json({ message: errorToMessage(error, "Unable to load certificate") });
    }
  });

  app.get("/api/admin/certificate-template", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAdmin) {
        return res.status(403).json({ message: "Only admins can view certificate template config." });
      }

      let raw = JSON.stringify(defaultCertificateTemplate, null, 2);
      try {
        raw = await fs.readFile(CERTIFICATE_TEMPLATE_PATH, "utf8");
      } catch {
        // Fall back to default template when file is missing.
      }

      let template = defaultCertificateTemplate;
      try {
        template = mergeTemplate(defaultCertificateTemplate, JSON.parse(raw));
      } catch {
        // Keep default if file is malformed.
      }

      res.json({ raw, template });
    } catch (error) {
      res.status(500).json({ message: errorToMessage(error, "Unable to load certificate template") });
    }
  });

  app.post("/api/admin/labs/:id/verification-certificate", authenticate, async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAdmin) {
        return res.status(403).json({ message: "Only admins can issue verification certificates." });
      }

      const payload = upsertVerificationCertificateSchema.parse(req.body ?? {});
      const { data: labRow, error: labError } = await supabase
        .from("labs")
        .select(
          "id, name, lab_status, lab_location (address_line1, address_line2, city, state, postal_code, country)",
        )
        .eq("id", labId)
        .maybeSingle();
      if (labError) throw labError;
      if (!labRow) return res.status(404).json({ message: "Lab not found" });

      const status = ((labRow as any)?.lab_status || "listed").toLowerCase();
      if (!["verified_passive", "verified_active", "premier"].includes(status)) {
        return res.status(409).json({ message: "This lab is not verified yet." });
      }

      const locationRow = Array.isArray((labRow as any)?.lab_location)
        ? (labRow as any).lab_location[0]
        : (labRow as any)?.lab_location;
      const location = [
        locationRow?.address_line1,
        locationRow?.address_line2,
        locationRow?.city,
        locationRow?.state,
        locationRow?.postal_code,
        locationRow?.country,
      ]
        .map(value => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
        .join(", ") || "Address not specified";

      const countryCode = toCountryCode(locationRow?.country ?? null);
      const ensuredGlassId = await ensureLabGlassId(labId, countryCode);
      const glassId = ensuredGlassId.glassId;
      const issuedAt = new Date();
      const pdfBytes = await generateVerificationCertificatePdf({
        labName: (labRow as any).name || `Lab #${labId}`,
        location,
        glassId,
        issuedAt,
        labSignerName: payload.labSignerName.trim(),
        labSignerTitle: payload.labSignerTitle?.trim() || null,
        labSignatureDataUrl: payload.labSignatureDataUrl,
        glassSignerName: payload.glassSignerName.trim(),
        glassSignerTitle: payload.glassSignerTitle?.trim() || null,
        glassSignatureDataUrl: payload.glassSignatureDataUrl,
      });

      const pdfVersion = issuedAt.getTime();
      const pdfPath = `verification-certificates/lab-${labId}/verification-certificate-${pdfVersion}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("lab-pdfs")
        .upload(pdfPath, pdfBytes, {
          upsert: true,
          contentType: "application/pdf",
        });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from("lab-pdfs").getPublicUrl(pdfPath);
      const issuedAtIso = issuedAt.toISOString();
      const { error: auditUpdateError } = await supabase
        .from("labs")
        .update({
          audit_passed: true,
          audit_passed_at: issuedAtIso,
        })
        .eq("id", labId);
      if (auditUpdateError) throw auditUpdateError;

      const recordToSave = {
        lab_id: labId,
        glass_id: glassId,
        lab_signer_name: payload.labSignerName.trim(),
        lab_signer_title: payload.labSignerTitle?.trim() || null,
        lab_signature_data_url: payload.labSignatureDataUrl,
        glass_signer_name: payload.glassSignerName.trim(),
        glass_signer_title: payload.glassSignerTitle?.trim() || null,
        glass_signature_data_url: payload.glassSignatureDataUrl,
        issued_by_user_id: userId,
        issued_at: issuedAtIso,
        pdf_bucket: "lab-pdfs",
        pdf_path: pdfPath,
        pdf_url: publicUrlData.publicUrl,
        updated_at: issuedAtIso,
      };

      const { data: certificate, error: certificateError } = await supabase
        .from("lab_verification_certificates")
        .upsert(recordToSave, { onConflict: "lab_id" })
        .select(
          [
            "id",
            "lab_id",
            "glass_id",
            "lab_signer_name",
            "lab_signer_title",
            "glass_signer_name",
            "glass_signer_title",
            "issued_at",
            "pdf_bucket",
            "pdf_path",
            "pdf_url",
            "created_at",
            "updated_at",
          ].join(","),
        )
        .single();
      if (certificateError) throw certificateError;

      res.status(201).json(certificate);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid certificate payload" });
      }
      if (isMissingRelationError(error)) {
        return res.status(500).json({
          message: "Certificate table not found. Run server/sql/lab_verification_certificates.sql first.",
        });
      }
      res.status(500).json({ message: errorToMessage(error, "Unable to issue verification certificate") });
    }
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

  // --------- Investor contact (premier labs) ----------
  app.post("/api/labs/:id/investor", publicRequestRateLimit, async (req, res) => {
    const labId = Number(req.params.id);
    if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
    try {
      const payload = insertInvestorRequestSchema.parse({ ...req.body, labId });
      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const ownerUserId = lab.ownerUserId ?? null;
      if (!ownerUserId) {
        return res.status(403).json({ message: "Investor contact is available for claimed labs only" });
      }
      const profile = await fetchProfileCapabilities(ownerUserId);
      if (!profile?.canReceiveInvestor) {
        return res.status(403).json({ message: "Investor contact is not enabled for this lab" });
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
      const mailParams = {
        labName: lab.name,
        labId,
        investorName: payload.name,
        investorEmail: payload.email,
        company: payload.company ?? "N/A",
        website: payload.website ?? "N/A",
        message: payload.message,
      };

      await Promise.all([
        sendMail({
          to: labEmail,
          from: process.env.MAIL_FROM_LAB || process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
          subject: `Investor inquiry for ${lab.name}`,
          text: lines,
          templateId: process.env.BREVO_TEMPLATE_INVESTOR_LAB
            ? Number(process.env.BREVO_TEMPLATE_INVESTOR_LAB)
            : undefined,
          params: mailParams,
        }),
        sendMail({
          to: adminEmail,
          from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
          subject: `Investor inquiry for ${lab.name}`,
          text: lines,
          templateId: process.env.BREVO_TEMPLATE_INVESTOR_ADMIN
            ? Number(process.env.BREVO_TEMPLATE_INVESTOR_ADMIN)
            : undefined,
          params: mailParams,
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

  // --------- HAL publications ----------
  app.get("/api/labs/:id/hal-publications", async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });

      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const canAccess = await canAccessLabFromPublicRoute(req, lab);
      if (!canAccess) return res.status(404).json({ message: "Lab not found" });

      const halStructureId = lab.halStructureId;
      const halPersonId = lab.halPersonId;
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
        console.error("[hal] publications request failed", txt);
        return res.status(500).json({ message: "HAL error" });
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

      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const canAccess = await canAccessLabFromPublicRoute(req, lab);
      if (!canAccess) return res.status(404).json({ message: "Lab not found" });

      const halStructureId = lab.halStructureId;
      const halPersonId = lab.halPersonId;
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
        console.error("[hal] patents request failed", txt);
        return res.status(500).json({ message: "HAL error" });
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

  // --------- INPI patents by SIREN ----------
  app.get("/api/labs/:id/patents", async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });

      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const canAccess = await canAccessLabFromPublicRoute(req, lab);
      if (!canAccess) return res.status(404).json({ message: "Lab not found" });

      const siren = toSirenFromSiretOrSiren(lab.siretNumber);
      if (!siren) {
        return res.status(400).json({ message: "Missing valid SIREN/SIRET for this lab" });
      }

      if (!isInpiConfigured()) {
        return res.status(503).json({
          message:
            "INPI API is not configured yet. Add INPI credentials in the server environment to enable patents import.",
        });
      }

      const items = await fetchInpiPatentsBySiren(siren);
      return res.json({ items, source: "inpi", siren });
    } catch (err) {
      return res.status(500).json({
        message: err instanceof Error ? err.message : "Unable to load patents",
      });
    }
  });
}
