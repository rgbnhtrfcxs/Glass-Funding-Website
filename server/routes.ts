// server/routes.ts
import express, { Express, NextFunction, Request, Response } from "express";
import { createServer } from "http";
import { supabase } from "./supabaseClient.js";
import { storage } from "./storage";
import { labStore } from "./labs-store";
import { teamStore } from "./teams-store";
import { labRequestStore } from "./lab-requests-store";
import { labCollaborationStore } from "./collaboration-store";
import { sendMail } from "./mailer";
import { supabasePublic } from "./supabasePublicClient.js";
import { fetchInpiPatentsBySiren, isInpiConfigured, toSirenFromSiretOrSiren } from "./inpiClient.js";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
import { upsertLabOfferProfileSchema } from "@shared/labOffers";
import { insertLabViewSchema } from "@shared/views";
import { insertTeamSchema, updateTeamSchema } from "@shared/teams";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CERTIFICATE_TEMPLATE_PATH = path.resolve(__dirname, "data", "certificate-template.json");
const CERTIFICATE_HTML_TEMPLATE_PATHS = [
  path.resolve(__dirname, "..", "client", "public", "certificate-template.html"),
  path.resolve(__dirname, "..", "dist", "certificate-template.html"),
];

const defaultCertificateTemplate = {
  page: {
    width: 595,
    height: 842,
  },
  colors: {
    background: "#FFFFFF",
    pastelBlue: "#BFE8FF",
    pastelPink: "#FFD7E8",
    mist: "#EDF7FF",
    cardBorder: "#D1DBF2",
    ink: "#1A2238",
    mutedInk: "#59647F",
    subtitle: "#54668F",
    idLabel: "#53668F",
    signatureLine: "#B8C1D9",
    footer: "#6B748D",
    fallbackLogo: "#22345A",
  },
  background: {
    leftGlow: { x: 96, y: 760, xScale: 168, yScale: 132, opacity: 0.38 },
    rightGlow: { x: 505, y: 768, xScale: 152, yScale: 128, opacity: 0.36 },
    bottomGlow: { xScale: 220, yScale: 120, y: 50, opacity: 0.62 },
  },
  card: {
    x: 30,
    y: 34,
    borderWidth: 1.25,
    opacity: 0.93,
    topAccentHeight: 2.6,
  },
  logo: {
    symbol: { file: "GlassLogo3.png", maxWidth: 58, y: 742, opacity: 0.99 },
    wordmark: { file: "GlassLogoLettering.png", maxWidth: 156, y: 690, opacity: 0.98 },
    fallback: { text: "GLASS", y: 710, size: 34 },
  },
  heading: {
    titleY: 668,
    titleSize: 30,
    subtitleY: 644,
    subtitleSize: 12,
    kickerY: 628,
    kickerSize: 11,
  },
  labName: {
    introY: 596,
    topY: 572,
    largeSize: 29,
    mediumSize: 24,
    smallSize: 20,
    lineGap: 6,
    maxWidth: 485,
    maxLines: 3,
    bodyOffset: 28,
  },
  address: {
    labelOffset: 52,
    labelSize: 10,
    textSize: 10,
    maxWidth: 465,
    maxLines: 3,
    lineGap: 12,
    issuedGap: 18,
  },
  idBox: {
    width: 390,
    height: 88,
    y: 364,
    borderWidth: 1.1,
    accentHeight: 4,
    labelYOffset: 60,
    labelSize: 11,
    idYOffset: 31,
    idSize: 22,
  },
  signatures: {
    titleY: 244,
    slotWidth: 220,
    gap: 56,
    imageY: 170,
    imageHeight: 58,
    lineY: 128,
    lineThickness: 1.1,
    nameGap: 18,
    titleGap: 32,
    nameSize: 11,
    titleSize: 10,
  },
  footer: {
    text: "Issued by GLASS for trusted collaboration visibility across verified labs.",
    y: 42,
    size: 9,
  },
};

type CertificateTemplate = typeof defaultCertificateTemplate;

let certificateTemplateCache: { mtimeMs: number; value: CertificateTemplate } | null = null;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const mergeTemplate = <T,>(base: T, override: unknown): T => {
  if (Array.isArray(base)) return base;
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base };
    Object.keys(base).forEach(key => {
      if (!(key in override)) return;
      result[key] = mergeTemplate((base as Record<string, unknown>)[key], (override as Record<string, unknown>)[key]);
    });
    return result as T;
  }
  if (typeof override === typeof base) {
    return override as T;
  }
  return base;
};

const loadCertificateTemplate = async (): Promise<CertificateTemplate> => {
  try {
    const stat = await fs.stat(CERTIFICATE_TEMPLATE_PATH);
    if (certificateTemplateCache && certificateTemplateCache.mtimeMs === stat.mtimeMs) {
      return certificateTemplateCache.value;
    }
    const raw = await fs.readFile(CERTIFICATE_TEMPLATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const merged = mergeTemplate(defaultCertificateTemplate, parsed);
    certificateTemplateCache = {
      mtimeMs: stat.mtimeMs,
      value: merged,
    };
    return merged;
  } catch {
    return defaultCertificateTemplate;
  }
};

const hexToRgb = (hex: string, fallback: [number, number, number]) => {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return rgb(fallback[0], fallback[1], fallback[2]);
  }
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
};

// Avoid duplicate "viewed" notifications during a single server runtime
const viewedNotifyCache = new Set<string>();
const stripePricingCache: {
  data: null | {
    verified: { monthly: number | null; yearly: number | null; currency: string | null };
    premier: { monthly: number | null; yearly: number | null; currency: string | null };
  };
  expiresAt: number;
} = {
  data: null,
  expiresAt: 0,
};

const rateLimitState = new Map<string, { count: number; resetAt: number }>();

const getRequestIp = (req: Request) => {
  const ip = req.ip || req.socket.remoteAddress || "";
  return ip.trim() || "unknown";
};

const createRateLimiter =
  (scope: string, maxRequests: number, windowMs: number) =>
  (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = getRequestIp(req);
    const key = `${scope}:${ip}`;
    const existing = rateLimitState.get(key);

    if (!existing || now >= existing.resetAt) {
      rateLimitState.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (existing.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ message: "Too many requests. Please try again shortly." });
    }

    existing.count += 1;
    rateLimitState.set(key, existing);
    return next();
  };

const stripePriceMap = () => {
  const mapping: Record<string, { tier: "verified" | "premier"; interval: string }> = {};
  const add = (priceId: string | undefined, tier: "verified" | "premier", interval: string) => {
    if (priceId) mapping[priceId] = { tier, interval };
  };
  add(process.env.STRIPE_PRICE_VERIFIED_MONTHLY, "verified", "monthly");
  add(process.env.STRIPE_PRICE_VERIFIED_YEARLY, "verified", "yearly");
  add(process.env.STRIPE_PRICE_VERIFIED_YEARLY_DISCOUNT, "verified", "yearly");
  add(process.env.STRIPE_PRICE_PREMIER_MONTHLY, "premier", "monthly");
  add(process.env.STRIPE_PRICE_PREMIER_YEARLY, "premier", "yearly");
  add(process.env.STRIPE_PRICE_PREMIER_YEARLY_DISCOUNT, "premier", "yearly");
  return mapping;
};

const resolveStripePriceId = (planKey: string, intervalKey: string) => {
  const verifiedYearly =
    process.env.STRIPE_PRICE_VERIFIED_YEARLY_DISCOUNT || process.env.STRIPE_PRICE_VERIFIED_YEARLY;
  const premierYearly =
    process.env.STRIPE_PRICE_PREMIER_YEARLY_DISCOUNT || process.env.STRIPE_PRICE_PREMIER_YEARLY;

  if (planKey === "verified") {
    return intervalKey === "yearly" ? verifiedYearly : process.env.STRIPE_PRICE_VERIFIED_MONTHLY;
  }
  if (planKey === "premier") {
    return intervalKey === "yearly" ? premierYearly : process.env.STRIPE_PRICE_PREMIER_MONTHLY;
  }
  return undefined;
};

const timingSafeEqual = (a: string, b: string) => {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const listLabIdsForUser = async (userId?: string | null) => {
  const ids = new Set<number>();
  if (userId) {
    const { data } = await supabase.from("labs").select("id").eq("owner_user_id", userId);
    (data ?? []).forEach(row => {
      const id = Number(row.id);
      if (!Number.isNaN(id)) ids.add(id);
    });
  }
  return Array.from(ids);
};

const parseRequestedLabId = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return Number.NaN;
  return parsed;
};

const getLabSubscriptionTierRank = (status?: string | null) => {
  const normalized = normalizeLabStatus(status);
  if (normalized === "premier") return 2;
  if (normalized === "verified" || normalized === "verified_active" || normalized === "verified_passive") {
    return 1;
  }
  return 0;
};

const canLabSubscribeToPlan = (status: string | null | undefined, planKey: "verified" | "premier") => {
  const rank = getLabSubscriptionTierRank(status);
  if (planKey === "verified") return rank < 1;
  return rank < 2;
};

const resolveSubscriptionLabId = async (
  userId: string,
  requestedLabId: unknown,
  planKey: "verified" | "premier",
) => {
  const { data, error } = await supabase
    .from("labs")
    .select("id, name, lab_status")
    .eq("owner_user_id", userId);
  if (error) {
    return {
      labId: null as number | null,
      error: { status: 500, message: "Unable to load labs for subscription." },
    };
  }

  const ownedLabs = (data ?? [])
    .map(row => ({
      id: Number((row as any).id),
      name: typeof (row as any).name === "string" ? (row as any).name : "",
      labStatus: typeof (row as any).lab_status === "string" ? (row as any).lab_status : null,
    }))
    .filter(row => Number.isInteger(row.id) && row.id > 0);

  if (!ownedLabs.length) {
    return {
      labId: null as number | null,
      error: { status: 400, message: "No labs linked to this account. Create a lab before subscribing." },
    };
  }

  const eligibleLabs = ownedLabs.filter(lab => canLabSubscribeToPlan(lab.labStatus, planKey));
  if (!eligibleLabs.length) {
    return {
      labId: null as number | null,
      error: {
        status: 409,
        message:
          planKey === "premier"
            ? "All your labs are already on Premier."
            : "All your labs are already on Verified or Premier.",
      },
    };
  }

  const parsedLabId = parseRequestedLabId(requestedLabId);
  if (parsedLabId === null) {
    if (eligibleLabs.length === 1) {
      return { labId: eligibleLabs[0].id, error: null as { status: number; message: string } | null };
    }
    return {
      labId: null as number | null,
      error: { status: 400, message: "Please select an eligible lab for this subscription." },
    };
  }
  if (Number.isNaN(parsedLabId)) {
    return {
      labId: null as number | null,
      error: { status: 400, message: "Invalid lab id" },
    };
  }
  const selectedLab = ownedLabs.find(lab => lab.id === parsedLabId);
  if (!selectedLab) {
    return {
      labId: null as number | null,
      error: { status: 403, message: "You can only subscribe for your own lab." },
    };
  }
  if (!canLabSubscribeToPlan(selectedLab.labStatus, planKey)) {
    return {
      labId: null as number | null,
      error: {
        status: 409,
        message:
          planKey === "premier"
            ? `${selectedLab.name || "Selected lab"} is already on Premier.`
            : `${selectedLab.name || "Selected lab"} is already on Verified or Premier.`,
      },
    };
  }

  return { labId: parsedLabId, error: null as { status: number; message: string } | null };
};

const parseBoolean = (value: boolean | string | null | undefined, fallback = false) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = value.toString().toLowerCase();
  return normalized === "true" || normalized === "t" || normalized === "1";
};

const parseNullableBoolean = (value: boolean | string | null | undefined) => {
  if (value === null || value === undefined) return null;
  return parseBoolean(value, false);
};

const PASSWORD_MIN_LENGTH = 8;
const getPasswordPolicyError = (password: string) => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one symbol.";
  }
  return null;
};

const resolvePublicSiteOrigin = (req: Request) => {
  const configured = (process.env.PUBLIC_SITE_URL || "https://glass-connect.com").trim().replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") {
    const hostHeader = req.get("host");
    if (hostHeader) {
      return `${req.protocol}://${hostHeader}`.replace(/\/+$/, "");
    }
  }
  return configured;
};

const errorToMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const message = typeof (error as any).message === "string" ? (error as any).message : "";
    const details = typeof (error as any).details === "string" ? (error as any).details : "";
    const hint = typeof (error as any).hint === "string" ? (error as any).hint : "";
    const code = typeof (error as any).code === "string" ? (error as any).code : "";
    const joined = [message, details, hint, code ? `code=${code}` : ""].filter(Boolean).join(" | ");
    if (joined) return joined;
  }
  return fallback;
};

const isMissingRelationError = (error: any) =>
  error?.code === "42P01" || /does not exist/i.test(String(error?.message ?? ""));

const signatureDataUrlSchema = z
  .string()
  .min(32, "Signature is required")
  .regex(
    /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/i,
    "Signature must be a PNG or JPEG data URL",
  );

const upsertVerificationCertificateSchema = z.object({
  labSignerName: z.string().trim().min(2, "Lab signer name is required").max(120),
  labSignerTitle: z.string().trim().max(120).optional().nullable(),
  labSignatureDataUrl: signatureDataUrlSchema,
  glassSignerName: z.string().trim().min(2, "GLASS signer name is required").max(120),
  glassSignerTitle: z.string().trim().max(120).optional().nullable(),
  glassSignatureDataUrl: signatureDataUrlSchema,
});

type CertificatePdfInput = {
  labName: string;
  location: string;
  glassId: string | null;
  issuedAt: Date;
  labSignerName: string;
  labSignerTitle: string | null;
  labSignatureDataUrl: string;
  glassSignerName: string;
  glassSignerTitle: string | null;
  glassSignatureDataUrl: string;
};

const decodeImageDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:(image\/(?:png|jpe?g));base64,(.+)$/i);
  if (!match) {
    throw new Error("Invalid signature image format");
  }
  return {
    mimeType: match[1].toLowerCase(),
    bytes: Buffer.from(match[2], "base64"),
  };
};

const fitText = (
  text: string,
  maxWidth: number,
  size: number,
  measure: (value: string, size: number) => number,
) => {
  if (measure(text, size) <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 0 && measure(`${shortened}...`, size) > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return shortened ? `${shortened}...` : "";
};

const toCountryCode = (countryValue?: string | null) => {
  const raw = (countryValue || "").trim();
  if (!raw) return "GL";
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const tokens = raw.replace(/[^A-Za-z\s]/g, " ").split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
  if (tokens.length === 1) {
    const token = tokens[0].toUpperCase();
    return token.length >= 2 ? token.slice(0, 2) : `${token}X`;
  }
  return "GL";
};

const makeGlassId = (countryCode: string) => {
  const ts = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `GLS-${countryCode}-${ts}-${random}`;
};

const extractGlassShort = (glassId: string) =>
  glassId.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase();

const tryInsertGlassIdRow = async (
  labId: number,
  countryCode: string,
  glassId: string,
  issuedAtIso: string,
) => {
  const attempts: Array<Record<string, unknown>> = [
    {
      lab_id: labId,
      glass_id: glassId,
      issued_at: issuedAtIso,
      revoked_at: null,
      is_active: true,
      country_code: countryCode,
      glass_short: extractGlassShort(glassId),
    },
    {
      lab_id: labId,
      glass_id: glassId,
      issued_at: issuedAtIso,
      is_active: true,
      country_code: countryCode,
    },
    {
      lab_id: labId,
      glass_id: glassId,
      issued_at: issuedAtIso,
      is_active: true,
    },
    {
      lab_id: labId,
      glass_id: glassId,
    },
  ];

  let lastError: any = null;
  for (const payload of attempts) {
    const { data, error } = await supabase
      .from("lab_glass_ids")
      .insert(payload)
      .select("glass_id, glass_short, is_active, issued_at")
      .single();
    if (!error && data) return data;
    lastError = error;
    if (error?.code === "23505") {
      return null;
    }
    if (error?.code === "42703" || /column .* does not exist/i.test(String(error?.message ?? ""))) {
      continue;
    }
  }
  if (lastError) throw lastError;
  return null;
};

const ensureLabGlassId = async (labId: number, countryCode: string) => {
  const { data: activeRows, error: activeError } = await supabase
    .from("lab_glass_ids_view")
    .select("glass_id, glass_short, is_active, issued_at")
    .eq("lab_id", labId)
    .eq("is_active", true)
    .order("issued_at", { ascending: false })
    .limit(1);
  if (activeError && !isMissingRelationError(activeError)) throw activeError;
  const activeRow = Array.isArray(activeRows) && activeRows.length > 0 ? activeRows[0] : null;
  if (activeRow && ((activeRow as any)?.glass_id || (activeRow as any)?.glass_short)) {
    return {
      glassId: ((activeRow as any)?.glass_id || (activeRow as any)?.glass_short) as string,
      issuedAt: (activeRow as any)?.issued_at ?? null,
    };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("lab_glass_ids_view")
    .select("glass_id, glass_short, issued_at")
    .eq("lab_id", labId)
    .order("issued_at", { ascending: false })
    .limit(1);
  if (existingError && !isMissingRelationError(existingError)) throw existingError;
  const existingRow = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
  if (existingRow && ((existingRow as any)?.glass_id || (existingRow as any)?.glass_short)) {
    try {
      await supabase
        .from("lab_glass_ids")
        .update({ is_active: true, revoked_at: null })
        .eq("lab_id", labId)
        .eq("glass_id", ((existingRow as any)?.glass_id || (existingRow as any)?.glass_short) as string);
    } catch {
      // Best effort; if columns differ or update fails, keep using existing id.
    }
    return {
      glassId: ((existingRow as any)?.glass_id || (existingRow as any)?.glass_short) as string,
      issuedAt: (existingRow as any)?.issued_at ?? null,
    };
  }

  const issuedAtIso = new Date().toISOString();
  for (let i = 0; i < 8; i += 1) {
    const candidate = makeGlassId(countryCode);
    const inserted = await tryInsertGlassIdRow(labId, countryCode, candidate, issuedAtIso);
    if (!inserted) continue;
    return {
      glassId: ((inserted as any)?.glass_id || candidate) as string,
      issuedAt: (inserted as any)?.issued_at ?? issuedAtIso,
    };
  }
  throw new Error("Unable to generate a unique GLASS-ID");
};

const drawSignatureImage = (
  page: any,
  image: any,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
) => {
  const baseWidth = image.width;
  const baseHeight = image.height;
  if (!baseWidth || !baseHeight) return;
  const ratio = Math.min(maxWidth / baseWidth, maxHeight / baseHeight, 1);
  const drawWidth = baseWidth * ratio;
  const drawHeight = baseHeight * ratio;
  page.drawImage(image, {
    x: x + (maxWidth - drawWidth) / 2,
    y: y + (maxHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });
};

const tryEmbedImage = async (pdf: PDFDocument, candidates: string[]) => {
  for (const candidate of candidates) {
    try {
      const bytes = await fs.readFile(candidate);
      if (candidate.toLowerCase().endsWith(".png")) {
        return await pdf.embedPng(bytes);
      }
      if (candidate.toLowerCase().endsWith(".jpg") || candidate.toLowerCase().endsWith(".jpeg")) {
        return await pdf.embedJpg(bytes);
      }
    } catch {
      // Try next file.
    }
  }
  return null;
};

const toLocalAssetCandidates = (primaryFile: string | null | undefined, fallbacks: string[]) => {
  const names = [primaryFile ?? "", ...fallbacks]
    .map(value => value.trim())
    .filter(Boolean);

  const candidates: string[] = [];
  names.forEach(name => {
    if (/^https?:\/\//i.test(name)) return;
    if (path.isAbsolute(name)) {
      candidates.push(name);
      return;
    }
    const normalized = name.replace(/^\/+/, "");
    candidates.push(path.resolve(__dirname, "..", "client", "public", normalized));
    candidates.push(path.resolve(__dirname, "..", "dist", normalized));
    candidates.push(path.resolve(__dirname, "..", normalized));
  });

  return Array.from(new Set(candidates));
};

const tryEmbedGlassSymbol = async (pdf: PDFDocument, fileName?: string) =>
  tryEmbedImage(pdf, toLocalAssetCandidates(fileName, ["GlassLogo3.png", "GlassLogo2.png", "GlassLogo1.png"]));

const tryEmbedGlassLogo = async (pdf: PDFDocument, fileName?: string) =>
  tryEmbedImage(pdf, toLocalAssetCandidates(fileName, ["GlassLogoLettering.png", "GlassLogo5.png"]));

const readFirstExistingTextFile = async (candidates: string[]) => {
  for (const candidate of candidates) {
    try {
      const text = await fs.readFile(candidate, "utf8");
      return { path: candidate, text };
    } catch {
      // Try next path.
    }
  }
  return null;
};

const extractTemplateDefaultValue = (html: string, key: string, fallback: string) => {
  const match = html.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`, "i"));
  return match?.[1]?.trim() || fallback;
};

const bytesToDataUrl = (bytes: Buffer, extension: string) => {
  const normalized = extension.toLowerCase();
  const mime =
    normalized === ".png"
      ? "image/png"
      : normalized === ".jpg" || normalized === ".jpeg"
        ? "image/jpeg"
        : "application/octet-stream";
  return `data:${mime};base64,${bytes.toString("base64")}`;
};

const toRenderableImageSource = async (value: string | null | undefined, fallbackFiles: string[]) => {
  const source = (value ?? "").trim();
  if (!source) {
    if (!fallbackFiles.length) return null;
  } else if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(source) || /^https?:\/\//i.test(source)) {
    return source;
  }

  const candidates = toLocalAssetCandidates(source, fallbackFiles);
  for (const candidate of candidates) {
    try {
      const bytes = await fs.readFile(candidate);
      const extension = path.extname(candidate);
      return bytesToDataUrl(bytes, extension);
    } catch {
      // Try next path.
    }
  }
  return null;
};

const injectTemplateBootData = (html: string, payload: Record<string, unknown>) => {
  const safeJson = JSON.stringify(payload).replace(/</g, "\\u003c");
  const bootScript =
    `<script>window.__INITIAL_CERTIFICATE_DATA__=${safeJson};window.__SERVER_RENDER__=true;</script>`;
  if (html.includes("<script>")) {
    return html.replace("<script>", `${bootScript}\n<script>`);
  }
  if (html.includes("</body>")) {
    return html.replace("</body>", `${bootScript}\n</body>`);
  }
  return `${html}\n${bootScript}`;
};

const generateVerificationCertificatePdfFromHtmlTemplate = async (input: CertificatePdfInput) => {
  const templateFile = await readFirstExistingTextFile(CERTIFICATE_HTML_TEMPLATE_PATHS);
  if (!templateFile) return null;

  const defaultSymbol = extractTemplateDefaultValue(templateFile.text, "symbolLogo", "/GlassLogo1.png");
  const defaultWordmark = extractTemplateDefaultValue(templateFile.text, "wordmarkLogo", "/GlassLogoLettering.png");
  const symbolLogo = await toRenderableImageSource(defaultSymbol, ["GlassLogo1.png", "GlassLogo3.png", "GlassLogo2.png"]);
  const wordmarkLogo = await toRenderableImageSource(defaultWordmark, ["GlassLogoLettering.png", "GlassLogo5.png"]);
  const issuedDate = input.issuedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const renderPayload = {
    ...(symbolLogo ? { symbolLogo } : {}),
    ...(wordmarkLogo ? { wordmarkLogo } : {}),
    labName: input.labName,
    labAddress: input.location || "Address not specified",
    glassId: input.glassId || "Not assigned",
    issuedDate,
    labSignerName: input.labSignerName || "Lab representative",
    labSignerTitle: input.labSignerTitle || "Lab representative",
    glassSignerName: input.glassSignerName || "GLASS signer",
    glassSignerTitle: input.glassSignerTitle || "GLASS admin",
    labSignature: input.labSignatureDataUrl || "",
    glassSignature: input.glassSignatureDataUrl || "",
  };

  let html = injectTemplateBootData(templateFile.text, renderPayload);
  html = html.replace("<body>", '<body class="server-render">');

  let puppeteerModule: any;
  try {
    puppeteerModule = await import("puppeteer");
  } catch {
    return null;
  }

  const puppeteer = puppeteerModule?.default ?? puppeteerModule;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 595, height: 842, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluate(async () => {
      if (typeof (window as any).setCertificateData === "function" && (window as any).__INITIAL_CERTIFICATE_DATA__) {
        (window as any).setCertificateData((window as any).__INITIAL_CERTIFICATE_DATA__);
      }
      const images = Array.from(document.images).filter(image => image.src);
      await Promise.all(
        images.map(image =>
          image.complete
            ? Promise.resolve()
            : new Promise(resolve => {
                image.addEventListener("load", () => resolve(null), { once: true });
                image.addEventListener("error", () => resolve(null), { once: true });
              }),
        ),
      );
      await new Promise(resolve => setTimeout(resolve, 80));
    });

    const pdfBuffer = await page.pdf({
      width: "595px",
      height: "842px",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: false,
    });
    return new Uint8Array(pdfBuffer);
  } finally {
    await browser.close();
  }
};

const generateVerificationCertificatePdfLegacy = async (input: CertificatePdfInput) => {
  const template = await loadCertificateTemplate();
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([template.page.width, template.page.height]);
  const { width, height } = page.getSize();
  const centerX = width / 2;

  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdf.embedFont(StandardFonts.CourierBold);

  const normalizeInlineText = (value: string | null | undefined) =>
    String(value ?? "")
      .replace(/[\r\n\t]+/g, " ")
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const toFontSafeText = (value: string | null | undefined, font: any) => {
    const normalized = normalizeInlineText(value);
    if (!normalized) return "";
    let safe = "";
    for (const char of normalized) {
      try {
        font.encodeText(char);
        safe += char;
      } catch {
        safe += " ";
      }
    }
    return safe.replace(/\s+/g, " ").trim();
  };

  const wrapCenteredText = (
    text: string,
    maxWidth: number,
    size: number,
    font: any,
    maxLines: number,
  ) => {
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
    if (current && lines.length < maxLines) lines.push(current);

    if (words.length && lines.length === maxLines) {
      const usedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
      if (usedWords < words.length) {
        const last = lines[lines.length - 1];
        lines[lines.length - 1] = fitText(`${last}...`, maxWidth, size, (value, fontSize) =>
          font.widthOfTextAtSize(value, fontSize),
        );
      }
    }
    return lines;
  };

  const centerText = (text: string, y: number, size: number, font: any, color = rgb(0.12, 0.15, 0.24)) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: centerX - textWidth / 2,
      y,
      size,
      font,
      color,
    });
  };

  const colors = {
    background: hexToRgb(template.colors.background, [1, 1, 1]),
    pastelBlue: hexToRgb(template.colors.pastelBlue, [0.75, 0.91, 1.0]),
    pastelPink: hexToRgb(template.colors.pastelPink, [1.0, 0.84, 0.91]),
    mist: hexToRgb(template.colors.mist, [0.93, 0.97, 1]),
    cardBorder: hexToRgb(template.colors.cardBorder, [0.82, 0.86, 0.95]),
    ink: hexToRgb(template.colors.ink, [0.1, 0.13, 0.21]),
    mutedInk: hexToRgb(template.colors.mutedInk, [0.35, 0.39, 0.5]),
    subtitle: hexToRgb(template.colors.subtitle, [0.33, 0.4, 0.56]),
    idLabel: hexToRgb(template.colors.idLabel, [0.32, 0.4, 0.57]),
    signatureLine: hexToRgb(template.colors.signatureLine, [0.72, 0.76, 0.86]),
    footer: hexToRgb(template.colors.footer, [0.43, 0.47, 0.58]),
    fallbackLogo: hexToRgb(template.colors.fallbackLogo, [0.13, 0.18, 0.3]),
  };

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: colors.background,
  });
  page.drawEllipse({
    x: template.background.leftGlow.x,
    y: template.background.leftGlow.y,
    xScale: template.background.leftGlow.xScale,
    yScale: template.background.leftGlow.yScale,
    color: colors.pastelBlue,
    opacity: template.background.leftGlow.opacity,
  });
  page.drawEllipse({
    x: template.background.rightGlow.x,
    y: template.background.rightGlow.y,
    xScale: template.background.rightGlow.xScale,
    yScale: template.background.rightGlow.yScale,
    color: colors.pastelPink,
    opacity: template.background.rightGlow.opacity,
  });
  page.drawEllipse({
    x: centerX,
    y: template.background.bottomGlow.y,
    xScale: template.background.bottomGlow.xScale,
    yScale: template.background.bottomGlow.yScale,
    color: colors.mist,
    opacity: template.background.bottomGlow.opacity,
  });

  const cardX = template.card.x;
  const cardY = template.card.y;
  const cardWidth = width - cardX * 2;
  const cardHeight = height - cardY * 2;
  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    borderColor: colors.cardBorder,
    borderWidth: template.card.borderWidth,
    color: rgb(1, 1, 1),
    opacity: template.card.opacity,
  });

  page.drawRectangle({
    x: cardX,
    y: cardY + cardHeight - 6,
    width: cardWidth / 2,
    height: template.card.topAccentHeight,
    color: colors.pastelBlue,
  });
  page.drawRectangle({
    x: cardX + cardWidth / 2,
    y: cardY + cardHeight - 6,
    width: cardWidth / 2,
    height: template.card.topAccentHeight,
    color: colors.pastelPink,
  });

  const symbolLogo = await tryEmbedGlassSymbol(pdf, template.logo.symbol.file);
  if (symbolLogo) {
    const symbolRatio = Math.min(1, template.logo.symbol.maxWidth / symbolLogo.width);
    const symbolWidth = symbolLogo.width * symbolRatio;
    const symbolHeight = symbolLogo.height * symbolRatio;
    page.drawImage(symbolLogo, {
      x: centerX - symbolWidth / 2,
      y: template.logo.symbol.y,
      width: symbolWidth,
      height: symbolHeight,
      opacity: template.logo.symbol.opacity,
    });
  }

  const logo = await tryEmbedGlassLogo(pdf, template.logo.wordmark.file);
  if (logo) {
    const ratio = Math.min(1, template.logo.wordmark.maxWidth / logo.width);
    const drawWidth = logo.width * ratio;
    const drawHeight = logo.height * ratio;
    page.drawImage(logo, {
      x: centerX - drawWidth / 2,
      y: template.logo.wordmark.y,
      width: drawWidth,
      height: drawHeight,
      opacity: template.logo.wordmark.opacity,
    });
  } else {
    centerText(
      toFontSafeText(template.logo.fallback.text, fontBold) || "GLASS",
      template.logo.fallback.y,
      template.logo.fallback.size,
      fontBold,
      colors.fallbackLogo,
    );
  }

  centerText("Verification Certificate", template.heading.titleY, template.heading.titleSize, fontBold, colors.ink);
  centerText("Verified by GLASS", template.heading.subtitleY, template.heading.subtitleSize, fontRegular, colors.subtitle);
  centerText("Equipment and Techniques", template.heading.kickerY, template.heading.kickerSize, fontRegular, colors.subtitle);

  const safeLabName = toFontSafeText(input.labName, fontBold) || "Lab";
  const labNameSize =
    safeLabName.length > 72
      ? template.labName.smallSize
      : safeLabName.length > 52
        ? template.labName.mediumSize
        : template.labName.largeSize;
  const labNameLines = wrapCenteredText(
    safeLabName,
    template.labName.maxWidth,
    labNameSize,
    fontBold,
    template.labName.maxLines,
  );
  const lineHeight = labNameSize + template.labName.lineGap;
  const labNameTopY = template.labName.topY;

  centerText("This certifies that", template.labName.introY, 12, fontRegular, colors.mutedInk);
  labNameLines.forEach((line, index) => {
    centerText(line, labNameTopY - index * lineHeight, labNameSize, fontBold, colors.ink);
  });
  const labNameBottomY = labNameTopY - (labNameLines.length - 1) * lineHeight;
  centerText(
    "has been verified for equipment and techniques in the GLASS network.",
    labNameBottomY - template.labName.bodyOffset,
    12,
    fontRegular,
    colors.mutedInk,
  );

  const locationSafe = toFontSafeText(input.location || "Address not specified", fontRegular) || "Address not specified";
  const addressLines = wrapCenteredText(
    locationSafe,
    template.address.maxWidth,
    template.address.textSize,
    fontRegular,
    template.address.maxLines,
  );
  const addressLabelY = labNameBottomY - template.address.labelOffset;
  centerText("Address on file", addressLabelY, template.address.labelSize, fontBold, colors.subtitle);
  addressLines.forEach((line, index) => {
    centerText(
      line,
      addressLabelY - 15 - index * template.address.lineGap,
      template.address.textSize,
      fontRegular,
      colors.mutedInk,
    );
  });
  const addressBottomY = addressLabelY - 15 - (addressLines.length - 1) * template.address.lineGap;

  const issueDate = input.issuedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  centerText(`Issued on ${issueDate}`, addressBottomY - template.address.issuedGap, 10, fontRegular, colors.subtitle);

  const idBoxWidth = template.idBox.width;
  const idBoxHeight = template.idBox.height;
  const idBoxX = centerX - idBoxWidth / 2;
  const idBoxY = template.idBox.y;
  page.drawRectangle({
    x: idBoxX,
    y: idBoxY,
    width: idBoxWidth,
    height: idBoxHeight,
    color: rgb(0.98, 0.99, 1),
    borderColor: colors.cardBorder,
    borderWidth: template.idBox.borderWidth,
  });
  page.drawRectangle({
    x: idBoxX,
    y: idBoxY + idBoxHeight - template.idBox.accentHeight,
    width: idBoxWidth / 2,
    height: template.idBox.accentHeight,
    color: colors.pastelBlue,
  });
  page.drawRectangle({
    x: idBoxX + idBoxWidth / 2,
    y: idBoxY + idBoxHeight - template.idBox.accentHeight,
    width: idBoxWidth / 2,
    height: template.idBox.accentHeight,
    color: colors.pastelPink,
  });

  const glassIdText = toFontSafeText(input.glassId ? input.glassId : "Not assigned", fontMono) || "Not assigned";
  centerText("GLASS-ID", idBoxY + template.idBox.labelYOffset, template.idBox.labelSize, fontBold, colors.idLabel);
  centerText(glassIdText, idBoxY + template.idBox.idYOffset, template.idBox.idSize, fontMono, colors.ink);

  const signatureAreaY = template.signatures.imageY;
  const signatureLineY = template.signatures.lineY;
  const signatureSlotWidth = template.signatures.slotWidth;
  const signatureGap = template.signatures.gap;
  const leftX = (width - signatureSlotWidth * 2 - signatureGap) / 2;
  const rightX = leftX + signatureSlotWidth + signatureGap;

  centerText("Signatures", template.signatures.titleY, 10, fontBold, colors.subtitle);

  const labSignature = decodeImageDataUrl(input.labSignatureDataUrl);
  const glassSignature = decodeImageDataUrl(input.glassSignatureDataUrl);
  const labImage =
    labSignature.mimeType === "image/png"
      ? await pdf.embedPng(labSignature.bytes)
      : await pdf.embedJpg(labSignature.bytes);
  const glassImage =
    glassSignature.mimeType === "image/png"
      ? await pdf.embedPng(glassSignature.bytes)
      : await pdf.embedJpg(glassSignature.bytes);
  drawSignatureImage(page, labImage, leftX, signatureAreaY, signatureSlotWidth, template.signatures.imageHeight);
  drawSignatureImage(page, glassImage, rightX, signatureAreaY, signatureSlotWidth, template.signatures.imageHeight);

  page.drawLine({
    start: { x: leftX, y: signatureLineY },
    end: { x: leftX + signatureSlotWidth, y: signatureLineY },
    thickness: template.signatures.lineThickness,
    color: colors.signatureLine,
  });
  page.drawLine({
    start: { x: rightX, y: signatureLineY },
    end: { x: rightX + signatureSlotWidth, y: signatureLineY },
    thickness: template.signatures.lineThickness,
    color: colors.signatureLine,
  });

  const labSignerName = fitText(
    toFontSafeText(input.labSignerName, fontBold) || "Lab representative",
    signatureSlotWidth,
    template.signatures.nameSize,
    (value, size) => fontBold.widthOfTextAtSize(value, size),
  );
  const glassSignerName = fitText(
    toFontSafeText(input.glassSignerName, fontBold) || "GLASS signer",
    signatureSlotWidth,
    template.signatures.nameSize,
    (value, size) => fontBold.widthOfTextAtSize(value, size),
  );
  const labSignerTitle = fitText(
    toFontSafeText(input.labSignerTitle || "Lab representative", fontRegular) || "Lab representative",
    signatureSlotWidth,
    template.signatures.titleSize,
    (value, size) => fontRegular.widthOfTextAtSize(value, size),
  );
  const glassSignerTitle = fitText(
    toFontSafeText(input.glassSignerTitle || "GLASS admin", fontRegular) || "GLASS admin",
    signatureSlotWidth,
    template.signatures.titleSize,
    (value, size) => fontRegular.widthOfTextAtSize(value, size),
  );

  page.drawText(labSignerName, {
    x: leftX,
    y: signatureLineY - template.signatures.nameGap,
    size: template.signatures.nameSize,
    font: fontBold,
    color: colors.ink,
  });
  page.drawText(glassSignerName, {
    x: rightX,
    y: signatureLineY - template.signatures.nameGap,
    size: template.signatures.nameSize,
    font: fontBold,
    color: colors.ink,
  });
  page.drawText(labSignerTitle, {
    x: leftX,
    y: signatureLineY - template.signatures.titleGap,
    size: template.signatures.titleSize,
    font: fontRegular,
    color: colors.mutedInk,
  });
  page.drawText(glassSignerTitle, {
    x: rightX,
    y: signatureLineY - template.signatures.titleGap,
    size: template.signatures.titleSize,
    font: fontRegular,
    color: colors.mutedInk,
  });

  centerText(
    toFontSafeText(template.footer.text, fontRegular) || "Issued by GLASS.",
    template.footer.y,
    template.footer.size,
    fontRegular,
    colors.footer,
  );

  return pdf.save();
};

const generateVerificationCertificatePdf = async (input: CertificatePdfInput) => {
  const htmlPdf = await generateVerificationCertificatePdfFromHtmlTemplate(input);
  if (htmlPdf && htmlPdf.length > 0) {
    return htmlPdf;
  }
  throw new Error("Unable to render certificate from HTML template.");
};

const fetchProfileCapabilities = async (userId?: string | null) => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select(
      [
        "can_create_lab",
        "can_manage_multiple_labs",
        "can_manage_teams",
        "can_manage_multiple_teams",
        "can_post_news",
        "can_broker_requests",
        "can_receive_investor",
        "inbox_email_notifications_enabled",
        "is_admin",
      ].join(","),
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return {
    canCreateLab: parseBoolean((data as any)?.can_create_lab, false),
    canManageMultipleLabs: parseBoolean((data as any)?.can_manage_multiple_labs, false),
    canManageTeams: parseBoolean((data as any)?.can_manage_teams, false),
    canManageMultipleTeams: parseBoolean((data as any)?.can_manage_multiple_teams, false),
    canPostNews: parseBoolean((data as any)?.can_post_news, false),
    canBrokerRequests: parseBoolean((data as any)?.can_broker_requests, false),
    canReceiveInvestor: parseBoolean((data as any)?.can_receive_investor, false),
    inboxEmailNotificationsEnabled: parseNullableBoolean((data as any)?.inbox_email_notifications_enabled),
    isAdmin: parseBoolean((data as any)?.is_admin, false),
  };
};

const normalizeLabStatus = (status?: string | null) => (status || "listed").toLowerCase();
const formatLabStatusLabel = (status?: string | null) => {
  const normalized = normalizeLabStatus(status);
  if (normalized === "verified_active" || normalized === "verified_passive") return "verified";
  return normalized;
};
const isVerifiedLabStatus = (status?: string | null) =>
  ["verified_passive", "verified_active", "premier"].includes(normalizeLabStatus(status));
const canForwardLabRequests = (status?: string | null) =>
  ["verified_active", "premier"].includes(normalizeLabStatus(status));
const defaultInboxEmailNotificationsEnabled = (status?: string | null) =>
  normalizeLabStatus(status) !== "verified_passive";
const resolveInboxEmailNotificationsEnabled = (
  profile: { inboxEmailNotificationsEnabled?: boolean | null } | null | undefined,
  status?: string | null,
) => {
  if (typeof profile?.inboxEmailNotificationsEnabled === "boolean") {
    return profile.inboxEmailNotificationsEnabled;
  }
  return defaultInboxEmailNotificationsEnabled(status);
};

const fetchStripePrice = async (stripeKey: string, priceId?: string) => {
  if (!priceId) return null;
  const res = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Stripe price lookup failed");
  }
  const price = await res.json();
  const unitAmount = typeof price.unit_amount === "number" ? price.unit_amount / 100 : null;
  return { amount: unitAmount, currency: price.currency || null };
};

const getStripePricing = async () => {
  const now = Date.now();
  if (stripePricingCache.data && now < stripePricingCache.expiresAt) {
    return stripePricingCache.data;
  }
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return null;

  const verifiedYearlyPriceId =
    process.env.STRIPE_PRICE_VERIFIED_YEARLY_DISCOUNT || process.env.STRIPE_PRICE_VERIFIED_YEARLY;
  const premierYearlyPriceId =
    process.env.STRIPE_PRICE_PREMIER_YEARLY_DISCOUNT || process.env.STRIPE_PRICE_PREMIER_YEARLY;

  const [verifiedMonthly, verifiedYearly, premierMonthly, premierYearly] = await Promise.all([
    fetchStripePrice(stripeKey, process.env.STRIPE_PRICE_VERIFIED_MONTHLY),
    fetchStripePrice(stripeKey, verifiedYearlyPriceId),
    fetchStripePrice(stripeKey, process.env.STRIPE_PRICE_PREMIER_MONTHLY),
    fetchStripePrice(stripeKey, premierYearlyPriceId),
  ]);

  const data = {
    verified: {
      monthly: verifiedMonthly?.amount ?? null,
      yearly: verifiedYearly?.amount ?? null,
      currency: verifiedMonthly?.currency ?? verifiedYearly?.currency ?? null,
    },
    premier: {
      monthly: premierMonthly?.amount ?? null,
      yearly: premierYearly?.amount ?? null,
      currency: premierMonthly?.currency ?? premierYearly?.currency ?? null,
    },
  };
  stripePricingCache.data = data;
  stripePricingCache.expiresAt = now + 5 * 60 * 1000;
  return data;
};

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

const insertTierUpgradeInterestSchema = z.object({
  tier: z.enum(["verified", "premier"]),
  interval: z.enum(["monthly", "yearly"]).optional(),
  labIds: z.array(z.number().int().positive()).min(1, "Select at least one lab"),
});

const insertOnboardingCallRequestSchema = z.object({
  labName: z.string().trim().min(2, "Lab name is required").max(160, "Lab name is too long"),
  website: z.string().trim().min(3, "Website is required").max(255, "Website is too long"),
  contactName: z.string().trim().min(2, "Contact name is required").max(120, "Contact name is too long"),
  contactEmail: z.string().trim().email("Valid contact email is required"),
  contactPhone: z.string().trim().max(80, "Contact phone is too long").optional(),
  notes: z.string().trim().max(2000, "Notes are too long").optional(),
});

const resolveSubscriptionTier = (subscription: any) => {
  const metadataPlan = (subscription?.metadata?.plan as string | undefined)?.toLowerCase();
  if (metadataPlan === "verified" || metadataPlan === "premier") {
    return metadataPlan;
  }
  const priceId = subscription?.items?.data?.[0]?.price?.id as string | undefined;
  const mapping = stripePriceMap();
  return priceId && mapping[priceId] ? mapping[priceId].tier : null;
};

const mapSubscriptionStatus = (status?: string | null) => {
  const value = (status || "").toLowerCase();
  if (value === "active" || value === "trialing") return "active";
  if (value === "past_due" || value === "unpaid") return "past_due";
  if (value === "canceled" || value === "incomplete_expired") return "canceled";
  return "none";
};

const fetchStripeCustomer = async (stripeKey: string, customerId: string) => {
  const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Stripe customer lookup failed");
  }
  return res.json();
};

const getProfileSubscription = async (userId: string) => {
  const { data } = await supabase
    .from("profiles")
    .select("subscription_tier, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();
  const tier = (data?.subscription_tier || "base").toLowerCase();
  const status = (data?.subscription_status || "none").toLowerCase();
  return { tier, status };
};

const isActiveSubscriptionStatus = (status: string) =>
  status === "active" || status === "past_due" || status === "trialing";

const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization.trim() : "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : authHeader;
  const normalizedToken = token.replace(/^"+|"+$/g, "");
  if (!normalizedToken) return res.status(401).json({ message: "Missing token" });

  const { data, error } = await supabasePublic.auth.getUser(normalizedToken);
  if (error || !data?.user) return res.status(401).json({ message: "Invalid token" });

  req.user = data.user;
  next();
};

const getOptionalUserIdFromAuthHeader = async (req: Request): Promise<string | null> => {
  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization.trim() : "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : authHeader;
  const normalizedToken = token.replace(/^"+|"+$/g, "");
  if (!normalizedToken) return null;

  const { data, error } = await supabasePublic.auth.getUser(normalizedToken);
  if (error || !data?.user?.id) return null;
  return data.user.id;
};

const canAccessLabFromPublicRoute = async (req: Request, lab: { isVisible?: boolean | null; ownerUserId?: string | null }) => {
  if (lab?.isVisible !== false) return true;
  const userId = await getOptionalUserIdFromAuthHeader(req);
  if (!userId) return false;
  if (lab?.ownerUserId && lab.ownerUserId === userId) return true;
  const profile = await fetchProfileCapabilities(userId);
  return Boolean(profile?.isAdmin);
};

const sanitizePublicLab = (lab: any) => {
  const {
    ownerUserId: _ownerUserId,
    owner_user_id: _ownerUserIdSnake,
    contactEmail: _contactEmail,
    contact_email: _contactEmailSnake,
    ...safe
  } = lab ?? {};
  return safe;
};

const sanitizePublicTeam = (team: any) => ({
  ...team,
  ownerUserId: null,
  members: Array.isArray(team?.members)
    ? team.members.map((member: any) => ({
        ...member,
        email: null,
      }))
    : [],
});

export function registerRoutes(app: Express) {
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const signupRateLimit = createRateLimiter("signup", 8, 15 * 60 * 1000);
  const loginRateLimit = createRateLimiter("login", 20, 15 * 60 * 1000);
  const publicFormRateLimit = createRateLimiter("public-form", 20, 10 * 60 * 1000);
  const publicRequestRateLimit = createRateLimiter("public-request", 20, 10 * 60 * 1000);

  // --------- Stripe Webhook ----------
  app.post("/api/stripe/webhook", async (req, res) => {
    const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = req.headers["stripe-signature"];
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!stripeSecret) {
      return res.status(500).json({ message: "Stripe webhook secret not configured" });
    }
    if (!rawBody || typeof signature !== "string") {
      return res.status(400).json({ message: "Missing Stripe signature" });
    }

    const parts = signature.split(",").map(part => part.trim());
    const timestampPart = parts.find(part => part.startsWith("t="));
    const signatureParts = parts.filter(part => part.startsWith("v1=")).map(part => part.replace("v1=", ""));
    if (!timestampPart || signatureParts.length === 0) {
      return res.status(400).json({ message: "Invalid Stripe signature" });
    }
    const timestamp = timestampPart.replace("t=", "");
    const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
    const expected = crypto
      .createHmac("sha256", stripeSecret)
      .update(signedPayload, "utf8")
      .digest("hex");
    const valid = signatureParts.some(sig => timingSafeEqual(sig, expected));
    if (!valid) {
      return res.status(400).json({ message: "Stripe signature verification failed" });
    }

    const event = JSON.parse(rawBody.toString("utf8"));

    const updateProfileForSubscription = async (subscription: any) => {
      const customerId = subscription?.customer as string | undefined;
      if (!customerId) return;
      let userId: string | null = subscription?.metadata?.user_id ?? null;
      let customerEmail: string | null = null;
      let customerLabId: number | null = null;

      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          console.warn("[stripe] missing STRIPE_SECRET_KEY for customer lookup");
          return;
        }
        const customer = await fetchStripeCustomer(stripeKey, customerId);
        userId = userId || customer?.metadata?.user_id || null;
        customerEmail = customer?.email || null;
        const parsedCustomerLabId = parseRequestedLabId(customer?.metadata?.lab_id);
        customerLabId =
          typeof parsedCustomerLabId === "number" && !Number.isNaN(parsedCustomerLabId)
            ? parsedCustomerLabId
            : null;
      } catch (error) {
        console.warn("[stripe] customer lookup failed", error);
      }

      if (!userId && customerEmail) {
        const { data } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("email", customerEmail)
          .maybeSingle();
        userId = data?.user_id ?? null;
      }

      if (!userId) {
        console.warn("[stripe] unable to map subscription to user");
        return;
      }

      const tier = resolveSubscriptionTier(subscription) || "base";
      const status = mapSubscriptionStatus(subscription?.status);
      const tierToSave = status === "active" || status === "past_due" ? tier : "base";

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          subscription_tier: tierToSave,
          subscription_status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      if (updateError) {
        console.warn("[stripe] failed to update profile", updateError.message);
      }

      const parsedLabId = parseRequestedLabId(subscription?.metadata?.lab_id);
      const subscriptionLabId =
        typeof parsedLabId === "number" && !Number.isNaN(parsedLabId) ? parsedLabId : customerLabId;
      const stripeSubscriptionStatus = typeof subscription?.status === "string" ? subscription.status.toLowerCase() : "";
      const targetLabStatus =
        stripeSubscriptionStatus === "active"
          ? tier === "premier"
            ? "premier"
            : tier === "verified"
              ? "verified_active"
              : null
          : null;

      if (subscriptionLabId && targetLabStatus) {
        const { error: labUpdateError } = await supabase
          .from("labs")
          .update({ lab_status: targetLabStatus })
          .eq("id", subscriptionLabId)
          .eq("owner_user_id", userId);
        if (labUpdateError) {
          console.warn("[stripe] failed to update lab status", labUpdateError.message);
        }
      }

    };

    try {
      if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
        await updateProfileForSubscription(event.data.object);
      }
      if (event.type === "customer.subscription.deleted") {
        await updateProfileForSubscription({ ...event.data.object, status: "canceled" });
      }
      if (event.type === "invoice.payment_failed") {
        const subscriptionId = event.data.object?.subscription;
        if (subscriptionId && process.env.STRIPE_SECRET_KEY) {
          const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
          });
          if (subRes.ok) {
            const subscription = await subRes.json();
            await updateProfileForSubscription({ ...subscription, status: "past_due" });
          }
        }
      }
    } catch (error) {
      console.error("[stripe] webhook handler failed", error);
      return res.status(500).json({ message: "Webhook handler failed" });
    }

    return res.json({ received: true });
  });

  // --------- Stripe Checkout for subscriptions ----------
  app.post("/api/subscriptions/checkout", authenticate, async (req, res) => {
    try {
      const { plan, interval, labId } = req.body ?? {};
      const planKey = typeof plan === "string" ? plan.toLowerCase() : "";
      const intervalKey = typeof interval === "string" ? interval.toLowerCase() : "monthly";
      if (!planKey || !["verified", "premier"].includes(planKey)) {
        return res.status(400).json({ message: "Invalid plan" });
      }
      if (!["monthly", "yearly"].includes(intervalKey)) {
        return res.status(400).json({ message: "Invalid interval" });
      }
      const selectedLab = await resolveSubscriptionLabId(req.user.id, labId, planKey as "verified" | "premier");
      if (selectedLab.error) {
        return res.status(selectedLab.error.status).json({ message: selectedLab.error.message });
      }

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ message: "Stripe not configured" });

      const priceId = resolveStripePriceId(planKey, intervalKey);

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
      params.append("metadata[lab_id]", String(selectedLab.labId));
      params.append("subscription_data[metadata][plan]", planKey);
      params.append("subscription_data[metadata][interval]", intervalKey);
      params.append("subscription_data[metadata][lab_id]", String(selectedLab.labId));

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
        console.error("[stripe] checkout session creation failed", errorText);
        return res.status(500).json({ message: "Stripe error" });
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
  app.post("/api/subscriptions/intent", authenticate, async (req, res) => {
    try {
      const { plan, interval, email, labId } = req.body ?? {};
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
      const selectedLab = await resolveSubscriptionLabId(req.user.id, labId, planKey as "verified" | "premier");
      if (selectedLab.error) {
        return res.status(selectedLab.error.status).json({ message: selectedLab.error.message });
      }

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ message: "Stripe not configured" });

      const priceId = resolveStripePriceId(planKey, intervalKey);

      if (!priceId) {
        return res.status(500).json({ message: "Stripe price not configured" });
      }

      const customerParams = new URLSearchParams();
      customerParams.append("email", emailValue);
      if (req.user?.id) {
        customerParams.append("metadata[user_id]", req.user.id);
      }
      customerParams.append("metadata[lab_id]", String(selectedLab.labId));
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
        console.error("[stripe] customer creation failed", errorText);
        return res.status(500).json({ message: "Stripe error" });
      }
      const customer = await customerRes.json();

      const setupParams = new URLSearchParams();
      setupParams.append("customer", customer.id);
      setupParams.append("payment_method_types[]", "card");
      setupParams.append("usage", "off_session");
      setupParams.append("metadata[plan]", planKey);
      setupParams.append("metadata[interval]", intervalKey);
      setupParams.append("metadata[lab_id]", String(selectedLab.labId));
      if (req.user?.id) {
        setupParams.append("metadata[user_id]", req.user.id);
      }

      const setupRes = await fetch("https://api.stripe.com/v1/setup_intents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: setupParams.toString(),
      });
      if (!setupRes.ok) {
        const errorText = await setupRes.text();
        console.error("[stripe] setup intent creation failed", errorText);
        return res.status(500).json({ message: "Stripe error" });
      }
      const setupIntent = await setupRes.json();
      const clientSecret = setupIntent?.client_secret;
      if (!clientSecret) {
        return res.status(500).json({ message: "Missing setup intent client secret" });
      }
      return res.status(200).json({ client_secret: clientSecret, setup_intent_id: setupIntent.id });
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : "Unable to create subscription intent",
      });
    }
  });

  // --------- Stripe subscription activation ----------
  app.post("/api/subscriptions/activate", authenticate, async (req, res) => {
    try {
      const schema = z.object({
        plan: z.string(),
        interval: z.string(),
        setupIntentId: z.string(),
        labId: z.coerce.number().int().positive().optional(),
      });
      const payload = schema.parse(req.body);
      const planKey = payload.plan.toLowerCase();
      const intervalKey = payload.interval.toLowerCase();
      if (!["verified", "premier"].includes(planKey)) {
        return res.status(400).json({ message: "Invalid plan" });
      }
      if (!["monthly", "yearly"].includes(intervalKey)) {
        return res.status(400).json({ message: "Invalid interval" });
      }
      const selectedLab = await resolveSubscriptionLabId(
        req.user.id,
        payload.labId,
        planKey as "verified" | "premier",
      );
      if (selectedLab.error) {
        return res.status(selectedLab.error.status).json({ message: selectedLab.error.message });
      }

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ message: "Stripe not configured" });

      const priceId = resolveStripePriceId(planKey, intervalKey);

      if (!priceId) {
        return res.status(500).json({ message: "Stripe price not configured" });
      }

      const setupRes = await fetch(`https://api.stripe.com/v1/setup_intents/${payload.setupIntentId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
        },
      });
      if (!setupRes.ok) {
        const errorText = await setupRes.text();
        console.error("[stripe] setup intent lookup failed", errorText);
        return res.status(500).json({ message: "Stripe error" });
      }
      const setupIntent = await setupRes.json();
      const paymentMethod = setupIntent?.payment_method;
      const customerId = setupIntent?.customer;
      const setupUserId = setupIntent?.metadata?.user_id;
      const setupLabId = parseRequestedLabId(setupIntent?.metadata?.lab_id);
      if (!paymentMethod || !customerId) {
        return res.status(400).json({ message: "Setup intent incomplete" });
      }
      if (setupUserId && setupUserId !== req.user.id) {
        return res.status(403).json({ message: "Setup intent does not belong to this user" });
      }
      if (typeof setupLabId === "number" && !Number.isNaN(setupLabId) && setupLabId !== selectedLab.labId) {
        return res.status(403).json({ message: "Setup intent lab does not match selected lab" });
      }

      const params = new URLSearchParams();
      params.append("customer", customerId);
      params.append("items[0][price]", priceId);
      params.append("default_payment_method", paymentMethod);
      params.append("collection_method", "charge_automatically");
      params.append("payment_behavior", "default_incomplete");
      params.append("payment_settings[payment_method_types][]", "card");
      params.append("payment_settings[save_default_payment_method]", "on_subscription");
      params.append("expand[]", "latest_invoice.payment_intent");
      params.append("metadata[plan]", planKey);
      params.append("metadata[interval]", intervalKey);
      params.append("metadata[lab_id]", String(selectedLab.labId));
      if (req.user?.id) {
        params.append("metadata[user_id]", req.user.id);
      }

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
        console.error("[stripe] subscription creation failed", errorText);
        return res.status(500).json({ message: "Stripe error" });
      }
      const subscription = await subRes.json();
      const latestInvoice = subscription?.latest_invoice ?? null;
      let invoiceId: string | null = null;
      let invoiceStatus: string | null = null;
      let paymentIntent: any = null;

      if (typeof latestInvoice === "string") {
        invoiceId = latestInvoice;
      } else if (latestInvoice && typeof latestInvoice === "object") {
        invoiceId = latestInvoice.id ?? null;
        invoiceStatus = latestInvoice.status ?? null;
        paymentIntent = latestInvoice.payment_intent ?? null;
      }

      const fetchInvoice = async (id: string) => {
        const invoiceRes = await fetch(`https://api.stripe.com/v1/invoices/${id}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
          },
        });
        if (!invoiceRes.ok) return null;
        return invoiceRes.json();
      };

      const fetchPaymentIntent = async (id: string) => {
        const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${id}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
          },
        });
        if (!piRes.ok) return null;
        return piRes.json();
      };

      if (!paymentIntent && invoiceId) {
        const invoice = await fetchInvoice(invoiceId);
        if (invoice) {
          invoiceStatus = invoice.status ?? invoiceStatus;
          paymentIntent = invoice.payment_intent ?? paymentIntent;
        }
        if (!paymentIntent && invoiceStatus === "draft") {
          const finalizeRes = await fetch(`https://api.stripe.com/v1/invoices/${invoiceId}/finalize`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${stripeKey}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
          });
          if (finalizeRes.ok) {
            const invoice = await finalizeRes.json();
            paymentIntent = invoice?.payment_intent ?? paymentIntent;
          }
        }
      }

      if (paymentIntent && typeof paymentIntent === "string") {
        const fetchedIntent = await fetchPaymentIntent(paymentIntent);
        if (fetchedIntent) {
          paymentIntent = fetchedIntent;
        }
      }

      const clientSecret = paymentIntent?.client_secret || null;

      return res.status(200).json({
        subscription_id: subscription?.id ?? null,
        status: subscription?.status ?? null,
        payment_intent_client_secret: clientSecret,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid subscription payload" });
      }
      res.status(500).json({
        message: error instanceof Error ? error.message : "Unable to activate subscription",
      });
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

  app.post("/api/tier-upgrade-interest", authenticate, async (req, res) => {
    try {
      const payload = insertTierUpgradeInterestSchema.parse(req.body);
      const uniqueLabIds = Array.from(new Set(payload.labIds));

      const { data, error } = await supabase
        .from("labs")
        .select("id, name, lab_status")
        .eq("owner_user_id", req.user.id)
        .in("id", uniqueLabIds);
      if (error) throw error;

      const labs = (data ?? [])
        .map(row => ({
          id: Number((row as any).id),
          name: typeof (row as any).name === "string" ? (row as any).name : "",
          labStatus: typeof (row as any).lab_status === "string" ? (row as any).lab_status : "listed",
        }))
        .filter(lab => Number.isInteger(lab.id) && lab.id > 0);

      if (labs.length !== uniqueLabIds.length) {
        return res.status(403).json({ message: "One or more selected labs are invalid for this account." });
      }

      const ineligibleLabs = labs.filter(lab => !canLabSubscribeToPlan(lab.labStatus, payload.tier));
      if (ineligibleLabs.length > 0) {
        const label =
          payload.tier === "premier"
            ? "already on Premier"
            : "already on Verified or Premier";
        return res.status(409).json({
          message:
            ineligibleLabs.length === 1
              ? `${ineligibleLabs[0].name || "Selected lab"} is ${label}.`
              : "One or more selected labs are not eligible for this upgrade tier.",
        });
      }

      const requesterName =
        (req.user.user_metadata?.full_name as string | undefined) ||
        (req.user.user_metadata?.name as string | undefined) ||
        (req.user.user_metadata?.display_name as string | undefined) ||
        "Unknown";
      const requesterEmail = req.user.email || "unknown";
      const adminEmail = process.env.ADMIN_INBOX ?? "contact@glass-funding.com";
      const tierLabel = payload.tier === "premier" ? "Premier" : "Verified";

      const lines = [
        "New tier upgrade request",
        "",
        `Tier requested: ${tierLabel}`,
        `Billing preference: ${(payload.interval || "yearly").toLowerCase()}`,
        `Requester: ${requesterName} <${requesterEmail}>`,
        `User ID: ${req.user.id}`,
        "",
        "Labs:",
        ...labs.map(
          lab =>
            `- ${lab.name || `Lab #${lab.id}`} (id: ${lab.id}, current status: ${formatLabStatusLabel(lab.labStatus)})`,
        ),
      ].join("\n");

      await sendMail({
        to: adminEmail,
        from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
        subject: `Tier upgrade request: ${tierLabel} (${labs.length} lab${labs.length === 1 ? "" : "s"})`,
        text: lines,
      });

      res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid upgrade request" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to submit upgrade request" });
    }
  });

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

  // --------- Teams ----------
  app.get("/api/teams", async (req, res) => {
    const includeHiddenRequested = req.query.includeHidden === "true" || req.query.includeHidden === "1";
    let includeHidden = false;
    if (includeHiddenRequested) {
      const userId = await getOptionalUserIdFromAuthHeader(req);
      if (userId) {
        const profile = await fetchProfileCapabilities(userId);
        includeHidden = Boolean(profile?.isAdmin);
      }
    }
    const teams = includeHidden ? await teamStore.list() : await teamStore.listVisible();
    res.json(includeHidden ? teams : teams.map(sanitizePublicTeam));
  });

  app.get("/api/teams/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid team id" });
    }
    try {
      const team = await teamStore.findById(id);
      if (!team) return res.status(404).json({ message: "Team not found" });
      res.json(sanitizePublicTeam(team));
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load team" });
    }
  });

  app.post("/api/teams", authenticate, async (req, res) => {
    try {
      const ownerUserId = req.user?.id ?? null;
      const profile = await fetchProfileCapabilities(req.user?.id);
      if (!profile) {
        return res.status(403).json({ message: "Profile permissions not found for this account." });
      }
      if (!profile.canManageTeams) {
        return res.status(403).json({ message: "This account is not allowed to manage teams yet." });
      }
      if (!profile.canManageMultipleTeams) {
        const { count, error: countErr } = await supabase
          .from("teams")
          .select("id", { count: "exact", head: true })
          .eq("owner_user_id", ownerUserId);
        if (countErr) throw countErr;
        if ((count ?? 0) >= 1) {
          return res
            .status(403)
            .json({ message: "This account can manage only one team right now. Contact Glass to add more." });
        }
      }
      const payload = insertTeamSchema.parse({
        ...req.body,
        ownerUserId,
        labIds: [],
      });
      const team = await teamStore.create(payload);
      res.status(201).json(team);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid team payload" });
      }
      res.status(500).json({ message: "Unable to create team" });
    }
  });

  app.put("/api/teams/:id", authenticate, async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid team id" });
    }
    try {
      const existing = await teamStore.findById(id);
      if (!existing) return res.status(404).json({ message: "Team not found" });
      const profile = await fetchProfileCapabilities(req.user?.id);
      if (!profile) {
        return res.status(403).json({ message: "Profile permissions not found for this account." });
      }
      if (existing.ownerUserId !== req.user?.id) {
        return res.status(403).json({ message: "Not authorized to update this team" });
      }
      if (!profile.canManageTeams) {
        return res.status(403).json({ message: "This account is not allowed to manage teams yet." });
      }
      const sanitized = { ...req.body };
      delete sanitized.labIds;
      const updates = updateTeamSchema.parse(sanitized);
      const updated = await teamStore.update(id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid team update" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to update team" });
    }
  });

  app.delete("/api/teams/:id", authenticate, async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid team id" });
    }
    try {
      const existing = await teamStore.findById(id);
      if (!existing) return res.status(404).json({ message: "Team not found" });
      const profile = await fetchProfileCapabilities(req.user?.id);
      if (!profile) {
        return res.status(403).json({ message: "Profile permissions not found for this account." });
      }
      if (existing.ownerUserId !== req.user?.id) {
        return res.status(403).json({ message: "Not authorized to delete this team" });
      }
      if (!profile.canManageTeams) {
        return res.status(403).json({ message: "This account is not allowed to manage teams yet." });
      }
      await teamStore.delete(id);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to delete team" });
    }
  });

  app.get("/api/my-teams", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canManageTeams) {
        return res.status(403).json({ message: "This account is not enabled to manage teams yet." });
      }
      const teams = await teamStore.listByOwner(userId);
      res.json(teams);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load teams" });
    }
  });

  app.get("/api/my-team/:id", authenticate, async (req, res) => {
    try {
      const teamId = Number(req.params.id);
      if (Number.isNaN(teamId)) return res.status(400).json({ message: "Invalid team id" });
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canManageTeams) {
        return res.status(403).json({ message: "This account is not enabled to manage teams yet." });
      }
      const team = await teamStore.findById(teamId);
      if (!team || team.ownerUserId !== userId) return res.status(404).json({ message: "No team linked to this account" });
      res.json(team);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load team" });
    }
  });

  app.put("/api/my-team/:id", authenticate, async (req, res) => {
    try {
      const teamId = Number(req.params.id);
      if (Number.isNaN(teamId)) return res.status(400).json({ message: "Invalid team id" });
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canManageTeams) {
        return res.status(403).json({ message: "This account is not enabled to manage teams yet." });
      }
      const team = await teamStore.findById(teamId);
      if (!team || team.ownerUserId !== userId) return res.status(404).json({ message: "No team linked to this account" });
      const sanitized = { ...req.body };
      delete sanitized.labIds;
      const updates = updateTeamSchema.parse(sanitized);
      const updated = await teamStore.update(teamId, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid team update" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to update team" });
    }
  });

  app.delete("/api/my-team/:id", authenticate, async (req, res) => {
    try {
      const teamId = Number(req.params.id);
      if (Number.isNaN(teamId)) return res.status(400).json({ message: "Invalid team id" });
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const team = await teamStore.findById(teamId);
      if (!team || team.ownerUserId !== userId) return res.status(404).json({ message: "No team linked to this account" });
      await teamStore.delete(teamId);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to delete team" });
    }
  });

  app.get("/api/labs/:id/teams", async (req, res) => {
    const labId = Number(req.params.id);
    if (Number.isNaN(labId)) {
      return res.status(400).json({ message: "Invalid lab id" });
    }
    try {
      const teams = await teamStore.listByLabId(labId);
      res.json(teams.map(sanitizePublicTeam));
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load teams" });
    }
  });

  app.post("/api/teams/:id/link-requests", authenticate, async (req, res) => {
    const teamId = Number(req.params.id);
    if (Number.isNaN(teamId)) return res.status(400).json({ message: "Invalid team id" });
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const team = await teamStore.findById(teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });
      const profile = await fetchProfileCapabilities(userId);
      if (team.ownerUserId !== userId) {
        return res.status(403).json({ message: "Not authorized to request lab links" });
      }
      if (!profile?.canManageTeams) {
        return res.status(403).json({ message: "This account cannot manage teams." });
      }
      const labId = Number(req.body?.labId);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });

      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });

      const { data: existingLink } = await supabase
        .from("lab_team_links")
        .select("lab_id")
        .eq("lab_id", labId)
        .eq("team_id", teamId)
        .maybeSingle();
      if (existingLink) {
        return res.status(409).json({ message: "Team is already linked to this lab" });
      }

      const { data: existingRequest } = await supabase
        .from("lab_team_link_requests")
        .select("id, status")
        .eq("lab_id", labId)
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (existingRequest && existingRequest.status === "pending") {
        return res.status(409).json({ message: "A pending request already exists for this lab" });
      }

      const { data: inserted, error } = await supabase
        .from("lab_team_link_requests")
        .insert({
          lab_id: labId,
          team_id: teamId,
          requested_by_user_id: userId,
          status: "pending",
        })
        .select("id")
        .single();
      if (error || !inserted) throw error ?? new Error("Unable to create request");
      res.status(201).json({ id: inserted.id });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to create request" });
    }
  });

  app.get("/api/teams/:id/link-requests", authenticate, async (req, res) => {
    const teamId = Number(req.params.id);
    if (Number.isNaN(teamId)) return res.status(400).json({ message: "Invalid team id" });
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const team = await teamStore.findById(teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });
      const profile = await fetchProfileCapabilities(userId);
      if (team.ownerUserId !== userId) {
        return res.status(403).json({ message: "Not authorized to view requests" });
      }
      if (!profile?.canManageTeams) {
        return res.status(403).json({ message: "This account cannot manage teams." });
      }
      const { data, error } = await supabase
        .from("lab_team_link_requests")
        .select("id, lab_id, status, created_at, responded_at, labs (id, name, lab_location (city, country))")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const mapped = (data ?? []).map(row => {
        const lab = (row as any).labs ?? null;
        const location = (Array.isArray(lab?.lab_location) ? lab.lab_location[0] : lab?.lab_location) ?? null;
        return {
          ...row,
          labs: lab
            ? {
                id: lab.id,
                name: lab.name,
                city: location?.city ?? null,
                country: location?.country ?? null,
              }
            : null,
        };
      });
      res.json(mapped);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load requests" });
    }
  });

  app.get("/api/labs/:id/team-link-requests", authenticate, async (req, res) => {
    const labId = Number(req.params.id);
    if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const profile = await fetchProfileCapabilities(userId);
      if (lab.ownerUserId !== userId) {
        return res.status(403).json({ message: "Not authorized to view requests" });
      }
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account cannot manage labs." });
      }
      const { data, error } = await supabase
        .from("lab_team_link_requests")
        .select("id, team_id, status, created_at, requested_by_user_id, teams (id, name, description_short, logo_url)")
        .eq("lab_id", labId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json(data ?? []);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load requests" });
    }
  });

  app.post("/api/labs/:id/team-link-requests/:requestId", authenticate, async (req, res) => {
    const labId = Number(req.params.id);
    const requestId = Number(req.params.requestId);
    if (Number.isNaN(labId) || Number.isNaN(requestId)) {
      return res.status(400).json({ message: "Invalid request" });
    }
    const status = (req.body?.status as string)?.toLowerCase();
    if (status !== "approved" && status !== "declined") {
      return res.status(400).json({ message: "Status must be approved or declined" });
    }
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const profile = await fetchProfileCapabilities(userId);
      if (lab.ownerUserId !== userId) {
        return res.status(403).json({ message: "Not authorized to update requests" });
      }
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account cannot manage labs." });
      }
      const { data: requestRow, error: reqError } = await supabase
        .from("lab_team_link_requests")
        .select("id, team_id, status")
        .eq("id", requestId)
        .eq("lab_id", labId)
        .maybeSingle();
      if (reqError) throw reqError;
      if (!requestRow) return res.status(404).json({ message: "Request not found" });
      if (requestRow.status !== "pending") {
        return res.status(409).json({ message: "Request already resolved" });
      }

      const { error: updateError } = await supabase
        .from("lab_team_link_requests")
        .update({ status, responded_at: new Date().toISOString() })
        .eq("id", requestId);
      if (updateError) throw updateError;

      if (status === "approved") {
        const { error: linkError } = await supabase
          .from("lab_team_links")
          .insert({ lab_id: labId, team_id: requestRow.team_id });
        if (linkError) throw linkError;
      }

      res.json({ status });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to update request" });
    }
  });

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

  // Legacy profile endpoints (archived for security hardening)
  const profileLegacyArchived = (_req: Request, res: Response) =>
    res.status(410).json({
      message: "This legacy profile endpoint is archived. Use /api/me/profile instead.",
    });

  app.get("/api/profile/:id", profileLegacyArchived);
  app.post("/api/profile/:id", profileLegacyArchived);


// Signup
app.post("/api/signup", signupRateLimit, async (req, res) => {
  try {
    const { email, password, display_name } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim() : "";
    const normalizedPassword = typeof password === "string" ? password : "";

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return res.status(400).json({ message: "Use a valid email address." });
    }
    const passwordPolicyError = getPasswordPolicyError(normalizedPassword);
    if (passwordPolicyError) {
      return res.status(400).json({ message: passwordPolicyError });
    }

    const origin = resolvePublicSiteOrigin(req);

    const { data, error } = await supabasePublic.auth.signUp({
      email: normalizedEmail,
      password: normalizedPassword,
      options: {
        data: { display_name },
        emailRedirectTo: `${origin}/confirm-email`,
      },
    });

    if (error) throw error;

    res.status(201).json({ message: "Signup successful, check your email", user: data.user });
  } catch (err) {
    res.status(400).json({ message: err instanceof Error ? err.message : "Signup failed" });
  }
});

// Login
  app.post("/api/login", loginRateLimit, async (req, res) => {
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



// Legacy debug route archived
app.get("/api/profile", (_req, res) => {
  res.status(410).json({ message: "This endpoint is archived. Use /api/me/profile instead." });
});

  app.get("/api/me/profile", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,email,name,subscription_status,avatar_url")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;

      res.json({ profile: data ?? null });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load profile" });
    }
  });

  app.put("/api/me/profile", authenticate, async (req, res) => {
    const schema = z.object({
      name: z.string().optional().nullable(),
      avatarUrl: z.string().optional().nullable(),
    });
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const payload = schema.parse(req.body ?? {});

      const updates: Record<string, unknown> = {};
      if ("name" in payload) {
        const nextName = typeof payload.name === "string" ? payload.name.trim() : "";
        updates.name = nextName || null;
      }
      if ("avatarUrl" in payload) {
        const nextAvatar = typeof payload.avatarUrl === "string" ? payload.avatarUrl.trim() : "";
        updates.avatar_url = nextAvatar || null;
      }

      const { data: existing, error: existingError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existingError) throw existingError;

      if (existing?.user_id) {
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from("profiles")
            .update(updates)
            .eq("user_id", userId);
          if (updateError) throw updateError;
        }
      } else {
        const email = typeof req.user?.email === "string" ? req.user.email : null;
        if (!email) {
          return res.status(400).json({ message: "No email on authenticated user" });
        }
        const insertPayload: Record<string, unknown> = {
          user_id: userId,
          email,
          ...updates,
        };
        const { error: insertError } = await supabase.from("profiles").insert(insertPayload);
        if (insertError) throw insertError;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,email,name,subscription_status,avatar_url")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;

      res.json({ profile: data ?? null });
    } catch (err) {
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid profile payload" });
      }
      res.status(500).json({ message: errorToMessage(err, "Unable to save profile") });
    }
  });

  // --------- Account Deletion (GDPR) ----------
  app.delete("/api/account", authenticate, async (req, res) => {
    const userId = req.user?.id;
    const userEmail = typeof req.user?.email === "string" ? req.user.email.trim() : "";
    if (!userId) return res.status(400).json({ message: "No user on request" });

    const runCleanup = async (
      label: string,
      task: () => Promise<{ error: any } | void>,
    ) => {
      try {
        const result = await task();
        const maybeError = (result as any)?.error;
        if (maybeError) throw maybeError;
      } catch (error: any) {
        if (isMissingRelationError(error)) {
          console.info(`[account-delete] skipping ${label}: table missing`);
          return;
        }
        throw error;
      }
    };

    try {
      // Remove user-linked rows and detach ownership from shared/public entities.
      await runCleanup("lab_favorites", async () =>
        supabase.from("lab_favorites").delete().eq("user_id", userId),
      );
      await runCleanup("lab_views", async () =>
        supabase.from("lab_views").delete().eq("user_id", userId),
      );
      await runCleanup("lab_news", async () =>
        supabase.from("lab_news").update({ created_by: null }).eq("created_by", userId),
      );
      await runCleanup("labs ownership", async () =>
        supabase.from("labs").update({ owner_user_id: null }).eq("owner_user_id", userId),
      );
      await runCleanup("teams ownership", async () =>
        supabase.from("teams").update({ owner_user_id: null }).eq("owner_user_id", userId),
      );
      await runCleanup("team link requests", async () =>
        supabase.from("lab_team_link_requests").delete().eq("requested_by_user_id", userId),
      );
      if (userEmail) {
        await runCleanup("lab contact requests", async () =>
          supabase.from("lab_contact_requests").delete().ilike("requester_email", userEmail),
        );
        await runCleanup("lab collaborations", async () =>
          supabase.from("lab_collaborations").delete().ilike("contact_email", userEmail),
        );
      }
      await runCleanup("profile", async () =>
        supabase.from("profiles").delete().eq("user_id", userId),
      );

      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) throw authError;

      return res.status(204).end();
    } catch (error) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Unable to delete account",
      });
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

  // --------- Lab News (premier) ----------
  app.post("/api/news", authenticate, async (req, res) => {
    try {
      const payload = insertNewsSchema.parse(req.body);
      const requesterUserId = req.user?.id;
      if (!requesterUserId) return res.status(400).json({ message: "No user on request" });
      const requesterProfile = await fetchProfileCapabilities(requesterUserId);
      if (!requesterProfile) {
        return res.status(403).json({ message: "Profile permissions not found for this account." });
      }

      const lab = await labStore.findById(payload.labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const ownerUserId = lab.ownerUserId ?? null;
      if (!ownerUserId) {
        return res.status(403).json({ message: "Only claimed labs can post news right now." });
      }
      const ownerProfile = await fetchProfileCapabilities(ownerUserId);
      if (!ownerProfile?.canCreateLab) {
        return res.status(403).json({ message: "News is available to lab owners only." });
      }
      if (lab.labStatus !== "premier") {
        return res.status(403).json({ message: "News is available for premier labs only." });
      }
      const isOwner = ownerUserId === requesterUserId;
      if (!isOwner && !requesterProfile.isAdmin) {
        return res.status(403).json({ message: "Not allowed to post for this lab" });
      }
      if (!requesterProfile.isAdmin && payload.authorId && payload.authorId !== requesterUserId) {
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
          created_by: requesterProfile.isAdmin ? (payload.authorId ?? requesterUserId) : requesterUserId,
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
        .select("id, lab_id, title, summary, category, images, status, created_at, labs!inner(name, lab_status, owner_user_id)")
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
        .select("id, lab_id, title, summary, category, images, status, created_at, labs:lab_id (name, lab_status)")
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

  // --------- Pricing ----------
  app.get("/api/pricing", async (_req, res) => {
    let list: Array<{
      name: string;
      monthly_price: number | null;
      yearly_price: number | null;
      currency: string | null;
      description: string;
      highlights: readonly string[];
      featured: boolean;
      sort_order: number;
    }> = defaultPricing.map(tier => ({
      name: tier.name,
      monthly_price: tier.monthly_price ?? null,
      yearly_price: tier.name === "Base" ? 0 : null as number | null,
      currency: null as string | null,
      description: tier.description,
      highlights: tier.highlights,
      featured: tier.featured ?? false,
      sort_order: tier.sort_order ?? 999,
    }));

    try {
      const { data, error } = await supabase
        .from("pricing_features")
        .select("id, tier_name, feature, sort_order, created_at")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      if (error) {
        console.warn("[pricing] pricing_features lookup failed", error);
      } else if (Array.isArray(data) && data.length > 0) {
        const featuresByTier = new Map<string, string[]>();
        for (const row of data as Array<{ tier_name?: string | null; feature?: string | null }>) {
          const tierKey = (row.tier_name || "").toLowerCase().trim();
          const feature = (row.feature || "").trim();
          if (!tierKey || !feature) continue;

          const existing = featuresByTier.get(tierKey) ?? [];
          if (!existing.includes(feature) && existing.length < 10) {
            existing.push(feature);
            featuresByTier.set(tierKey, existing);
          }
        }

        list = list.map(tier => {
          const tierKey = (tier.name || "").toLowerCase().trim();
          const features = featuresByTier.get(tierKey);
          if (features && features.length > 0) {
            return { ...tier, highlights: features };
          }
          return tier;
        });
      }
    } catch (error) {
      console.warn("[pricing] unable to load pricing_features", error);
    }

    try {
      const stripePricing = await getStripePricing();
      if (stripePricing) {
        list = list.map(tier => {
          const key = (tier.name || "").toLowerCase().trim();
          if (key === "verified") {
            return {
              ...tier,
              monthly_price: stripePricing.verified.monthly ?? tier.monthly_price,
              yearly_price: stripePricing.verified.yearly ?? tier.yearly_price,
              currency: stripePricing.verified.currency,
            };
          }
          if (key === "premier") {
            return {
              ...tier,
              monthly_price: stripePricing.premier.monthly ?? tier.monthly_price,
              yearly_price: stripePricing.premier.yearly ?? tier.yearly_price,
              currency: stripePricing.premier.currency,
            };
          }
          return tier;
        });
      }
    } catch (error) {
      console.warn("[pricing] stripe pricing lookup failed", error);
    }

    res.json({ tiers: list });
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
        await supabase
          .from("lab_location")
          .upsert({ lab_id: payload.labId, ...addressUpdate }, { onConflict: "lab_id" });
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
      const userEmail = req.user.email || lab.contactEmail || null;

      // Notify admin
      await sendMail({
        to: adminInbox,
        from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
        subject: `Verification request for ${lab.name}`,
        text: [
          `Lab: ${lab.name} (id: ${payload.labId})`,
          `Requested by user: ${req.user.id}`,
          `Address line1: ${payload.addressLine1 || lab.addressLine1 || "N/A"}`,
          `Address line2: ${payload.addressLine2 || lab.addressLine2 || "N/A"}`,
          `City: ${payload.city || lab.city || "N/A"}`,
          `State: ${payload.state || lab.state || "N/A"}`,
          `Postal code: ${payload.postalCode || lab.postalCode || "N/A"}`,
          `Country: ${payload.country || lab.country || "N/A"}`,
          `Note: On-site verification requested; please follow up for scheduling and costs.`,
        ].join("\n"),
        templateId: process.env.BREVO_TEMPLATE_VERIFY_ADMIN
          ? Number(process.env.BREVO_TEMPLATE_VERIFY_ADMIN)
          : undefined,
        params: {
          labName: lab.name,
          requester: req.user.id,
          address: [
            payload.addressLine1 || lab.addressLine1 || "",
            payload.addressLine2 || lab.addressLine2 || "",
            payload.city || lab.city || "",
            payload.state || lab.state || "",
            payload.postalCode || lab.postalCode || "",
            payload.country || lab.country || "",
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
            payload.addressLine1 || lab.addressLine1 || ""
          } ${payload.city || lab.city || ""} ${payload.country || lab.country || ""}`.trim(),
          templateId: process.env.BREVO_TEMPLATE_VERIFY_USER
            ? Number(process.env.BREVO_TEMPLATE_VERIFY_USER)
            : 9,
          params: {
            labName: lab.name,
            address: [
              payload.addressLine1 || lab.addressLine1 || "",
              payload.addressLine2 || lab.addressLine2 || "",
              payload.city || lab.city || "",
              payload.state || lab.state || "",
              payload.postalCode || lab.postalCode || "",
              payload.country || lab.country || "",
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
      tier: z.enum(["base", "verified", "premier"]),
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

  // Lab manager endpoints: manage only labs tied to owner_user_id.
  app.get("/api/my-lab", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      const { data: labRow, error: labError } = await supabase.from("labs").select("id").eq("owner_user_id", userId).maybeSingle();
      if (labError) throw labError;
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
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      const labIds = await listLabIdsForUser(userId);
      if (!labIds.length) return res.json([]);

      const { data, error } = await supabase
        .from("labs")
        .select(
          [
            "id",
            "name",
            "is_visible",
            "lab_status",
            "org_role",
            "lab_erc_disciplines (erc_code, is_primary, erc_disciplines (code, domain, title))",
            "lab_profile (logo_url, alternate_names)",
            "lab_location (city, country)",
            "lab_photos (url, name)",
            "lab_equipment (item, is_priority)",
          ].join(","),
        )
        .in("id", labIds);
      if (error) throw error;

      const mapped = ((data as unknown as any[]) ?? []).map(row => {
        const pickOne = (value: any) => (Array.isArray(value) ? value[0] : value) ?? null;
        const profileRow = pickOne((row as any).lab_profile);
        const locationRow = pickOne((row as any).lab_location);
        const ercRows = (row as any).lab_erc_disciplines ?? [];
        const ercCodes = Array.from(
          new Set(
            ercRows
              .map((item: any) => (typeof item?.erc_code === "string" ? item.erc_code.trim().toUpperCase() : ""))
              .filter((code: string) => /^(PE(1[0-1]|[1-9])|LS[1-9]|SH[1-8])$/.test(code)),
          ),
        );
        const primaryErc = ercRows.find((item: any) => item?.is_primary)?.erc_code ?? null;
        const ercDisciplines = ercRows
          .map((item: any) => {
            const rel = Array.isArray(item?.erc_disciplines) ? item.erc_disciplines[0] : item?.erc_disciplines;
            const code = typeof rel?.code === "string" ? rel.code.trim().toUpperCase() : "";
            const domain = typeof rel?.domain === "string" ? rel.domain.trim().toUpperCase() : "";
            const title = typeof rel?.title === "string" ? rel.title.trim() : "";
            if (!/^(PE(1[0-1]|[1-9])|LS[1-9]|SH[1-8])$/.test(code)) return null;
            if (!["PE", "LS", "SH"].includes(domain)) return null;
            if (!title) return null;
            return { code, domain, title };
          })
          .filter((item: any): item is { code: string; domain: string; title: string } => Boolean(item));
        return {
          id: row.id,
          name: row.name,
          lab_status: (row as any).lab_status ?? null,
          city: locationRow?.city ?? null,
          country: locationRow?.country ?? null,
          logo_url: profileRow?.logo_url ?? null,
          alternate_names: profileRow?.alternate_names ?? [],
          org_role: (row as any).org_role ?? null,
          erc_discipline_codes: ercCodes,
          primary_erc_discipline_code: typeof primaryErc === "string" ? primaryErc.toUpperCase() : null,
          erc_disciplines: ercDisciplines,
          is_visible: (row as any).is_visible ?? null,
          lab_photos: (row as any).lab_photos ?? [],
          lab_equipment: (row as any).lab_equipment ?? [],
        };
      });

      res.json(mapped);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load labs" });
    }
  });

  app.get("/api/my-labs/certificates", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const labIds = await listLabIdsForUser(userId);
      if (!labIds.length) return res.json([]);

      const { data, error } = await supabase
        .from("lab_verification_certificates")
        .select("id, lab_id, glass_id, issued_at, pdf_url, created_at, updated_at")
        .in("lab_id", labIds);
      if (error) throw error;

      res.json(data ?? []);
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.json([]);
      }
      res.status(500).json({ message: errorToMessage(error, "Unable to load verification certificates") });
    }
  });

  app.get("/api/my-lab/:id", authenticate, async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      // owner match first
      const { data: labRow, error: labError } = await supabase
        .from("labs")
        .select("id")
        .eq("id", labId)
        .eq("owner_user_id", userId)
        .maybeSingle();
      if (labError) throw labError;
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
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      const { data: labRow, error: labError } = await supabase
        .from("labs")
        .select("id")
        .eq("id", labId)
        .eq("owner_user_id", userId)
        .maybeSingle();
      if (labError) throw labError;
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      const updates = { ...(req.body ?? {}) } as Record<string, unknown>;
      const requestedOwnerCamel = updates.ownerUserId;
      const requestedOwnerSnake = updates.owner_user_id;
      if (requestedOwnerCamel !== undefined && requestedOwnerCamel !== userId) {
        return res.status(403).json({ message: "Not authorized to transfer lab ownership" });
      }
      if (requestedOwnerSnake !== undefined && requestedOwnerSnake !== userId) {
        return res.status(403).json({ message: "Not authorized to transfer lab ownership" });
      }
      delete updates.ownerUserId;
      delete updates.owner_user_id;

      const updated = await labStore.update(labId, updates);
      res.json(updated);
    } catch (err) {
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid lab update" });
      }
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to update lab" });
    }
  });

  app.delete("/api/my-lab/:id", authenticate, async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      const { data: labRow, error: labError } = await supabase
        .from("labs")
        .select("id")
        .eq("id", labId)
        .eq("owner_user_id", userId)
        .maybeSingle();
      if (labError) throw labError;
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      await labStore.delete(labId);
      res.status(204).end();
    } catch (err) {
      if (err instanceof Error && err.message === "Lab not found") {
        return res.status(404).json({ message: err.message });
      }
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to delete lab" });
    }
  });

  app.get("/api/my-lab/analytics", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const { data: labRow, error: labError } = await supabase
        .from("labs")
        .select("id, lab_status")
        .eq("owner_user_id", userId)
        .maybeSingle();
      if (labError) throw labError;
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      const labId = Number((labRow as any).id);
      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const profile = await fetchProfileCapabilities(userId);
      const canAccess = profile?.canCreateLab;
      if (!canAccess) {
        return res.status(403).json({ message: "Analytics are not enabled for this account yet." });
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
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const labIds = await listLabIdsForUser(userId);
      if (!labIds.length) return res.json({ labs: [] });

      const { data: labs, error: labsError } = await supabase
        .from("labs")
        .select("id, name, is_visible, lab_status, owner_user_id")
        .in("id", labIds);
      if (labsError) throw labsError;
      if (!labs || labs.length === 0) return res.json({ labs: [] });

      const profile = await fetchProfileCapabilities(userId);
      const canAccess = profile?.canCreateLab;
      if (!canAccess) {
        return res.status(403).json({ message: "Analytics are not enabled for this account yet." });
      }

      const labIdList = labs.map(l => Number(l.id)).filter(id => !Number.isNaN(id));
      if (!labIdList.length) return res.json({ labs: [] });

      const now = new Date();
      const from7 = new Date(now);
      from7.setDate(from7.getDate() - 7);
      const from30 = new Date(now);
      from30.setDate(from30.getDate() - 30);

      const [view7, view30, favs] = await Promise.all([
        supabase.from("lab_views").select("lab_id").in("lab_id", labIdList).gte("created_at", from7.toISOString()),
        supabase.from("lab_views").select("lab_id").in("lab_id", labIdList).gte("created_at", from30.toISOString()),
        supabase.from("lab_favorites").select("lab_id").in("lab_id", labIdList),
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
          labStatus: (lab as any).lab_status ?? null,
          views7d: view7Map[lab.id] ?? 0,
          views30d: view30Map[lab.id] ?? 0,
          favorites: favMap[lab.id] ?? 0,
        })),
      });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load analytics" });
    }
  });

  app.get("/api/inbox-notifications/preferences", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const [{ data: profileRow, error: profileError }, { data: labs, error: labsError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("inbox_email_notifications_enabled")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("labs")
          .select("lab_status")
          .eq("owner_user_id", userId),
      ]);
      if (profileError) throw profileError;
      if (labsError) throw labsError;

      const normalizedStatuses = (labs ?? []).map(row => normalizeLabStatus((row as any).lab_status));
      const allVerifiedPassive = normalizedStatuses.length > 0 && normalizedStatuses.every(status => status === "verified_passive");
      const defaultEnabled = !allVerifiedPassive;
      const storedPreference = parseNullableBoolean((profileRow as any)?.inbox_email_notifications_enabled);
      const enabled = storedPreference ?? defaultEnabled;

      res.json({
        enabled,
        storedPreference,
        defaultEnabled,
      });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load notification preferences" });
    }
  });

  app.put("/api/inbox-notifications/preferences", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const enabled = req.body?.enabled;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ message: "enabled must be a boolean" });
      }

      const { data: existing, error: existingError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existingError) throw existingError;

      if (existing?.user_id) {
        const { error } = await supabase
          .from("profiles")
          .update({ inbox_email_notifications_enabled: enabled })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const email = typeof req.user?.email === "string" ? req.user.email : null;
        if (!email) {
          return res.status(400).json({ message: "No email on authenticated user" });
        }
        const { error } = await supabase
          .from("profiles")
          .insert({
            user_id: userId,
            email,
            inbox_email_notifications_enabled: enabled,
          });
        if (error) throw error;
      }

      res.json({
        enabled,
        storedPreference: enabled,
      });
    } catch (err) {
      res.status(500).json({ message: errorToMessage(err, "Unable to save notification preferences") });
    }
  });

  app.get("/api/my-labs/requests", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const labIds = await listLabIdsForUser(userId);
      if (!labIds.length) return res.json({ labs: [], collaborations: [], contacts: [] });

      const { data: labs, error: labsError } = await supabase
        .from("labs")
        .select("id, name, owner_user_id")
        .in("id", labIds);
      if (labsError) throw labsError;
      if (!labs || labs.length === 0) return res.json({ labs: [], collaborations: [], contacts: [] });

      const labNames = labs.map(l => l.name).filter(Boolean);
      const labIdList = labs.map(l => Number(l.id)).filter(id => !Number.isNaN(id));
      if (!labIdList.length && !labNames.length) return res.json({ labs, collaborations: [], contacts: [] });

      const collaborationColumns = [
        "id",
        "lab_id",
        "lab_name",
        "contact_name",
        "contact_email",
        "preferred_contact",
        "target_labs",
        "collaboration_focus",
        "resources_offered",
        "desired_timeline",
        "additional_notes",
        "created_at",
      ].join(",");
      const contactColumns = [
        "id",
        "lab_id",
        "lab_name",
        "contact_name",
        "contact_email",
        "requester_name",
        "requester_email",
        "preferred_contact_methods",
        "message",
        "type",
        "organization",
        "created_at",
      ].join(",");

      const { data: collabsById, error: collabsByIdError } = await supabase
        .from("lab_collaborations")
        .select(collaborationColumns)
        .in("lab_id", labIdList)
        .order("created_at", { ascending: false });
      if (collabsByIdError) throw collabsByIdError;

      const { data: contactsById, error: contactsByIdError } = await supabase
        .from("lab_contact_requests")
        .select(contactColumns)
        .in("lab_id", labIdList)
        .order("created_at", { ascending: false });
      if (contactsByIdError) throw contactsByIdError;

      let collabsByNameLegacy: any[] = [];
      let contactsByNameLegacy: any[] = [];
      if (labNames.length) {
        const { data: collabNameRows, error: collabNameError } = await supabase
          .from("lab_collaborations")
          .select(collaborationColumns)
          .is("lab_id", null)
          .in("lab_name", labNames)
          .order("created_at", { ascending: false });
        if (collabNameError) throw collabNameError;
        collabsByNameLegacy = collabNameRows ?? [];

        const { data: contactNameRows, error: contactNameError } = await supabase
          .from("lab_contact_requests")
          .select(contactColumns)
          .is("lab_id", null)
          .in("lab_name", labNames)
          .order("created_at", { ascending: false });
        if (contactNameError) throw contactNameError;
        contactsByNameLegacy = contactNameRows ?? [];
      }

      const dedupeAndSort = (rows: any[]) => {
        const seen = new Set<string>();
        return rows
          .filter(row => {
            const key =
              row?.id !== undefined && row?.id !== null
                ? String(row.id)
                : `${row?.lab_id ?? ""}|${row?.lab_name ?? ""}|${row?.contact_email ?? row?.requester_email ?? ""}|${row?.created_at ?? ""}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => {
            const aTs = a?.created_at ? new Date(a.created_at).getTime() : 0;
            const bTs = b?.created_at ? new Date(b.created_at).getTime() : 0;
            return bTs - aTs;
          });
      };

      const filteredCollabs = dedupeAndSort([...(collabsById ?? []), ...collabsByNameLegacy]);
      const filteredContacts = dedupeAndSort([...(contactsById ?? []), ...contactsByNameLegacy]).map(row => ({
        id: row?.id ?? null,
        lab_id: row?.lab_id ?? null,
        lab_name: row?.lab_name ?? null,
        contact_name: row?.contact_name ?? row?.requester_name ?? null,
        contact_email: row?.contact_email ?? row?.requester_email ?? null,
        preferred_contact: Array.isArray(row?.preferred_contact_methods)
          ? row.preferred_contact_methods[0] ?? null
          : null,
        message: row?.message ?? null,
        type: row?.type ?? null,
        organization: row?.organization ?? null,
        created_at: row?.created_at ?? null,
      }));

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
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab && !profile?.isAdmin) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      const contactEmail = typeof req.body?.contactEmail === "string" ? req.body.contactEmail.trim().toLowerCase() : "";
      const labName = typeof req.body?.labName === "string" ? req.body.labName.trim() : "";
      const type = typeof req.body?.type === "string" ? req.body.type.trim() : "request";
      if (!contactEmail) return res.status(400).json({ message: "Missing contact email" });
      if (!labName) return res.status(400).json({ message: "Missing lab name" });

      const labIds = await listLabIdsForUser(userId);
      if (!labIds.length) {
        return res.status(403).json({ message: "No lab linked to this account" });
      }
      const { data: ownedLabs, error: ownedLabsError } = await supabase
        .from("labs")
        .select("id, name")
        .in("id", labIds);
      if (ownedLabsError) throw ownedLabsError;
      const ownedIdSet = new Set((ownedLabs ?? []).map(row => Number(row.id)).filter(id => !Number.isNaN(id)));
      const ownedNameSet = new Set((ownedLabs ?? []).map(row => String(row.name || "").trim().toLowerCase()).filter(Boolean));
      const normalizedLabName = labName.toLowerCase();
      if (!ownedNameSet.has(normalizedLabName)) {
        return res.status(403).json({ message: "Not authorized to notify contacts for this lab" });
      }

      const [collaborationMatches, requesterMatches] = await Promise.all([
        supabase
          .from("lab_collaborations")
          .select("id, lab_id, lab_name, contact_email")
          .eq("contact_email", contactEmail)
          .limit(50),
        supabase
          .from("lab_contact_requests")
          .select("id, lab_id, lab_name, requester_email")
          .eq("requester_email", contactEmail)
          .limit(50),
      ]);
      if (collaborationMatches.error) throw collaborationMatches.error;
      if (requesterMatches.error) throw requesterMatches.error;

      let contactMatchesByContactEmail: Array<{ id: number; lab_id: number | null; lab_name: string | null; contact_email: string | null }> = [];
      const contactEmailMatchResult = await supabase
        .from("lab_contact_requests")
        .select("id, lab_id, lab_name, contact_email")
        .eq("contact_email", contactEmail)
        .limit(50);
      if (contactEmailMatchResult.error) {
        const message = String(contactEmailMatchResult.error.message ?? "").toLowerCase();
        if (!message.includes("contact_email")) {
          throw contactEmailMatchResult.error;
        }
      } else {
        contactMatchesByContactEmail = contactEmailMatchResult.data ?? [];
      }

      const belongsToOwnedLab = (row: { lab_id?: number | null; lab_name?: string | null }) => {
        const rowLabId = Number(row.lab_id);
        const rowLabName = String(row.lab_name || "").trim().toLowerCase();
        const matchesOwnedLab = (!Number.isNaN(rowLabId) && ownedIdSet.has(rowLabId)) || ownedNameSet.has(rowLabName);
        return matchesOwnedLab && rowLabName === normalizedLabName;
      };
      const canNotify = [
        ...(collaborationMatches.data ?? []),
        ...(requesterMatches.data ?? []),
        ...contactMatchesByContactEmail,
      ].some(row => belongsToOwnedLab(row));
      if (!canNotify) {
        return res.status(403).json({ message: "Not authorized to notify this contact" });
      }

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
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const { data: labRow, error: labError } = await supabase.from("labs").select("id").eq("owner_user_id", userId).maybeSingle();
      if (labError) throw labError;
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      const labId = Number(labRow.id);
      const updates = { ...(req.body ?? {}) } as Record<string, unknown>;
      const requestedOwnerCamel = updates.ownerUserId;
      const requestedOwnerSnake = updates.owner_user_id;
      if (requestedOwnerCamel !== undefined && requestedOwnerCamel !== userId) {
        return res.status(403).json({ message: "Not authorized to transfer lab ownership" });
      }
      if (requestedOwnerSnake !== undefined && requestedOwnerSnake !== userId) {
        return res.status(403).json({ message: "Not authorized to transfer lab ownership" });
      }
      delete updates.ownerUserId;
      delete updates.owner_user_id;

      const updated = await labStore.update(labId, updates);
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
