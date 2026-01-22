import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles, ClipboardCheck } from "lucide-react";
import { Link } from "wouter";
import { usePricing } from "@/hooks/usePricing";

export default function Pricing() {
  const { tiers } = usePricing();
  const [interval, setInterval] = useState<"monthly" | "yearly">("yearly");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const startCheckout = (plan: string) => {
    setCheckoutError(null);
    setCheckoutLoading(plan);
    window.location.href = `/subscribe?plan=${plan}&interval=${interval}`;
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl space-y-6"
        >
          <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">GLASS-Connect pricing</span>
          <h1 className="text-4xl md:text-5xl font-semibold text-foreground leading-tight">
            Simple plans to showcase your lab. No hidden fees.
          </h1>
          <p className="text-lg text-muted-foreground">
            Choose how visible you want to be on GLASS-Connect. Switch tiers anytime; your listing stays live.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/labs">
              <a className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                List your lab
              </a>
            </Link>
            <Link href="/labs">
              <a className="inline-flex items-center rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
                Browse labs on GLASS-Connect
              </a>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-14"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="text-sm text-muted-foreground">
              Billing
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 p-1 text-sm">
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
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {tiers.map(tier => {
              const plan = tier.name.toLowerCase().trim();
              const paymentHref = tier.name === "Custom" ? `/payments?plan=${plan}#custom` : `/payments?plan=${plan}`;
              const monthlyPrice: any = (tier as any).monthly_price ?? (tier as any).monthlyPrice;
              const yearlyPrice: any = (tier as any).yearly_price ?? (tier as any).yearlyPrice;
              const priceVal = interval === "yearly" ? yearlyPrice : monthlyPrice;
              const isFree = priceVal === 0 || priceVal === "0";
              const hasPrice = priceVal !== null && priceVal !== undefined && !isFree;
              const priceLabel = isFree ? "Free" : hasPrice ? `€${priceVal}` : "Custom";
              const isFeatured = tier.name.toLowerCase() === "verified";
              return (
                <article
                  key={tier.name}
                  className={`relative flex h-full flex-col rounded-[28px] border border-border bg-card/90 p-7 shadow-sm ${
                    isFeatured ? "ring-2 ring-primary/50 bg-gradient-to-br from-card to-primary/10" : ""
                  }`}
                >
                  {isFeatured && (
                    <span className="absolute right-6 top-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      Most popular
                    </span>
                  )}
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{tier.name}</p>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-semibold text-foreground">{priceLabel}</span>
                      {hasPrice && (
                        <span className="text-sm text-muted-foreground">
                          {interval === "yearly" ? "/ year" : "/ month"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{tier.description}</p>
                  </div>

                  <div className="mt-6 flex-1">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                      What&apos;s included
                    </h3>
                    <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                      {tier.highlights.map(item => (
                        <li key={item} className="flex items-start gap-3">
                          <ClipboardCheck className="mt-0.5 h-4 w-4 text-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6">
                    {tier.name === "Custom" ? (
                      <Link href="/contact">
                        <a className="inline-flex w-full items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
                          Talk to partnerships
                          <ArrowUpRight className="ml-2 h-4 w-4" />
                        </a>
                      </Link>
                    ) : tier.name === "Base" ? (
                      <Link href="/signup">
                        <a className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/90">
                          Get started free
                        </a>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startCheckout(plan)}
                        disabled={checkoutLoading === plan}
                        className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:opacity-60"
                      >
                        {checkoutLoading === plan ? "Redirecting…" : "Get started"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {checkoutError && (
            <p className="mt-4 text-sm text-destructive">{checkoutError}</p>
          )}
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
              Need ACH, wire, or invoices? Use the Custom intake on the plan details page and we’ll send tailored options.
            </p>
          </div>
          <div className="rounded-[32px] border border-border bg-card/80 p-8 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-foreground">After you subscribe</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>Stripe emails a receipt instantly and your listing stays live as you edit.</li>
              <li>GLASS-Connect activates your listing within one business day and schedules verification if needed.</li>
              <li>Weekly Fridays: we highlight new labs and route qualified requests right to your inbox.</li>
            </ul>
            <Link href="/payments?plan=base">
              <a className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
                View plan details
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
            href="mailto:contact@glass-funding.com"
            className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            Contact support
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
