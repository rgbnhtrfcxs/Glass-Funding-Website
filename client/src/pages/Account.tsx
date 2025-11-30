import { motion } from "framer-motion";
import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Profile = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  name: string | null;
  role: string | null;
  subscription_status: string | null;
  subscription_tier?: string | null;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export default function Account() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labsLoading, setLabsLoading] = useState(false);
  const [labStats, setLabStats] = useState<
    Array<{
      id: number;
      name: string;
      subscriptionTier?: string | null;
      isVisible?: boolean | null;
      views7d: number;
      views30d: number;
      favorites: number;
    }>
  >([]);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [collabCount, setCollabCount] = useState<number>(0);
  const [contactCount, setContactCount] = useState<number>(0);

  const displayLabel = useMemo(() => {
    return profile?.display_name || profile?.name || user?.email || "Your Account";
  }, [profile?.display_name, profile?.name, user?.email]);

  const initials = useMemo(() => {
    const from = profile?.display_name || profile?.name || user?.email || "?";
    const parts = from.replace(/@.*/, "").trim().split(/\s+/);
    const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0][0];
    return letters.toUpperCase();
  }, [profile?.display_name, profile?.name, user?.email]);

  useEffect(() => {
    async function load() {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "user_id,email,display_name,name,role,subscription_status,subscription_tier,avatar_url,created_at,updated_at",
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        setError(error.message);
        setProfile(null);
      } else {
        setProfile((data as Profile) ?? null);
      }
      setLoading(false);
    }
    if (!authLoading) load();
  }, [authLoading, user?.id]);

  useEffect(() => {
    async function loadLabsAndFavorites() {
      if (!user) {
        setLabStats([]);
        return;
      }
      setLabsLoading(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const statsRes = await fetch("/api/my-labs/analytics", { headers });
        if (statsRes.ok) {
          const payload = await statsRes.json();
          setLabStats(payload?.labs ?? []);
          setAnalyticsError(null);
        } else {
          const txt = await statsRes.text();
          setAnalyticsError(txt || "Unable to load analytics");
        }

        // Requests counts (collaboration and contact)
        try {
          const reqRes = await fetch("/api/my-labs/requests", { headers });
          const ct = reqRes.headers.get("content-type") || "";
          if (reqRes.ok && ct.includes("application/json")) {
            const reqPayload = await reqRes.json();
            setCollabCount(Array.isArray(reqPayload?.collaborations) ? reqPayload.collaborations.length : 0);
            setContactCount(Array.isArray(reqPayload?.contacts) ? reqPayload.contacts.length : 0);
          }
        } catch {
          // ignore request count errors; not critical for dashboard
        }
      } catch (err: any) {
        setAnalyticsError(err.message || "Unable to load dashboard data");
      } finally {
        setLabsLoading(false);
      }
    }
    if (!authLoading) loadLabsAndFavorites();
  }, [authLoading, user?.id]);

  const tierLabel = (() => {
    const tier = profile?.subscription_tier?.toLowerCase?.() ?? "base";
    if (tier === "premier") return "Premier";
    if (tier === "verified") return "Verified";
    if (tier === "custom") return "Custom";
    return "Base";
  })();

  const labsVisibleCount = labStats.filter(l => l.isVisible !== false).length;
  const labsHiddenCount = labStats.filter(l => l.isVisible === false).length;
  const premiumLabs = labStats.filter(l => ["premier", "custom"].includes((l.subscriptionTier || "").toLowerCase()));
  const totalViews7d = labStats.reduce((sum, lab) => sum + (lab.views7d || 0), 0);
  const totalViews30d = labStats.reduce((sum, lab) => sum + (lab.views30d || 0), 0);
  const totalFavorites = labStats.reduce((sum, lab) => sum + (lab.favorites || 0), 0);
  const bestViewLab = labStats.reduce(
    (best, lab) => (lab.views30d > (best?.views30d ?? -1) ? lab : best),
    labStats.length ? labStats[0] : null,
  );
  const bestFavoriteLab = labStats.reduce(
    (best, lab) => (lab.favorites > (best?.favorites ?? -1) ? lab : best),
    labStats.length ? labStats[0] : null,
  );

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 lg:py-24 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayLabel} />
              <AvatarFallback className="text-base font-semibold bg-gradient-to-br from-indigo-500/20 to-pink-500/20 text-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground">{displayLabel}</h1>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {tierLabel}
                </span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">Your Glass profile overview.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/account/edit"
              className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-primary hover:border-primary"
            >
              Edit account
            </Link>
            <Link
              href="/requests"
              className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-primary hover:border-primary"
            >
              Requests
            </Link>
            {profile && (profile.role === "lab" || profile.role === "admin") && (
              <Link
                href="/lab/manage"
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Manage lab
              </Link>
            )}
            {profile && profile.role === "admin" && (
              <Link
                href="/admin/labs"
                className="inline-flex items-center justify-center rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
              >
                Admin labs
              </Link>
            )}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-8 rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Dashboard</p>
              <h2 className="text-xl font-semibold text-foreground">Your activity at a glance</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <CardStat label="Tier" value={tierLabel} hint={profile?.subscription_status || ""} />
            <CardStat label="Labs linked" value={labStats.length.toString()} hint={labsHiddenCount ? `${labsHiddenCount} hidden` : ""} />
            <CardStat label="Views (7d total)" value={totalViews7d.toString()} />
            <CardStat label="Views (30d total)" value={totalViews30d.toString()} />
            <CardStat label="Favorites total" value={totalFavorites.toString()} />
            <CardStat label="Collab requests" value={collabCount.toString()} />
            <CardStat label="Rent/contact requests" value={contactCount.toString()} />
            {analyticsError && (
              <div className="col-span-full rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {analyticsError}
              </div>
            )}
          </div>

          {labStats.length > 0 && (
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {bestViewLab && (
                <HighlightCard
                  title="Best performing"
                  subtitle="Most views (30d)"
                  primary={`${bestViewLab.views30d} views`}
                  secondary={bestViewLab.name}
                  badge={["premier", "custom"].includes((bestViewLab.subscriptionTier || "").toLowerCase()) ? "Premium" : undefined}
                />
              )}
              {bestFavoriteLab && (
                <HighlightCard
                  title="Most favorited"
                  subtitle="Total favorites"
                  primary={`${bestFavoriteLab.favorites} favorites`}
                  secondary={bestFavoriteLab.name}
                  badge={["premier", "custom"].includes((bestFavoriteLab.subscriptionTier || "").toLowerCase()) ? "Premium" : undefined}
                />
              )}
            </div>
          )}

          {labStats.length > 0 && (
            <div className="mt-8">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Linked labs</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {labStats.map(lab => {
                  const tier = (lab.subscriptionTier || "").toLowerCase();
                  const premium = tier === "premier" || tier === "custom";
                  return (
                    <div
                      key={lab.id}
                      className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{lab.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {premium ? "Premier/Custom" : tier ? tier : "Base"} • {lab.isVisible === false ? "Hidden" : "Visible"}
                          </p>
                        </div>
                        <Link href={`/lab/manage/${lab.id}`} className="text-xs font-medium text-primary hover:underline">
                          Manage
                        </Link>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="rounded-full border border-border px-2 py-1">7d views: {lab.views7d}</span>
                        <span className="rounded-full border border-border px-2 py-1">30d views: {lab.views30d}</span>
                        <span className="rounded-full border border-border px-2 py-1">Favorites: {lab.favorites}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 last:border-b-0">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function CardStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{hint}</p> : null}
    </div>
  );
}

function HighlightCard({
  title,
  subtitle,
  primary,
  secondary,
  badge,
}: {
  title: string;
  subtitle: string;
  primary: string;
  secondary: string;
  badge?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {badge ? <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">{badge}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{primary}</p>
      <p className="text-sm text-muted-foreground truncate">{secondary}</p>
    </div>
  );
}
