// server/routes/shared/helpers.ts
import { type NextFunction, type Request, type Response } from "express";
import { supabase } from "../../supabaseClient.js";
import { supabasePublic } from "../../supabasePublicClient.js";

// Avoid duplicate "viewed" notifications during a single server runtime
export const viewedNotifyCache = new Set<string>();

export const rateLimitState = new Map<string, { count: number; resetAt: number }>();

export const getRequestIp = (req: Request) => {
  const ip = req.ip || req.socket.remoteAddress || "";
  return ip.trim() || "unknown";
};

export const createRateLimiter =
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

export const parseBoolean = (value: boolean | string | null | undefined, fallback = false) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = value.toString().toLowerCase();
  return normalized === "true" || normalized === "t" || normalized === "1";
};

export const parseNullableBoolean = (value: boolean | string | null | undefined) => {
  if (value === null || value === undefined) return null;
  return parseBoolean(value, false);
};

export const PASSWORD_MIN_LENGTH = 8;
export const getPasswordPolicyError = (password: string) => {
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

export const resolvePublicSiteOrigin = (req: Request) => {
  const configured = (process.env.PUBLIC_SITE_URL || "https://glass-connect.com").trim().replace(/\/+$/, "");
  if (process.env.NODE_ENV !== "production") {
    const hostHeader = req.get("host");
    if (hostHeader) {
      return `${req.protocol}://${hostHeader}`.replace(/\/+$/, "");
    }
  }
  return configured;
};

export const errorToMessage = (error: unknown, fallback: string) => {
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

export const isMissingRelationError = (error: any) =>
  error?.code === "42P01" || /does not exist/i.test(String(error?.message ?? ""));

export const fetchProfileCapabilities = async (userId?: string | null) => {
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
        "role",
      ].join(","),
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  const role: string = (data as any)?.role ?? "user";
  const legacyAdmin = parseBoolean((data as any)?.is_admin, false);
  return {
    canCreateLab: parseBoolean((data as any)?.can_create_lab, false),
    canManageMultipleLabs: parseBoolean((data as any)?.can_manage_multiple_labs, false),
    canManageTeams: parseBoolean((data as any)?.can_manage_teams, false),
    canManageMultipleTeams: parseBoolean((data as any)?.can_manage_multiple_teams, false),
    canPostNews: parseBoolean((data as any)?.can_post_news, false),
    canBrokerRequests: parseBoolean((data as any)?.can_broker_requests, false),
    canReceiveInvestor: parseBoolean((data as any)?.can_receive_investor, false),
    inboxEmailNotificationsEnabled: parseNullableBoolean((data as any)?.inbox_email_notifications_enabled),
    isAdmin: legacyAdmin || role === "admin",
    role,
    isAuditManager: legacyAdmin || role === "audit_manager" || role === "admin",
    isAuditor: legacyAdmin || role === "auditor" || role === "audit_manager" || role === "admin",
  };
};

export const normalizeLabStatus = (status?: string | null) => (status || "listed").toLowerCase();
export const formatLabStatusLabel = (status?: string | null) => {
  const normalized = normalizeLabStatus(status);
  if (normalized === "verified_active" || normalized === "verified_passive") return "verified";
  return normalized;
};
export const isVerifiedLabStatus = (status?: string | null) =>
  ["verified_passive", "verified_active", "premier"].includes(normalizeLabStatus(status));
export const canForwardLabRequests = (status?: string | null) =>
  ["verified_active", "premier"].includes(normalizeLabStatus(status));
export const defaultInboxEmailNotificationsEnabled = (status?: string | null) =>
  normalizeLabStatus(status) !== "verified_passive";
export const resolveInboxEmailNotificationsEnabled = (
  profile: { inboxEmailNotificationsEnabled?: boolean | null } | null | undefined,
  status?: string | null,
) => {
  if (typeof profile?.inboxEmailNotificationsEnabled === "boolean") {
    return profile.inboxEmailNotificationsEnabled;
  }
  return defaultInboxEmailNotificationsEnabled(status);
};

export const ACTIVE_AUDIT_BOOKING_STATUSES = ["pending", "confirmed"] as const;

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization.trim() : "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : authHeader;
  const normalizedToken = token.replace(/^"+|"+$/g, "");
  if (!normalizedToken) return res.status(401).json({ message: "Missing token" });

  const { data, error } = await supabasePublic.auth.getUser(normalizedToken);
  if (error || !data?.user) return res.status(401).json({ message: "Invalid token" });

  req.user = data.user;
  next();
};

export const getOptionalUserIdFromAuthHeader = async (req: Request): Promise<string | null> => {
  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization.trim() : "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : authHeader;
  const normalizedToken = token.replace(/^"+|"+$/g, "");
  if (!normalizedToken) return null;

  const { data, error } = await supabasePublic.auth.getUser(normalizedToken);
  if (error || !data?.user?.id) return null;
  return data.user.id;
};

export const canAccessLabFromPublicRoute = async (req: Request, lab: { isVisible?: boolean | null; ownerUserId?: string | null }) => {
  if (lab?.isVisible !== false) return true;
  const userId = await getOptionalUserIdFromAuthHeader(req);
  if (!userId) return false;
  if (lab?.ownerUserId && lab.ownerUserId === userId) return true;
  const profile = await fetchProfileCapabilities(userId);
  return Boolean(profile?.isAdmin);
};

export const sanitizePublicLab = (lab: any) => {
  const {
    ownerUserId: _ownerUserId,
    owner_user_id: _ownerUserIdSnake,
    contactEmail: _contactEmail,
    contact_email: _contactEmailSnake,
    ...safe
  } = lab ?? {};
  return safe;
};

export const sanitizePublicTeam = (team: any) => ({
  ...team,
  ownerUserId: null,
  members: Array.isArray(team?.members)
    ? team.members.map((member: any) => ({
        ...member,
        email: null,
      }))
    : [],
});

export const requireUserId = async (req: Request, res: Response): Promise<string | null> => {
  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization.trim() : "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const { data, error } = await supabasePublic.auth.getUser(token);
  if (error || !data?.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return data.user.id;
};
