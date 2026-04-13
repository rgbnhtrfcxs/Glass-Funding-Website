import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Building2, Globe2, Linkedin, MapPin, Search, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { getLabHref } from "@/lib/labPaths";
import { getOrgHref } from "@/lib/orgPaths";
import type { Org, OrgLab } from "@shared/orgs";
import { MapboxMap, type MapMarker } from "@/components/maps/MapboxMap";
import { buildAddress, geocodeAddress, mapboxToken } from "@/lib/mapbox";

interface OrgDetailsProps {
  params: {
    identifier: string;
  };
}

const MEMBERS_PREVIEW_COUNT = 6;

const typeLabel: Record<string, string> = {
  research_org: "Research organization",
  university: "University",
  hospital_network: "Hospital network",
  industry: "Industry",
  other: "Organization",
};

const statusBadge: Record<string, { label: string; className: string } | undefined> = {
  premier: { label: "Premier", className: "bg-amber-500/10 text-amber-600 border border-amber-500/20" },
  verified_active: { label: "Verified", className: "bg-primary/10 text-primary border border-primary/20" },
  verified_passive: { label: "Verified", className: "bg-primary/10 text-primary border border-primary/20" },
};

function MemberCard({ member }: { member: OrgLab }) {
  const badge = member.labStatus ? statusBadge[member.labStatus] : undefined;
  return (
    <Link
      href={getLabHref(member)}
      className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-sm transition hover:border-primary group"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
          {member.logoUrl ? (
            <img src={member.logoUrl} alt={member.name} className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-medium text-foreground">{member.name}</p>
            {badge && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
          {(member.city || member.country) && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              {[member.city, member.country].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      </div>
      <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  );
}

function AllMembersModal({
  members,
  orgName,
  onClose,
}: {
  members: OrgLab[];
  orgName: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter(m =>
      [m.name, m.city, m.country]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [members, search]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-2xl flex-col rounded-3xl border border-border bg-background shadow-2xl" style={{ maxHeight: "85vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">All members</h3>
            <p className="text-xs text-muted-foreground">{orgName} · {members.length} lab{members.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Search */}
        <div className="border-b border-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by name, city, or country…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-4 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No labs match your search.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {filtered.map(member => (
                <MemberCard key={member.id} member={member} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrgDetails({ params }: OrgDetailsProps) {
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const geocodeCache = useRef(new Map<number, MapMarker>());

  useEffect(() => {
    let active = true;
    async function loadOrg() {
      setLoading(true);
      try {
        const res = await fetch(`/api/orgs/${params.identifier}`);
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message || "Unable to load organization");
        }
        const data = (await res.json()) as Org;
        if (active) {
          setOrg(data);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load organization");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadOrg();
    return () => { active = false; };
  }, [params.identifier]);

  useEffect(() => {
    if (typeof window === "undefined" || !org?.slug) return;
    if (params.identifier === org.slug || params.identifier !== String(org.id)) return;
    window.history.replaceState({}, "", `${getOrgHref(org)}${window.location.search}${window.location.hash}`);
  }, [org?.id, org?.slug, params.identifier]);

  // Geocode member labs to build map markers
  useEffect(() => {
    if (!org || org.members.length === 0 || !mapboxToken) return;
    let active = true;
    setMapLoading(true);

    void (async () => {
      const markerBuckets = new Map<string, MapMarker>();

      for (const member of org.members) {
        const address = buildAddress([member.city, member.country]);
        if (!address) continue;

        let point = geocodeCache.current.get(member.id)
          ? { lat: geocodeCache.current.get(member.id)!.lat, lng: geocodeCache.current.get(member.id)!.lng }
          : await geocodeAddress(address);

        if (!point || !active) break;

        const markerEntry: MapMarker = geocodeCache.current.get(member.id) ?? {
          id: member.id,
          ...point,
          label: member.name,
          subtitle: [member.city, member.country].filter(Boolean).join(", "),
          href: getLabHref(member),
          imageUrl: member.logoUrl ?? undefined,
        };
        if (!geocodeCache.current.has(member.id)) {
          geocodeCache.current.set(member.id, markerEntry);
        }

        const key = `${markerEntry.lat.toFixed(4)}|${markerEntry.lng.toFixed(4)}`;
        const bucket = markerBuckets.get(key);
        const item = {
          id: member.id,
          label: member.name,
          subtitle: [member.city, member.country].filter(Boolean).join(", "),
          href: getLabHref(member),
          imageUrl: member.logoUrl ?? undefined,
        };
        if (bucket) {
          bucket.items = bucket.items ?? [];
          bucket.items.push(item);
        } else {
          markerBuckets.set(key, { ...markerEntry, items: [item] });
        }
      }

      if (!active) return;

      const nextMarkers: MapMarker[] = [];
      markerBuckets.forEach(bucket => {
        if ((bucket.items?.length ?? 0) > 1) {
          bucket.label = `${bucket.items!.length} labs`;
          bucket.subtitle = "Same city";
          bucket.imageUrl = undefined;
          bucket.href = undefined;
        } else if (bucket.items?.length === 1) {
          const [single] = bucket.items;
          bucket.label = single.label;
          bucket.subtitle = single.subtitle;
          bucket.imageUrl = single.imageUrl;
          bucket.href = single.href;
        }
        nextMarkers.push(bucket);
      });

      setMapMarkers(nextMarkers);
      setMapLoading(false);
    })();

    return () => { active = false; };
  }, [org]);

  if (loading) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-20 lg:py-24">
          <p className="text-sm text-muted-foreground">Loading organization...</p>
        </div>
      </section>
    );
  }

  if (error || !org) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-20 lg:py-24">
          <p className="text-sm text-destructive">{error || "Organization not found."}</p>
        </div>
      </section>
    );
  }

  const uniqueCountries = [...new Set(org.members.map(m => m.country).filter(Boolean))];
  const previewMembers = org.members.slice(0, MEMBERS_PREVIEW_COUNT);
  const hasMore = org.members.length > MEMBERS_PREVIEW_COUNT;

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto max-w-5xl px-4 py-12 lg:py-16">
        <Link href="/orgs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" />
          Back to organizations
        </Link>

        {/* Header */}
        <div className="mt-6 rounded-3xl border border-border bg-card/70 p-6 lg:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="min-w-0 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {typeLabel[org.orgType] ?? "Organization"}
                </span>
              </div>
              <h1 className="text-3xl font-semibold text-foreground md:text-4xl">{org.name}</h1>
              {org.shortDescription && (
                <p className="max-w-2xl text-base text-muted-foreground">{org.shortDescription}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {org.website && (
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
                  >
                    <Globe2 className="h-3.5 w-3.5" />
                    Website
                  </a>
                )}
                {org.linkedin && (
                  <a
                    href={org.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
                  >
                    <Linkedin className="h-3.5 w-3.5" />
                    LinkedIn
                  </a>
                )}
              </div>
            </motion.div>

            <div className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-3xl border border-border bg-background/80 shadow-sm">
              {org.logoUrl ? (
                <img src={org.logoUrl} alt={org.name} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Building2 className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* Stats bar */}
          {org.members.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-6 border-t border-border pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{org.members.length}</span>
                <span className="text-sm text-muted-foreground">member lab{org.members.length !== 1 ? "s" : ""}</span>
              </div>
              {uniqueCountries.length > 0 && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{uniqueCountries.length}</span>
                  <span className="text-sm text-muted-foreground">{uniqueCountries.length === 1 ? "country" : "countries"}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* About */}
        {org.longDescription && (
          <div className="mt-6 rounded-3xl border border-border bg-card/70 p-6">
            <h2 className="text-lg font-semibold text-foreground">About this organization</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {org.longDescription}
            </p>
          </div>
        )}

        {/* Map */}
        {org.members.length > 0 && mapboxToken && (
          <div className="mt-6 overflow-hidden rounded-3xl border border-border">
            {mapLoading && mapMarkers.length === 0 ? (
              <div className="flex h-72 items-center justify-center bg-card/70">
                <p className="text-sm text-muted-foreground">Loading map…</p>
              </div>
            ) : (
              <MapboxMap
                markers={mapMarkers}
                className="h-72 w-full"
                zoom={4}
                showNavigation
                navigationVariant="glass-pill"
                showPopups
              />
            )}
          </div>
        )}

        {/* Members */}
        <section className="mt-6 rounded-3xl border border-border bg-card/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Member labs</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Research labs and groups affiliated with this organization.
              </p>
            </div>
            {hasMore && (
              <button
                type="button"
                onClick={() => setShowAllMembers(true)}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                View all {org.members.length}
                <ArrowUpRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {org.members.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No members listed yet.</p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {previewMembers.map(member => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </div>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setShowAllMembers(true)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  <Users className="h-4 w-4" />
                  Show {org.members.length - MEMBERS_PREVIEW_COUNT} more lab{org.members.length - MEMBERS_PREVIEW_COUNT !== 1 ? "s" : ""}
                </button>
              )}
            </>
          )}
        </section>
      </div>

      {showAllMembers && (
        <AllMembersModal
          members={org.members}
          orgName={org.name}
          onClose={() => setShowAllMembers(false)}
        />
      )}
    </section>
  );
}
