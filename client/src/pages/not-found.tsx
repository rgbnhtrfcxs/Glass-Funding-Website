import { Link } from "wouter";
import { Search } from "lucide-react";

export default function NotFound() {
  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 pt-28 pb-20 flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          404 error
        </span>
        <h1 className="mt-6 text-4xl md:text-5xl font-semibold text-foreground max-w-3xl">
          Looks like this page drifted off the map.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground leading-relaxed">
          The link you followed might be broken or the content may have been moved. Try returning to the homepage or browse
          our available lab partners.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/">
            <a className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
              Back to homepage
            </a>
          </Link>
          <Link href="/labs">
            <a className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-2 text-sm font-medium text-foreground hover:text-primary transition">
              <Search className="h-4 w-4" />
              Browse labs
            </a>
          </Link>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Believe this is a mistake?{" "}
          <a className="text-primary hover:text-primary/80 transition" href="mailto:support@glass.org">
            Let us know
          </a>
          .
        </p>
      </div>
    </section>
  );
}
