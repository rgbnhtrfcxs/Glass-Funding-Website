import { Link } from "wouter";
import { Wrench } from "lucide-react";

export default function Maintenance() {
  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 pt-28 pb-20 flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Scheduled maintenance
        </span>
        <Wrench className="mt-6 h-12 w-12 text-primary" />
        <h1 className="mt-4 text-4xl md:text-5xl font-semibold text-foreground max-w-3xl">
          We&apos;re upgrading our systems to serve you better.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground leading-relaxed">
          The Glass platform is temporarily unavailable while we roll out new improvements. We expect to be back online by{" "}
          <span className="font-semibold text-foreground">18:00 UTC</span>. Your data and ongoing donations are safe.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/status">
            <a className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
              Track system status
            </a>
          </Link>
          <a
            href="mailto:support@glass.org"
            className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-2 text-sm font-medium text-foreground hover:text-primary transition"
          >
            Contact support
          </a>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Need an update for your team? We&apos;ll share real-time notices on{" "}
          <a className="text-primary hover:text-primary/80 transition" href="https://status.glass.org">
            status.glass.org
          </a>
          .
        </p>
      </div>
    </section>
  );
}
