import { Link } from "wouter";

export default function PricingArchived() {
  return (
    <div className="max-w-4xl mx-auto pt-32 px-4 pb-20 space-y-6">
      <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Beta update</p>
        <h1 className="text-3xl font-semibold mb-2">Pricing is paused during beta</h1>
        <p className="text-sm text-muted-foreground">
          All early adopters get free access while we finish verification and invite-only premier onboarding. We&apos;ll
          announce public plans later.
        </p>
        <div className="mt-6 space-y-3 text-sm text-muted-foreground">
          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-primary">
            Premier is invite-only for now. Reach out if you need visibility perks or verification.
          </div>
          <p>Need something specific? Email us and we&apos;ll sort it out one-on-one.</p>
        </div>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link href="/labs" className="rounded-full bg-primary px-5 py-2 text-primary-foreground text-sm font-medium hover:bg-primary/90 text-center">
            Explore labs
          </Link>
          <Link href="/contact" className="rounded-full border px-5 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary text-center">
            Contact us
          </Link>
        </div>
      </div>
    </div>
  );
}
