// server/routes/shared/certificate.ts
import { promises as fs } from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { supabase } from "../../supabaseClient.js";
import { isMissingRelationError } from "./helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CERTIFICATE_TEMPLATE_PATH = path.resolve(__dirname, "..", "..", "data", "certificate-template.json");
const CERTIFICATE_HTML_TEMPLATE_PATHS = [
  path.resolve(__dirname, "..", "..", "..", "client", "public", "certificate-template.html"),
  path.resolve(__dirname, "..", "..", "..", "dist", "certificate-template.html"),
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

export { defaultCertificateTemplate, mergeTemplate, CERTIFICATE_TEMPLATE_PATH };

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

export const signatureDataUrlSchema = z
  .string()
  .min(32, "Signature is required")
  .regex(
    /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/i,
    "Signature must be a PNG or JPEG data URL",
  );

export const upsertVerificationCertificateSchema = z.object({
  labSignerName: z.string().trim().min(2, "Lab signer name is required").max(120),
  labSignerTitle: z.string().trim().max(120).optional().nullable(),
  labSignatureDataUrl: signatureDataUrlSchema,
  glassSignerName: z.string().trim().min(2, "GLASS signer name is required").max(120),
  glassSignerTitle: z.string().trim().max(120).optional().nullable(),
  glassSignatureDataUrl: signatureDataUrlSchema,
});

export type CertificatePdfInput = {
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

export const toCountryCode = (countryValue?: string | null) => {
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

type AuditPricingTierCode = "T1" | "T2" | "T3" | "T4" | "T5";
type AuditPricingQuote = {
  tier: AuditPricingTierCode;
  amountEur: number;
  currency: "EUR";
  label: string;
  basis: string;
  distanceKm: number | null;
  countryCode: string | null;
};

const STRASBOURG_COORDS = { lat: 48.5734, lng: 7.7521 } as const;
const T3_COUNTRY_CODES = new Set(["FR", "DE", "CH"]);
const EUROPE_COUNTRY_CODES = new Set([
  "AL", "AD", "AM", "AT", "AZ", "BY", "BE", "BA", "BG", "HR", "CY", "CZ",
  "DK", "EE", "FI", "FR", "GE", "DE", "GR", "HU", "IS", "IE", "IT", "XK",
  "LV", "LI", "LT", "LU", "MT", "MD", "MC", "ME", "NL", "MK", "NO", "PL",
  "PT", "RO", "RU", "SM", "RS", "SK", "SI", "ES", "SE", "CH", "TR", "UA",
  "GB", "VA",
]);
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  france: "FR",
  german: "DE",
  germany: "DE",
  deutschland: "DE",
  schweiz: "CH",
  suisse: "CH",
  svizzera: "CH",
  switzerland: "CH",
  royaumeuni: "GB",
  "unitedkingdom": "GB",
  uk: "GB",
};

const normalizeCountryToIso2 = (countryValue?: string | null) => {
  const raw = (countryValue || "").trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const canonical = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return COUNTRY_NAME_TO_ISO2[canonical] || null;
};

export const formatVerificationAddress = (address: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}) =>
  [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .map(value => (value || "").trim())
    .filter(Boolean)
    .join(", ");

const isLikelyAlsaceLocation = (state?: string | null, postalCode?: string | null) => {
  const normalizedState = (state || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const normalizedPostal = (postalCode || "").replace(/\s+/g, "");
  if (normalizedState.includes("alsace")) return true;
  return normalizedPostal.startsWith("67") || normalizedPostal.startsWith("68");
};

const haversineKm = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const getServerMapboxToken = () =>
  process.env.MAPBOX_TOKEN?.trim() ||
  process.env.VITE_MAPBOX_TOKEN?.trim() ||
  process.env.MAPBOX_PUBLIC_TOKEN?.trim() ||
  null;

const geocodeForAuditPricing = async (query: string) => {
  const token = getServerMapboxToken();
  if (!token || !query.trim()) return null;
  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
    );
    url.searchParams.set("access_token", token);
    url.searchParams.set("limit", "1");
    url.searchParams.set("types", "address,place,postcode,locality,neighborhood");
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      features?: Array<{ center?: [number, number] }>;
    };
    const center = payload.features?.[0]?.center;
    if (!center || center.length < 2) return null;
    const [lng, lat] = center;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return { lat, lng };
  } catch {
    return null;
  }
};

export const computeAuditPricingQuote = async (address: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}): Promise<AuditPricingQuote> => {
  const countryCode = normalizeCountryToIso2(address.country);
  const formattedAddress = formatVerificationAddress(address);
  let distanceKm: number | null = null;

  if (formattedAddress) {
    const point = await geocodeForAuditPricing(formattedAddress);
    if (point) {
      distanceKm = haversineKm(STRASBOURG_COORDS, point);
    }
  }

  const t1Eligible = distanceKm !== null && distanceKm <= 20;
  const t2DistanceEligible = distanceKm !== null && distanceKm <= 200;
  const t2AlsaceFallback =
    countryCode === "FR" && isLikelyAlsaceLocation(address.state, address.postalCode);

  if (t1Eligible) {
    return {
      tier: "T1",
      amountEur: 290,
      currency: "EUR",
      label: "Strasbourg radius (<=20 km)",
      basis: `${distanceKm!.toFixed(1)} km from Strasbourg`,
      distanceKm,
      countryCode,
    };
  }
  if (countryCode === "FR" && (t2DistanceEligible || t2AlsaceFallback)) {
    return {
      tier: "T2",
      amountEur: 490,
      currency: "EUR",
      label: "Alsace / regional France (<=200 km)",
      basis:
        distanceKm !== null
          ? `${distanceKm.toFixed(1)} km from Strasbourg`
          : "Alsace fallback by state/postal code",
      distanceKm,
      countryCode,
    };
  }
  if (countryCode && T3_COUNTRY_CODES.has(countryCode)) {
    return {
      tier: "T3",
      amountEur: 690,
      currency: "EUR",
      label: "France, Germany, or Switzerland",
      basis: countryCode,
      distanceKm,
      countryCode,
    };
  }
  if (countryCode && EUROPE_COUNTRY_CODES.has(countryCode)) {
    return {
      tier: "T4",
      amountEur: 890,
      currency: "EUR",
      label: "Rest of Europe",
      basis: countryCode,
      distanceKm,
      countryCode,
    };
  }
  return {
    tier: "T5",
    amountEur: 1290,
    currency: "EUR",
    label: "International",
    basis: countryCode || "Unknown country",
    distanceKm,
    countryCode,
  };
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

export const ensureLabGlassId = async (labId: number, countryCode: string) => {
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
    candidates.push(path.resolve(__dirname, "..", "..", "..", "client", "public", normalized));
    candidates.push(path.resolve(__dirname, "..", "..", "..", "dist", normalized));
    candidates.push(path.resolve(__dirname, "..", "..", "..", normalized));
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

export const generateVerificationCertificatePdf = async (input: CertificatePdfInput) => {
  const htmlPdf = await generateVerificationCertificatePdfFromHtmlTemplate(input);
  if (htmlPdf && htmlPdf.length > 0) {
    return htmlPdf;
  }
  throw new Error("Unable to render certificate from HTML template.");
};
