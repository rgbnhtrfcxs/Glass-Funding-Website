import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Loader2, CreditCard, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function StripeCheckout() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const [redirecting, setRedirecting] = useState(false);
  const search = typeof window !== "undefined" ? window.location.search : "";
  const selectedPlan = useMemo(() => {
    try {
      const params = new URLSearchParams(search);
      return params.get("plan")?.toLowerCase() ?? null;
    } catch {
      return null;
    }
  }, [search]);

  const allowedPlans = ["verified", "premier", "custom"];
  const validPlan = selectedPlan && allowedPlans.includes(selectedPlan);

  useEffect(() => {
    if (loading) return;
    if (!validPlan) {
      setLocation("/subscriptions");
      return;
    }
    if (!user) {
      const next = encodeURIComponent(`/stripe?plan=${selectedPlan}`);
      setLocation(`/login?next=${next}`);
      return;
    }
    setRedirecting(true);
    window.location.href = `/api/stripe/checkout?plan=${selectedPlan}`;
  }, [user, loading, validPlan, selectedPlan, setLocation]);

  if (loading || !validPlan) {
    return null;
  }

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 max-w-3xl">
        <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-6 text-center">
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Stripe checkout
            </span>
          </div>
          <h1 className="text-3xl font-semibold text-foreground">Redirecting to Stripe</h1>
          <p className="text-muted-foreground text-sm">
            We’re opening Stripe for the {selectedPlan} plan. If nothing happens, use the button below.
          </p>
          <div className="flex justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}>
              <Loader2 className="h-10 w-10 text-primary" />
            </motion.div>
          </div>
          <button
            onClick={() => {
              setRedirecting(true);
              window.location.href = `/api/stripe/checkout?plan=${selectedPlan}`;
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            disabled={redirecting}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            {redirecting ? "Opening Stripe..." : "Open Stripe Checkout"}
          </button>
          <div className="rounded-2xl border border-dashed border-border bg-background/60 p-4 text-xs text-muted-foreground text-left space-y-2">
            <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              What to expect
            </div>
            <ul className="space-y-1 list-disc list-inside">
              <li>We never see or store card numbers—Stripe handles everything.</li>
              <li>You’ll receive a receipt immediately after payment.</li>
              <li>Your listing is activated within one business day.</li>
            </ul>
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <Link href="/subscriptions">
              <a className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-muted-foreground transition hover:border-primary hover:text-primary">
                Back to subscriptions
              </a>
            </Link>
            <Link href="/payments">
              <a className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-background transition hover:bg-foreground/90">
                View payment options
              </a>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
