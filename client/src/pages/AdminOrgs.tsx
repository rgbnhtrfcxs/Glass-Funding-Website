import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Building2, Edit2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { Org } from "@shared/orgs";

type VisibilityFilter = "all" | "visible" | "hidden";

export default function AdminOrgs() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadOrgs = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch("/api/orgs?includeHidden=true", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Unable to load organizations");
      }
      const data = (await res.json()) as Org[];
      setOrgs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load organizations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrgs();
  }, []);

  const filteredOrgs = useMemo(() => {
    return orgs.filter(org => {
      if (visibilityFilter === "visible" && org.isVisible === false) return false;
      if (visibilityFilter === "hidden" && org.isVisible !== false) return false;
      return true;
    });
  }, [orgs, visibilityFilter]);

  const visibleCount = orgs.filter(org => org.isVisible !== false).length;
  const hiddenCount = orgs.filter(org => org.isVisible === false).length;

  const toggleVisibility = async (org: Org) => {
    setSavingId(org.id);
    setError(null);
    setSuccess(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(`/api/orgs/${org.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isVisible: org.isVisible === false }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Unable to update organization visibility");
      }
      const updated = (await res.json()) as Org;
      setOrgs(prev => prev.map(entry => (entry.id === updated.id ? updated : entry)));
      setSuccess(`${updated.name} is now ${updated.isVisible === false ? "hidden" : "visible"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update organization visibility");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-20 lg:py-24 space-y-8">
        <div className="space-y-4">
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Back to admin
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Admin</span>
              <h1 className="mt-2 text-2xl font-semibold text-foreground">Organizations</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Review org profiles and control whether they are publicly visible.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-border bg-card px-4 py-2 text-foreground">
                {orgs.length} total
              </span>
              <span className="rounded-full border border-border bg-card px-4 py-2 text-foreground">
                {visibleCount} visible
              </span>
              <span className="rounded-full border border-border bg-card px-4 py-2 text-foreground">
                {hiddenCount} hidden
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "visible", "hidden"] as const).map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setVisibilityFilter(option)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                visibilityFilter === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}

        <div className="grid gap-4">
          {loading ? (
            <div className="rounded-3xl border border-border bg-card/80 p-8 text-sm text-muted-foreground">
              Loading organizations…
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card/80 p-8 text-sm text-muted-foreground">
              No organizations match this filter yet.
            </div>
          ) : (
            filteredOrgs.map(org => (
              <div key={org.id} className="rounded-3xl border border-border bg-card/80 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
                      {org.logoUrl ? (
                        <img src={org.logoUrl} alt={org.name} className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-foreground">{org.name}</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          org.isVisible === false ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {org.isVisible === false ? "Hidden" : "Visible"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">Slug: {org.slug}</p>
                      {org.shortDescription && (
                        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{org.shortDescription}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border border-border px-3 py-1">
                          {(org.orgType || "research_org").replace(/_/g, " ")}
                        </span>
                        <span className="rounded-full border border-border px-3 py-1">
                          {org.members.length} member{org.members.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/org/manage/${org.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                    >
                      <Edit2 className="h-4 w-4" />
                      Open editor
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleVisibility(org)}
                      disabled={savingId === org.id}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                    >
                      {org.isVisible === false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      {savingId === org.id
                        ? "Saving..."
                        : org.isVisible === false
                          ? "Make visible"
                          : "Hide org"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
