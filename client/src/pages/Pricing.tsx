import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles, ShieldCheck, ClipboardCheck } from "lucide-react";
import { Link } from "wouter";

const tiers = [
  {
    name: "Base",
    monthlyPrice: 99,
    description: "Launch on Glass with the essentials.",
    highlights: ["Profile page", "Equipment showcase", "Inbound contact form"],
    featured: false,
  },
  {
    name: "Verified",
    monthlyPrice: 149,
    description: "Add the badge researchers trust.",
    highlights: ["Remote/on-site verification", "Badge on listing", "Priority placement"],
    featured: false,
  },
  {
    name: "Premier",
    monthlyPrice: 199,
    description: "Flagship placement plus media support.",
    highlights: ["Featured carousels", "Media refresh", "First look at requests"],
    featured: true,
  },
  {
    name: "Custom",
    monthlyPrice: null,
    description: "For networks or operators managing multiple labs.",
    highlights: ["Central billing", "Dedicated partner manager", "API & tooling access"],
    featured: false,
  },
] as const;

export default function Pricing() {

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-24 lg:py-28">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl space-y-6"
        >
          <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Glass pricing</span>
          <h1 className="text-4xl md:text-5xl font-semibold text-foreground leading-tight">
            Simple tiers. Apple-clean presentation. No hidden fees.
          </h1>
          <p className="text-lg text-muted-foreground">
            Pay only when your lab is live. Switch tiers anytime. Stripe handles billing; we handle operators.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/payments">
              <a className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                See payment flow
              </a>
            </Link>
            <Link href="/labs">
              <a className="inline-flex items-center rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
                Browse labs on Glass
              </a>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-14 grid gap-6 lg:grid-cols-2"
        >
          {tiers.map(tier => (
            <article
              key={tier.name}
              className={`rounded-[32px] border border-border bg-card/90 p-8 shadow-sm ${
                tier.featured ? "lg:col-span-2 bg-gradient-to-br from-card to-primary/5" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{tier.name}</p>
                  <p className="mt-3 text-4xl font-semibold text-foreground">
                    {tier.monthlyPrice ? `€${tier.monthlyPrice}` : "Custom"}
                    {tier.monthlyPrice && <span className="text-base text-muted-foreground"> / month</span>}
                  </p>
                </div>
                {tier.featured && <Sparkles className="h-6 w-6 text-primary" />}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{tier.description}</p>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                {tier.highlights.map(item => (
                  <li key={item} className="flex items-center gap-3">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              {tier.name === "Custom" ? (
                <Link href="/payments#custom">
                  <a className="mt-6 inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
                    Talk to partnerships
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </a>
                </Link>
              ) : (
                <Link href="/payments">
                  <a className="mt-6 inline-flex items-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/90">
                    Get started
                  </a>
                </Link>
              )}
            </article>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 grid gap-6 lg:grid-cols-2"
        >
          <div className="rounded-[32px] border border-border bg-card/80 p-8 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Add-ons</h2>
            <p className="text-sm text-muted-foreground">
              Verification visits: €250–€500 depending on geography. Remote verifications are available if you already have documented SOPs.
            </p>
            <p className="text-sm text-muted-foreground">
              Need ACH, wire, or invoices? Use the Custom intake on the payment flow page and we’ll send tailored options.
            </p>
          </div>
          <div className="rounded-[32px] border border-border bg-card/80 p-8 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-foreground">After you pay</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>Stripe emails a receipt instantly. You can update payment methods anytime.</li>
              <li>Glass activates your listing within one business day and schedules verification if needed.</li>
              <li>Weekly Fridays: we highlight new labs + route qualified requests right to your inbox.</li>
            </ul>
            <Link href="/payments">
              <a className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
                Learn more about billing
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </a>
            </Link>
          </div>
        </motion.div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/labs">
            <a className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
              Browse labs
            </a>
          </Link>
          <Link href="/admin/labs">
            <a className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
              Manage my lab profile
            </a>
          </Link>
          <a
            href="mailto:finance@glass.demo"
            className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            Contact finance
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
