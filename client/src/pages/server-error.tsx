import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";

export default function ServerError() {
  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 pt-28 pb-20 flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          500 error
        </span>
        <AlertTriangle className="mt-6 h-12 w-12 text-amber-500" />
        <h1 className="mt-4 text-4xl md:text-5xl font-semibold text-foreground max-w-3xl">
          Something went wrong on our side.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground leading-relaxed">
          We&apos;re already looking into it. Refresh the page to try again, or head back to a safe spot while we resolve the
          issue.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
          >
            Retry
          </button>
          <Link href="/status">
            <a className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-2 text-sm font-medium text-foreground hover:text-primary transition">
              View system status
            </a>
          </Link>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          If the problem continues, email{" "}
          <a className="text-primary hover:text-primary/80 transition" href="mailto:support@glass.org">
            support@glass.org
          </a>{" "}
          with a screenshot and we&apos;ll help out.
        </p>
      </div>
    </section>
  );
}
