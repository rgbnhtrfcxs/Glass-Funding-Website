import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { CreditCard, ShieldCheck, Building } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

const enterpriseInitialState = {
  ownerName: "",
  organization: "",
  labsManaged: "",
  email: "",
  phone: "",
  message: "",
};

export default function PaymentFlow() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const [formState, setFormState] = useState(enterpriseInitialState);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [freeStatus, setFreeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [freeError, setFreeError] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const search = typeof window !== "undefined" ? window.location.search : "";
  const selectedPlan = useMemo(() => {
    try {
      const params = new URLSearchParams(search);
      return params.get("plan");
    } catch {
      return null;
    }
  }, [search]);

  const normalizedPlan = (selectedPlan ?? "").toLowerCase();
  const isFreePlan = normalizedPlan === "base" || normalizedPlan === "free";
  const isPaidStandard = normalizedPlan === "verified" || normalizedPlan === "premier";
  const isEnterprise = normalizedPlan === "custom" || normalizedPlan === "enterprise";
  const metadataName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.fullName ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.displayName ||
    "";
  const stripeCheckoutUrl = `/api/stripe/checkout?plan=${normalizedPlan || "base"}`;
  // const sepaDetails = {
  //   accountName: "Glass Connect Labs Ltd",
  //   iban: "DE89 3704 0044 0532 0130 00",
  //   bic: "COBADEFFXXX",
  //   reference: `GLASS-Connect (${user?.email || "your-email"})`,
  // };

  useEffect(() => {
    if (loading) return;
    const allowedPlans = ["base", "free", "verified", "premier", "custom", "enterprise"];
    if (!selectedPlan || !allowedPlans.includes(normalizedPlan)) {
      setLocation("/pricing");
      return;
    }
    if (!user) {
      const next = encodeURIComponent(`/payments?plan=${normalizedPlan}`);
      setLocation(`/login?next=${next}`);
      return;
    }
  }, [user, selectedPlan, normalizedPlan, loading, setLocation]);

  useEffect(() => {
    if (!user) return;
    async function loadProfileName() {
      const { data, error } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!error && data?.name) {
        setProfileName(data.name);
        setFormState(prev => ({
          ...prev,
          ownerName: prev.ownerName || data.name,
        }));
      } else {
        setProfileName(null);
      }
    }
    loadProfileName();
    setFormState(prev => ({
      ...prev,
      ownerName: prev.ownerName || metadataName || user?.email?.split("@")[0] || "",
      email: prev.email || user.email || "",
      phone: prev.phone || user.user_metadata?.phone || user.phone || "",
    }));
  }, [user, metadataName]);

  const updateField = (field: keyof typeof formState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState(previous => ({ ...previous, [field]: event.target.value }));
  };

  const handleEnterpriseSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formState.ownerName || formState.organization,
          email: formState.email,
          message: [
            `Organization: ${formState.organization}`,
            `Labs managed: ${formState.labsManaged}`,
            "",
            formState.message || "No additional context provided.",
          ].join("\n"),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Unable to send request" }));
        throw new Error(payload?.message ?? "Unable to send request");
      }
      setStatus("success");
      setFormState(enterpriseInitialState);
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to send request");
    }
  };

  const handleFreeConfirm = async () => {
    setFreeStatus("loading");
    setFreeError(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formState.ownerName || metadataName || user?.email || "GLASS-Connect user",
          email: user?.email,
          message: `Confirming free plan signup for ${user?.email || "unknown"} on GLASS-Connect.`,
        }),
      });
      if (!response.ok) {
        throw new Error("Unable to send confirmation");
      }
      setFreeStatus("success");
    } catch (error) {
      setFreeStatus("error");
      setFreeError(error instanceof Error ? error.message : "Unable to send confirmation");
    }
  };

  const inputClasses =
    "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  if (loading) {
    return null;
  }

  if (!user || !selectedPlan) {
    return null;
  }

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 lg:py-24 max-w-6xl space-y-12">
        <header className="space-y-4">
          <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Payment flow</span>
          <h1 className="text-4xl font-semibold text-foreground">
            {isFreePlan ? "Your GLASS-Connect free listing" : "Stripe-first billing built for labs"}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {isFreePlan
              ? "Confirm your free plan so your listing stays live while you edit. You can upgrade anytime."
              : "We keep billing transparent: standard plans go through Stripe Checkout (with optional SEPA transfer), and multi-lab operators can request a custom agreement."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/pricing">
              <a className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
                Review plans
              </a>
            </Link>
            <Link href="/labs">
              <a className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                Explore live listings
              </a>
            </Link>
          </div>
        </header>

        {isFreePlan && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"
          >
            <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">Free plan confirmation</h2>
              <p className="text-sm text-muted-foreground">
                Confirm your free GLASS-Connect listing. We’ll email a confirmation and keep your profile live while you edit.
              </p>
              <button
                onClick={handleFreeConfirm}
                disabled={freeStatus === "loading"}
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {freeStatus === "loading" ? "Sending confirmation…" : "Confirm free plan"}
              </button>
              {freeStatus === "success" && (
                <p className="text-sm text-emerald-600">
                  Confirmation sent to {user?.email ?? "your email on file"}. If you don’t see it, check spam or contact support.
                </p>
              )}
              {freeStatus === "error" && (
                <p className="text-sm text-destructive">
                  {freeError ?? "We couldn’t send the confirmation. Please try again or contact support."}
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-4">
              <h3 className="text-lg font-semibold text-foreground">What you get</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />
                  Standardised lab profile with capabilities, equipment, and contact prefs.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />
                  Inbound requests routed to your team while you edit and refine details.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5" />
                  Upgrade anytime to add verification, placement, and media support.
                </li>
              </ul>
            </div>
          </motion.div>
        )}

        {isPaidStandard && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]"
          >
            <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">Stripe Checkout</h2>
              <p className="text-sm text-muted-foreground">
                You’ll be redirected to a Stripe-hosted checkout page for the {normalizedPlan} plan. Glass never touches raw card numbers.
              </p>
              <button
                onClick={() => {
                  window.location.href = stripeCheckoutUrl;
                }}
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Proceed to Stripe Checkout
              </button>
              <div className="rounded-2xl border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
                After payment, we’ll activate your listing within one business day and schedule verification if needed.
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Prefer bank transfer (SEPA)?</h2>
              <p className="text-sm text-muted-foreground">
                Bank transfer option coming soon. We&apos;ll share SEPA details once the Glass account is live.
              </p>
              {/*
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><span className="font-semibold text-foreground">Account name:</span> {sepaDetails.accountName}</li>
                <li><span className="font-semibold text-foreground">IBAN:</span> {sepaDetails.iban}</li>
                <li><span className="font-semibold text-foreground">BIC/SWIFT:</span> {sepaDetails.bic}</li>
                <li><span className="font-semibold text-foreground">Reference:</span> {sepaDetails.reference}</li>
              </ul>
              <p className="text-xs text-muted-foreground">
                Email proof of transfer to contact@glass-funding.com with your plan and lab name to expedite activation.
              </p>
              */}
            </div>
          </motion.div>
        )}

        {isEnterprise && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]"
          >
            <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-6">
              <h2 className="text-2xl font-semibold text-foreground">Enterprise intake</h2>
              <p className="text-sm text-muted-foreground">
                Tell us about your network and billing needs. We’ll follow up with the right agreement, procurement details, and onboarding.
              </p>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>Dedicated partner manager and verification scheduling across sites.</li>
                <li>Custom invoicing (ACH/SEPA/wire), procurement docs, and data exports.</li>
                <li>API access and multi-lab routing preferences.</li>
              </ul>
            </div>

            <div id="custom" className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Enterprise form</h2>
                  <p className="text-sm text-muted-foreground">
                    We’ll get back to you within one business day.
                  </p>
                </div>
              </div>
              {status === "success" && (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  Thanks! We’ve logged your details and will respond within one business day.
                </div>
              )}
              {status === "error" && (
                <div className="rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {errorMessage ?? "We couldn’t send your message. Please try again."}
                </div>
              )}
              <form className="space-y-4" onSubmit={handleEnterpriseSubmit}>
                <label className="space-y-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Your name</span>
                  <input
                    className={inputClasses}
                    value={formState.ownerName}
                    onChange={updateField("ownerName")}
                    placeholder="Jordan Reyes"
                    required
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Contact email</span>
                    <input
                      type="email"
                      className={inputClasses}
                      value={formState.email}
                      onChange={updateField("email")}
                      placeholder="you@labs.com"
                      required
                    />
                  </label>
                  <label className="space-y-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Phone number</span>
                    <input
                      className={inputClasses}
                      value={formState.phone}
                      onChange={updateField("phone")}
                      placeholder="+49 171 2345678"
                      required
                    />
                  </label>
                </div>
                <label className="space-y-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Organization</span>
                  <input
                    className={inputClasses}
                    value={formState.organization}
                    onChange={updateField("organization")}
                    placeholder="Atlas Applied Biology"
                    required
                  />
                </label>
                <label className="space-y-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Labs managed (optional)</span>
                  <input
                    className={inputClasses}
                    value={formState.labsManaged}
                    onChange={updateField("labsManaged")}
                    placeholder="e.g. 4 locations"
                  />
                </label>
                <label className="space-y-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">What do you need?</span>
                  <textarea
                    className={`${inputClasses} min-h-[120px]`}
                    value={formState.message}
                    onChange={updateField("message")}
                    placeholder="Tell us about your footprint, routing preferences, billing needs, or integrations."
                  />
                </label>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === "loading" ? "Sending…" : "Send to Glass partnerships"}
                </button>
                <p className="text-xs text-muted-foreground">
                  We route this form to our Brevo/email inbox so a real person can follow up with invoices, contracts, or procurement info.
                </p>
              </form>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-4"
        >
          <h3 className="text-lg font-semibold text-foreground">Need a direct line?</h3>
          <p className="text-sm text-muted-foreground">
            Email <a className="text-primary underline" href="mailto:contact@glass-funding.com">contact@glass-funding.com</a> or drop a note in the custom
            form. We can accommodate purchase orders, wire transfers, and co-branded partnership agreements.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/pricing">
              <a className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
                Back to pricing
              </a>
            </Link>
            <Link href="/labs">
              <a className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                See partner labs
              </a>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
