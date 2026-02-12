import { motion } from "framer-motion";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, UserCog } from "lucide-react";

type ProfileRow = {
  user_id: string;
  email: string | null;
  name: string | null;
  subscription_status: string | null;
  avatar_url: string | null;
};

type ProfilePortalProps = {
  embedded?: boolean;
  onProfileSaved?: (profile: { name: string | null; avatarUrl: string | null }) => void;
};

export default function ProfilePortal({ embedded = false, onProfileSaved }: ProfilePortalProps) {
  const inputClasses =
    "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  const { user, loading: authLoading, signOut } = useAuth();
  const [profileData, setProfileData] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [uploading, setUploading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const getAuthHeaders = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Please sign in again.");
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setProfileData(null);
        setLoading(false);
        return;
      }

      try {
        const headers = await getAuthHeaders();
        const response = await fetch("/api/me/profile", { headers });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Unable to load profile.");
        }
        const payload = await response.json();
        const row = (payload?.profile as ProfileRow | null) ?? null;
        setProfileData(row);
        if (row) {
          setName(row.name ?? "");
          setSubscriptionStatus(row.subscription_status ?? "");
          setAvatarUrl(row.avatar_url ?? null);
        } else {
          setSubscriptionStatus("none");
        }
      } catch (err: any) {
        setError(err?.message || "Unable to load profile.");
        setProfileData(null);
      }

      setLoading(false);
    }

    if (!authLoading) {
      void fetchProfile();
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setProfileData(null);
      } else {
        void fetchProfile();
      }
    });

    return () => {
      try {
        // @ts-ignore
        authListener?.subscription?.unsubscribe?.();
        // @ts-ignore
        authListener?.unsubscribe?.();
      } catch {
        // noop
      }
    };
  }, [authLoading, user?.id]);

  const handleSaveProfile = async () => {
    setError(null);
    setNotice(null);
    setSaving(true);

    if (!user) {
      setError("You must be logged in to save your profile.");
      setSaving(false);
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/me/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          name: name.trim() || null,
          avatarUrl: avatarUrl || null,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to save profile.");
      }
      const payload = await response.json();
      const saved = (payload?.profile as ProfileRow | null) ?? null;
      setProfileData(saved);
      if (saved) {
        setName(saved.name ?? "");
        setAvatarUrl(saved.avatar_url ?? null);
        onProfileSaved?.({ name: saved.name ?? null, avatarUrl: saved.avatar_url ?? null });
      } else {
        onProfileSaved?.({ name: name.trim() || null, avatarUrl: avatarUrl || null });
      }
      setNotice("Profile saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      setError("No email found for this account.");
      return;
    }
    setResettingPassword(true);
    setError(null);
    setNotice(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setNotice("Password reset email sent.");
    } catch (err: any) {
      setError(err?.message || "Failed to send reset email.");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) {
      setError("You must be logged in to delete your account.");
      return;
    }
    const confirmation = typeof window !== "undefined"
      ? window.prompt("Type DELETE to permanently delete your account.")
      : null;
    if (confirmation !== "DELETE") return;

    setDeletingAccount(true);
    setError(null);
    setNotice(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please sign in again before deleting your account.");

      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Unable to delete account.");
      }

      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } catch (err: any) {
      setError(err?.message || "Unable to delete account.");
    } finally {
      setDeletingAccount(false);
    }
  };

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const cleanName = file.name.replace(/\s+/g, "-").toLowerCase();
      const path = `${user.id}/${Date.now()}-${cleanName || `avatar.${ext}`}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      setAvatarUrl(publicUrl);
      const headers = await getAuthHeaders();
      const response = await fetch("/api/me/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({ avatarUrl: publicUrl }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to save avatar.");
      }
      const payload = await response.json();
      const saved = (payload?.profile as ProfileRow | null) ?? null;
      if (saved) {
        setProfileData(saved);
        setName(saved.name ?? "");
        setAvatarUrl(saved.avatar_url ?? publicUrl);
        onProfileSaved?.({ name: saved.name ?? null, avatarUrl: saved.avatar_url ?? null });
      } else {
        setProfileData(prev => ({ ...(prev ?? {}), avatar_url: publicUrl } as ProfileRow));
        onProfileSaved?.({ name: name.trim() || null, avatarUrl: publicUrl });
      }
      setNotice("Photo updated.");
    } catch (err: any) {
      setError(err?.message || "Failed to upload avatar.");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  }

  const sectionClass = embedded ? "bg-transparent" : "bg-background min-h-screen";
  const containerClass = embedded
    ? "w-full px-0 py-0"
    : "container mx-auto px-4 py-20 lg:py-24 max-w-5xl";

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl space-y-4">
            <h1 className="flex items-center gap-2 text-4xl font-semibold text-foreground">
              <User className="h-6 w-6 text-primary" />
              Your profile
            </h1>
            <p className="text-muted-foreground">
              Keep your account details current. Your full name is used in contact and legal-support flows.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={resettingPassword}
            className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-primary hover:border-primary disabled:opacity-60"
          >
            {resettingPassword ? "Sending reset..." : "Reset password"}
          </button>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
          >
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <User className="h-5 w-5 text-primary" />
              Account info
            </h2>

            {loading || authLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading profile...</p>
            ) : profileData ? (
              <div className="mt-4 space-y-2 text-sm text-foreground">
                <p><strong>Full name:</strong> {profileData.name || "-"}</p>
                <p><strong>Email:</strong> {user?.email || "-"}</p>
                <p><strong>Subscription:</strong> {profileData.subscription_status || subscriptionStatus || "-"}</p>
                <button
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  onClick={async () => {
                    await signOut();
                  }}
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

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
          >
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <UserCog className="h-5 w-5 text-primary" />
              Edit profile
            </h2>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            {notice && <p className="mt-2 text-sm text-emerald-700">{notice}</p>}
            <form className="mt-6 space-y-4" onSubmit={event => event.preventDefault()}>
              <Field label="Photo">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={avatarUrl ?? undefined} alt={name || user?.email || "Avatar"} />
                    <AvatarFallback className="text-base font-semibold bg-muted">
                      {(name || user?.email || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <label className="inline-flex items-center rounded-full border px-3 py-2 text-xs font-medium cursor-pointer hover:border-primary hover:text-primary">
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    {uploading ? "Uploading..." : "Upload photo"}
                  </label>
                </div>
              </Field>

              <Field label="Full name">
                <input
                  className={inputClasses}
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="Your full name"
                />
              </Field>

              <Field label="Email">
                <input className={inputClasses} value={user?.email ?? ""} disabled />
              </Field>

              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? "Deleting account..." : "Delete account"}
              </button>
              <p className="text-xs text-muted-foreground">
                This permanently deletes your account and personal data. This action cannot be undone.
              </p>
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
