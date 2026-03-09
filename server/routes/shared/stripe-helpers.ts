// server/routes/shared/stripe-helpers.ts
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { supabase } from "../../supabaseClient.js";
import { normalizeLabStatus } from "./helpers.js";

export const stripePricingCache: {
  data: null | {
    verified: { monthly: number | null; yearly: number | null; currency: string | null };
    premier: { monthly: number | null; yearly: number | null; currency: string | null };
  };
  expiresAt: number;
} = {
  data: null,
  expiresAt: 0,
};

export const stripePriceMap = () => {
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

export const resolveStripePriceId = (planKey: string, intervalKey: string) => {
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

export const timingSafeEqual = (a: string, b: string) => {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

export const listLabIdsForUser = async (userId?: string | null) => {
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

export const parseRequestedLabId = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return Number.NaN;
  return parsed;
};

export const getLabSubscriptionTierRank = (status?: string | null) => {
  const normalized = normalizeLabStatus(status);
  if (normalized === "premier") return 2;
  if (normalized === "verified" || normalized === "verified_active" || normalized === "verified_passive") {
    return 1;
  }
  return 0;
};

export const canLabSubscribeToPlan = (status: string | null | undefined, planKey: "verified" | "premier") => {
  const rank = getLabSubscriptionTierRank(status);
  if (planKey === "verified") return rank < 1;
  return rank < 2;
};

export const resolveSubscriptionLabId = async (
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

export const fetchStripePrice = async (stripeKey: string, priceId?: string) => {
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

export const getStripePricing = async () => {
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

export const defaultPricing = [
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

export const resolveSubscriptionTier = (subscription: any) => {
  const metadataPlan = (subscription?.metadata?.plan as string | undefined)?.toLowerCase();
  if (metadataPlan === "verified" || metadataPlan === "premier") {
    return metadataPlan;
  }
  const priceId = subscription?.items?.data?.[0]?.price?.id as string | undefined;
  const mapping = stripePriceMap();
  return priceId && mapping[priceId] ? mapping[priceId].tier : null;
};

export const mapSubscriptionStatus = (status?: string | null) => {
  const value = (status || "").toLowerCase();
  if (value === "active" || value === "trialing") return "active";
  if (value === "past_due" || value === "unpaid") return "past_due";
  if (value === "canceled" || value === "incomplete_expired") return "canceled";
  return "none";
};

export const fetchStripeCustomer = async (stripeKey: string, customerId: string) => {
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

export const getProfileSubscription = async (userId: string) => {
  const { data } = await supabase
    .from("profiles")
    .select("subscription_tier, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();
  const tier = (data?.subscription_tier || "base").toLowerCase();
  const status = (data?.subscription_status || "none").toLowerCase();
  return { tier, status };
};

export const isActiveSubscriptionStatus = (status: string) =>
  status === "active" || status === "past_due" || status === "trialing";
