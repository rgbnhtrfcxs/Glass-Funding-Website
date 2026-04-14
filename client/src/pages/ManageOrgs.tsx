import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Building2, Globe2, Plus, Users } from "lucide-react";
import type { Org } from "@shared/orgs";

export default function ManageOrgs({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canManageOrgs, setCanManageOrgs] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const [orgRes, profileRes] = await Promise.all([
          fetch("/api/my-orgs", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
          supabase
            .from("profiles")
            .select("can_manage_orgs,is_admin")
            .eq("user_id", user?.id)
            .maybeSingle(),
        ]);
        if (!orgRes.ok) {
          const payload = await orgRes.json().catch(() => ({}));
          throw new Error(payload?.message || "Unable to load organizations");
        }
        const data = (await orgRes.json()) as Org[];
        if (!active) return;
        setOrgs(data ?? []);
        setCanManageOrgs(Boolean((profileRes.data as any)?.can_manage_orgs) || Boolean((profileRes.data as any)?.is_admin));
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load organizations");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const existingOrg = useMemo(() => orgs[0] ?? null, [orgs]);
  const sectionClass = embedded ? "bg-transparent" : "bg-background min-h-screen";
  const containerClass = embedded
    ? "w-full px-0 py-0"
    : "container mx-auto px-4 py-20 lg:py-24 max-w-5xl";

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-3xl font-semibold text-foreground">
              <Building2 className="h-5 w-5 text-primary" />
              Manage your organization
            </h1>
            <p className="text-sm text-muted-foreground">
              Edit your org profile, manage branding, and choose which labs appear as members.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading organization…</p>
        ) : error ? (
          <p className="mt-6 text-sm text-destructive">{error}</p>
        ) : (
          <div className={`mt-8 grid gap-6 ${existingOrg ? "" : "md:grid-cols-2"}`}>
            {!existingOrg && (
              <motion.div
                key="add-org"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex h-full flex-col overflow-hidden rounded-3xl border border-dashed border-border bg-card/60 shadow-sm"
              >
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Plus className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Create an organization</h3>
                  <p className="text-sm text-muted-foreground">
                    {canManageOrgs
                      ? "Set up an org profile with branding, member labs, and public details."
                      : "This account does not currently have permission to manage organizations."}
                  </p>
                </div>
                <div className="p-4">
                  {canManageOrgs ? (
                    <Link
                      href="/org/manage/new"
                      className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                      Create org
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex w-full items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground opacity-70"
                    >
                      Permission required
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {existingOrg && (
              <motion.div
                key={existingOrg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card/80 shadow-sm"
              >
                {existingOrg.logoUrl && (
                  <div className="h-36 w-full overflow-hidden border-b border-border/60 bg-background/40 p-4">
                    <img src={existingOrg.logoUrl} alt={existingOrg.name} className="h-full w-full object-contain" />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{existingOrg.name}</h2>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {existingOrg.orgType.replace(/_/g, " ")}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${existingOrg.isVisible === false ? "bg-amber-100 text-amber-800" : "bg-primary/10 text-primary"}`}>
                      {existingOrg.isVisible === false ? "Hidden" : "Visible"}
                    </span>
                  </div>
                  {existingOrg.shortDescription && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{existingOrg.shortDescription}</p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      {existingOrg.members.length} members
                    </span>
                    {existingOrg.website && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                        <Globe2 className="h-3.5 w-3.5 text-primary" />
                        Website
                      </span>
                    )}
                  </div>
                  <div className="pt-2">
                    <Link
                      href={`/org/manage/${existingOrg.id}`}
                      className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
