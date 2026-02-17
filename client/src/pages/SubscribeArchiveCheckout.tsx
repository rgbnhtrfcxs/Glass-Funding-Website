import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { usePricing } from "@/hooks/usePricing";
import { supabase } from "@/lib/supabaseClient";

type SubscriptionPlan = "verified" | "premier";

type OwnedLab = {
  id: number;
  name: string;
  labStatus: string | null;
};

const parseLabId = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const getLabSubscriptionTierRank = (status?: string | null) => {
  const normalized = (status || "").toLowerCase().trim();
  if (normalized === "premier") return 2;
  if (normalized === "verified" || normalized === "verified_active" || normalized === "verified_passive") {
    return 1;
  }
  return 0;
};

const canLabSubscribeToPlan = (status: string | null | undefined, plan: SubscriptionPlan) => {
  const rank = getLabSubscriptionTierRank(status);
  if (plan === "verified") return rank < 1;
  return rank < 2;
};

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
  const [labs, setLabs] = useState<OwnedLab[]>([]);
  const [labsLoading, setLabsLoading] = useState(false);
  const [selectedLabId, setSelectedLabId] = useState<number | null>(parseLabId(searchParams.get("labId")));
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
  }, [interval, plan, selectedLabId]);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const eligibleLabs = useMemo(
    () => labs.filter(lab => canLabSubscribeToPlan(lab.labStatus, plan as SubscriptionPlan)),
    [labs, plan],
  );

  const resolveLabIdForSubscription = () => {
    if (selectedLabId && eligibleLabs.some(lab => lab.id === selectedLabId)) return selectedLabId;
    if (eligibleLabs.length === 1) return eligibleLabs[0].id;
    return null;
  };

  useEffect(() => {
    if (!user?.id) {
      setLabs([]);
      setSelectedLabId(null);
      return;
    }

    let active = true;
    (async () => {
      setLabsLoading(true);
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/my-labs", { headers });
        if (!res.ok) {
          throw new Error("Unable to load labs");
        }
        const payload = await res.json();
        const ownedLabs: OwnedLab[] = Array.isArray(payload)
          ? payload
              .map((lab: any) => {
                const id = Number(lab?.id);
                const name = typeof lab?.name === "string" ? lab.name.trim() : "";
                const labStatus = typeof lab?.lab_status === "string" ? lab.lab_status : null;
                if (!Number.isInteger(id) || id <= 0 || !name) return null;
                return { id, name, labStatus };
              })
              .filter((lab: OwnedLab | null): lab is OwnedLab => Boolean(lab))
          : [];
        if (!active) return;
        setLabs(ownedLabs);
        setSelectedLabId(prev => {
          if (prev && ownedLabs.some(lab => lab.id === prev)) return prev;
          const requestedLabId = parseLabId(searchParams.get("labId"));
          if (requestedLabId && ownedLabs.some(lab => lab.id === requestedLabId)) return requestedLabId;
          if (ownedLabs.length === 1) return ownedLabs[0].id;
          return null;
        });
      } catch {
        if (!active) return;
        setLabs([]);
        setSelectedLabId(null);
      } finally {
        if (active) setLabsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    setSelectedLabId(prev => {
      if (prev && eligibleLabs.some(lab => lab.id === prev)) return prev;
      const requestedLabId = parseLabId(searchParams.get("labId"));
      if (requestedLabId && eligibleLabs.some(lab => lab.id === requestedLabId)) return requestedLabId;
      if (eligibleLabs.length === 1) return eligibleLabs[0].id;
      return null;
    });
  }, [eligibleLabs, searchParams]);

  const createIntent = async () => {
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (labsLoading) {
      setError("Loading your labs. Please try again.");
      return;
    }
    const labId = resolveLabIdForSubscription();
    if (!labId) {
      if (!eligibleLabs.length) {
        setError(
          plan === "premier"
            ? "All your labs are already on Premier."
            : "All your labs are already on Verified or Premier.",
        );
      } else {
        setError("Select an eligible lab before continuing.");
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/subscriptions/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ plan, interval, email, labId }),
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
    const labId = resolveLabIdForSubscription();
    if (!labId) {
      setError(eligibleLabs.length ? "Select an eligible lab before confirming." : "No eligible lab found.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await stripeInstance.current.confirmSetup({
        elements: stripeElements.current,
        confirmParams: {
          return_url: `${window.location.origin}/subscribe?plan=${plan}&interval=${interval}&labId=${labId}`,
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
        body: JSON.stringify({ plan, interval, setupIntentId: intentId, labId }),
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
    if (labsLoading) return;
    const labId = resolveLabIdForSubscription();
    if (!labId) {
      setError(eligibleLabs.length ? "Select an eligible lab before confirming." : "No eligible lab found.");
      return;
    }
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
          body: JSON.stringify({ plan, interval, setupIntentId: redirectSetupIntent, labId }),
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
  }, [plan, interval, searchParams, stripeReady, labsLoading, selectedLabId, eligibleLabs]);

  const planLabel = plan === "premier" ? "Premier" : "Verified";
  const tier = tiers.find(t => t.name.toLowerCase().trim() === plan);
  const displayPrice =
    interval === "yearly" ? tier?.yearly_price ?? null : tier?.monthly_price ?? null;
  const priceSuffix = interval === "yearly" ? "/ year" : "/ month";

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12 lg:py-16 max-w-3xl">
        <Link href="/account" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4">
          ← Back to profile
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
            <label className="text-sm font-medium text-foreground">Lab</label>
            {labsLoading ? (
              <p className="text-sm text-muted-foreground">Loading your labs…</p>
            ) : eligibleLabs.length > 1 ? (
              <select
                value={selectedLabId ? String(selectedLabId) : ""}
                onChange={event => {
                  const value = event.target.value;
                  setSelectedLabId(value ? Number(value) : null);
                }}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="">Select an eligible lab</option>
                {eligibleLabs.map(lab => (
                  <option key={lab.id} value={lab.id}>
                    {lab.name}
                  </option>
                ))}
              </select>
            ) : eligibleLabs.length === 1 ? (
              <div className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                {eligibleLabs[0].name}
              </div>
            ) : labs.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {plan === "premier"
                  ? "All your labs are already on Premier."
                  : "All your labs are already on Verified or Premier."}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No labs found for this account yet.
              </p>
            )}
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
              disabled={loading || labsLoading || (eligibleLabs.length > 1 && !selectedLabId) || eligibleLabs.length === 0}
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
