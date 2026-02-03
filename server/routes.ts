// server/routes.ts
import express, { Express } from "express";
import { createServer } from "http";
import { supabase } from "./supabaseClient.js";
import { storage } from "./storage";
import { labStore } from "./labs-store";
import { teamStore } from "./teams-store";
import { labRequestStore } from "./lab-requests-store";
import { labCollaborationStore } from "./collaboration-store";
import { sendMail } from "./mailer";
import jwt from "jsonwebtoken";
import { supabasePublic } from "./supabasePublicClient.js";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";

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
import { insertTeamSchema, updateTeamSchema } from "@shared/teams";

import { insertDonationSchema } from "@shared/donations";

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

const stripePriceMap = () => {
  const mapping: Record<string, { tier: "verified" | "premier"; interval: string }> = {};
  const add = (priceId: string | undefined, tier: "verified" | "premier", interval: string) => {
    if (priceId) mapping[priceId] = { tier, interval };
  };
  add(process.env.STRIPE_PRICE_VERIFIED_MONTHLY, "verified", "monthly");
  add(process.env.STRIPE_PRICE_VERIFIED_YEARLY, "verified", "yearly");
  add(process.env.STRIPE_PRICE_PREMIER_MONTHLY, "premier", "monthly");
  add(process.env.STRIPE_PRICE_PREMIER_YEARLY, "premier", "yearly");
  return mapping;
};

const timingSafeEqual = (a: string, b: string) => {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const findLabIdByContactEmail = async (email?: string | null, labId?: number | null): Promise<number | null> => {
  if (!email) return null;
  const trimmed = email.trim();
  if (!trimmed) return null;
  let query = supabase.from("lab_contacts").select("lab_id").ilike("contact_email", trimmed);
  if (labId) {
    query = query.eq("lab_id", labId);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) return null;
  const id = data?.lab_id ? Number(data.lab_id) : NaN;
  return Number.isNaN(id) ? null : id;
};

const claimLabForUser = async (userId?: string | null, email?: string | null, labId?: number | null) => {
  if (!userId || !email) return null;
  const id = await findLabIdByContactEmail(email, labId ?? null);
  if (!id) return null;
  const { data, error } = await supabase.from("labs").select("id, owner_user_id").eq("id", id).maybeSingle();
  if (error || !data) return null;
  if (!data.owner_user_id) {
    await supabase.from("labs").update({ owner_user_id: userId }).eq("id", data.id);
  }
  return { id: data.id };
};

const listLabIdsForUser = async (userId?: string | null, email?: string | null) => {
  const ids = new Set<number>();
  if (userId) {
    const { data } = await supabase.from("labs").select("id").eq("owner_user_id", userId);
    (data ?? []).forEach(row => {
      const id = Number(row.id);
      if (!Number.isNaN(id)) ids.add(id);
    });
  }
  if (email) {
    const { data } = await supabase.from("lab_contacts").select("lab_id").ilike("contact_email", email.trim());
    (data ?? []).forEach(row => {
      const id = Number((row as any).lab_id);
      if (!Number.isNaN(id)) ids.add(id);
    });
  }
  return Array.from(ids);
};

const parseBoolean = (value: boolean | string | null | undefined, fallback = false) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = value.toString().toLowerCase();
  return normalized === "true" || normalized === "t" || normalized === "1";
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
    isAdmin: parseBoolean((data as any)?.is_admin, false),
  };
};

const normalizeLabStatus = (status?: string | null) => (status || "listed").toLowerCase();
const isVerifiedLabStatus = (status?: string | null) =>
  ["verified_passive", "verified_active", "premier"].includes(normalizeLabStatus(status));
const canForwardLabRequests = (status?: string | null) =>
  ["verified_active", "premier"].includes(normalizeLabStatus(status));

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

  const [verifiedMonthly, verifiedYearly, premierMonthly, premierYearly] = await Promise.all([
    fetchStripePrice(stripeKey, process.env.STRIPE_PRICE_VERIFIED_MONTHLY),
    fetchStripePrice(stripeKey, process.env.STRIPE_PRICE_VERIFIED_YEARLY),
    fetchStripePrice(stripeKey, process.env.STRIPE_PRICE_PREMIER_MONTHLY),
    fetchStripePrice(stripeKey, process.env.STRIPE_PRICE_PREMIER_YEARLY),
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

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Missing token" });

  const { data, error } = await supabasePublic.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ message: "Invalid token" });

  req.user = data.user;
  next();
};

export function registerRoutes(app: Express) {
  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

      try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
          console.warn("[stripe] missing STRIPE_SECRET_KEY for customer lookup");
          return;
        }
        const customer = await fetchStripeCustomer(stripeKey, customerId);
        userId = userId || customer?.metadata?.user_id || null;
        customerEmail = customer?.email || null;
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

      const recurringFlag =
        recurring === true || recurring === "true" || recurring === 1 || recurring === "1";
      const metaEntries = {
        donorType: donorType || "",
        recurring: recurringFlag ? "true" : "false",
        ...meta,
      };
      const donorName =
        (meta.fullName || "").trim() ||
        (meta.companyName || "").trim() ||
        (meta.contactName || "").trim() ||
        email.trim();
      let clientSecret: string | undefined;
      let paymentIntentId: string | undefined;
      let subscriptionId: string | undefined;
      let status: string | undefined;
      const billingMode = recurringFlag ? "subscription" : "payment_intent";

      if (recurringFlag) {
        const customerParams = new URLSearchParams();
        customerParams.append("email", email.trim());
        customerParams.append("name", donorName);
        Object.entries(metaEntries).forEach(([key, val]) => {
          if (val !== undefined && val !== null && val !== "") {
            customerParams.append(`metadata[${key}]`, String(val));
          }
        });
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
        params.append("items[0][price_data][currency]", "eur");
        params.append("items[0][price_data][unit_amount]", Math.round(amountNumber * 100).toString());
        params.append("items[0][price_data][recurring][interval]", "month");
        params.append("items[0][price_data][product_data][name]", "Glass Connect donation");
        params.append("payment_behavior", "default_incomplete");
        params.append("payment_settings[save_default_payment_method]", "on_subscription");
        params.append("expand[]", "latest_invoice.payment_intent");
        Object.entries(metaEntries).forEach(([key, val]) => {
          if (val !== undefined && val !== null && val !== "") {
            params.append(`metadata[${key}]`, String(val));
          }
        });

        const response = await fetch("https://api.stripe.com/v1/subscriptions", {
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
        const subscription = await response.json();
        subscriptionId = subscription?.id;
        status = subscription?.status;
        const paymentIntent = subscription?.latest_invoice?.payment_intent;
        clientSecret = paymentIntent?.client_secret;
        paymentIntentId = paymentIntent?.id;
        console.info("[donations] created subscription", {
          subscriptionId,
          paymentIntentId,
          status,
        });
      } else {
        const params = new URLSearchParams();
        params.append("amount", Math.round(amountNumber * 100).toString());
        params.append("currency", "eur");
        params.append("receipt_email", email.trim());
        params.append("description", "Glass Connect donation");
        params.append("automatic_payment_methods[enabled]", "true");
        Object.entries(metaEntries).forEach(([key, val]) => {
          if (val !== undefined && val !== null && val !== "") {
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
        clientSecret = intent?.client_secret;
        paymentIntentId = intent?.id;
        status = intent?.status;
        console.info("[donations] created payment intent", {
          paymentIntentId,
          status,
        });
      }

      if (!clientSecret) {
        return res.status(500).json({ message: "Stripe error", detail: "Missing client secret" });
      }

      const donationAmountRaw = Number(meta.donationAmount);
      const feeAmountRaw = Number(meta.feeAmount);
      const donationAmount = Number.isFinite(donationAmountRaw) ? donationAmountRaw : null;
      const feeAmount = Number.isFinite(feeAmountRaw) ? feeAmountRaw : null;

      try {
        const { error: insertError } = await supabase.from("donations").insert({
          name: donorName,
          email: email.trim(),
          amount: amountNumber,
          message: meta.message || null,
          donor_type: donorType || null,
          recurring: recurringFlag,
          full_name: meta.fullName || null,
          company_name: meta.companyName || null,
          siret: meta.siret || null,
          contact_name: meta.contactName || null,
          address_line1: meta.addressLine1 || null,
          address_line2: meta.addressLine2 || null,
          city: meta.city || null,
          postal_code: meta.postalCode || null,
          country: meta.country || null,
          donation_amount: donationAmount,
          fee_amount: feeAmount,
          stripe_payment_intent_id: paymentIntentId || null,
          stripe_subscription_id: subscriptionId || null,
          status: status || null,
        });
        if (insertError) {
          console.warn("[donations] Failed to store donation", insertError.message);
        }
      } catch (err) {
        console.warn("[donations] Failed to store donation", err);
      }

      return res.status(200).json({
        client_secret: clientSecret,
        mode: billingMode,
        subscription_id: subscriptionId ?? null,
        payment_intent_id: paymentIntentId ?? null,
        status: status ?? null,
      });
    } catch (error) {
      res
        .status(500)
        .json({ message: error instanceof Error ? error.message : "Unable to create payment intent" });
    }
  });

  // --------- Stripe Checkout for subscriptions ----------
  app.post("/api/subscriptions/checkout", authenticate, async (req, res) => {
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

      const { tier: currentTier, status: currentStatus } = await getProfileSubscription(req.user.id);
      if (isActiveSubscriptionStatus(currentStatus)) {
        if (currentTier === "premier") {
          return res.status(409).json({ message: "Your account is already Premier." });
        }
        if (currentTier === "verified" && planKey === "verified") {
          return res.status(409).json({ message: "Your account is already Verified." });
        }
        if (currentTier === "premier" && planKey === "verified") {
          return res.status(409).json({ message: "Premier accounts cannot subscribe to Verified." });
        }
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
  app.post("/api/subscriptions/intent", authenticate, async (req, res) => {
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

      const { tier: currentTier, status: currentStatus } = await getProfileSubscription(req.user.id);
      if (isActiveSubscriptionStatus(currentStatus)) {
        if (currentTier === "premier") {
          return res.status(409).json({ message: "Your account is already Premier." });
        }
        if (currentTier === "verified" && planKey === "verified") {
          return res.status(409).json({ message: "Your account is already Verified." });
        }
        if (currentTier === "premier" && planKey === "verified") {
          return res.status(409).json({ message: "Premier accounts cannot subscribe to Verified." });
        }
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

      const setupParams = new URLSearchParams();
      setupParams.append("customer", customer.id);
      setupParams.append("payment_method_types[]", "card");
      setupParams.append("usage", "off_session");
      setupParams.append("metadata[plan]", planKey);
      setupParams.append("metadata[interval]", intervalKey);
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
        return res.status(500).json({ message: "Stripe error", detail: errorText });
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

      const { tier: currentTier, status: currentStatus } = await getProfileSubscription(req.user.id);
      if (isActiveSubscriptionStatus(currentStatus)) {
        if (currentTier === "premier") {
          return res.status(409).json({ message: "Your account is already Premier." });
        }
        if (currentTier === "verified" && planKey === "verified") {
          return res.status(409).json({ message: "Your account is already Verified." });
        }
        if (currentTier === "premier" && planKey === "verified") {
          return res.status(409).json({ message: "Premier accounts cannot subscribe to Verified." });
        }
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

      const setupRes = await fetch(`https://api.stripe.com/v1/setup_intents/${payload.setupIntentId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
        },
      });
      if (!setupRes.ok) {
        const errorText = await setupRes.text();
        return res.status(500).json({ message: "Stripe error", detail: errorText });
      }
      const setupIntent = await setupRes.json();
      const paymentMethod = setupIntent?.payment_method;
      const customerId = setupIntent?.customer;
      const setupUserId = setupIntent?.metadata?.user_id;
      if (!paymentMethod || !customerId) {
        return res.status(400).json({ message: "Setup intent incomplete" });
      }
      if (setupUserId && setupUserId !== req.user.id) {
        return res.status(403).json({ message: "Setup intent does not belong to this user" });
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
        return res.status(500).json({ message: "Stripe error", detail: errorText });
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

      const { data, error } = await supabase
        .from("lab_profile")
        .select("hal_structure_id, hal_person_id")
        .eq("lab_id", labId)
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
        .from("lab_profile")
        .select("hal_structure_id, hal_person_id")
        .eq("lab_id", labId)
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
        const profile = await fetchProfileCapabilities(ownerId);
        if (!profile) {
          return res.status(403).json({ message: "Profile permissions not found for this account." });
        }
        if (!profile.canCreateLab) {
          return res.status(403).json({ message: "This account is not allowed to create labs yet." });
        }
        if (!profile.canManageMultipleLabs) {
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

  // --------- Teams ----------
  app.get("/api/teams", async (req, res) => {
    const includeHidden = req.query.includeHidden === "true" || req.query.includeHidden === "1";
    const teams = includeHidden ? await teamStore.list() : await teamStore.listVisible();
    res.json(teams);
  });

  app.get("/api/teams/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid team id" });
    }
    try {
      const team = await teamStore.findById(id);
      if (!team) return res.status(404).json({ message: "Team not found" });
      res.json(team);
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
      res.json(teams);
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
  app.post("/api/lab-collaborations", async (req, res) => {
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
      if (lab.contactEmail && canForward && canForwardLabRequests(status)) {
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
      const status = normalizeLabStatus(lab.labStatus);
      if (status === "listed" || status === "confirmed") {
        return res.status(403).json({ message: "This lab is not accepting requests yet." });
      }
      const ownerProfile = lab.ownerUserId ? await fetchProfileCapabilities(lab.ownerUserId) : null;
      const canForward = ownerProfile?.canBrokerRequests;

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
      if (lab.contactEmail && canForward && canForwardLabRequests(status)) {
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
    const originHeader = typeof req.headers.origin === "string" ? req.headers.origin : "";
    const hostHeader = req.get("host");
    const origin = (
      originHeader ||
      (hostHeader ? `${req.protocol}://${hostHeader}` : "") ||
      process.env.PUBLIC_SITE_URL ||
      "https://glass-connect.com"
    ).replace(/\/+$/, "");

    const { data, error } = await supabasePublic.auth.signUp({
      email,
      password,
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
      const ownerUserId = lab.ownerUserId ?? null;
      if (!ownerUserId) {
        return res.status(403).json({ message: "Only claimed labs can post news right now." });
      }
      const profile = await fetchProfileCapabilities(ownerUserId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "News is available to lab owners only." });
      }
      if (lab.labStatus !== "premier") {
        return res.status(403).json({ message: "News is available for premier labs only." });
      }
      if (payload.authorId && ownerUserId !== payload.authorId) {
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
  app.post("/api/labs/:id/investor", async (req, res) => {
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
    const baseList = defaultPricing.map(tier => ({
      name: tier.name,
      monthly_price: tier.monthly_price ?? null,
      yearly_price: null as number | null,
      currency: null as string | null,
      description: tier.description,
      highlights: tier.highlights,
      featured: tier.featured ?? false,
      sort_order: tier.sort_order ?? 999,
    }));

    let list = baseList;
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

      const mapped = (data ?? []).map(row => ({
        name: row.name,
        monthly_price: row.monthly_price ?? null,
        yearly_price: null as number | null,
        currency: null as string | null,
        description: row.description ?? defaultPricing.find(d => d.name === row.name)?.description ?? "",
        highlights:
          featuresByTier[row.name] && featuresByTier[row.name].length
            ? featuresByTier[row.name]
            : Array.isArray(row.highlights)
              ? row.highlights
              : defaultPricing.find(d => d.name === row.name)?.highlights ?? [],
        featured: row.featured ?? false,
        sort_order: row.sort_order ?? 999,
      }));
      list = mapped.length ? mapped : list;
    } catch {
      // keep defaults
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

  // Lab manager endpoints: manage only the lab tied to their user id (owner_user_id) or claim by contact email
  app.get("/api/my-lab", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId && !email) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      let labRow = null;
      if (userId) {
        const { data, error } = await supabase.from("labs").select("id").eq("owner_user_id", userId).maybeSingle();
        if (error) throw error;
        if (data) labRow = data;
      }
      if (!labRow && userId && email) {
        labRow = await claimLabForUser(userId, email);
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

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      const labIds = await listLabIdsForUser(userId, email);
      if (!labIds.length) return res.json([]);

      const { data, error } = await supabase
        .from("labs")
        .select(
          [
            "id",
            "name",
            "is_visible",
            "lab_status",
            "lab_profile (logo_url)",
            "lab_location (city, country)",
            "lab_photos (url, name)",
            "lab_equipment (item)",
          ].join(","),
        )
        .in("id", labIds);
      if (error) throw error;

      const mapped = (data ?? []).map(row => {
        const pickOne = (value: any) => (Array.isArray(value) ? value[0] : value) ?? null;
        const profileRow = pickOne((row as any).lab_profile);
        const locationRow = pickOne((row as any).lab_location);
        return {
          id: row.id,
          name: row.name,
          lab_status: (row as any).lab_status ?? null,
          city: locationRow?.city ?? null,
          country: locationRow?.country ?? null,
          logo_url: profileRow?.logo_url ?? null,
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

  app.get("/api/my-lab/:id", authenticate, async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId && !email) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      // owner match first
      let labRow = null;
      if (userId) {
        const { data, error } = await supabase.from("labs").select("id").eq("id", labId).eq("owner_user_id", userId).maybeSingle();
        if (error) throw error;
        if (data) labRow = data;
      }
      if (!labRow && email && userId) {
        labRow = await claimLabForUser(userId, email, labId);
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

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

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
        labRow = await claimLabForUser(userId, email, labId);
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

  app.delete("/api/my-lab/:id", authenticate, async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId && !email) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

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
        labRow = await claimLabForUser(userId, email, labId);
      }
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
      const email = req.user?.email;
      if (!userId && !email) return res.status(400).json({ message: "No user on request" });

      let labRow = null;
      if (userId) {
        const { data, error } = await supabase
          .from("labs")
          .select("id, lab_status")
          .eq("owner_user_id", userId)
          .maybeSingle();
        if (error) throw error;
        if (data) labRow = data;
      }
      if (!labRow && userId && email) {
        labRow = await claimLabForUser(userId, email);
      }
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
      const email = req.user?.email;
      if (!userId && !email) return res.status(400).json({ message: "No user on request" });

      const labIds = await listLabIdsForUser(userId, email);
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

  app.get("/api/my-labs/requests", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      const email = req.user?.email;
      if (!userId && !email) return res.status(400).json({ message: "No user on request" });

      const labIds = await listLabIdsForUser(userId, email);
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

      // Prefer matching by lab_id; fall back to case-insensitive lab_name to catch legacy rows
      const [collabs, contacts] = await Promise.all([
        supabase.from("lab_collaborations").select("*").order("created_at", { ascending: false }),
        supabase.from("lab_contact_requests").select("*").order("created_at", { ascending: false }),
      ]);

      if (collabs.error) throw collabs.error;
      if (contacts.error) throw contacts.error;

      const nameSet = new Set(labNames.map(n => (n || "").toLowerCase()));
      const idSet = new Set(labIdList);
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
        labRow = await claimLabForUser(userId, email);
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
