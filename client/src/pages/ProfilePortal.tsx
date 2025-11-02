import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ProfilePortal() {
  const inputClasses =
    "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // Form state
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("");
  const [extra1, setExtra1] = useState("");
  const [extra2, setExtra2] = useState("");
  const [extra3, setExtra3] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      const user = supabase.auth.user();

      if (!user) {
        setProfileData(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching profile:", error.message);
        setProfileData(null);
      } else {
        setProfileData(data || null);

        // Populate form with existing data
        if (data) {
          setName(data.name || "");
          setOrganization(data.organization || "");
          setRole(data.role || "");
          setExtra1(data.extra1 || "");
          setExtra2(data.extra2 || "");
          setExtra3(data.extra3 || "");
        }
      }

      setLoading(false);
    }

    fetchProfile();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT") {
          setProfileData(null);
          setLocation("/");
        } else if (event === "SIGNED_IN") {
          fetchProfile();
        }
      }
    );

    return () => listener?.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleSaveProfile = async () => {
    setError(null);
    setSaving(true);

    const user = supabase.auth.user();
    if (!user) {
      setError("You must be logged in to save your profile.");
      setSaving(false);
      return;
    }

    try {
      if (profileData) {
        // Update existing profile
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ name, organization, role, extra1, extra2, extra3 })
          .eq("user_id", user.id);

        if (updateError) throw updateError;
      } else {
        // Insert new profile
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({ user_id: user.id, name, organization, role, extra1, extra2, extra3 });

        if (insertError) throw insertError;
      }

      // Refresh profile data
      setProfileData({ user_id: user.id, name, organization, role, extra1, extra2, extra3 });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 lg:py-24 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl space-y-4">
            <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
              Account preview
            </span>
            <h1 className="text-4xl font-semibold text-foreground">
              Your Glass profile
            </h1>
            <p className="text-muted-foreground">
              This page will eventually show your verified status, saved labs,
              requests, and billing.
            </p>
          </div>
          <Link href="/labs">
            <a className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-primary hover:border-primary">
              Browse labs
            </a>
          </Link>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {/* Profile Info Section */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-foreground">
              Profile Info
            </h2>

            {loading ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading profile...</p>
            ) : profileData ? (
              <div className="mt-4 space-y-2 text-sm text-foreground">
                <p><strong>Name:</strong> {profileData.name || "—"}</p>
                <p><strong>Email:</strong> {supabase.auth.user()?.email || "—"}</p>
                <p><strong>Organization:</strong> {profileData.organization || "—"}</p>
                <p><strong>Role:</strong> {profileData.role || "—"}</p>
                <p><strong>Extra1:</strong> {profileData.extra1 || "—"}</p>
                <p><strong>Extra2:</strong> {profileData.extra2 || "—"}</p>
                <p><strong>Extra3:</strong> {profileData.extra3 || "—"}</p>
                <button
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                You are not signed in or profile not created yet.
              </p>
            )}
          </motion.div>

          {/* Create / Edit profile form */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-foreground">
              {profileData ? "Edit your profile" : "Create your profile"}
            </h2>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
            <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
              <Field label="Full name">
                <input className={inputClasses} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Organization">
                <input className={inputClasses} value={organization} onChange={(e) => setOrganization(e.target.value)} />
              </Field>
              <Field label="Role / title">
                <input className={inputClasses} value={role} onChange={(e) => setRole(e.target.value)} />
              </Field>
              <Field label="Extra1">
                <input className={inputClasses} value={extra1} onChange={(e) => setExtra1(e.target.value)} />
              </Field>
              <Field label="Extra2">
                <input className={inputClasses} value={extra2} onChange={(e) => setExtra2(e.target.value)} />
              </Field>
              <Field label="Extra3">
                <input className={inputClasses} value={extra3} onChange={(e) => setExtra3(e.target.value)} />
              </Field>

              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {children}
    </div>
  );
}
