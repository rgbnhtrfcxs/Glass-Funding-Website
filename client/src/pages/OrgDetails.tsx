import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Building2, Globe2, Linkedin, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { getLabHref } from "@/lib/labPaths";
import { getOrgHref } from "@/lib/orgPaths";
import type { Org } from "@shared/orgs";

interface OrgDetailsProps {
  params: {
    identifier: string;
  };
}

const typeLabel: Record<string, string> = {
  research_org: "Research organization",
  university: "University",
  hospital_network: "Hospital network",
  industry: "Industry",
  other: "Organization",
};

export default function OrgDetails({ params }: OrgDetailsProps) {
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    return () => {
      active = false;
    };
  }, [params.identifier]);

  useEffect(() => {
    if (typeof window === "undefined" || !org?.slug) return;
    if (params.identifier === org.slug || params.identifier !== String(org.id)) return;
    window.history.replaceState({}, "", `${getOrgHref(org)}${window.location.search}${window.location.hash}`);
  }, [org?.id, org?.slug, params.identifier]);

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

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-12 lg:py-16">
        <Link href="/orgs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" />
          Back to organizations
        </Link>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-3"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-semibold text-foreground">{org.name}</h1>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {typeLabel[org.orgType] ?? "Organization"}
              </span>
            </div>
            {org.shortDescription && (
              <p className="max-w-2xl text-base text-muted-foreground">{org.shortDescription}</p>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4 text-primary" />
                {org.members.length} members
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
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
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  LinkedIn
                </a>
              )}
            </div>
          </motion.div>

          <div className="h-32 w-32 overflow-hidden rounded-3xl border border-border bg-background/80">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {org.longDescription && (
          <div className="mt-8 rounded-3xl border border-border bg-card/70 p-6">
            <h2 className="text-lg font-semibold text-foreground">About this organization</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {org.longDescription}
            </p>
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-border bg-card/70 p-6">
            <h2 className="text-lg font-semibold text-foreground">Members</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Labs associated with this organization.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {org.members.length > 0 ? org.members.map(member => (
                <Link
                  href={getLabHref(member)}
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-sm transition hover:border-primary"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-background">
                      {member.logoUrl ? (
                        <img src={member.logoUrl} alt={member.name} className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{[member.city, member.country].filter(Boolean).join(", ") || "Location not set"}</p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              )) : (
                <p className="text-sm text-muted-foreground">No members listed yet.</p>
              )}
            </div>
        </section>
      </div>
    </section>
  );
}
