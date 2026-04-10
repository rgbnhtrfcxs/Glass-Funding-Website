import { motion } from "framer-motion";
import { ArrowUpRight, Building2, Globe2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useOrgs } from "@/context/OrgsContext";
import { getOrgHref } from "@/lib/orgPaths";

const typeLabel: Record<string, string> = {
  research_org: "Research organization",
  university: "University",
  hospital_network: "Hospital network",
  industry: "Industry",
  other: "Organization",
};

export default function Orgs() {
  const { orgs, isLoading, error, refresh } = useOrgs();
  const [searchTerm, setSearchTerm] = useState("");
  const [, setLocation] = useLocation();

  const visibleOrgs = useMemo(() => orgs.filter(org => org.isVisible !== false), [orgs]);

  const filteredOrgs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return visibleOrgs;
    return visibleOrgs.filter(org =>
      [
        org.name,
        org.slug,
        org.shortDescription,
        org.longDescription,
        org.orgType,
        ...org.members.map(member => [member.name, member.city, member.country].filter(Boolean).join(" ")),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [searchTerm, visibleOrgs]);

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
            Organizations
          </span>
          <h1 className="mt-4 text-4xl md:text-5xl font-semibold leading-tight">
            Browse the organizations behind labs, networks, and research programs.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Organizations give larger entities a shared public presence without taking control of individual member profiles.
          </p>
        </motion.div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filteredOrgs.length} of {visibleOrgs.length} organizations
          </div>
          <div className="relative w-full sm:w-80">
            <input
              type="search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search organizations, members, or labs"
              className="w-full rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <Building2 className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading organizations...</p>
        ) : error ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => refresh()}
              className="rounded-full border border-destructive/40 px-3 py-1 text-xs font-medium text-destructive"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredOrgs.map(org => {
              const members = org.members.slice(0, 3);
              return (
                <motion.div
                  key={org.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  whileHover={{ scale: 1.02 }}
                  className="group relative flex h-full min-h-[360px] cursor-pointer flex-col overflow-hidden rounded-3xl border border-border bg-card/80 shadow-sm"
                  role="link"
                  tabIndex={0}
                  onClick={() => setLocation(getOrgHref(org))}
                  onKeyDown={event => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setLocation(getOrgHref(org));
                  }}
                >
                  <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-white/80 via-white/70 to-emerald-100/80 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100" />
                  <div className="relative z-10 flex h-full flex-col p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
                          {org.logoUrl ? (
                            <img src={org.logoUrl} alt={org.name} className="h-full w-full object-cover" />
                          ) : (
                            <Building2 className="h-6 w-6 text-muted-foreground" />
                          )}
                        </span>
                        <div>
                          <p className="text-lg font-semibold text-foreground">{org.name}</p>
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {typeLabel[org.orgType] ?? "Organization"}
                          </p>
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                    </div>

                    {org.shortDescription && (
                      <p className="mt-4 text-sm text-muted-foreground line-clamp-3">
                        {org.shortDescription}
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        {org.members.length} members
                      </span>
                      {org.website && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                          <Globe2 className="h-3.5 w-3.5 text-primary" />
                          Website
                        </span>
                      )}
                    </div>

                    <div className="mt-auto pt-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Members
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {members.length > 0 ? members.map(member => (
                          <span key={member.id} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                            {member.name}
                          </span>
                        )) : (
                          <span className="text-sm text-muted-foreground">No members yet.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
