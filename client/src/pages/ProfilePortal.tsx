import { motion } from "framer-motion";
import { Link } from "wouter";
import type { ReactNode, ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ProfilePortal() {
  const inputClasses =
    "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  const { user, loading: authLoading, signOut } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("France");

  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setProfileData(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "user_id,email,display_name,role,subscription_status,name,avatar_url,created_at,updated_at,legal_full_name,address_line1,address_line2,city,postal_code,country",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error.message);
        setProfileData(null);
      } else {
        setProfileData(data || null);
        if (data) {
          setName(data.name ?? "");
          setDisplayName(data.display_name ?? "");
          setRole(data.role ?? "");
          setSubscriptionStatus(data.subscription_status ?? "");
          setAvatarUrl(data.avatar_url ?? null);
          setLegalName(data.legal_full_name ?? "");
          setAddressLine1(data.address_line1 ?? "");
          setAddressLine2(data.address_line2 ?? "");
          setCity(data.city ?? "");
          setPostalCode(data.postal_code ?? "");
          setCountry(data.country ?? country);
        } else {
          // No row yet; initialize read-only fields from defaults
          setRole("user");
          setSubscriptionStatus("none");
        }
      }

      setLoading(false);
    }

    if (!authLoading) {
      fetchProfile();
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setProfileData(null);
      } else {
        fetchProfile();
      }
    });

    return () => {
      try {
        // @ts-ignore
        authListener?.subscription?.unsubscribe?.();
        // @ts-ignore
        authListener?.unsubscribe?.();
      } catch {}
    };
  }, [authLoading, user?.id]);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleSaveProfile = async () => {
    setError(null);
    setSaving(true);

    if (!user) {
      setError("You must be logged in to save your profile.");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        user_id: user.id,
        email: user.email,
        name: name || null,
        display_name: displayName || null,
        avatar_url: avatarUrl || null,
        legal_full_name: legalName || null,
        address_line1: addressLine1 || null,
        address_line2: addressLine2 || null,
        city: city || null,
        postal_code: postalCode || null,
        country: country || null,
      } as const;

      // Upsert row; RLS allows only own row
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "user_id" });

      if (upsertError) throw upsertError;

      // Refresh profile data
      setProfileData(prev => ({ ...(prev ?? {}), ...payload }));
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      setAvatarUrl(publicUrl);

      const { error: profileErr } = await supabase
        .from("profiles")
        .upsert({ user_id: user.id, email: user.email, avatar_url: publicUrl }, { onConflict: "user_id" });
      if (profileErr) throw profileErr;
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to upload avatar.");
    } finally {
      setUploading(false);
    }
  }

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

            {loading || authLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading profile...</p>
            ) : profileData ? (
              <div className="mt-4 space-y-2 text-sm text-foreground">
                <p><strong>Name:</strong> {profileData.name || "—"}</p>
                <p><strong>Display name:</strong> {profileData.display_name || "—"}</p>
                <p><strong>Email:</strong> {user?.email || "—"}</p>
                <p><strong>Role:</strong> {profileData.role || role || "—"}</p>
                <p><strong>Subscription:</strong> {profileData.subscription_status || subscriptionStatus || "—"}</p>
                <p><strong>Legal name:</strong> {profileData.legal_full_name || "—"}</p>
                <p><strong>Company:</strong> {profileData.company_name || "—"}</p>
                <p>
                  <strong>Address:</strong>{" "}
                  {profileData.address_line1 || profileData.address_line2 || profileData.city || profileData.postal_code || profileData.country
                    ? `${profileData.address_line1 ?? ""} ${profileData.address_line2 ?? ""} ${profileData.postal_code ?? ""} ${profileData.city ?? ""} ${profileData.country ?? ""}`
                    : "—"}
                </p>
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
              <Field label="Avatar">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={avatarUrl ?? undefined} alt={displayName || name || "Avatar"} />
                    <AvatarFallback className="text-base font-semibold bg-muted">
                      {(displayName || name || user?.email || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <label className="inline-flex items-center rounded-full border px-3 py-2 text-xs font-medium cursor-pointer hover:border-primary hover:text-primary">
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    {uploading ? "Uploading…" : "Upload photo"}
                  </label>
                </div>
              </Field>
              <Field label="Full name">
                <input className={inputClasses} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Display name">
                <input className={inputClasses} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </Field>
              <Field label="Legal full name (for receipts)">
                <input className={inputClasses} value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="Legal name for individual receipts" />
              </Field>
              <Field label="Address line 1">
                <input className={inputClasses} value={addressLine1} onChange={e => setAddressLine1(e.target.value)} placeholder="Street and number" />
              </Field>
              <Field label="Address line 2 (optional)">
                <input className={inputClasses} value={addressLine2} onChange={e => setAddressLine2(e.target.value)} placeholder="Apartment, suite, etc." />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="City">
                  <input className={inputClasses} value={city} onChange={e => setCity(e.target.value)} />
                </Field>
                <Field label="Postal code">
                  <input className={inputClasses} value={postalCode} onChange={e => setPostalCode(e.target.value)} />
                </Field>
              </div>
              <Field label="Country">
                <input className={inputClasses} value={country} onChange={e => setCountry(e.target.value)} />
              </Field>
              <Field label="Email">
                <input className={inputClasses} value={user?.email ?? ""} disabled />
              </Field>
              <Field label="Role">
                <input className={inputClasses} value={role} disabled />
              </Field>
              <Field label="Subscription status">
                <input className={inputClasses} value={subscriptionStatus} disabled />
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
