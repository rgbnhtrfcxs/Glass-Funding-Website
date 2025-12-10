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
import { useMemo, useState, useEffect } from "react";
import { useLabs } from "@/context/LabsContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

export default function Labs() {
  const { labs, isLoading, error, refresh } = useLabs();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  const visibleLabs = useMemo(() => labs.filter(lab => lab.isVisible !== false), [labs]);
  const labCount = visibleLabs.length;
  const verifiedCount = visibleLabs.filter(lab => lab.isVerified).length;
  const uniqueEquipmentCount = useMemo(() => {
    const equipment = new Set<string>();
    visibleLabs.forEach(lab => {
      lab.equipment.forEach(item => equipment.add(item.toLowerCase()));
    });
    return equipment.size;
  }, [visibleLabs]);
  const getImageUrl = (url: string, width = 1200) =>
    url.startsWith("data:")
      ? url
      : `${url}${url.includes("?") ? "&" : "?"}auto=format&fit=crop&w=${width}&q=${width >= 1600 ? 80 : 75}`;
  useEffect(() => {
    let active = true;
    async function loadFavorites() {
      if (!user) {
        setFavorites(new Set());
        return;
      }
      try {
        setFavoritesLoading(true);
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) {
          setFavorites(new Set());
          return;
        }
        const res = await fetch("/api/favorites", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Unable to load favorites");
        const payload = await res.json();
        if (active) setFavorites(new Set((payload.labIds as number[]) ?? []));
      } catch (err: any) {
        if (active) setFavoritesError(err.message || "Unable to load favorites");
      } finally {
        if (active) setFavoritesLoading(false);
      }
    }
    loadFavorites();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const toggleFavorite = async (labId: number) => {
    if (!user) {
      setFavoritesError("Sign in to favorite labs.");
      return;
    }
    setFavoritesError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Please sign in again.");
      const isFav = favorites.has(labId);
      const method = isFav ? "DELETE" : "POST";
      const res = await fetch(`/api/labs/${labId}/favorite`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Unable to update favorite");
      }
      setFavorites(prev => {
        const next = new Set(prev);
        if (isFav) next.delete(labId);
        else next.add(labId);
        return next;
      });
    } catch (err: any) {
      setFavoritesError(err.message || "Unable to update favorite");
    }
  };

  const tierValue = (lab: any) => ((lab?.subscriptionTier ?? lab?.subscription_tier ?? "base") as string).toLowerCase();
  const filteredLabs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let subset = term
      ? visibleLabs.filter(lab => {
          const haystack = [lab.name, lab.location, lab.equipment.join(" "), lab.focusAreas.join(" ")]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(term);
        })
      : visibleLabs;
    if (verifiedOnly) {
      subset = subset.filter(lab => {
        const isVerified = lab.isVerified === true || lab.isVerified === "true" || lab.isVerified === 1;
        const tier = tierValue(lab);
        const isPending = !isVerified && tier !== "base";
        return isVerified || isPending;
      });
    }
    if (favoritesOnly) {
      subset = subset.filter(lab => favorites.has(lab.id));
    }
    return [...subset].sort((a, b) => {
      const aPremium = tierValue(a) === "premier";
      const bPremium = tierValue(b) === "premier";
      if (aPremium === bPremium) return 0;
      return aPremium ? -1 : 1;
    });
  }, [visibleLabs, searchTerm, favoritesOnly, favorites, verifiedOnly]);
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="search"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search labs by name or location"
                className="w-full rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <MapPin className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            {user && (
              <button
                type="button"
                onClick={() => setFavoritesOnly(prev => !prev)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  favoritesOnly
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}
                disabled={favoritesLoading}
              >
                {favoritesOnly ? "Showing favorites" : "Show favorites"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setVerifiedOnly(prev => !prev)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                verifiedOnly
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              {verifiedOnly ? "GLASS verified only" : "Include unverified"}
            </button>
          </div>
        </div>
        {favoritesError && <p className="mt-2 text-xs text-destructive">{favoritesError}</p>}

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
              {filteredLabs.map((lab, index) => {
                const tier = (lab as any).subscriptionTier ?? (lab as any).subscription_tier ?? "base";
                const tierLower = (tier as string).toLowerCase();
                const isPremier = ["premier", "custom"].includes(tierLower);
                const status = lab.isVerified ? "verified" : tierLower === "base" ? "unverified" : "pending";
                const offersLabSpace = ["true", "1", true, 1].includes(lab.offersLabSpace as any);
                const badgeClass =
                  status === "verified"
                    ? "bg-emerald-50 text-emerald-700"
                    : status === "pending"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-700";
                const badgeLabel = status === "verified" ? "Verified" : status === "pending" ? "Verification pending" : "Unverified";
                return (
                  <motion.div
                    key={lab.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 * (index % 3) }}
                    className={`flex h-full flex-col rounded-3xl border ${
                      isPremier ? "border-2 border-primary/80 shadow-lg" : "border-border"
                    } bg-card/80 p-8`}
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

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {(lab.logoUrl || ["premier", "custom"].includes(tierLower)) && (
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
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}
                        >
                          {status === "verified" ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {badgeLabel}
                              </>
                            ) : status === "pending" ? (
                              <>
                                <ShieldAlert className="h-3.5 w-3.5" />
                                {badgeLabel}
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="h-3.5 w-3.5" />
                                {badgeLabel}
                              </>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleFavorite(lab.id)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                              favorites.has(lab.id)
                                ? "border-red-500 bg-red-50 text-red-500"
                                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                            }`}
                            aria-label={favorites.has(lab.id) ? "Unfavorite lab" : "Favorite lab"}
                            disabled={favoritesLoading}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill={favorites.has(lab.id) ? "currentColor" : "none"}
                              stroke="currentColor"
                              strokeWidth="2"
                              className="h-4 w-4"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 21s-6.5-4.35-9-8.5C1 7.5 3.5 4 7 4c1.9 0 3.2 1.2 4 2.4C11.8 5.2 13.1 4 15 4c3.5 0 6 3.5 4 8.5-2.5 4.15-9 8.5-9 8.5Z"
                              />
                            </svg>
                          </button>
                        </div>
                        {offersLabSpace && (
                          <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium bg-primary/10 text-primary">
                            Offers lab space
                          </span>
                        )}
                      </div>
                    </div>

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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
