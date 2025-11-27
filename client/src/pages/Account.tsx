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
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export default function Account() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        .select("user_id,email,display_name,name,role,subscription_status,avatar_url,created_at,updated_at")
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
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground">{displayLabel}</h1>
              <p className="text-xs md:text-sm text-muted-foreground">View your account details and status.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/account/edit">
              <a className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-primary hover:border-primary">
                Edit account
              </a>
            </Link>
            {profile && (profile.role === 'lab' || profile.role === 'admin') && (
              <Link href="/lab/manage">
                <a className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                  Manage lab
                </a>
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          {authLoading || loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !profile ? (
            <p className="text-sm text-muted-foreground">No profile found yet. Click Edit account to create it.</p>
          ) : (
            <div className="grid gap-3 text-sm text-foreground">
              <Row label="Name" value={profile.name || "—"} />
              <Row label="Display name" value={profile.display_name || "—"} />
              <Row label="Email" value={profile.email || user?.email || "—"} />
              <Row label="Role" value={profile.role || "—"} />
              <Row label="Subscription" value={profile.subscription_status || "—"} />
              {profile.created_at && <Row label="Created" value={new Date(profile.created_at).toLocaleString()} />}
              {profile.updated_at && <Row label="Updated" value={new Date(profile.updated_at).toLocaleString()} />}
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
