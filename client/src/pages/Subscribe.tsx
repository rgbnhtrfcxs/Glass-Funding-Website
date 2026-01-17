import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/context/AuthContext";

export default function Subscribe() {
  const { user } = useAuth();
  const [location] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.split("?")[1] ?? ""), [location]);
  const plan = (searchParams.get("plan") || "verified").toLowerCase();
  const [interval, setInterval] = useState<"monthly" | "yearly">(
    (searchParams.get("interval") as "monthly" | "yearly") || "yearly",
  );
  const [email, setEmail] = useState(user?.email || "");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const paymentElementRef = useRef<HTMLDivElement | null>(null);
  const stripeInstance = useRef<any>(null);
  const stripeElements = useRef<any>(null);

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
    setError(null);
  }, [interval, plan]);

  const createIntent = async () => {
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval, email }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Unable to start checkout");
      }
      const payload = await res.json();
      if (!payload?.client_secret) throw new Error("No client secret returned");
      setClientSecret(payload.client_secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout");
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async () => {
    if (!stripeInstance.current || !stripeElements.current) return;
    setLoading(true);
    setError(null);
    try {
      const result = await stripeInstance.current.confirmPayment({
        elements: stripeElements.current,
        confirmParams: {
          return_url: `${window.location.origin}/account?status=subscription_success&plan=${plan}`,
        },
        redirect: "if_required",
      });
      if (result.error) {
        throw new Error(result.error.message || "Payment failed");
      }
      window.location.href = `/account?status=subscription_success&plan=${plan}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const planLabel = plan === "premier" ? "Premier" : "Verified";

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
                onClick={confirmPayment}
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
