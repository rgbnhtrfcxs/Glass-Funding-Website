import { motion } from "framer-motion";
import {
  CheckCircle2,
  Images,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { useLabs } from "@/context/LabsContext";

export default function Labs() {
  const { labs, isLoading, error, refresh } = useLabs();
  const [searchTerm, setSearchTerm] = useState("");

  const labCount = labs.length;
  const verifiedCount = labs.filter(lab => lab.isVerified).length;
  const uniqueEquipmentCount = useMemo(() => {
    const equipment = new Set<string>();
    labs.forEach(lab => {
      lab.equipment.forEach(item => equipment.add(item.toLowerCase()));
    });
    return equipment.size;
  }, [labs]);
  const getImageUrl = (url: string, width = 1200) =>
    url.startsWith("data:")
      ? url
      : `${url}${url.includes("?") ? "&" : "?"}auto=format&fit=crop&w=${width}&q=${width >= 1600 ? 80 : 75}`;
  const filteredLabs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return labs;
    return labs.filter(lab => {
      const haystack = [lab.name, lab.location].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [labs, searchTerm]);
  // Potential future premium search: include labManager, focusAreas, equipment, offers.

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <span className="text-sm uppercase tracking-[0.35em] text-muted-foreground">
            Partner Labs
          </span>
          <h1 className="mt-4 text-4xl md:text-5xl font-semibold leading-tight">
            Rent bench space inside vetted labs aligned with Glass.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Each partner lab lists core equipment, focus areas, and compliance posture so your team can
            spin up work quickly with the right infrastructure in place.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-10 flex flex-wrap items-start gap-4 md:gap-6"
        >
          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm flex-1 min-w-[240px] max-w-sm">
            <div className="flex items-center gap-3 justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">Network size</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{labCount} labs</p>
                <p className="mt-1 text-sm text-muted-foreground">Vetted partners with GLASS-Connect alignment.</p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm flex-1 min-w-[240px] max-w-sm">
            <div className="flex items-center gap-3 justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">Verified labs</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{verifiedCount} verified</p>
                <p className="mt-1 text-sm text-muted-foreground">Completed verification to boost trust and routing.</p>
              </div>
            </div>
          </div>
        </motion.div>

        <p className="mt-6 text-sm text-muted-foreground">
          Across the network you&apos;ll find {uniqueEquipmentCount}+ distinct pieces of specialized equipment,
          supporting a broad range of wet lab, fabrication, and analytics workflows.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filteredLabs.length} of {labCount} labs
          </div>
          <div className="relative w-full sm:w-80">
            <input
              type="search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search labs by name, city, focus, or equipment"
              className="w-full rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <MapPin className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {error && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>{error}</span>
            <button
              type="button"
              onClick={refresh}
              className="rounded-full border border-destructive/40 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em]"
            >
              Retry
            </button>
          </div>
        )}

        <div className="mt-12">
          {isLoading && labs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/70 p-10 text-center text-muted-foreground">
              Loading labs…
            </div>
          ) : labs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/70 p-10 text-center text-muted-foreground">
              {error
                ? "We couldn't load the lab directory. Please retry."
                : "No partner labs are available yet. Check back soon."}
            </div>
          ) : filteredLabs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/70 p-10 text-center text-muted-foreground">
              No labs match that search. Try a different name, city, or equipment keyword.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredLabs.map((lab, index) => (
                <motion.div
                  key={lab.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * (index % 3) }}
                  className="flex h-full flex-col rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
                >
                {lab.photos.length > 0 && (
                  <div className="mb-6 overflow-hidden rounded-2xl border border-border/60 bg-background/40">
                    <img
                      src={getImageUrl(lab.photos[0].url)}
                      alt={`${lab.name} preview - ${lab.photos[0].name}`}
                      className="h-48 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                {(() => {
                  const tier = (lab as any).subscriptionTier ?? (lab as any).subscription_tier ?? "base";
                  return (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {(lab.logoUrl || tier === "premier") && (
                          <div className="h-12 w-12 overflow-hidden rounded-full border border-dashed border-border bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-center flex-shrink-0">
                            {lab.logoUrl ? (
                              <img src={lab.logoUrl} alt={`${lab.name} logo`} className="h-full w-full object-cover" />
                            ) : (
                              "Logo"
                            )}
                          </div>
                        )}
                        <div>
                          <h3 className="text-xl font-semibold text-foreground">{lab.name}</h3>
                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span>{lab.location}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                            lab.isVerified
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {lab.isVerified ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Verified
                            </>
                          ) : (
                            <>
                              <ShieldAlert className="h-3.5 w-3.5" />
                              Pending
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                  <div className="mt-5 grid gap-4">
                    {lab.focusAreas.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Focus</h4>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {lab.focusAreas.slice(0, 3).map(area => (
                            <span
                              key={area}
                              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground"
                            >
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {lab.equipment.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Equipment</h4>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {lab.equipment.slice(0, 3).map(item => (
                            <span
                              key={item}
                              className="rounded-full bg-muted/60 px-3 py-1"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {lab.photos.length > 1 && (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
                          <Images className="h-3.5 w-3.5 text-primary" />
                          {lab.photos.length} photos provided
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link href={`/labs/${lab.id}`}>
                      <a className="inline-flex items-center justify-center rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary">
                        View details
                      </a>
                    </Link>
                    <a
                      href={`mailto:${lab.contactEmail}`}
                      className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                    >
                      Contact lab
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
