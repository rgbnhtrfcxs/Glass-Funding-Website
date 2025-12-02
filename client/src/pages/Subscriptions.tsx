import { motion } from "framer-motion";
import { CheckCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { usePricing } from "@/hooks/usePricing";

export default function Subscriptions() {
  const { tiers } = usePricing();

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto max-w-5xl px-4 py-20 lg:py-24 space-y-10">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Subscriptions</p>
          <h1 className="text-4xl md:text-5xl font-semibold text-foreground">Choose your GLASS plan</h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            New accounts start on Base. Upgrade anytime; after payment we’ll switch your subscription tier automatically.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/pricing">
              <a className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
                View pricing page
              </a>
            </Link>
            <Link href="/account">
              <a className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                Back to profile
              </a>
            </Link>
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          {tiers.map(tier => {
            const isFeatured = (tier as any).featured;
            const plan = tier.name.toLowerCase();
            const paymentHref = plan === "custom" ? "/payments?plan=custom#custom" : `/payments?plan=${plan}`;
            const priceVal: any = (tier as any).monthly_price ?? (tier as any).monthlyPrice;
            const isFree = priceVal === 0 || priceVal === "0";
            const hasPrice = priceVal !== null && priceVal !== undefined && !isFree;
            const priceLabel = isFree ? "Free" : hasPrice ? `€${priceVal}/mo` : "Talk to us";
            return (
              <article
                key={plan}
                className={`rounded-[32px] border border-border bg-card/90 p-8 shadow-sm ${
                  isFeatured ? "lg:col-span-2 bg-gradient-to-br from-card to-primary/5" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{tier.name}</p>
                    <p className="mt-3 text-3xl font-semibold text-foreground">{priceLabel}</p>
                    <p className="text-sm text-muted-foreground">{tier.description ?? "Choose your plan and switch anytime."}</p>
                  </div>
                  {tier.name === "Base" && <ShieldCheck className="h-6 w-6 text-muted-foreground" />}
                  {isFeatured && <Sparkles className="h-6 w-6 text-primary" />}
                </div>
                <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                  {(tier as any).highlights?.map((item: string) => (
                    <li key={item} className="flex items-center gap-3">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href={paymentHref}>
                  <a
                    className={`mt-6 inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition ${
                      plan === "custom"
                        ? "border border-border text-muted-foreground hover:border-primary hover:text-primary"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {plan === "custom" ? "Talk to us" : "Subscribe"}
                  </a>
                </Link>
              </article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
