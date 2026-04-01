import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Building2, Users, Beaker } from "lucide-react";
import { Link } from "wouter";

type OrgMember = {
  id: number;
  user_id: string;
  org_role: "member" | "manager" | "owner";
};

type OrgLab = {
  id: number;
  name: string;
  lab_status: string | null;
  lab_location: { city?: string; country?: string } | null;
  lab_profile: { logo_url?: string } | null;
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
  org_type: string;
  owner_user_id: string;
  is_visible: boolean;
  created_at: string;
  org_members: OrgMember[];
};

const ORG_TYPE_LABELS: Record<string, string> = {
  research_org: "Research Organization",
  university: "University",
  hospital_network: "Hospital Network",
  industry: "Industry",
  other: "Organization",
};

interface OrgProfileProps {
  params: { slug: string };
}

export default function OrgProfile({ params }: OrgProfileProps) {
  const { slug } = params;
  const [org, setOrg] = useState<Organization | null>(null);
  const [labs, setLabs] = useState<OrgLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/organizations/${slug}`);
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message || "Organization not found");
        }
        const data: Organization = await res.json();
        if (!active) return;
        setOrg(data);
        setError(null);

        const labsRes = await fetch(`/api/organizations/${data.id}/labs`);
        if (labsRes.ok && active) {
          setLabs(await labsRes.json());
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load organization");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [slug]);

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
          <p className="text-sm text-destructive">{error ?? "Organization not found."}</p>
          <Link href="/labs" className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Labs
          </Link>
        </div>
      </section>
    );
  }

  const visibleManagers = org.org_members.filter(
    (m) => m.org_role === "owner" || m.org_role === "manager",
  );

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12 lg:py-16 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Link href="/labs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="h-4 w-4" /> Back to Labs
          </Link>

          {/* Header */}
          <div className="flex flex-col sm:flex-row gap-6 items-start mb-10">
            {org.logo_url ? (
              <img
                src={org.logo_url}
                alt={org.name}
                className="h-20 w-20 rounded-xl object-contain border border-border bg-muted flex-shrink-0"
              />
            ) : (
              <div className="h-20 w-20 rounded-xl border border-border bg-muted flex items-center justify-center flex-shrink-0">
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
                <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                  {ORG_TYPE_LABELS[org.org_type] ?? org.org_type}
                </span>
              </div>
              {org.short_description && (
                <p className="text-sm text-muted-foreground mt-1 max-w-prose">{org.short_description}</p>
              )}
              <div className="flex flex-wrap gap-3 mt-3">
                {org.website && (
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Website <ArrowUpRight className="h-3 w-3" />
                  </a>
                )}
                {org.linkedin && (
                  <a
                    href={org.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    LinkedIn <ArrowUpRight className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Long description */}
          {org.long_description && (
            <div className="mb-10">
              <h2 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide">About</h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{org.long_description}</p>
            </div>
          )}

          {/* Affiliated labs */}
          <div className="mb-10">
            <h2 className="text-sm font-medium mb-4 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Beaker className="h-4 w-4" />
              Affiliated Labs ({labs.length})
            </h2>
            {labs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No labs affiliated yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {labs.map((lab) => (
                  <Link key={lab.id} href={`/labs/${lab.id}`}>
                    <div className="border border-border rounded-lg p-4 hover:border-foreground/20 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        {lab.lab_profile?.logo_url ? (
                          <img
                            src={lab.lab_profile.logo_url}
                            alt={lab.name}
                            className="h-8 w-8 rounded object-contain border border-border bg-muted flex-shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded border border-border bg-muted flex items-center justify-center flex-shrink-0">
                            <Beaker className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{lab.name}</p>
                          {lab.lab_location && (
                            <p className="text-xs text-muted-foreground truncate">
                              {[lab.lab_location.city, lab.lab_location.country].filter(Boolean).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Management team */}
          {visibleManagers.length > 0 && (
            <div>
              <h2 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Users className="h-4 w-4" />
                Management Team
              </h2>
              <div className="flex flex-wrap gap-2">
                {visibleManagers.map((m) => (
                  <span
                    key={m.id}
                    className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground capitalize"
                  >
                    {m.org_role}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
