import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Images,
  MapPin,
  Search,
  Heart,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { useMemo, useState, useEffect, useRef } from "react";
import { useLabs } from "@/context/LabsContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { MapboxMap, type MapMarker } from "@/components/maps/MapboxMap";
import { buildAddress, geocodeAddress, mapboxToken } from "@/lib/mapbox";

export default function Labs() {
  const { labs, isLoading, error, refresh } = useLabs();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapMissingLabs, setMapMissingLabs] = useState<string[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const uiStateRef = useRef({
    searchTerm: "",
    favoritesOnly: false,
    verifiedOnly: true,
    showMap: false,
  });
  const scrollYRef = useRef(0);
  const handleMapClose = () => setSelectedMarker(null);
  const geocodeCache = useRef(new Map<number, MapMarker>());
  const statusValue = (lab: any) => ((lab?.labStatus ?? "listed") as string).toLowerCase();
  const isVerifiedStatus = (status?: string | null) =>
    ["verified_passive", "verified_active", "premier"].includes((status || "").toLowerCase());
  const labsUiStorageKey = "labs-ui-state";
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map(part => part.trim()[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const visibleLabs = useMemo(() => labs.filter(lab => lab.isVisible !== false), [labs]);
  const labCount = visibleLabs.length;
  const verifiedCount = visibleLabs.filter(lab => isVerifiedStatus(lab.labStatus)).length;
  const formatLocation = (lab: { city?: string | null; country?: string | null }) =>
    [lab.city, lab.country].filter(Boolean).join(", ");
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
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(labsUiStorageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (typeof parsed.searchTerm === "string") setSearchTerm(parsed.searchTerm);
      if (typeof parsed.favoritesOnly === "boolean") setFavoritesOnly(parsed.favoritesOnly);
      if (typeof parsed.verifiedOnly === "boolean") setVerifiedOnly(parsed.verifiedOnly);
      if (typeof parsed.showMap === "boolean") setShowMap(parsed.showMap);
      if (typeof parsed.scrollY === "number") {
        requestAnimationFrame(() => window.scrollTo(0, parsed.scrollY));
      }
    } catch {
      // ignore bad storage payloads
    }
  }, []);

  useEffect(() => {
    uiStateRef.current = {
      searchTerm,
      favoritesOnly,
      verifiedOnly,
      showMap,
    };
  }, [searchTerm, favoritesOnly, verifiedOnly, showMap]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleScroll = () => {
      scrollYRef.current = window.scrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const saveUiState = () => {
    if (typeof window === "undefined") return;
    const payload = { ...uiStateRef.current, scrollY: scrollYRef.current };
    window.sessionStorage.setItem(labsUiStorageKey, JSON.stringify(payload));
  };

  useEffect(() => {
    saveUiState();
  }, [searchTerm, favoritesOnly, verifiedOnly, showMap]);

  useEffect(() => {
    return () => {
      saveUiState();
    };
  }, []);
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

  const filteredLabs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let subset = term
      ? visibleLabs.filter(lab => {
          const haystack = [
            lab.name,
            ...(lab.alternateNames ?? []),
            formatLocation(lab),
            lab.equipment.join(" "),
            lab.focusAreas.join(" "),
            (lab.tags ?? []).join(" "),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(term);
        })
      : visibleLabs;
    if (verifiedOnly) {
      subset = subset.filter(lab => {
        return isVerifiedStatus(statusValue(lab));
      });
    }
    if (favoritesOnly) {
      subset = subset.filter(lab => favorites.has(lab.id));
    }
    return [...subset].sort((a, b) => {
      const aPremium = statusValue(a) === "premier";
      const bPremium = statusValue(b) === "premier";
      if (aPremium === bPremium) return 0;
      return aPremium ? -1 : 1;
    });
  }, [visibleLabs, searchTerm, favoritesOnly, favorites, verifiedOnly]);
  // Potential future premium search: include labManager, focusAreas, equipment, offers.

  useEffect(() => {
    if (!showMap) return;
    if (!mapboxToken) {
      setMapMarkers([]);
      setMapError("Mapbox token missing. Add VITE_MAPBOX_TOKEN to enable maps.");
      return;
    }

    let active = true;
    const resolveLabs = async () => {
      setMapLoading(true);
      setMapError(null);

      const nextMarkers: MapMarker[] = [];
      const markerBuckets = new Map<string, MapMarker>();
      const missingLabs: string[] = [];
      for (const lab of filteredLabs) {
        const addressLabel =
          buildAddress([
            lab.addressLine1,
            lab.addressLine2,
            lab.city,
            lab.state,
            lab.postalCode,
            lab.country,
          ]) || formatLocation(lab) || "Address not set";
        const cached = geocodeCache.current.get(lab.id);
        if (cached) {
          const key = `${cached.lat.toFixed(5)}|${cached.lng.toFixed(5)}`;
          const bucket = markerBuckets.get(key);
          if (bucket) {
            bucket.items = bucket.items ?? [];
            bucket.items.push({
              id: lab.id,
              label: lab.name,
              subtitle: formatLocation(lab) || "Location not set",
              address: addressLabel,
              href: `/labs/${lab.id}`,
              imageUrl: lab.logoUrl ? getImageUrl(lab.logoUrl, 300) : undefined,
            });
          } else {
            markerBuckets.set(key, {
              ...cached,
              items: [
                {
                  id: lab.id,
                  label: lab.name,
                  subtitle: formatLocation(lab) || "Location not set",
                  address: addressLabel,
                  href: `/labs/${lab.id}`,
                  imageUrl: lab.logoUrl ? getImageUrl(lab.logoUrl, 300) : undefined,
                },
              ],
            });
          }
          continue;
        }

        const address = buildAddress([
          lab.addressLine1,
          lab.addressLine2,
          lab.city,
          lab.state,
          lab.postalCode,
          lab.country,
        ]);
        if (!address) {
          missingLabs.push(lab.name);
          continue;
        }

        const point = await geocodeAddress(address);
        if (!point) {
          missingLabs.push(lab.name);
          continue;
        }

        const marker = {
          id: lab.id,
          ...point,
          label: lab.name,
          subtitle: formatLocation(lab) || "Location not set",
          address: addressLabel,
          href: `/labs/${lab.id}`,
          imageUrl: lab.logoUrl ? getImageUrl(lab.logoUrl, 300) : undefined,
        };
        geocodeCache.current.set(lab.id, marker);
        const key = `${marker.lat.toFixed(5)}|${marker.lng.toFixed(5)}`;
        const bucket = markerBuckets.get(key);
        if (bucket) {
          bucket.items = bucket.items ?? [];
          bucket.items.push({
            id: lab.id,
            label: lab.name,
            subtitle: marker.subtitle,
            address: addressLabel,
            href: marker.href,
            imageUrl: marker.imageUrl,
          });
        } else {
          markerBuckets.set(key, {
            ...marker,
            items: [
              {
                id: lab.id,
                label: lab.name,
                subtitle: marker.subtitle,
                address: addressLabel,
                href: marker.href,
                imageUrl: marker.imageUrl,
              },
            ],
          });
        }
      }

      markerBuckets.forEach(value => {
        if (value.items && value.items.length > 1) {
          value.label = `${value.items.length} labs`;
          value.subtitle = "Shared address";
          value.imageUrl = undefined;
          value.href = undefined;
        } else if (value.items?.length === 1) {
          const [single] = value.items;
          value.label = single.label;
          value.subtitle = single.subtitle;
          value.imageUrl = single.imageUrl;
          value.href = single.href;
        }
        nextMarkers.push(value);
      });

      if (!active) return;
      if (nextMarkers.length === 0) {
        setMapError("No lab locations available yet.");
      }
      if (missingLabs.length > 0) {
        console.info("[Labs map] Missing/ungeocoded labs:", missingLabs);
      }
      setMapMarkers(nextMarkers);
      setMapMissingLabs(missingLabs);
      setMapLoading(false);
    };

    resolveLabs();
    return () => {
      active = false;
    };
  }, [filteredLabs, showMap]);

  useEffect(() => {
    if (!showMap) {
      setSelectedMarker(null);
    }
  }, [showMap]);

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12 lg:py-16">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMap(prev => !prev)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  showMap
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}
              >
                <MapPin className="h-4 w-4" />
                {showMap ? "Hide map" : "Show map"}
              </button>
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
                  <Heart className="h-4 w-4" />
                  {favoritesOnly ? "Showing favorites" : "Show favorites"}
                </button>
              )}
            </div>
            <div className="relative w-full sm:w-80">
              <input
                type="search"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search labs by name, city, or equipment"
                className="w-full rounded-full border border-border bg-card/80 pl-10 pr-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/70 p-1 w-fit">
              <button
                type="button"
                onClick={() => setVerifiedOnly(true)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  verifiedOnly
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                GLASS verified
              </button>
              <button
                type="button"
                onClick={() => setVerifiedOnly(false)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  !verifiedOnly
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Include unverified
              </button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground sm:ml-auto">
            Showing {filteredLabs.length} of {labCount} labs
          </div>
        </div>
        {favoritesError && <p className="mt-2 text-xs text-destructive">{favoritesError}</p>}
        {showMap && (
          <div className="mt-6 space-y-3">
            <div className="relative">
              <MapboxMap
                markers={mapMarkers}
                resizeKey={showMap}
                className="h-[520px] w-full rounded-3xl border border-border"
                interactive
                showPopups={false}
                onMarkerClick={marker => setSelectedMarker(marker)}
                onMapClick={handleMapClose}
              />
              <AnimatePresence mode="wait">
                {(selectedMarker?.items?.length ?? 0) > 0 && (
                  <motion.div
                    key={selectedMarker?.id ?? "marker"}
                    className="absolute left-4 top-4 bottom-4 w-80 max-w-[calc(100%-2rem)] labs-map-overlay"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <div className="h-full rounded-2xl border border-white/20 bg-white/55 p-2 shadow-lg backdrop-blur-xl">
                      <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.2em] text-muted-foreground">
                        <span>Labs at this location</span>
                        <div className="flex items-center gap-2">
                          <span>{selectedMarker?.items?.length} labs</span>
                          <button
                            type="button"
                            onClick={handleMapClose}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/70 text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition"
                            aria-label="Close list"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-3 overflow-y-auto pr-1 pb-1 max-h-[calc(100%-2rem)]">
                        {(selectedMarker?.items ?? []).map(item => (
                          <Link key={item.id} href={item.href ?? "#"}>
                          <a
                            className="group relative block w-full max-w-[300px] h-28 overflow-hidden rounded-xl border border-white/25 bg-white/20 transition-all duration-300 ease-out backdrop-blur-2xl mx-auto hover:border-white/70 hover:scale-[1.02]"
                            onClick={() => {
                              if (typeof window === "undefined") return;
                              window.sessionStorage.setItem("labs-return-target", "map");
                            }}
                          >
                              <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-sky-100/90 via-white/80 to-white/90 opacity-0 transition-opacity duration-500 ease-in-out group-hover:opacity-100" />
                            <div className="relative z-10 flex h-full flex-col px-3 pt-3 pb-3">
                              <div className="flex items-center gap-3">
                                {item.imageUrl && (
                                  <img
                                    src={item.imageUrl}
                                    alt={`${item.label} avatar`}
                                    className="h-11 w-11 rounded-full border border-border/60 object-cover"
                                    loading="lazy"
                                  />
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground break-words leading-snug">
                                    {item.label}
                                  </p>
                                </div>
                              </div>
                              <p className="mt-auto text-xs text-muted-foreground leading-snug">
                                {item.address || item.subtitle || "Address not set"}
                              </p>
                            </div>
                            </a>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {mapLoading && <p className="text-xs text-muted-foreground">Resolving lab locations…</p>}
            {mapError && <p className="text-xs text-muted-foreground">{mapError}</p>}
            {!mapLoading && !mapError && (
              <p className="text-xs text-muted-foreground">
                {mapMarkers.length} mapped, {mapMissingLabs.length} missing address or not found.
              </p>
            )}
            {mapMissingLabs.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Missing: {mapMissingLabs.join(", ")}
              </div>
            )}
          </div>
        )}

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
                const status = statusValue(lab);
                const isPremier = status === "premier";
                const isVerified = isVerifiedStatus(status);
                const hasAuditFlag = lab.auditPassed !== undefined && lab.auditPassed !== null;
                const auditPassed = ["true", true, 1, "1"].includes(lab.auditPassed as any);
                const isAuditPending = isVerified && hasAuditFlag && !auditPassed;
                const offersLabSpace = ["true", "1", true, 1].includes(lab.offersLabSpace as any);
                const badgeClass =
                  isAuditPending
                    ? "bg-amber-50 text-amber-700"
                    : isVerified
                    ? "bg-emerald-50 text-emerald-700"
                    : status === "confirmed"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-700";
                const badgeLabel = isAuditPending
                  ? "Pending"
                  : isVerified
                    ? "Verified"
                    : status === "confirmed"
                      ? "Confirmed"
                      : "Listed";
                return (
                  <motion.div
                    key={lab.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.5, delay: 0.1 * (index % 3), ease: "easeOut" }}
                    className={`group relative flex h-full flex-col rounded-3xl border overflow-hidden will-change-transform ${
                      isPremier ? "border-2 border-primary/80 shadow-lg" : "border-border"
                    } bg-card/80 p-8`}
                  >
                    <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-sky-100/80 via-white/70 to-pink-100/80 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100" />
                    <div className="relative z-10 flex h-full flex-col">
                    {lab.photos.length > 0 && (
                      <div className="relative mb-6 overflow-hidden rounded-2xl border border-border/60 bg-background/40">
                        <img
                          src={getImageUrl(lab.photos[0].url)}
                          alt={`${lab.name} preview - ${lab.photos[0].name}`}
                          className="h-48 w-full object-cover"
                          loading="lazy"
                        />
                        <span
                          className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}
                        >
                          {isVerified && !isAuditPending ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {badgeLabel}
                            </>
                          ) : (
                            <>
                              <ShieldAlert className="h-3.5 w-3.5" />
                              {badgeLabel}
                            </>
                          )}
                        </span>
                        {lab.logoUrl && (
                          <div className="absolute bottom-3 left-3 h-12 w-12 overflow-hidden rounded-full bg-white text-[11px] text-muted-foreground flex items-center justify-center ring-1 ring-white/80 shadow-sm">
                            {lab.logoUrl ? (
                              <img src={lab.logoUrl} alt={`${lab.name} logo`} className="h-full w-full object-cover" />
                            ) : (
                              "Logo"
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-xl font-semibold text-foreground">{lab.name}</h3>
                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span>{formatLocation(lab) || "Location not set"}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-right">
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
                  </div>
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
