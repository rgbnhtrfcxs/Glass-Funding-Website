import { motion } from "framer-motion";
import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useLabs } from "@/context/LabsContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

type Profile = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  name: string | null;
  is_admin?: boolean | null;
  can_create_lab?: boolean | null;
  can_manage_multiple_labs?: boolean | null;
  can_manage_teams?: boolean | null;
  can_manage_multiple_teams?: boolean | null;
  can_post_news?: boolean | null;
  can_broker_requests?: boolean | null;
  can_receive_investor?: boolean | null;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

type TeamMember = {
  name: string;
  title: string;
  linkedin?: string | null;
  website?: string | null;
  teamName?: string | null;
  roleRank?: number | null;
  isLead?: boolean;
};

type TeamMemberForm = {
  name: string;
  title: string;
  linkedin: string;
  website: string;
  teamName: string;
  roleRank: string;
  isLead: boolean;
};

export default function Account() {
  const { user, loading: authLoading } = useAuth();
  const { labs: allLabs, updateLab } = useLabs();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labsLoading, setLabsLoading] = useState(false);
  const [labStats, setLabStats] = useState<
    Array<{
      id: number;
      name: string;
      labStatus?: string | null;
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
      labs?: { name?: string | null; lab_status?: string | null };
    }>
  >([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsFeedError, setNewsFeedError] = useState<string | null>(null);

  const toBool = (value: unknown) =>
    value === true || value === "true" || value === 1 || value === "1";
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
  const [activeTab, setActiveTab] = useState<"overview" | "labs" | "equipment" | "team" | "activity">("overview");
  const [equipmentDrafts, setEquipmentDrafts] = useState<Record<number, string[]>>({});
  const [equipmentInput, setEquipmentInput] = useState<Record<number, string>>({});
  const [equipmentSaving, setEquipmentSaving] = useState<Record<number, boolean>>({});
  const [equipmentError, setEquipmentError] = useState<Record<number, string | null>>({});
  const [teamDrafts, setTeamDrafts] = useState<Record<number, TeamMember[]>>({});
  const [teamForms, setTeamForms] = useState<Record<number, TeamMemberForm>>({});
  const [teamEditingIndex, setTeamEditingIndex] = useState<Record<number, number | null>>({});
  const [teamSaving, setTeamSaving] = useState<Record<number, boolean>>({});
  const [teamError, setTeamError] = useState<Record<number, string | null>>({});
  const [resettingPassword, setResettingPassword] = useState(false);

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
          [
            "user_id",
            "email",
            "display_name",
            "name",
            "is_admin",
            "can_create_lab",
            "can_manage_multiple_labs",
            "can_manage_teams",
            "can_manage_multiple_teams",
            "can_post_news",
            "can_broker_requests",
            "can_receive_investor",
            "avatar_url",
            "created_at",
            "updated_at",
          ].join(","),
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

  const labStatusValue = (lab: { labStatus?: string | null; lab_status?: string | null }) =>
    (lab.labStatus || lab.lab_status || "listed").toLowerCase();
  const isPremierLab = (lab: { labStatus?: string | null }) =>
    labStatusValue(lab) === "premier";

  const sendPasswordReset = async () => {
    const email = profile?.email || user?.email;
    if (!email) {
      toast({
        title: "No email on file",
        description: "Add an email to your account before resetting your password.",
      });
      return;
    }
    setResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: "Reset email sent",
        description: `Check ${email} for a reset link.`,
      });
    } catch (err: any) {
      toast({
        title: "Unable to send reset email",
        description: err?.message || "Please try again in a moment.",
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const labsVisibleCount = labStats.filter(l => l.isVisible !== false).length;
  const labsHiddenCount = labStats.filter(l => l.isVisible === false).length;
  const premiumLabs = labStats.filter(isPremierLab);
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
  const hasPremierLab = premiumLabs.length > 0;
  const canSeeDashboard = toBool(profile?.can_create_lab);
  const canPostNews = canSeeDashboard && hasPremierLab;
  const isLabVerified = (labId: number) => {
    const fromStats = labStats.find(l => l.id === labId);
    const statusFromStats = (fromStats as any)?.labStatus;
    if (statusFromStats) {
      return ["verified_passive", "verified_active", "premier"].includes(statusFromStats);
    }
    const fromAll = allLabs.find(l => l.id === labId) as any;
    const statusFromAll = fromAll?.labStatus ?? fromAll?.lab_status;
    return ["verified_passive", "verified_active", "premier"].includes(statusFromAll);
  };
  const premierLabs = useMemo(
    () => labStats.filter(isPremierLab),
    [labStats],
  );
  const ownedLabs = useMemo(() => {
    return allLabs.filter(
      l => (l as any).ownerUserId === user?.id || (l as any).owner_user_id === user?.id || labStats.some(s => s.id === l.id),
    );
  }, [allLabs, labStats, user?.id]);
  const ownedUnverifiedLabs = useMemo(() => ownedLabs.filter(l => !isLabVerified(l.id)), [ownedLabs]);
  const canManageLabs = toBool(profile?.can_create_lab);
  const emptyTeamForm: TeamMemberForm = {
    name: "",
    title: "",
    linkedin: "",
    website: "",
    teamName: "",
    roleRank: "",
    isLead: false,
  };

  const normalizeUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  useEffect(() => {
    if (newsLabId) return;
    const fallbackId = ownedLabs[0]?.id ?? labStats[0]?.id ?? null;
    if (fallbackId) setNewsLabId(fallbackId);
  }, [ownedLabs, labStats, newsLabId]);

  useEffect(() => {
    if (!ownedLabs.length) {
      setEquipmentDrafts({});
      setTeamDrafts({});
      return;
    }
    setEquipmentDrafts(
      ownedLabs.reduce((acc: Record<number, string[]>, lab) => {
        acc[lab.id] = Array.isArray((lab as any).equipment) ? (lab as any).equipment : [];
        return acc;
      }, {}),
    );
    setTeamDrafts(
      ownedLabs.reduce((acc: Record<number, TeamMember[]>, lab) => {
        acc[lab.id] = Array.isArray((lab as any).teamMembers) ? (lab as any).teamMembers : [];
        return acc;
      }, {}),
    );
    setTeamForms(prev => {
      const next = { ...prev };
      ownedLabs.forEach(lab => {
        if (!next[lab.id]) next[lab.id] = { ...emptyTeamForm };
      });
      return next;
    });
    setTeamEditingIndex(prev => {
      const next = { ...prev };
      ownedLabs.forEach(lab => {
        if (next[lab.id] === undefined) next[lab.id] = null;
      });
      return next;
    });
  }, [ownedLabs]);

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

  const saveEquipment = async (labId: number, items: string[]) => {
    if (!canManageLabs) return;
    setEquipmentSaving(prev => ({ ...prev, [labId]: true }));
    setEquipmentError(prev => ({ ...prev, [labId]: null }));
    try {
      const updated = await updateLab(labId, { equipment: items });
      setEquipmentDrafts(prev => ({
        ...prev,
        [labId]: Array.isArray((updated as any).equipment) ? (updated as any).equipment : items,
      }));
    } catch (err: any) {
      setEquipmentError(prev => ({
        ...prev,
        [labId]: err?.message || "Unable to update equipment",
      }));
    } finally {
      setEquipmentSaving(prev => ({ ...prev, [labId]: false }));
    }
  };

  const addEquipment = async (labId: number) => {
    const value = (equipmentInput[labId] ?? "").trim();
    if (!value) return;
    const current = equipmentDrafts[labId] ?? [];
    const next = Array.from(new Set([...current, value]));
    setEquipmentInput(prev => ({ ...prev, [labId]: "" }));
    setEquipmentDrafts(prev => ({ ...prev, [labId]: next }));
    await saveEquipment(labId, next);
  };

  const removeEquipment = async (labId: number, item: string) => {
    const current = equipmentDrafts[labId] ?? [];
    const next = current.filter(entry => entry !== item);
    setEquipmentDrafts(prev => ({ ...prev, [labId]: next }));
    await saveEquipment(labId, next);
  };

  const saveTeamMembers = async (labId: number, members: TeamMember[]) => {
    if (!canManageLabs) return;
    setTeamSaving(prev => ({ ...prev, [labId]: true }));
    setTeamError(prev => ({ ...prev, [labId]: null }));
    try {
      const updated = await updateLab(labId, { teamMembers: members });
      setTeamDrafts(prev => ({
        ...prev,
        [labId]: Array.isArray((updated as any).teamMembers) ? (updated as any).teamMembers : members,
      }));
    } catch (err: any) {
      setTeamError(prev => ({ ...prev, [labId]: err?.message || "Unable to update team members" }));
    } finally {
      setTeamSaving(prev => ({ ...prev, [labId]: false }));
    }
  };

  const updateTeamForm = (labId: number, updates: Partial<TeamMemberForm>) => {
    setTeamForms(prev => ({
      ...prev,
      [labId]: {
        ...(prev[labId] ?? emptyTeamForm),
        ...updates,
      },
    }));
  };

  const resetTeamForm = (labId: number) => {
    setTeamForms(prev => ({ ...prev, [labId]: { ...emptyTeamForm } }));
    setTeamEditingIndex(prev => ({ ...prev, [labId]: null }));
  };

  const submitTeamMember = async (labId: number) => {
    const form = teamForms[labId] ?? emptyTeamForm;
    if (!form.name.trim() || !form.title.trim()) {
      setTeamError(prev => ({ ...prev, [labId]: "Name and title are required." }));
      return;
    }

    const parsedRank = form.roleRank.trim() ? Number(form.roleRank) : null;
    if (form.roleRank.trim() && Number.isNaN(parsedRank)) {
      setTeamError(prev => ({ ...prev, [labId]: "Role rank must be a number." }));
      return;
    }

    const member: TeamMember = {
      name: form.name.trim(),
      title: form.title.trim(),
      teamName: form.teamName.trim() ? form.teamName.trim() : null,
      roleRank: parsedRank ?? null,
      linkedin: normalizeUrl(form.linkedin) ?? null,
      website: normalizeUrl(form.website) ?? null,
      isLead: form.isLead,
    };

    const current = teamDrafts[labId] ?? [];
    const editingIndex = teamEditingIndex[labId];
    let next = [...current];
    if (editingIndex !== null && editingIndex !== undefined && editingIndex >= 0) {
      next[editingIndex] = member;
    } else {
      next = [...next];
      next.push(member);
    }
    if (member.isLead) {
      next = next.map((item, idx) => ({ ...item, isLead: idx === (editingIndex ?? next.length - 1) }));
    }
    next = next
      .map(item => ({ ...item }))
      .sort((a, b) => {
        if (a.isLead !== b.isLead) return Number(b.isLead) - Number(a.isLead);
        const rankA = a.roleRank ?? 999;
        const rankB = b.roleRank ?? 999;
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name);
      });

    setTeamDrafts(prev => ({ ...prev, [labId]: next }));
    await saveTeamMembers(labId, next);
    resetTeamForm(labId);
  };

  const editTeamMember = (labId: number, index: number) => {
    const member = (teamDrafts[labId] ?? [])[index];
    if (!member) return;
    updateTeamForm(labId, {
      name: member.name,
      title: member.title,
      teamName: member.teamName ?? "",
      roleRank: member.roleRank ? String(member.roleRank) : "",
      linkedin: member.linkedin ?? "",
      website: member.website ?? "",
      isLead: Boolean(member.isLead),
    });
    setTeamEditingIndex(prev => ({ ...prev, [labId]: index }));
  };

  const removeTeamMember = async (labId: number, index: number) => {
    const current = teamDrafts[labId] ?? [];
    const next = current.filter((_, idx) => idx !== index);
    setTeamDrafts(prev => ({ ...prev, [labId]: next }));
    await saveTeamMembers(labId, next);
  };

  const setLeadMember = async (labId: number, index: number) => {
    const current = teamDrafts[labId] ?? [];
    const next = current.map((member, idx) => ({ ...member, isLead: idx === index }));
    setTeamDrafts(prev => ({ ...prev, [labId]: next }));
    await saveTeamMembers(labId, next);
  };

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

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "labs", label: "Labs" },
    { id: "equipment", label: "Equipment" },
    { id: "team", label: "Team" },
    { id: "activity", label: "Activity" },
  ] as const;

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
            {profile && toBool(profile.can_broker_requests) && (
              <Link
                href="/requests"
                className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-primary hover:border-primary"
              >
                Requests
              </Link>
            )}
            {profile && toBool(profile.can_create_lab) && (
              <Link
                href="/lab/manage"
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                Manage lab
              </Link>
            )}
            {profile && toBool(profile.can_manage_teams) && (
              <Link
                href="/team/manage"
                className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                Manage teams
              </Link>
            )}
            {profile && toBool(profile.is_admin) && (
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
            {profile && (toBool(profile.can_create_lab) || toBool(profile.can_manage_teams)) && (
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

        <div className="mt-10 flex flex-wrap gap-2 border-b border-border pb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-8">
          {activeTab === "overview" && (
            <>
              {canSeeDashboard ? (
                <div className="flex flex-col gap-6 lg:flex-row">
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
                                badge={isPremierLab(bestViewLab) ? "Premium" : undefined}
                              />
                            )}
                            {bestFavoriteLab && (
                              <HighlightCard
                                title="Most favorited"
                                subtitle="Total favorites"
                                primary={`${bestFavoriteLab.favorites} favorites`}
                                secondary={bestFavoriteLab.name}
                                badge={isPremierLab(bestFavoriteLab) ? "Premium" : undefined}
                              />
                            )}
                          </div>
                        )}

                        {labStats.length > 0 && (
                          <div className="mt-8">
                            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Linked labs</p>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              {labStats.map(lab => {
                                const status = labStatusValue(lab);
                                const premium = status === "premier";
                                return (
                                  <div
                                    key={lab.id}
                                    className="rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm flex flex-col gap-2"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div>
                                        <p className="font-semibold text-foreground">{lab.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {premium ? "Premier" : status} • {lab.isVisible === false ? "Hidden" : "Visible"}
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
              ) : (
                <div className="rounded-3xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
                  Your dashboard unlocks once you have a premier lab or a multi-lab account.
                </div>
              )}
            </>
          )}

          {activeTab === "labs" && (
            <div className="space-y-6">
              {ownedLabs.length === 0 ? (
                <div className="rounded-3xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
                  You don’t have any labs linked yet. Create your first lab to unlock equipment, team, and verification tools.
                  <div className="mt-4">
                    <Link
                      href="/lab/manage"
                      className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                      Create a lab profile
                    </Link>
                  </div>
                </div>
              ) : (
                ownedLabs.map(lab => {
                  const location = [lab.city, lab.country].filter(Boolean).join(", ");
                  const status = labStatusValue(lab);
                  const verified = isLabVerified(lab.id);
                  return (
                    <div key={lab.id} className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm space-y-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Lab</p>
                          <h3 className="text-lg font-semibold text-foreground">{lab.name}</h3>
                          {location && <p className="text-sm text-muted-foreground">{location}</p>}
                          {lab.descriptionShort && (
                            <p className="mt-2 text-sm text-muted-foreground">{lab.descriptionShort}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground capitalize">
                            {status.replace("_", " ")}
                          </span>
                          {verified && (
                            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                              Verified by GLASS
                            </span>
                          )}
                          <Link
                            href={`/lab/manage/${lab.id}`}
                            className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                          >
                            Manage lab
                          </Link>
                        </div>
                      </div>
                      {verified ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              toast({
                                title: "Verification PDF coming soon",
                                description: `We’ll enable verified PDF downloads for ${lab.name} shortly.`,
                              })
                            }
                            className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition hover:bg-foreground/90"
                          >
                            Download verified PDF
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              toast({
                                title: "Badge assets coming soon",
                                description: `Email and website badges for ${lab.name} will be available soon.`,
                              })
                            }
                            className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                          >
                            Get badge assets
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Verification assets unlock once GLASS verifies this lab.
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "equipment" && (
            <div className="space-y-6">
              {ownedLabs.length === 0 ? (
                <div className="rounded-3xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
                  Add a lab profile to start listing equipment and capabilities.
                </div>
              ) : (
                ownedLabs.map(lab => {
                  const equipment = equipmentDrafts[lab.id] ?? [];
                  return (
                    <div key={lab.id} className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm space-y-4">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Equipment</p>
                        <h3 className="text-lg font-semibold text-foreground">{lab.name}</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {equipment.length ? (
                          equipment.map(item => (
                            <span
                              key={item}
                              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                            >
                              {item}
                              {canManageLabs && (
                                <button
                                  type="button"
                                  onClick={() => removeEquipment(lab.id, item)}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No equipment listed yet.</p>
                        )}
                      </div>
                      {canManageLabs && (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            className="w-full max-w-sm rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                            placeholder="Add equipment and press Enter"
                            value={equipmentInput[lab.id] ?? ""}
                            onChange={e =>
                              setEquipmentInput(prev => ({ ...prev, [lab.id]: e.target.value }))
                            }
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addEquipment(lab.id);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => addEquipment(lab.id)}
                            className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                          >
                            Add equipment
                          </button>
                          {equipmentSaving[lab.id] && (
                            <span className="text-xs text-muted-foreground">Saving…</span>
                          )}
                        </div>
                      )}
                      {equipmentError[lab.id] && (
                        <p className="text-xs text-destructive">{equipmentError[lab.id]}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "team" && (
            <div className="space-y-6">
              {ownedLabs.length === 0 ? (
                <div className="rounded-3xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
                  Add a lab profile to build your team directory.
                </div>
              ) : (
                ownedLabs.map(lab => {
                  const members = teamDrafts[lab.id] ?? [];
                  const form = teamForms[lab.id] ?? emptyTeamForm;
                  const editing = teamEditingIndex[lab.id];
                  return (
                    <div key={lab.id} className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm space-y-6">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Team</p>
                        <h3 className="text-lg font-semibold text-foreground">{lab.name}</h3>
                      </div>

                      <div className="space-y-3">
                        {members.length ? (
                          members.map((member, index) => (
                            <div
                              key={`${member.name}-${index}`}
                              className="flex flex-col gap-2 rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between"
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-foreground">{member.name}</p>
                                  {member.isLead && (
                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                      Lead
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{member.title}</p>
                                {member.teamName && (
                                  <p className="text-xs text-muted-foreground">Team: {member.teamName}</p>
                                )}
                                {(member.linkedin || member.website) && (
                                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                    {member.linkedin && (
                                      <a
                                        href={member.linkedin}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="hover:text-primary"
                                      >
                                        LinkedIn
                                      </a>
                                    )}
                                    {member.website && (
                                      <a
                                        href={member.website}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="hover:text-primary"
                                      >
                                        Website
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                              {canManageLabs && (
                                <div className="flex flex-wrap items-center gap-2">
                                  {!member.isLead && (
                                    <button
                                      type="button"
                                      onClick={() => setLeadMember(lab.id, index)}
                                      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                                    >
                                      Make lead
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => editTeamMember(lab.id, index)}
                                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeTeamMember(lab.id, index)}
                                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-destructive hover:text-destructive"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No team members added yet.</p>
                        )}
                      </div>

                      {canManageLabs && (
                        <div className="rounded-2xl border border-border bg-background/70 p-4 space-y-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="grid gap-1">
                              <label className="text-xs font-medium text-muted-foreground">Name</label>
                              <input
                                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                                value={form.name}
                                onChange={e => updateTeamForm(lab.id, { name: e.target.value })}
                              />
                            </div>
                            <div className="grid gap-1">
                              <label className="text-xs font-medium text-muted-foreground">Title</label>
                              <input
                                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                                value={form.title}
                                onChange={e => updateTeamForm(lab.id, { title: e.target.value })}
                              />
                            </div>
                            <div className="grid gap-1">
                              <label className="text-xs font-medium text-muted-foreground">Team name</label>
                              <input
                                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                                value={form.teamName}
                                onChange={e => updateTeamForm(lab.id, { teamName: e.target.value })}
                              />
                            </div>
                            <div className="grid gap-1">
                              <label className="text-xs font-medium text-muted-foreground">Role rank (1-8)</label>
                              <input
                                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                                value={form.roleRank}
                                onChange={e => updateTeamForm(lab.id, { roleRank: e.target.value })}
                              />
                            </div>
                            <div className="grid gap-1">
                              <label className="text-xs font-medium text-muted-foreground">LinkedIn (optional)</label>
                              <input
                                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                                value={form.linkedin}
                                onChange={e => updateTeamForm(lab.id, { linkedin: e.target.value })}
                                placeholder="linkedin.com/in/..."
                              />
                            </div>
                            <div className="grid gap-1">
                              <label className="text-xs font-medium text-muted-foreground">Website (optional)</label>
                              <input
                                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                                value={form.website}
                                onChange={e => updateTeamForm(lab.id, { website: e.target.value })}
                                placeholder="labsite.com"
                              />
                            </div>
                          </div>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={form.isLead}
                              onChange={e => updateTeamForm(lab.id, { isLead: e.target.checked })}
                            />
                            Mark as lead
                          </label>
                          {teamError[lab.id] && <p className="text-xs text-destructive">{teamError[lab.id]}</p>}
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => submitTeamMember(lab.id)}
                              disabled={teamSaving[lab.id]}
                              className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-70"
                            >
                              {editing !== null && editing !== undefined ? "Update team member" : "Save team member"}
                            </button>
                            <button
                              type="button"
                              onClick={() => resetTeamForm(lab.id)}
                              className="rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                            >
                              Clear form
                            </button>
                            {teamSaving[lab.id] && <span className="text-xs text-muted-foreground">Saving…</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "activity" && (
            <>
              {canPostNews ? (
                <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
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
              ) : (
                <div className="rounded-3xl border border-border bg-card/80 p-6 text-sm text-muted-foreground">
                  News updates are available for premier and multi-lab accounts.
                </div>
              )}
            </>
          )}
        </div>
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
