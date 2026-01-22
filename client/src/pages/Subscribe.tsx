import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { usePricing } from "@/hooks/usePricing";
import { supabase } from "@/lib/supabaseClient";

export default function Subscribe() {
  const { user } = useAuth();
  const { tiers } = usePricing();
  const [location] = useLocation();
  const locationSearch = location.includes("?") ? location.slice(location.indexOf("?")) : "";
  const search =
    typeof window !== "undefined" && window.location.search
      ? window.location.search
      : locationSearch;
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const rawPlan = (searchParams.get("plan") || "verified").toLowerCase().trim();
  const plan = rawPlan === "premier" ? "premier" : "verified";
  const normalizeInterval = (value: string | null) => {
    if (!value) return "yearly";
    const cleaned = value.toLowerCase();
    if (cleaned === "monthly" || cleaned === "yearly") return cleaned;
    return "yearly";
  };
  const [interval, setInterval] = useState<"monthly" | "yearly">(normalizeInterval(searchParams.get("interval")));
  const [email, setEmail] = useState(user?.email || "");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupIntentId, setSetupIntentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [currentTier, setCurrentTier] = useState("base");
  const [currentStatus, setCurrentStatus] = useState("none");
  const paymentElementRef = useRef<HTMLDivElement | null>(null);
  const stripeInstance = useRef<any>(null);
  const stripeElements = useRef<any>(null);
  const redirectHandled = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = document.querySelector('script[src="https://js.stripe.com/v3"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => setStripeReady(true));
      if ((window as any).Stripe) setStripeReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3";
    script.async = true;
    script.onload = () => setStripeReady(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("subscription_tier, subscription_status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setCurrentTier((data.subscription_tier || "base").toLowerCase());
        setCurrentStatus((data.subscription_status || "none").toLowerCase());
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!stripeReady || !clientSecret) return;
    const StripeCtor = (window as any).Stripe;
    if (!StripeCtor) return;
    const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!pk) return;
    const stripe = StripeCtor(pk);
    const elements = stripe.elements({ clientSecret });
    const paymentEl = elements.create("payment");
    if (paymentElementRef.current) {
      paymentEl.mount(paymentElementRef.current);
    }
    stripeInstance.current = stripe;
    stripeElements.current = elements;
    return () => {
      try {
        paymentEl.unmount();
      } catch {
        /* ignore */
      }
    };
  }, [stripeReady, clientSecret]);

  useEffect(() => {
    setClientSecret(null);
    setSetupIntentId(null);
    setError(null);
  }, [interval, plan]);

  const getAuthHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const createIntent = async () => {
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (
      ["active", "past_due", "trialing"].includes(currentStatus) &&
      (currentTier === "premier" || currentTier === plan)
    ) {
      setError(
        currentTier === "premier"
          ? "Your account is already on Premier."
          : "Your account is already on this plan.",
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/subscriptions/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ plan, interval, email }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Unable to start checkout");
      }
      const payload = await res.json();
      if (!payload?.client_secret) throw new Error("No client secret returned");
      setClientSecret(payload.client_secret);
      setSetupIntentId(payload.setup_intent_id || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout");
    } finally {
      setLoading(false);
    }
  };

  const confirmSubscription = async () => {
    if (!stripeInstance.current || !stripeElements.current) return;
    setLoading(true);
    setError(null);
    try {
      const result = await stripeInstance.current.confirmSetup({
        elements: stripeElements.current,
        confirmParams: {
          return_url: `${window.location.origin}/subscribe?plan=${plan}&interval=${interval}`,
        },
        redirect: "if_required",
      });
      if (result.error) {
        throw new Error(result.error.message || "Payment method setup failed");
      }
      const intentId = result.setupIntent?.id || setupIntentId;
      if (!intentId) throw new Error("Setup intent missing");

      const headers = await getAuthHeaders();
      const activateRes = await fetch("/api/subscriptions/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ plan, interval, setupIntentId: intentId }),
      });
      if (!activateRes.ok) {
        const txt = await activateRes.text();
        throw new Error(txt || "Unable to activate subscription");
      }
      const activation = await activateRes.json();
      if (activation?.payment_intent_client_secret) {
        const paymentResult = await stripeInstance.current.confirmCardPayment(
          activation.payment_intent_client_secret,
        );
        if (paymentResult.error) {
          throw new Error(paymentResult.error.message || "Payment confirmation failed");
        }
      }
      window.location.href = `/account?status=subscription_success&plan=${plan}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to finalize subscription");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const redirectSetupIntent = searchParams.get("setup_intent");
    if (!redirectSetupIntent || redirectHandled.current) return;
    redirectHandled.current = true;
    setSetupIntentId(redirectSetupIntent);
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = await getAuthHeaders();
        const activateRes = await fetch("/api/subscriptions/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ plan, interval, setupIntentId: redirectSetupIntent }),
        });
        if (!activateRes.ok) {
          const txt = await activateRes.text();
          throw new Error(txt || "Unable to activate subscription");
        }
        const activation = await activateRes.json();
        if (activation?.payment_intent_client_secret && stripeInstance.current) {
          const paymentResult = await stripeInstance.current.confirmCardPayment(
            activation.payment_intent_client_secret,
          );
          if (paymentResult.error) {
            throw new Error(paymentResult.error.message || "Payment confirmation failed");
          }
        }
        window.location.href = `/account?status=subscription_success&plan=${plan}`;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to finalize subscription");
      } finally {
        setLoading(false);
      }
    })();
  }, [plan, interval, searchParams, stripeReady]);

  const planLabel = plan === "premier" ? "Premier" : "Verified";
  const tier = tiers.find(t => t.name.toLowerCase().trim() === plan);
  const displayPrice =
    interval === "yearly" ? tier?.yearly_price ?? null : tier?.monthly_price ?? null;
  const priceSuffix = interval === "yearly" ? "/ year" : "/ month";

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12 lg:py-16 max-w-3xl">
        <Link href="/pricing" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4">
          ← Back to pricing
        </Link>
        <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Subscribe</p>
            <h1 className="text-3xl font-semibold text-foreground">{planLabel} plan</h1>
            <p className="text-sm text-muted-foreground">
              Choose billing and add your payment method below. You can switch or cancel anytime.
            </p>
            {displayPrice !== null && displayPrice !== undefined && (
              <p className="text-lg font-semibold text-foreground">
                €{displayPrice} <span className="text-sm text-muted-foreground">{priceSuffix}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Billing</span>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 p-1 text-sm">
              <button
                type="button"
                onClick={() => setInterval("yearly")}
                className={`rounded-full px-4 py-1.5 font-medium transition ${
                  interval === "yearly"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                Yearly
              </button>
              <button
                type="button"
                onClick={() => setInterval("monthly")}
                className={`rounded-full px-4 py-1.5 font-medium transition ${
                  interval === "monthly"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {!clientSecret && (
            <button
              type="button"
              onClick={createIntent}
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:opacity-60"
            >
              {loading ? "Preparing checkout…" : "Continue to payment"}
            </button>
          )}

          {clientSecret && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <div ref={paymentElementRef} className="min-h-[180px]" />
              </div>
              <button
                type="button"
                onClick={confirmSubscription}
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? "Processing…" : "Confirm subscription"}
              </button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>
    </section>
  );
}
