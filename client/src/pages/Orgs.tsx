import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ChevronDown,
  ExternalLink,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ORG_TYPES, type OrgType } from "@shared/organizations";

const ORG_TYPE_LABELS: Record<OrgType, string> = {
  research_org: "Research Organization",
  university: "University",
  hospital_network: "Hospital Network",
  industry: "Industry",
  other: "Organization",
};

type Organization = {
  id: number;
  slug: string;
  name: string;
  short_description: string | null;
  long_description: string | null;
  logo_url: string | null;
  website: string | null;
  linkedin: string | null;
  org_type: OrgType;
  is_visible: boolean;
  created_at: string;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getInitials = (name: string) =>
  name
    .split(" ")
    .map(part => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function Orgs() {
  const [, setLocation] = useLocation();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrgTypes, setSelectedOrgTypes] = useState<OrgType[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/organizations");
        if (!res.ok) throw new Error("Failed to load organizations");
        const data = await res.json();
        if (active) setOrgs(Array.isArray(data) ? data : (data.organizations ?? []));
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load organizations");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const normalizeSearchText = (value: string) =>
    value
      .toLowerCase()
      .replace(/[()/,-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const filteredOrgs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const normalizedTerm = normalizeSearchText(term);
    const matchesSearch = (value: string | null | undefined) => {
      if (!value) return false;
      const lower = value.toLowerCase();
      const normalized = normalizeSearchText(value);
      return lower.includes(term) || normalized.includes(normalizedTerm);
    };

    let subset = term
      ? orgs.filter(
          org =>
            matchesSearch(org.name) ||
            matchesSearch(org.short_description) ||
            matchesSearch(org.long_description) ||
            matchesSearch(ORG_TYPE_LABELS[org.org_type]),
        )
      : orgs;

    if (selectedOrgTypes.length > 0) {
      subset = subset.filter(org => selectedOrgTypes.includes(org.org_type));
    }

    return subset;
  }, [orgs, searchTerm, selectedOrgTypes]);

  const availableOrgTypes = useMemo(
    () => ORG_TYPES.filter(type => orgs.some(org => org.org_type === type)),
    [orgs],
  );

  const hasActiveFilters = selectedOrgTypes.length > 0;

  const highlightTokens = useMemo(() => {
    const tokens = normalizeSearchText(searchTerm)
      .split(" ")
      .map(t => t.trim())
      .filter(Boolean);
    return Array.from(new Set(tokens)).sort((a, b) => b.length - a.length);
  }, [searchTerm]);

  const highlightText = (text: string) => {
    if (!text || highlightTokens.length === 0) return text;
    const escaped = highlightTokens.map(escapeRegExp);
    const regex = new RegExp(`(${escaped.join("|")})`, "gi");
    return text.split(regex).map((part, i) => {
      const isToken = highlightTokens.some(t => t === part.toLowerCase());
      if (!isToken) return <span key={i}>{part}</span>;
      return (
        <mark key={i} className="rounded-sm bg-pink-200/80 px-0.5 text-pink-900">
          {part}
        </mark>
      );
    });
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"
        >
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
              Discover organizations in the Glass network.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Browse research organizations, universities, hospital networks, and industry partners
              across the Glass ecosystem.
            </p>
          </div>
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
                <p className="text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
                  Network size
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{orgs.length} orgs</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Partner organizations currently in the directory.
                </p>
              </div>
            </div>
          </div>
          {availableOrgTypes.length > 0 && (
            <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm flex-1 min-w-[240px] max-w-sm">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
                Types
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {availableOrgTypes.map(type => (
                  <span
                    key={type}
                    className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {ORG_TYPE_LABELS[type]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3" />
          <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center sm:gap-3">
            <div className="w-full sm:w-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`inline-flex w-full items-center justify-between gap-2 rounded-full border px-4 py-2 text-sm font-medium transition sm:w-auto ${
                      hasActiveFilters
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      Filter
                    </span>
                    {hasActiveFilters ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] leading-5">
                        {selectedOrgTypes.length}
                      </span>
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuLabel>Organization type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableOrgTypes.length > 0 ? (
                    availableOrgTypes.map(type => (
                      <DropdownMenuCheckboxItem
                        key={type}
                        checked={selectedOrgTypes.includes(type)}
                        onCheckedChange={checked => {
                          setSelectedOrgTypes(prev => {
                            if (checked) return prev.includes(type) ? prev : [...prev, type];
                            return prev.filter(t => t !== type);
                          });
                        }}
                        onSelect={event => event.preventDefault()}
                      >
                        {ORG_TYPE_LABELS[type]}
                      </DropdownMenuCheckboxItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>No types available</DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => setSelectedOrgTypes([])}
                    disabled={!hasActiveFilters}
                  >
                    Clear filters
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="relative w-full sm:w-80">
              <input
                type="search"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search organizations by name or type"
                className="w-full rounded-full border border-border bg-card/80 pl-10 pr-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIsLoading(true);
                fetch("/api/organizations")
                  .then(r => r.json())
                  .then(data => {
                    setOrgs(Array.isArray(data) ? data : (data.organizations ?? []));
                    setIsLoading(false);
                  })
                  .catch(err => {
                    setError(err.message || "Failed to load organizations");
                    setIsLoading(false);
                  });
              }}
              className="rounded-full border border-destructive/40 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em]"
            >
              Retry
            </button>
          </div>
        )}

        <div className="mt-12">
          {isLoading ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/70 p-10 text-center text-muted-foreground">
              Loading organizations…
            </div>
          ) : orgs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/70 p-10 text-center text-muted-foreground">
              {error
                ? "We couldn't load the organization directory. Please retry."
                : "No organizations are available yet. Check back soon."}
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/70 p-10 text-center text-muted-foreground">
              No organizations match that search. Try a different name or type.
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence>
                {filteredOrgs.map((org, index) => (
                  <motion.div
                    key={org.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.5, delay: 0.08 * (index % 3), ease: "easeOut" }}
                    className="group relative flex h-full flex-col rounded-3xl border border-border overflow-hidden will-change-transform cursor-pointer bg-card/80 p-8"
                    role="link"
                    tabIndex={0}
                    onClick={event => {
                      const target = event.target as HTMLElement;
                      if (target.closest("a") || target.closest("button")) return;
                      setLocation(`/orgs/${org.slug}`);
                    }}
                    onKeyDown={event => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setLocation(`/orgs/${org.slug}`);
                    }}
                  >
                    <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-sky-200/80 via-white/70 to-white/80 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100" />
                    <div className="relative z-10 flex h-full flex-col">
                      <div className="flex items-start gap-4">
                        {org.logo_url ? (
                          <img
                            src={org.logo_url}
                            alt={`${org.name} logo`}
                            className="h-14 w-14 rounded-2xl border border-border/60 object-cover flex-shrink-0 bg-white"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-2xl border border-border/60 bg-muted/60 flex items-center justify-center flex-shrink-0">
                            <span className="text-base font-semibold text-muted-foreground">
                              {getInitials(org.name)}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xl font-semibold text-foreground leading-snug">
                            {highlightTokens.length > 0
                              ? highlightText(org.name)
                              : org.name}
                          </h3>
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            {ORG_TYPE_LABELS[org.org_type] ?? org.org_type}
                          </span>
                        </div>
                      </div>

                      {org.short_description && (
                        <p className="mt-5 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                          {highlightTokens.length > 0
                            ? highlightText(org.short_description)
                            : org.short_description}
                        </p>
                      )}

                      <div className="mt-auto pt-6 flex items-center justify-between gap-3">
                        <Link
                          href={`/orgs/${org.slug}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                        >
                          View profile
                        </Link>
                        {org.website && (
                          <a
                            href={org.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Website
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
