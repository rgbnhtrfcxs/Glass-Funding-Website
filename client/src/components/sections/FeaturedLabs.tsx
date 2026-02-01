import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { MapPin, ShieldCheck, Sparkles } from "lucide-react";

type LabAsset = { url: string; name?: string };
type LabItem = {
  id: number;
  name: string;
  city?: string | null;
  country?: string | null;
  labStatus?: string | null;
  lab_status?: string | null;
  isVisible?: boolean | null;
  logoUrl?: string | null;
  photos?: LabAsset[];
};

interface FeaturedLabsProps {
  title?: string;
  description?: string;
  className?: string;
}

export function FeaturedLabs({ title = "Featured labs", description, className = "" }: FeaturedLabsProps) {
  const [labs, setLabs] = useState<LabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/labs");
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || !ct.includes("application/json")) {
          await res.text();
          throw new Error("Unable to load labs");
        }
        const payload = await res.json();
        if (active) setLabs(Array.isArray(payload) ? payload : []);
      } catch (err: any) {
        if (active) setError(err?.message || "Unable to load labs");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const featured = useMemo(() => {
    return labs.filter(l => {
      const status = (l.labStatus ?? l.lab_status ?? "listed")?.toLowerCase?.() || "listed";
      return status === "premier" && l.isVisible !== false;
    });
  }, [labs]);

  return (
    <section className={`rounded-3xl border border-border bg-card/80 p-6 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Featured</p>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">Loading featured labs…</div>
      )}
      {error && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-full">
            {featured.length === 0 && (
              <div className="min-w-[260px] rounded-2xl border border-dashed border-border bg-background/60 px-4 py-4 text-sm text-muted-foreground">
                No featured labs yet. Check back soon.
              </div>
            )}
            {featured.map(lab => {
              const status = (lab.labStatus ?? lab.lab_status ?? "listed")?.toLowerCase?.() || "listed";
              const image = lab.logoUrl || lab.photos?.[0]?.url;
              return (
                <div
                  key={lab.id}
                  className="min-w-[260px] max-w-[280px] rounded-2xl border border-border bg-background/70 p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary capitalize">{status.replace("_", " ")}</span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Featured
                    </span>
                  </div>
                  {image && (
                    <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20">
                      <img src={image} alt={lab.name} className="h-32 w-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground line-clamp-2">{lab.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {[lab.city, lab.country].filter(Boolean).join(", ") || "Location not set"}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" />
                      Premier tier placement
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    Premium listing with GLASS support and top placement.
                  </p>
                  <Link
                    href={`/labs/${lab.id}`}
                    className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                  >
                    View lab
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
