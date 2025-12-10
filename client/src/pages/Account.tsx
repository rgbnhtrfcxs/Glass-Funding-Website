import { motion } from "framer-motion";
import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useLabs } from "@/context/LabsContext";
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
  const { labs: allLabs } = useLabs();
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
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [newsSubmitting, setNewsSubmitting] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsSuccess, setNewsSuccess] = useState<string | null>(null);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsSummary, setNewsSummary] = useState("");
  const [newsCategory, setNewsCategory] = useState("update");
  const [newsLabId, setNewsLabId] = useState<number | null>(null);
  const [newsImages, setNewsImages] = useState<Array<{ url: string; name: string }>>([]);
  const [newsUploading, setNewsUploading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [newsFeed, setNewsFeed] = useState<
    Array<{
      id: number;
      lab_id: number;
      title: string;
      summary: string;
      category?: string | null;
      status?: string | null;
      images?: Array<{ url: string; name?: string }>;
      created_at?: string;
      labs?: { name?: string | null; subscription_tier?: string | null };
    }>
  >([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsFeedError, setNewsFeedError] = useState<string | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyLabId, setVerifyLabId] = useState<number | null>(null);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [verifyAddress, setVerifyAddress] = useState({
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });
  const [showLegal, setShowLegal] = useState(false);
  const [legalTopic, setLegalTopic] = useState("");
  const [legalDetails, setLegalDetails] = useState("");
  const [legalLabId, setLegalLabId] = useState<number | null>(null);
  const [legalError, setLegalError] = useState<string | null>(null);
  const [legalSuccess, setLegalSuccess] = useState<string | null>(null);
  const [legalSubmitting, setLegalSubmitting] = useState(false);

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

        // Favorites
        try {
          const favRes = await fetch("/api/favorites", { headers });
          const ct = favRes.headers.get("content-type") || "";
          if (favRes.ok && ct.includes("application/json")) {
            const favPayload = await favRes.json();
            const ids = Array.isArray(favPayload?.labIds) ? favPayload.labIds : [];
            setFavoriteIds(ids.map((id: any) => Number(id)).filter((id: number) => !Number.isNaN(id)));
          }
        } catch {
          // ignore favorites errors here
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
  const premiumLabs = labStats.filter(l => (l.subscriptionTier || "").toLowerCase() === "premier");
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
  const favoriteLabs = favoriteIds.length ? allLabs.filter(l => favoriteIds.includes(l.id)) : [];
  const canSeeDashboard = profile && (profile.role === "admin" || profile.role === "multi-lab" || premiumLabs.length > 0);
  const canPostNews = canSeeDashboard;
  const isLabVerified = (labId: number) => {
    const fromStats = labStats.find(l => l.id === labId);
    if (fromStats && (fromStats as any).isVerified !== undefined) {
      const val = (fromStats as any).isVerified;
      return val === true || val === "true" || val === 1 || val === "1";
    }
    const fromAll = allLabs.find(l => l.id === labId);
    const val = (fromAll as any)?.isVerified ?? (fromAll as any)?.is_verified;
    return val === true || val === "true" || val === 1 || val === "1";
  };
  const premierLabs = useMemo(
    () => labStats.filter(l => (l.subscriptionTier || "").toLowerCase() === "premier"),
    [labStats],
  );
  const ownedLabs = useMemo(() => {
    return allLabs.filter(
      l => (l as any).ownerUserId === user?.id || (l as any).owner_user_id === user?.id || labStats.some(s => s.id === l.id),
    );
  }, [allLabs, labStats, user?.id]);
  const ownedUnverifiedLabs = useMemo(() => ownedLabs.filter(l => !isLabVerified(l.id)), [ownedLabs]);

  useEffect(() => {
    if (premierLabs.length && !newsLabId) {
      setNewsLabId(premierLabs[0].id);
    }
  }, [premierLabs, newsLabId]);

  async function uploadNewsFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setNewsError(null);
    setNewsUploading(true);
    try {
      const uploads = Array.from(files).slice(0, 4 - newsImages.length);
      const uploaded: Array<{ url: string; name: string }> = [];
      for (const file of uploads) {
        const cleanName = file.name.replace(/\s+/g, "-").toLowerCase();
        const path = `news/${user?.id ?? "anon"}/${Date.now()}-${cleanName}`;
        const { error: upErr } = await supabase.storage.from("lab-news").upload(path, file, {
          upsert: true,
          contentType: file.type,
        });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("lab-news").getPublicUrl(path);
        if (data?.publicUrl) uploaded.push({ url: data.publicUrl, name: file.name });
      }
      setNewsImages(prev => [...prev, ...uploaded].slice(0, 4));
    } catch (err: any) {
      setNewsError(err?.message || "Unable to upload photos");
    } finally {
      setNewsUploading(false);
    }
  }

  async function submitNews() {
    if (!newsLabId) {
      setNewsError("Select a lab to post this update.");
      return;
    }
    if (!newsTitle.trim() || !newsSummary.trim()) {
      setNewsError("Title and summary are required.");
      return;
    }
    setNewsSubmitting(true);
    setNewsError(null);
    setNewsSuccess(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch("/api/news", {
        method: "POST",
        headers,
        body: JSON.stringify({
          labId: newsLabId,
          title: newsTitle.trim(),
          summary: newsSummary.trim(),
          category: newsCategory,
          images: newsImages,
          authorId: user?.id ?? null,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Unable to post news");
      }
      setNewsSuccess("Sent! We'll review and publish it soon.");
      setNewsTitle("");
      setNewsSummary("");
      setNewsImages([]);
      setShowNewsModal(false);
    } catch (err: any) {
      setNewsError(err?.message || "Unable to post news");
    } finally {
      setNewsSubmitting(false);
    }
  }

  async function submitVerificationRequest() {
    if (!verifyLabId) {
      setVerifyError("Select a lab to verify.");
      return;
    }
    if (isLabVerified(verifyLabId)) {
      setVerifySubmitting(false);
      setVerifyError("This lab is already verified by GLASS.");
      if (typeof window !== "undefined") {
        alert("This lab is already verified by GLASS.");
      }
      return;
    }
    setVerifySubmitting(true);
    setVerifyError(null);
    setVerifySuccess(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch("/api/verification-requests", {
        method: "POST",
        headers,
        body: JSON.stringify({
          labId: verifyLabId,
          ...verifyAddress,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Unable to submit verification request");
      }
      setVerifySuccess("Request received! We will reach out to schedule verification (additional cost applies).");
      setShowVerifyModal(false);
      setVerifyAddress({
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "",
      });
    } catch (err: any) {
      setVerifyError(err?.message || "Unable to submit verification request");
    } finally {
      setVerifySubmitting(false);
    }
  }

  useEffect(() => {
    async function loadNews() {
      if (!user) return;
      setNewsLoading(true);
      setNewsFeedError(null);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch("/api/news/mine", { headers });
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || !ct.includes("application/json")) {
          await res.text(); // consume body
          throw new Error("Unable to load news");
        }
        const payload = await res.json();
        setNewsFeed(Array.isArray(payload?.news) ? payload.news : []);
      } catch (err: any) {
        setNewsFeedError(err?.message || "Unable to load news");
        setNewsFeed([]); // allow UI to show fallback cards
      } finally {
        setNewsLoading(false);
      }
    }
    if (!authLoading) loadNews();
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
            {profile && profile.role !== "user" && (
              <Link
                href="/requests"
                className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-primary hover:border-primary"
              >
                Requests
              </Link>
            )}
            {profile && (profile.role === "lab" || profile.role === "admin" || profile.role === "multi-lab") && (
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
            {ownedUnverifiedLabs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setVerifyLabId(ownedUnverifiedLabs[0]?.id ?? null);
                  setShowVerifyModal(true);
                  setVerifyError(null);
                }}
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Get Verified by GLASS
              </button>
            )}
            <Link
              href="/favorites"
              className="inline-flex items-center justify-center rounded-full border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary"
            >
              <span className="mr-2 flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground">♥</span>
              Favorites ({favoriteLabs.length})
            </Link>
            <Link
              href="/subscriptions"
              className="inline-flex items-center justify-center rounded-full border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary"
            >
              Change plan
            </Link>
            {profile && (profile.role === "lab" || profile.role === "multi-lab" || profile.role === "admin") && (
              <button
                type="button"
                onClick={() => {
                  setShowLegal(true);
                  setLegalError(null);
                  setLegalSuccess(null);
                  setLegalLabId(labStats[0]?.id ?? null);
                }}
                className="inline-flex items-center justify-center rounded-full border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary"
              >
                Legal assistance
              </button>
            )}
          </div>
        </div>

        {showNewsModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-10">
            <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl">
              <button
                type="button"
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewsModal(false)}
              >
                ✕
              </button>
              <h3 className="text-lg font-semibold text-foreground">Post a lab update</h3>
              <p className="text-sm text-muted-foreground">For premier/custom labs. We’ll review and feature these on the main page.</p>

              <div className="mt-4 grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Lab</label>
                  <select
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={newsLabId ?? ""}
                    onChange={e => setNewsLabId(Number(e.target.value))}
                  >
                    {premierLabs.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Title</label>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    placeholder="New equipment, collaboration call, milestone…"
                    value={newsTitle}
                    onChange={e => setNewsTitle(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Summary</label>
                  <textarea
                    className="min-h-[120px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    placeholder="Quick blurb for the homepage ticker."
                    value={newsSummary}
                    onChange={e => setNewsSummary(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Category</label>
                  <select
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={newsCategory}
                    onChange={e => setNewsCategory(e.target.value)}
                  >
                    <option value="update">Update</option>
                    <option value="equipment">New equipment</option>
                    <option value="project">New project</option>
                    <option value="collaboration">Collaboration request</option>
                    <option value="announcement">Announcement</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Photos (up to 4)</label>
                  <div className="flex flex-wrap gap-2">
                    {newsImages.map(img => (
                      <div key={img.url} className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                        <span className="text-xs text-foreground break-all max-w-[160px] truncate">{img.name}</span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => setNewsImages(prev => prev.filter(p => p.url !== img.url))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-3">
                      <span className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                        Upload photos
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={async e => {
                          await uploadNewsFiles(e.target.files);
                          if (e.target) e.target.value = "";
                        }}
                        disabled={newsImages.length >= 4 || newsUploading}
                      />
                    </label>
                    {newsUploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
                  </div>
                </div>

                {newsError && (
                  <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {newsError}
                  </div>
                )}
                {newsSuccess && (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    {newsSuccess}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary"
                    onClick={() => setShowNewsModal(false)}
                    disabled={newsSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitNews}
                    disabled={newsSubmitting}
                    className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-70"
                  >
                    {newsSubmitting ? "Sending…" : "Send update"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showVerifyModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-10">
            <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl">
              <button
                type="button"
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                onClick={() => setShowVerifyModal(false)}
              >
                ✕
              </button>
              <h3 className="text-lg font-semibold text-foreground">Get verified by GLASS</h3>
              <p className="text-sm text-muted-foreground">
                Verification includes an on-site visit and carries an additional cost. Choose a lab and provide an address if missing.
              </p>

              <div className="mt-4 grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Lab</label>
                  <select
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={verifyLabId ?? ""}
                    onChange={e => setVerifyLabId(Number(e.target.value))}
                  >
                    {ownedUnverifiedLabs.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Address line 1</label>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    placeholder="Street address"
                    value={verifyAddress.addressLine1}
                    onChange={e => setVerifyAddress(prev => ({ ...prev, addressLine1: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-foreground">Address line 2</label>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    placeholder="Suite / Unit (optional)"
                    value={verifyAddress.addressLine2}
                    onChange={e => setVerifyAddress(prev => ({ ...prev, addressLine2: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2 md:grid-cols-2 md:gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-foreground">City</label>
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={verifyAddress.city}
                      onChange={e => setVerifyAddress(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-foreground">State/Region</label>
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={verifyAddress.state}
                      onChange={e => setVerifyAddress(prev => ({ ...prev, state: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2 md:gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-foreground">Postal code</label>
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={verifyAddress.postalCode}
                      onChange={e => setVerifyAddress(prev => ({ ...prev, postalCode: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-foreground">Country</label>
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={verifyAddress.country}
                      onChange={e => setVerifyAddress(prev => ({ ...prev, country: e.target.value }))}
                    />
                  </div>
                </div>

                {verifyError && (
                  <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {verifyError}
                  </div>
                )}
                {verifySuccess && (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    {verifySuccess}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary"
                    onClick={() => setShowVerifyModal(false)}
                    disabled={verifySubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitVerificationRequest}
                    disabled={verifySubmitting}
                    className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-70"
                  >
                    {verifySubmitting ? "Sending…" : "Submit request"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showLegal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-10">
            <div className="relative w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-2xl">
              <button
                type="button"
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                onClick={() => setShowLegal(false)}
              >
                ✕
              </button>
              <h3 className="text-lg font-semibold text-foreground">Connect with legal support</h3>
              <p className="text-sm text-muted-foreground">We’ll connect you with our legal expert for contract help.</p>

              <div className="mt-4 grid gap-3">
                <div className="grid gap-1">
                  <label className="text-sm font-medium text-foreground">Topic</label>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={legalTopic}
                    onChange={e => setLegalTopic(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-sm font-medium text-foreground">Details</label>
                  <textarea
                    className="min-h-[120px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={legalDetails}
                    onChange={e => setLegalDetails(e.target.value)}
                    placeholder="Share context and any timelines."
                  />
                </div>
                {labStats.length > 0 && (
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Related lab</label>
                    <select
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={legalLabId ?? ""}
                      onChange={e => setLegalLabId(Number(e.target.value))}
                    >
                      <option value="">Select lab (optional)</option>
                      {labStats.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {legalError && <p className="text-sm text-destructive">{legalError}</p>}
                {legalSuccess && <p className="text-sm text-emerald-600">{legalSuccess}</p>}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary"
                    onClick={() => setShowLegal(false)}
                    disabled={legalSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!legalTopic.trim() || !legalDetails.trim()) {
                        setLegalError("Topic and details are required.");
                        return;
                      }
                      setLegalSubmitting(true);
                      setLegalError(null);
                      setLegalSuccess(null);
                      try {
                        const res = await fetch("/api/legal-assist", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            topic: legalTopic.trim(),
                            details: legalDetails.trim(),
                            labId: legalLabId || undefined,
                            name: displayLabel,
                            email: profile?.email || user?.email || "",
                          }),
                        });
                        if (!res.ok) {
                          const txt = await res.text();
                          throw new Error(txt || "Unable to send request");
                        }
                        setLegalSuccess("Sent! We’ll connect you with our legal contact shortly.");
                        setLegalTopic("");
                        setLegalDetails("");
                        setLegalLabId(labStats[0]?.id ?? null);
                        setShowLegal(false);
                      } catch (err: any) {
                        setLegalError(err?.message || "Unable to send request");
                      } finally {
                        setLegalSubmitting(false);
                      }
                    }}
                    className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-70"
                    disabled={legalSubmitting}
                  >
                    {legalSubmitting ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {canPostNews && (
        <div className="mt-10 rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">News</p>
              <h3 className="text-lg font-semibold text-foreground">Recent updates from your labs</h3>
            </div>
          </div>

          {newsLoading && (
            <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">Loading news…</div>
          )}
          {newsFeedError && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {newsFeedError}. You can still post a new update below.
            </div>
          )}

          {!newsLoading && (
            <div className="overflow-x-auto">
              <div className="flex gap-4 min-w-full">
                <div className="min-w-[260px] rounded-2xl border border-dashed border-border bg-background/60 px-4 py-4 flex flex-col justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">Share an update</p>
                    <p className="text-xs text-muted-foreground">Post equipment arrivals, collaborations, or milestones.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewsModal(true);
                      setNewsError(null);
                    }}
                    className="mt-3 inline-flex items-center justify-center rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                  >
                    Create post
                  </button>
                </div>

                {newsFeed.length > 0 &&
                  newsFeed.map(item => {
                    const labName = item.labs?.name || `Lab ${item.lab_id}`;
                    const created = item.created_at ? new Date(item.created_at).toLocaleDateString() : "";
                    return (
                      <div key={item.id} className="min-w-[260px] max-w-[280px] rounded-2xl border border-border bg-background/70 p-4 flex flex-col gap-3">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <span className="rounded-full bg-muted/60 px-2 py-1 text-[11px] capitalize">{item.category || "update"}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground line-clamp-2">{item.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{item.summary}</p>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="truncate">{labName}</span>
                          <span className="text-[11px]">{created}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.images?.slice(0, 2).map(img => (
                            <img
                              key={img.url}
                              src={img.url}
                              alt={img.name || "news"}
                              className="h-14 w-14 rounded-lg object-cover border border-border"
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
        )}
        {canSeeDashboard && (
        <div className="mt-8 flex flex-col gap-6 lg:flex-row">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
          >
            <div
              className="flex items-center justify-between gap-3 cursor-pointer select-none"
              onClick={() => setShowDashboard(prev => !prev)}
            >
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Dashboard</p>
                <h2 className="text-xl font-semibold text-foreground">Your activity at a glance</h2>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
                {showDashboard ? "Collapse" : "Expand"}
              </span>
            </div>

            {showDashboard && (
              <>
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
                        badge={(bestViewLab.subscriptionTier || "").toLowerCase() === "premier" ? "Premium" : undefined}
                      />
                    )}
                    {bestFavoriteLab && (
                      <HighlightCard
                        title="Most favorited"
                        subtitle="Total favorites"
                        primary={`${bestFavoriteLab.favorites} favorites`}
                        secondary={bestFavoriteLab.name}
                        badge={(bestFavoriteLab.subscriptionTier || "").toLowerCase() === "premier" ? "Premium" : undefined}
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
              </>
            )}
          </motion.div>

        </div>
        )}
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
