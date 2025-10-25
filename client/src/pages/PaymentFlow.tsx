import { useState, type ChangeEvent, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  CreditCard,
  ShieldCheck,
  Send,
  CalendarClock,
  Building,
  Mail,
} from "lucide-react";

const steps = [
  {
    title: "1. Pick your plan",
    description: "Choose Base, Verified, Premier, or the Custom intake. Pricing lives on the pricing page.",
    icon: ShieldCheck,
  },
  {
    title: "2. Stripe Checkout",
    description: "You’ll be redirected to Stripe-hosted checkout. Glass never touches raw card numbers.",
    icon: CreditCard,
  },
  {
    title: "3. Confirmation + onboarding",
    description: "Stripe emails a receipt instantly, and Glass unlocks your lab dashboard within minutes.",
    icon: Mail,
  },
  {
    title: "4. Weekly reviews",
    description: "Every Friday we review new listings, verification steps, and send any lab requests queued for you.",
    icon: CalendarClock,
  },
];

const enterpriseInitialState = {
  ownerName: "",
  organization: "",
  labsManaged: "",
  email: "",
  message: "",
};

export default function PaymentFlow() {
  const [formState, setFormState] = useState(enterpriseInitialState);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const inputClasses =
    "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 lg:py-24 max-w-6xl space-y-12">
        <header className="space-y-4">
          <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Payment flow</span>
          <h1 className="text-4xl font-semibold text-foreground">
            Stripe-first billing built for labs, with a human fallback for enterprise deals.
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            We keep billing transparent: standard plans go through Stripe Checkout, while multi-lab operators can request
            a custom agreement. This page documents the flow so your team and finance counterparts know what to expect.
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

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid gap-6 md:grid-cols-2"
        >
          {steps.map(step => (
            <div key={step.title} className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm space-y-2">
              <div className="flex items-center gap-3">
                <step.icon className="h-6 w-6 text-primary" />
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">{step.title}</p>
              </div>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">Standard checkout timeline</h2>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li>
                <span className="font-semibold text-foreground">Day 0</span> — complete Stripe Checkout with Base, Verified, or
                Premier. Receipts arrive instantly.
              </li>
              <li>
                <span className="font-semibold text-foreground">Day 0–1</span> — Glass confirms your details, unlocks your lab
                dashboard, and schedules verification (if applicable).
              </li>
              <li>
                <span className="font-semibold text-foreground">Day 7</span> — you appear in our weekly digest to founders and
                researchers who requested labs in your focus areas.
              </li>
            </ul>
            <div className="rounded-2xl border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
              Need to pay by invoice, ACH, or wire? Submit the custom form below and mention your preferred process—we’ll route
              it to Brevo/email so the finance team can follow up manually.
            </div>
          </div>

          <div id="custom" className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">Custom / enterprise intake</h2>
                <p className="text-sm text-muted-foreground">
                  For operators managing multiple labs or requiring bespoke contracts.
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
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Labs managed</span>
                  <input
                    className={inputClasses}
                    value={formState.labsManaged}
                    onChange={updateField("labsManaged")}
                    placeholder="e.g. 4 locations"
                    required
                  />
                </label>
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
              </div>
              <label className="space-y-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">What do you need?</span>
                <textarea
                  className={`${inputClasses} min-h-[120px]`}
                  value={formState.message}
                  onChange={updateField("message")}
                  placeholder="Tell us about your footprint, existing software, billing needs, or integrations."
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

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-4"
        >
          <h3 className="text-lg font-semibold text-foreground">Need a direct line?</h3>
          <p className="text-sm text-muted-foreground">
            Email <a className="text-primary underline" href="mailto:finance@glass.demo">finance@glass.demo</a> or drop a note in the custom
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
