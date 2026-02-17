import { Link, useLocation } from "wouter";

export default function Subscribe() {
  const [location] = useLocation();
  const query = location.includes("?") ? location.slice(location.indexOf("?")) : "";

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12 lg:py-16 max-w-3xl">
        <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-6">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Subscriptions</p>
            <h1 className="text-3xl font-semibold text-foreground">Payments are paused</h1>
            <p className="text-sm text-muted-foreground">
              We are not accepting live Stripe payments yet while legal status is being finalized. We can still onboard
              labs manually and discuss tier upgrades directly.
            </p>
          </div>

          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
            Current route query: <span className="font-mono text-foreground">{query || "(none)"}</span>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/contact">
              <a className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                Contact for onboarding
              </a>
            </Link>
            <Link href="/pricing">
              <a className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
                Back to tiers
              </a>
            </Link>
            <Link href="/subscribe-archive">
              <a className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
                Open archived checkout flow
              </a>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
