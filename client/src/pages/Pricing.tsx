import { useMemo, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BadgeCheck,
  ClipboardCheck,
  Euro,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";

export default function Pricing() {
  const tiers = [
    {
      name: "Base",
      monthlyPrice: 99,
      annualPrice: 990,
      description: "Launch-ready listing with core visibility.",
      highlights: [
        "Dedicated profile with photos",
        "Equipment & amenities list",
        "Inbound contact form",
      ],
    },
    {
      name: "Verified",
      monthlyPrice: 149,
      annualPrice: 1490,
      description: "Earn the badge that researchers trust.",
      highlights: [
        "On-site or remote verification",
        "Verification badge on listing",
        "Priority placement in searches",
      ],
    },
    {
      name: "Premier Partner",
      monthlyPrice: 199,
      annualPrice: 1990,
      description: "Max visibility for growth-minded labs.",
      highlights: [
        "Featured listings across Glass",
        "Professional visual media support",
        "Early access to collaboration requests",
      ],
    },
  ];

  const [selectedTier, setSelectedTier] = useState(tiers[2]);
  const [billingCadence, setBillingCadence] = useState<"monthly" | "annual">("annual");
  const [formState, setFormState] = useState({
    labName: "",
    contactEmail: "",
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
    country: "",
    postalCode: "",
  });

  const priceSummary = useMemo(() => {
    const amount = billingCadence === "annual" ? selectedTier.annualPrice : selectedTier.monthlyPrice;
    return {
      amount,
      display: new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
      }).format(amount),
    };
  }, [billingCadence, selectedTier]);

  const handleInputChange = (field: keyof typeof formState) => (event: ChangeEvent<HTMLInputElement>) => {
    setFormState(previous => ({ ...previous, [field]: event.target.value }));
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-24 lg:py-28">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl space-y-6"
        >
          <span className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Pricing</span>
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-foreground">
            Listing on Glass Labs isn’t just visibility — it’s a trusted gateway.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Every week, researchers and biotech startups contact us looking for specialized equipment access. For
            <span className="font-semibold text-foreground"> €99/month</span>, your lab gains verified visibility in front of
            them — without changing how you operate or adding extra admin. You can cancel anytime; we’re here to help labs
            unlock revenue from underused capacity.
          </p>
          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card/70 p-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-[0.3em]">Revenue opportunity</h2>
              <p className="mt-2">
                Turn idle space and equipment into recurring income without taking on new business operations.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/70 p-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-[0.3em]">Verification = credibility</h2>
              <p className="mt-2">
                Labs that complete verification see higher response rates. The badge reassures teams you’re vetted and ready.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/70 p-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-[0.3em]">Cancel anytime</h2>
              <p className="mt-2">
                Month-to-month flexibility—pause or resume when your capacity changes. No hidden fees.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/70 p-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-[0.3em]">Pilot stage, limited seats</h2>
              <p className="mt-2">
                We’re onboarding a select group of labs while we scale demand. Joining now secures early advantage and feedback loops.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-14 grid gap-6 lg:grid-cols-3"
        >
          {tiers.map((tier, index) => {
            const isSelected = tier.name === selectedTier.name;
            return (
              <div
                key={tier.name}
                onClick={() => setSelectedTier(tier)}
                className={`cursor-pointer rounded-3xl border p-8 shadow-sm transition hover:border-primary/70 ${
                  isSelected ? "border-primary/90 bg-primary/5" : "border-border bg-card/80"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                      {tier.name}
                    </p>
                    <p className={`mt-3 text-3xl font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                      €{tier.monthlyPrice}
                      <span className="text-sm text-muted-foreground"> /month</span>
                    </p>
                    <p className="text-xs text-muted-foreground">or €{tier.annualPrice} billed annually</p>
                  </div>
                  {index === 2 ? <Sparkles className="h-6 w-6 text-primary" /> : <Euro className="h-6 w-6 text-primary/70" />}
                </div>
                <p className="mt-5 text-sm text-muted-foreground leading-relaxed">{tier.description}</p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                  {tier.highlights.map(item => (
                    <li key={item} className="inline-flex items-start gap-3">
                      <ClipboardCheck className="mt-1 h-4 w-4 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Add-ons</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Verification visit fee: <span className="font-semibold text-foreground">€250–€500</span> depending on location and scope.
              </p>
            </div>
            <BadgeCheck className="h-6 w-6 text-primary" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Fees cover travel and specialist time. Remote verification is available for labs with comprehensive digital documentation.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 grid gap-8 lg:grid-cols-[1fr_0.8fr]"
        >
          <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Checkout</h2>
              <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                Powered by Stripe-style secure fields
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => setBillingCadence("monthly")}
                className={`rounded-full px-4 py-2 transition ${
                  billingCadence === "monthly"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}
              >
                Monthly billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCadence("annual")}
                className={`rounded-full px-4 py-2 transition ${
                  billingCadence === "annual"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}
              >
                Annual billing (recommended)
              </button>
            </div>

            <form className="grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Lab / organisation name</span>
                  <input
                    type="text"
                    value={formState.labName}
                    onChange={handleInputChange("labName")}
                    placeholder="Forge Biofabrication"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </label>
                <label className="space-y-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Billing email</span>
                  <input
                    type="email"
                    value={formState.contactEmail}
                    onChange={handleInputChange("contactEmail")}
                    placeholder="finance@forge.bio"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </label>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Card details</span>
                <div className="rounded-xl border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="4242 4242 4242 4242"
                    value={formState.cardNumber}
                    onChange={handleInputChange("cardNumber")}
                    className="w-full bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
                  />
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="MM / YY"
                      value={formState.expiry}
                      onChange={handleInputChange("expiry")}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="CVC"
                      value={formState.cvc}
                      onChange={handleInputChange("cvc")}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Country</span>
                  <input
                    type="text"
                    value={formState.country}
                    onChange={handleInputChange("country")}
                    placeholder="Ireland"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </label>
                <label className="space-y-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Postal code</span>
                  <input
                    type="text"
                    value={formState.postalCode}
                    onChange={handleInputChange("postalCode")}
                    placeholder="D02"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </label>
              </div>

              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                Confirm payment of {priceSummary.display}
              </button>
              <p className="text-xs text-muted-foreground">
                By continuing you authorise Glass Labs to charge your card for the selected plan. Stripe securely handles your payment details.
              </p>
            </form>
          </div>

          <div className="rounded-3xl border border-border bg-muted/40 p-8 shadow-sm space-y-5">
            <h2 className="text-lg font-semibold text-foreground">Order summary</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>{selectedTier.name} plan</span>
                <span className="font-medium text-foreground">{priceSummary.display}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>{billingCadence === "annual" ? "Billed annually" : "Billed monthly"}</span>
                <span className="text-muted-foreground">Includes applicable taxes</span>
              </div>
              <hr className="my-2 border-border" />
              <div className="space-y-2">
                <div className="inline-flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                  Verification badge available on Verified & Premier tiers.
                </div>
                <div className="inline-flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 text-primary" />
                  Premier partners appear in featured rows and receive early collaboration requests.
                </div>
                <div className="inline-flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                  Verification visit fee (€250–€500) applies when scheduling your audit.
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/labs">
            <a className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary">
              Browse listed labs
            </a>
          </Link>
          <Link href="/admin/labs">
            <a className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary">
              Manage my lab profile
            </a>
          </Link>
          <a
            href="mailto:support@glass.demo"
            className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            Talk to the Glass team
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
