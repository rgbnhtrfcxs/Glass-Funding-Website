import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useLabs } from "@/context/LabsContext";

export default function Favorites() {
  const { user } = useAuth();
  const { labs } = useLabs();
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadFavorites() {
      setLoading(true);
      setError(null);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch("/api/favorites", { headers });
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || !ct.includes("application/json")) {
          throw new Error("Unable to load favorites");
        }
        const payload = await res.json();
        const ids = Array.isArray(payload?.labIds) ? payload.labIds : [];
        if (active) {
          setFavoriteIds(ids.map((id: any) => Number(id)).filter((id: number) => !Number.isNaN(id)));
        }
      } catch (err: any) {
        if (active) setError(err.message || "Unable to load favorites");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (user) loadFavorites();
    else setLoading(false);
    return () => {
      active = false;
    };
  }, [user]);

  const favoriteLabs = useMemo(() => {
    return favoriteIds.length ? labs.filter(l => favoriteIds.includes(l.id)) : [];
  }, [favoriteIds, labs]);

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto max-w-5xl px-4 py-16 lg:py-20">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Favorites</p>
            <h1 className="text-2xl font-semibold text-foreground">Saved labs</h1>
            <p className="text-sm text-muted-foreground">Labs you have favorited for quick access.</p>
          </div>
          <Link
            href="/account"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            ← Back to account
          </Link>
        </div>

        <div className="mt-8">
          {loading && <div className="rounded-2xl border border-border bg-card/70 px-4 py-6 text-sm text-muted-foreground">Loading favorites…</div>}
          {error && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          )}
          {!loading && !error && favoriteLabs.length === 0 && (
            <div className="rounded-2xl border border-border bg-card/70 px-4 py-6 text-sm text-muted-foreground">
              You have no favorites yet. Browse labs and tap the heart to save them.
            </div>
          )}

          {favoriteLabs.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {favoriteLabs.map(lab => {
                const tier = (lab.subscriptionTier || lab.subscription_tier || "").toLowerCase();
                const premium = tier === "premier" || tier === "custom";
                return (
                  <div key={lab.id} className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{lab.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[lab.city, lab.country].filter(Boolean).join(", ") || "Location not set"}
                        </p>
                      </div>
                      {premium && (
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">Premium</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{lab.isVisible === false ? "Hidden" : "Visible"}</span>
                      <span className="font-medium text-primary">{tier ? tier : "base"}</span>
                    </div>
                    <Link
                      href={`/labs/${lab.id}`}
                      className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                      View lab
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
