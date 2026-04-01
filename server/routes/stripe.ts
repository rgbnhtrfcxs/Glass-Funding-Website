// server/routes/stripe.ts
import { type Express } from "express";
import { z, ZodError } from "zod";
import { supabase } from "../supabaseClient.js";
import {
  authenticate,
  isMissingRelationError,
} from "./shared/helpers.js";
import {
  timingSafeEqual,
  resolveStripePriceId,
  resolveSubscriptionLabId,
  parseRequestedLabId,
  fetchStripeCustomer,
  resolveSubscriptionTier,
  mapSubscriptionStatus,
  canLabSubscribeToPlan,
  formatLabStatusLabel,
  getStripePricing,
  defaultPricing,
} from "./shared/stripe-helpers.js";
import { sendMail } from "../mailer.js";
import crypto from "node:crypto";

const insertFreeTierConfirmationSchema = z.object({
  name: z.string().trim().max(120, "Name is too long").optional(),
  email: z.string().trim().email("Valid email is required").optional(),
});

const insertEnterpriseInterestSchema = z.object({
  ownerName: z.string().trim().min(2, "Contact name is required").max(120, "Contact name is too long"),
  organization: z.string().trim().min(2, "Organization is required").max(160, "Organization is too long"),
  labsManaged: z.string().trim().max(80, "Labs managed value is too long").optional(),
  email: z.string().trim().email("Valid contact email is required"),
  phone: z.string().trim().min(3, "Phone is required").max(80, "Phone is too long"),
  message: z.string().trim().max(3000, "Message is too long").optional(),
});

const insertTierUpgradeInterestSchema = z.object({
  tier: z.enum(["verified", "premier"]),
  interval: z.enum(["monthly", "yearly"]).optional(),
  labIds: z.array(z.number().int().positive()).min(1, "Select at least one lab"),
});

export function registerStripeRoutes(app: Express): void {
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

  app.post("/api/subscriptions/free-confirmation", authenticate, async (req, res) => {
    try {
      const payload = insertFreeTierConfirmationSchema.parse(req.body ?? {});
      const adminEmail = process.env.ADMIN_INBOX ?? "contact@glass-funding.com";
      const submittedAt = new Date().toISOString();
      const requesterName =
        payload.name ||
        (req.user.user_metadata?.full_name as string | undefined) ||
        (req.user.user_metadata?.name as string | undefined) ||
        req.user.email ||
        "Unknown";
      const requesterEmail = payload.email || req.user.email || "";
      if (!requesterEmail) {
        return res.status(400).json({ message: "Missing requester email" });
      }

      const adminLines = [
        "New free-tier confirmation",
        "",
        `Requester: ${requesterName} <${requesterEmail}>`,
        `User ID: ${req.user.id}`,
        `Submitted at: ${submittedAt}`,
      ].join("\n");

      const userLines = [
        `Hi ${requesterName},`,
        "",
        "Your free GLASS-Connect tier is confirmed.",
        "You can keep your listing live and upgrade anytime.",
        "",
        `Submitted at: ${submittedAt}`,
      ].join("\n");

      await Promise.all([
        sendMail({
          to: adminEmail,
          from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
          subject: "Free tier confirmation",
          text: adminLines,
          templateId: process.env.BREVO_TEMPLATE_FREE_CONFIRM_ADMIN
            ? Number(process.env.BREVO_TEMPLATE_FREE_CONFIRM_ADMIN)
            : undefined,
          params: {
            requesterName,
            requesterEmail,
            requesterUserId: req.user.id,
            submittedAt,
          },
        }),
        sendMail({
          to: requesterEmail,
          from: process.env.MAIL_FROM_USER || process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
          subject: "Your free tier is confirmed",
          text: userLines,
          templateId: process.env.BREVO_TEMPLATE_FREE_CONFIRM_USER
            ? Number(process.env.BREVO_TEMPLATE_FREE_CONFIRM_USER)
            : undefined,
          params: {
            requesterName,
            requesterEmail,
            submittedAt,
          },
        }),
      ]);

      return res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid free-tier confirmation" });
      }
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Unable to submit free-tier confirmation",
      });
    }
  });

  app.post("/api/subscriptions/enterprise-interest", authenticate, async (req, res) => {
    try {
      const payload = insertEnterpriseInterestSchema.parse(req.body ?? {});
      const adminEmail = process.env.ADMIN_INBOX ?? "contact@glass-funding.com";
      const submittedAt = new Date().toISOString();
      const labsManaged = payload.labsManaged?.trim() || "N/A";
      const details = payload.message?.trim() || "No additional details provided.";

      const adminLines = [
        "New enterprise interest request",
        "",
        `Contact: ${payload.ownerName} <${payload.email}>`,
        `Organization: ${payload.organization}`,
        `Phone: ${payload.phone}`,
        `Labs managed: ${labsManaged}`,
        `User ID: ${req.user.id}`,
        `Submitted at: ${submittedAt}`,
        "",
        "Details:",
        details,
      ].join("\n");

      const userLines = [
        `Hi ${payload.ownerName},`,
        "",
        "Thanks for your enterprise inquiry on GLASS-Connect.",
        "Our partnerships team will review your details and follow up shortly.",
        "",
        `Organization: ${payload.organization}`,
        `Labs managed: ${labsManaged}`,
        `Phone: ${payload.phone}`,
        "",
        `Submitted at: ${submittedAt}`,
      ].join("\n");

      await Promise.all([
        sendMail({
          to: adminEmail,
          from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
          subject: `Enterprise request: ${payload.organization}`,
          text: adminLines,
          templateId: process.env.BREVO_TEMPLATE_ENTERPRISE_ADMIN
            ? Number(process.env.BREVO_TEMPLATE_ENTERPRISE_ADMIN)
            : undefined,
          params: {
            ownerName: payload.ownerName,
            organization: payload.organization,
            labsManaged,
            contactEmail: payload.email,
            contactPhone: payload.phone,
            details,
            requesterUserId: req.user.id,
            submittedAt,
          },
        }),
        sendMail({
          to: payload.email,
          from: process.env.MAIL_FROM_USER || process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
          subject: "We received your enterprise request",
          text: userLines,
          templateId: process.env.BREVO_TEMPLATE_ENTERPRISE_USER
            ? Number(process.env.BREVO_TEMPLATE_ENTERPRISE_USER)
            : undefined,
          params: {
            ownerName: payload.ownerName,
            organization: payload.organization,
            labsManaged,
            contactEmail: payload.email,
            contactPhone: payload.phone,
            details,
            submittedAt,
          },
        }),
      ]);

      return res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid enterprise request" });
      }
      return res.status(500).json({ message: error instanceof Error ? error.message : "Unable to submit enterprise request" });
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
      const billingPreference = (payload.interval || "yearly").toLowerCase();
      const labsText = labs
        .map(
          lab =>
            `- ${lab.name || `Lab #${lab.id}`} (id: ${lab.id}, current status: ${formatLabStatusLabel(lab.labStatus)})`,
        )
        .join("\n");

      const lines = [
        "New tier upgrade request",
        "",
        `Tier requested: ${tierLabel}`,
        `Billing preference: ${billingPreference}`,
        `Requester: ${requesterName} <${requesterEmail}>`,
        `User ID: ${req.user.id}`,
        "",
        "Labs:",
        labsText,
      ].join("\n");
      const confirmationLines = [
        `Hi ${requesterName},`,
        "",
        "Thanks, we received your tier upgrade request on GLASS.",
        `Tier requested: ${tierLabel}`,
        `Billing preference: ${billingPreference}`,
        "",
        "Labs:",
        labsText,
        "",
        "Our team will review your request and follow up shortly.",
      ].join("\n");

      const adminMail = sendMail({
        to: adminEmail,
        from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
        subject: `Tier upgrade request: ${tierLabel} (${labs.length} lab${labs.length === 1 ? "" : "s"})`,
        text: lines,
        templateId: process.env.BREVO_TEMPLATE_TIER_UPGRADE_ADMIN
          ? Number(process.env.BREVO_TEMPLATE_TIER_UPGRADE_ADMIN)
          : undefined,
        params: {
          tier: payload.tier,
          tierLabel,
          billingPreference,
          requesterName,
          requesterEmail,
          requesterUserId: req.user.id,
          labCount: labs.length,
          labs: labs.map(lab => ({
            id: lab.id,
            name: lab.name || `Lab #${lab.id}`,
            currentStatus: formatLabStatusLabel(lab.labStatus),
          })),
          labsText,
        },
      });

      const mailTasks: Array<Promise<void>> = [adminMail];
      if (requesterEmail.includes("@")) {
        mailTasks.push(
          sendMail({
            to: requesterEmail,
            from: process.env.MAIL_FROM_USER || process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
            subject: `We received your ${tierLabel} upgrade request`,
            text: confirmationLines,
            templateId: process.env.BREVO_TEMPLATE_TIER_UPGRADE_USER
              ? Number(process.env.BREVO_TEMPLATE_TIER_UPGRADE_USER)
              : undefined,
            params: {
              tier: payload.tier,
              tierLabel,
              billingPreference,
              requesterName,
              requesterEmail,
              labCount: labs.length,
              labs: labs.map(lab => ({
                id: lab.id,
                name: lab.name || `Lab #${lab.id}`,
                currentStatus: formatLabStatusLabel(lab.labStatus),
              })),
              labsText,
            },
          }),
        );
      }

      await Promise.all(mailTasks);

      res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid upgrade request" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to submit upgrade request" });
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
}
