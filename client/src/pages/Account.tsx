import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useLabs } from "@/context/LabsContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  ArrowLeft,
  Box,
  ClipboardList,
  FlaskConical,
  Heart,
  IdCard,
  Mail,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  Users,
} from "lucide-react";
import ProfilePortal from "@/pages/ProfilePortal";
import Requests from "@/pages/Requests";
import ManageSelect from "@/pages/ManageSelect";
import ManageTeams from "@/pages/ManageTeams";
import AdminLabs from "@/pages/AdminLabs";
import Favorites from "@/pages/Favorites";
import { GlassIdCard, type GlassIdCardData } from "@/components/GlassIdCard";
import type { Team } from "@shared/teams";

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

type LabGlassIdRow = {
  lab_id: number;
  glass_id: string;
  issued_at: string | null;
  revoked_at: string | null;
  is_active: boolean | null;
  country_code: string | null;
  glass_short: string | null;
  lab_name: string | null;
};

type LabVerificationCertificateRow = {
  id: number;
  lab_id: number;
  glass_id: string | null;
  issued_at: string | null;
  pdf_url: string;
  updated_at?: string | null;
};

type AccountTab = "overview" | "edit" | "requests" | "manageLab" | "manageTeams" | "adminLabs" | "favorites" | "legal";
type OverviewTab = "overview" | "labs" | "equipment" | "team" | "activity";

const ACCOUNT_SECTION_STORAGE_KEY = "glass.account.section";
const ACCOUNT_TABS: AccountTab[] = [
  "overview",
  "edit",
  "requests",
  "manageLab",
  "manageTeams",
  "adminLabs",
  "favorites",
  "legal",
];
const OVERVIEW_TABS: OverviewTab[] = ["overview", "labs", "equipment", "team", "activity"];

function readStoredAccountSection() {
  if (typeof window === "undefined") {
    return { activeTab: null as AccountTab | null, overviewTab: null as OverviewTab | null };
  }
  try {
    const raw = window.localStorage.getItem(ACCOUNT_SECTION_STORAGE_KEY);
    if (!raw) {
      return { activeTab: null as AccountTab | null, overviewTab: null as OverviewTab | null };
    }
    const parsed = JSON.parse(raw) as { activeTab?: unknown; overviewTab?: unknown };
    const activeTab =
      typeof parsed.activeTab === "string" && ACCOUNT_TABS.includes(parsed.activeTab as AccountTab)
        ? (parsed.activeTab as AccountTab)
        : null;
    const overviewTab =
      typeof parsed.overviewTab === "string" && OVERVIEW_TABS.includes(parsed.overviewTab as OverviewTab)
        ? (parsed.overviewTab as OverviewTab)
        : null;
    return { activeTab, overviewTab };
  } catch {
    return { activeTab: null as AccountTab | null, overviewTab: null as OverviewTab | null };
  }
}

export default function Account() {
  const [location] = useLocation();
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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

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
  const [legalTopic, setLegalTopic] = useState("");
  const [legalDetails, setLegalDetails] = useState("");
  const [legalLabId, setLegalLabId] = useState<number | null>(null);
  const [legalError, setLegalError] = useState<string | null>(null);
  const [legalSuccess, setLegalSuccess] = useState<string | null>(null);
  const [legalSubmitting, setLegalSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountTab>(() => readStoredAccountSection().activeTab ?? "overview");
  const [overviewTab, setOverviewTab] = useState<OverviewTab>(() => readStoredAccountSection().overviewTab ?? "overview");
  const [equipmentDrafts, setEquipmentDrafts] = useState<Record<number, string[]>>({});
  const [equipmentInput, setEquipmentInput] = useState<Record<number, string>>({});
  const [equipmentSaving, setEquipmentSaving] = useState<Record<number, boolean>>({});
  const [equipmentError, setEquipmentError] = useState<Record<number, string | null>>({});
  const [teamDrafts, setTeamDrafts] = useState<Record<number, TeamMember[]>>({});
  const [teamForms, setTeamForms] = useState<Record<number, TeamMemberForm>>({});
  const [teamEditingIndex, setTeamEditingIndex] = useState<Record<number, number | null>>({});
  const [teamSaving, setTeamSaving] = useState<Record<number, boolean>>({});
  const [teamError, setTeamError] = useState<Record<number, string | null>>({});
  const [managedTeams, setManagedTeams] = useState<Team[]>([]);
  const [managedTeamsLoading, setManagedTeamsLoading] = useState(false);
  const [managedTeamsError, setManagedTeamsError] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [glassIdsByLab, setGlassIdsByLab] = useState<Record<number, LabGlassIdRow>>({});
  const [certificatesByLab, setCertificatesByLab] = useState<Record<number, LabVerificationCertificateRow>>({});
  const [showGlassIdModal, setShowGlassIdModal] = useState(false);
  const [glassIdModalLabId, setGlassIdModalLabId] = useState<number | null>(null);
  const teamMemberCount = useMemo(
    () => managedTeams.reduce((acc, team) => acc + (team.members?.length ?? 0), 0),
    [managedTeams],
  );
  const labsWithTeamCount = useMemo(
    () => {
      const linkedLabIds = new Set<number>();
      managedTeams.forEach(team => {
        (team.labs ?? []).forEach(lab => linkedLabIds.add(lab.id));
      });
      return linkedLabIds.size;
    },
    [managedTeams],
  );
  const managedTeamsCount = managedTeams.length;
  const equipmentCount = useMemo(
    () => Object.values(equipmentDrafts).reduce((acc, items) => acc + (items?.length ?? 0), 0),
    [equipmentDrafts],
  );

  const profileName = useMemo(() => {
    return profile?.name || profile?.display_name || null;
  }, [profile?.name, profile?.display_name]);

  const isProfileLoading = loading || authLoading;

  const displayLabel = useMemo(() => {
    if (isProfileLoading) return "";
    return profileName || "Your Account";
  }, [isProfileLoading, profileName]);

  const profileEmail = useMemo(() => {
    return profile?.email || user?.email || "";
  }, [profile?.email, user?.email]);

  const avatarLabel = useMemo(() => {
    return profileName || profileEmail || "Your Account";
  }, [profileName, profileEmail]);

  const getAccessToken = async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const initialToken = sessionData.session?.access_token ?? null;
    if (!initialToken) return null;

    const { data: userData, error: userError } = await supabase.auth.getUser(initialToken);
    if (!userError && userData.user) return initialToken;

    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
    return refreshedData.session?.access_token ?? null;
  };

  const fetchAuthed = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = await getAccessToken();
    const headers = new Headers(init?.headers ?? undefined);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const first = await fetch(input, { ...(init ?? {}), headers });
    if (first.status !== 401) return first;

    let shouldRetry = false;
    try {
      const text = (await first.clone().text()).toLowerCase();
      shouldRetry = text.includes("invalid token") || text.includes("missing token");
    } catch {
      shouldRetry = false;
    }
    if (!shouldRetry) return first;

    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    const refreshedToken = refreshedData.session?.access_token ?? null;
    if (refreshError || !refreshedToken) return first;

    headers.set("Authorization", `Bearer ${refreshedToken}`);
    return fetch(input, { ...(init ?? {}), headers });
  };

  const handleProfileSaved = ({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) => {
    setProfile(prev => {
      const base = prev ?? {
        user_id: user?.id ?? "",
        email: user?.email ?? null,
        display_name: null,
        name: null,
      };
      return {
        ...base,
        name,
        avatar_url: avatarUrl,
      };
    });
  };

  const requesterName = useMemo(() => {
    return profileName || profileEmail || "Unknown";
  }, [profileName, profileEmail]);

  const initials = useMemo(() => {
    const from = profileName || user?.email || "?";
    const parts = from.replace(/@.*/, "").trim().split(/\s+/);
    const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0][0];
    return letters.toUpperCase();
  }, [profileName, user?.email]);

  const handleAvatarUpload = async (file: File | null) => {
    if (!file || !user) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user?.id) {
        throw new Error("Please sign in again before uploading a photo.");
      }
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${session.user.id}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const token = session.access_token;
      if (!token) throw new Error("Please sign in again.");

      const response = await fetch("/api/me/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatarUrl: publicUrl }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to save avatar.");
      }

      const payload = await response.json();
      const saved = payload?.profile as Partial<Profile> | null | undefined;
      setProfile(prev => {
        const base: Profile = prev ?? {
          user_id: user.id,
          email: user.email ?? null,
          display_name: null,
          name: null,
        };
        return {
          ...base,
          user_id: saved?.user_id ?? base.user_id,
          email: saved?.email ?? base.email,
          name: saved?.name ?? base.name,
          avatar_url: saved?.avatar_url ?? publicUrl,
        };
      });
    } catch (err: any) {
      setAvatarError(err?.message || "Failed to upload avatar.");
    } finally {
      setAvatarUploading(false);
    }
  };

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
        const statsRes = await fetchAuthed("/api/my-labs/analytics");
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
          const reqRes = await fetchAuthed("/api/my-labs/requests");
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
          const favRes = await fetchAuthed("/api/favorites");
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

  useEffect(() => {
    let active = true;
    async function loadManagedTeams() {
      if (!user) {
        setManagedTeams([]);
        setManagedTeamsError(null);
        return;
      }
      setManagedTeamsLoading(true);
      try {
        const response = await fetchAuthed("/api/my-teams");
        if (response.status === 403) {
          if (active) {
            setManagedTeams([]);
            setManagedTeamsError(null);
          }
          return;
        }
        if (!response.ok) {
          const txt = await response.text();
          throw new Error(txt || "Unable to load teams");
        }
        const payload = (await response.json()) as Team[];
        if (active) {
          setManagedTeams(Array.isArray(payload) ? payload : []);
          setManagedTeamsError(null);
        }
      } catch (err: any) {
        if (active) {
          setManagedTeams([]);
          setManagedTeamsError(err?.message || "Unable to load teams");
        }
      } finally {
        if (active) setManagedTeamsLoading(false);
      }
    }
    if (!authLoading) loadManagedTeams();
    return () => {
      active = false;
    };
  }, [authLoading, user?.id, activeTab, overviewTab]);

  const labStatusValue = (lab: { labStatus?: string | null; lab_status?: string | null }) =>
    (lab.labStatus || lab.lab_status || "listed").toLowerCase();
  const labStatusLabel = (lab: { labStatus?: string | null; lab_status?: string | null }) => {
    const status = labStatusValue(lab);
    if (status === "verified_passive" || status === "verified_active") return "Verified";
    if (status === "premier") return "Premier";
    if (status === "confirmed") return "Confirmed";
    if (status === "listed") return "Listed";
    return status.replaceAll("_", " ");
  };
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
  const unreadRequestCount = collabCount + contactCount;
  const unreadRequestLabel = unreadRequestCount > 99 ? "99+" : String(unreadRequestCount);
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
  const selectedGlassLab = useMemo(
    () => ownedLabs.find(l => l.id === glassIdModalLabId) ?? null,
    [ownedLabs, glassIdModalLabId],
  );
  const selectedGlassRecord = useMemo(
    () => (glassIdModalLabId ? glassIdsByLab[glassIdModalLabId] ?? null : null),
    [glassIdModalLabId, glassIdsByLab],
  );
  const selectedGlassCardData = useMemo<GlassIdCardData | null>(() => {
    if (!selectedGlassLab) return null;

    const city = (selectedGlassLab as any).city ?? null;
    const country = (selectedGlassLab as any).country ?? null;
    const location = [city, country].filter(Boolean).join(", ") || selectedGlassRecord?.country_code || null;
    const fallbackGlassId = `GLS-PENDING-${String(selectedGlassLab.id).padStart(4, "0")}`;

    return {
      glassId: selectedGlassRecord?.glass_id || selectedGlassRecord?.glass_short || fallbackGlassId,
      labName: selectedGlassRecord?.lab_name || selectedGlassLab.name,
      location,
      countryCode: selectedGlassRecord?.country_code || country,
      isActive: selectedGlassRecord?.is_active ?? isLabVerified(selectedGlassLab.id),
      revokedAt: selectedGlassRecord?.revoked_at ?? null,
      issuedAt: selectedGlassRecord?.issued_at ?? null,
    };
  }, [isLabVerified, selectedGlassLab, selectedGlassRecord]);
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

  const openGlassIdModal = (labId: number) => {
    setGlassIdModalLabId(labId);
    setShowGlassIdModal(true);
  };
  const closeGlassIdModal = () => {
    setShowGlassIdModal(false);
    setGlassIdModalLabId(null);
  };

  useEffect(() => {
    if (newsLabId) return;
    const fallbackId = ownedLabs[0]?.id ?? labStats[0]?.id ?? null;
    if (fallbackId) setNewsLabId(fallbackId);
  }, [ownedLabs, labStats, newsLabId]);

  useEffect(() => {
    let active = true;

    async function loadGlassIds() {
      if (!user) {
        if (active) setGlassIdsByLab({});
        return;
      }

      const ownedLabIds = ownedLabs.map(lab => lab.id).filter(id => Number.isFinite(id));
      if (!ownedLabIds.length) {
        if (active) setGlassIdsByLab({});
        return;
      }

      const { data, error } = await supabase
        .from("lab_glass_ids_view")
        .select("lab_id, glass_id, issued_at, revoked_at, is_active, country_code, glass_short, lab_name")
        .in("lab_id", ownedLabIds);

      if (!active) return;
      if (error || !Array.isArray(data)) {
        setGlassIdsByLab({});
        return;
      }

      const next: Record<number, LabGlassIdRow> = {};
      data.forEach((rawRow: any) => {
        const labId = Number(rawRow?.lab_id);
        if (!Number.isFinite(labId)) return;

        const row: LabGlassIdRow = {
          lab_id: labId,
          glass_id: String(rawRow?.glass_id ?? ""),
          issued_at: rawRow?.issued_at ?? null,
          revoked_at: rawRow?.revoked_at ?? null,
          is_active: rawRow?.is_active ?? null,
          country_code: rawRow?.country_code ?? null,
          glass_short: rawRow?.glass_short ?? null,
          lab_name: rawRow?.lab_name ?? null,
        };

        const prev = next[labId];
        if (!prev) {
          next[labId] = row;
          return;
        }

        const prevScore = (prev.is_active ? 2 : 0) + (prev.issued_at ? 1 : 0);
        const rowScore = (row.is_active ? 2 : 0) + (row.issued_at ? 1 : 0);
        const prevIssued = prev.issued_at ? new Date(prev.issued_at).getTime() : 0;
        const rowIssued = row.issued_at ? new Date(row.issued_at).getTime() : 0;

        if (rowScore > prevScore || rowIssued > prevIssued) {
          next[labId] = row;
        }
      });

      setGlassIdsByLab(next);
    }

    if (!authLoading) {
      void loadGlassIds();
    }

    return () => {
      active = false;
    };
  }, [authLoading, ownedLabs, user?.id]);

  useEffect(() => {
    let active = true;

    async function loadVerificationCertificates() {
      if (!user) {
        if (active) setCertificatesByLab({});
        return;
      }

      try {
        const response = await fetchAuthed("/api/my-labs/certificates");
        if (!active) return;
        if (!response.ok) {
          setCertificatesByLab({});
          return;
        }
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          setCertificatesByLab({});
          return;
        }
        const rows = (await response.json()) as LabVerificationCertificateRow[];
        if (!Array.isArray(rows)) {
          setCertificatesByLab({});
          return;
        }
        const next: Record<number, LabVerificationCertificateRow> = {};
        rows.forEach(row => {
          const labId = Number(row?.lab_id);
          if (!Number.isFinite(labId) || !row?.pdf_url) return;
          const previous = next[labId];
          if (!previous) {
            next[labId] = row;
            return;
          }
          const previousIssued = previous.issued_at ? new Date(previous.issued_at).getTime() : 0;
          const currentIssued = row.issued_at ? new Date(row.issued_at).getTime() : 0;
          if (currentIssued >= previousIssued) {
            next[labId] = row;
          }
        });
        setCertificatesByLab(next);
      } catch {
        if (active) setCertificatesByLab({});
      }
    }

    if (!authLoading) {
      void loadVerificationCertificates();
    }

    return () => {
      active = false;
    };
  }, [authLoading, user?.id, ownedLabs]);

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

  async function submitLegalRequest() {
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
          name: requesterName,
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
    } catch (err: any) {
      setLegalError(err?.message || "Unable to send request");
    } finally {
      setLegalSubmitting(false);
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

  useEffect(() => {
    try {
      const [pathname] = location.split("?");
      if (pathname === "/account/edit") {
        setActiveTab("edit");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      const sub = params.get("sub");
      if (tab && ACCOUNT_TABS.includes(tab as AccountTab)) {
        setActiveTab(tab as AccountTab);
        if (tab === "overview" && sub && OVERVIEW_TABS.includes(sub as OverviewTab)) {
          setOverviewTab(sub as OverviewTab);
        }
      }
    } catch {
      // ignore invalid query params
    }
  }, [location]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        ACCOUNT_SECTION_STORAGE_KEY,
        JSON.stringify({ activeTab, overviewTab }),
      );
    } catch {
      // ignore storage write issues
    }
  }, [activeTab, overviewTab]);

  const tabs: Array<{ id: typeof activeTab; label: ReactNode; hidden?: boolean }> = [
    { id: "overview", label: "Overview" },
    { id: "edit", label: "Edit account" },
    { id: "requests", label: "Requests", hidden: !(profile && toBool(profile.can_broker_requests)) },
    { id: "manageLab", label: "Manage lab", hidden: !(profile && toBool(profile.can_create_lab)) },
    { id: "manageTeams", label: "Manage teams", hidden: !(profile && toBool(profile.can_manage_teams)) },
    { id: "adminLabs", label: "Admin labs", hidden: !(profile && toBool(profile.is_admin)) },
    { id: "favorites", label: `Favorites (${favoriteLabs.length})` },
    { id: "legal", label: "Legal assistance", hidden: !(profile && (toBool(profile.can_create_lab) || toBool(profile.can_manage_teams))) },
  ];

  const overviewTabs = [
    { id: "overview", label: "Dashboard", icon: Activity },
    { id: "labs", label: "Labs", icon: FlaskConical },
    { id: "team", label: "Team", icon: Users },
    { id: "activity", label: "Activity", icon: ClipboardList },
  ] as const;


  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 lg:py-24 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <label className="group relative cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0] ?? null;
                  void handleAvatarUpload(file);
                  if (e.target) e.target.value = "";
                }}
                disabled={avatarUploading}
              />
              <Avatar className="h-14 w-14">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt={avatarLabel} />
                <AvatarFallback className="text-base font-semibold bg-gradient-to-br from-indigo-500/20 to-pink-500/20 text-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition group-hover:bg-black/10" />
              <span className="pointer-events-none absolute left-1/2 top-full mt-2 w-max -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-background opacity-0 transition group-hover:opacity-100">
                Click to upload
              </span>
              {avatarUploading && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-background/70 text-[10px] font-medium text-muted-foreground">
                  Uploading…
                </span>
              )}
            </label>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
                  {isProfileLoading ? (
                    <span className="inline-block h-7 w-40 rounded bg-muted animate-pulse" />
                  ) : (
                    displayLabel
                  )}
                </h1>
              </div>
              {isProfileLoading ? (
                <span className="inline-block h-3 w-36 rounded bg-muted animate-pulse" />
              ) : (
                <p className="text-[11px] md:text-xs text-muted-foreground">{profileEmail}</p>
              )}
              {avatarError && <p className="text-xs text-destructive">{avatarError}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile && toBool(profile.can_broker_requests) && (
              <button
                type="button"
                onClick={() => setActiveTab("requests")}
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                  activeTab === "requests"
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}
                aria-label="Requests"
                title="Requests"
              >
                <Mail className="h-5 w-5" />
                {unreadRequestCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">
                    {unreadRequestLabel}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("favorites")}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                activeTab === "favorites"
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
              aria-label="Favorites"
              title="Favorites"
            >
              <Heart className="h-5 w-5" />
            </button>
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
              <p className="text-sm text-muted-foreground">For premier labs. We’ll review and feature these on the main page.</p>

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

                {newsError && <p className="text-sm text-destructive">{newsError}</p>}
                {newsSuccess && <p className="text-sm text-emerald-600">{newsSuccess}</p>}

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
                    className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-70"
                    disabled={newsSubmitting}
                  >
                    {newsSubmitting ? "Posting…" : "Post update"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showGlassIdModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-10"
            onClick={closeGlassIdModal}
          >
            {selectedGlassCardData ? (
              <div
                className="pointer-events-auto relative w-[min(92vw,420px)] overflow-visible"
                onClick={event => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="absolute -right-6 -top-6 z-10 rounded-full border border-white/50 bg-black/25 px-2.5 py-0.5 text-sm text-white/90 transition hover:bg-black/45 hover:text-white"
                  onClick={closeGlassIdModal}
                  aria-label="Close GLASS-ID card"
                >
                  ✕
                </button>
                <GlassIdCard
                  data={selectedGlassCardData}
                  variant="issuance"
                  issued
                  showFullId
                  className="max-w-none"
                />
              </div>
            ) : (
              <div
                className="pointer-events-auto relative rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground"
                onClick={event => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="absolute -right-6 -top-6 z-10 rounded-full border border-white/50 bg-black/25 px-2.5 py-0.5 text-sm text-white/90 transition hover:bg-black/45 hover:text-white"
                  onClick={closeGlassIdModal}
                  aria-label="Close GLASS-ID card"
                >
                  ✕
                </button>
                Unable to load GLASS-ID for this lab.
              </div>
            )}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Overview</p>
              <div className="space-y-1">
                {overviewTabs.map(tab => {
                  const isActive =
                    (activeTab === "overview" && overviewTab === tab.id) ||
                    (activeTab === "overview" && overviewTab === "equipment" && tab.id === "labs") ||
                    (activeTab === "manageLab" && tab.id === "labs") ||
                    (activeTab === "manageTeams" && tab.id === "team");
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveTab("overview");
                        setOverviewTab(tab.id);
                      }}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                        isActive
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Account</p>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("edit")}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                    activeTab === "edit"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <UserCog className="h-4 w-4" />
                    Edit account
                  </span>
                </button>
                {profile && (toBool(profile.can_create_lab) || toBool(profile.can_manage_teams)) && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("legal")}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                      activeTab === "legal"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Legal assistance
                    </span>
                  </button>
                )}
                {profile && toBool(profile.is_admin) && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("adminLabs")}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-medium transition ${
                      activeTab === "adminLabs"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" />
                      Admin labs
                    </span>
                  </button>
                )}
              </div>
            </div>
          </aside>

          <div className="space-y-8">
            {ownedUnverifiedLabs.length > 0 && (
              <div className="flex justify-end">
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
              </div>
            )}
          {activeTab === "overview" && (
            <>
              {overviewTab === "overview" && (
                <>
                  {canSeeDashboard ? (
                    <div className="flex flex-col gap-6 lg:flex-row">
                      <motion.div
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex-1 rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-background to-primary/10 p-8 shadow-sm"
                      >
                        <div
                          className="flex items-center justify-between gap-3 cursor-pointer select-none"
                          onClick={() => setShowDashboard(prev => !prev)}
                        >
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Activity className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Dashboard</p>
                                <h2 className="text-xl font-semibold text-foreground">Your activity at a glance</h2>
                              </div>
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
                                              {premium ? "Premier" : labStatusLabel(lab as any)} • {lab.isVisible === false ? "Hidden" : "Visible"}
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

              {overviewTab === "labs" && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="flex items-center gap-2 text-xl font-semibold text-foreground">
                          <FlaskConical className="h-5 w-5 text-primary" />
                          Your lab overview
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          A structured snapshot of your linked labs, visibility, and equipment.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOverviewTab("equipment")}
                          className="inline-flex items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                        >
                          Add equipments
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("manageLab")}
                          className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                        >
                          Manage labs
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <InfoTile label="Labs linked" value={labStats.length.toString()} />
                      <InfoTile label="Equipment" value={equipmentCount.toString()} />
                    </div>

                    <div className="mt-8">
                      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">All linked labs</p>
                      {ownedLabs.length === 0 ? (
                        <div className="mt-3 rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                          No labs linked yet.
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {ownedLabs.map(lab => {
                            const status = labStatusValue(lab as any);
                            const verified = isLabVerified(lab.id);
                            const city = (lab as any).city ?? null;
                            const country = (lab as any).country ?? null;
                            const location = [city, country].filter(Boolean).join(", ");
                            const glassRecord = glassIdsByLab[lab.id];
                            const isActiveGlassId =
                              glassRecord?.is_active ?? ["verified_passive", "verified_active", "premier"].includes(status);
                            const verificationCertificate = certificatesByLab[lab.id] ?? null;
                            return (
                              <div
                                key={lab.id}
                                className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-foreground">{lab.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {labStatusLabel(lab as any)} • {(lab as any).isVisible === false ? "Hidden" : "Visible"}
                                    </p>
                                    {location ? (
                                      <p className="mt-1 text-xs text-muted-foreground">{location}</p>
                                    ) : null}
                                  </div>
                                  <Link href={`/lab/manage/${lab.id}`} className="text-xs font-medium text-primary hover:underline">
                                    Manage
                                  </Link>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
                                    Status: {verified ? "Verified" : "Unverified"}
                                  </span>
                                </div>

                                {(verified || verificationCertificate) && (
                                  <div className="mt-4 flex flex-wrap items-center gap-2">
                                    {verified && (
                                      <button
                                        type="button"
                                        onClick={() => openGlassIdModal(lab.id)}
                                        className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                                      >
                                        <IdCard className="h-3.5 w-3.5" />
                                        {isActiveGlassId ? "View GLASS-ID" : "View GLASS-ID (inactive)"}
                                      </button>
                                    )}
                                    {verificationCertificate && (
                                      <a
                                        href={verificationCertificate.pdf_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                                      >
                                        View certificate
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {overviewTab === "equipment" && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setOverviewTab("labs")}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Back
                    </button>
                    <div className="flex items-center gap-2">
                      <Box className="h-4 w-4 text-primary" />
                      <h3 className="text-lg font-semibold text-foreground">Equipment</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Manage equipment lists for each lab.</p>
                  </div>
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
                </motion.div>
              )}

              {overviewTab === "team" && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                          <Users className="h-4 w-4 text-primary" />
                          Your team overview
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">Quick snapshot of team members across labs.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("manageTeams")}
                        className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                      >
                        Manage teams
                      </button>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <InfoTile label="Teams managed" value={managedTeamsCount.toString()} />
                      <InfoTile label="Team members" value={teamMemberCount.toString()} />
                      <InfoTile label="Labs with teams" value={labsWithTeamCount.toString()} />
                    </div>
                    {managedTeamsLoading && (
                      <p className="mt-3 text-xs text-muted-foreground">Loading team stats…</p>
                    )}
                    {managedTeamsError && (
                      <p className="mt-3 text-xs text-destructive">{managedTeamsError}</p>
                    )}
                    <div className="mt-6 space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">Your teams</h4>
                      {managedTeamsLoading ? (
                        <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                          Loading teams…
                        </div>
                      ) : managedTeams.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                          No teams linked to your account yet.
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {managedTeams.map(team => {
                            const linkedLabs = team.labs ?? [];
                            const members = team.members ?? [];
                            return (
                              <Link key={team.id} href={`/teams/${team.id}`}>
                                <a className="block rounded-2xl border border-border bg-background/70 p-4 transition hover:border-primary/50 hover:bg-background hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-medium text-foreground">{team.name}</p>
                                      {team.descriptionShort && (
                                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{team.descriptionShort}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                    <span className="rounded-full border border-border px-2 py-1 text-muted-foreground">
                                      {members.length} member{members.length === 1 ? "" : "s"}
                                    </span>
                                    <span className="rounded-full border border-border px-2 py-1 text-muted-foreground">
                                      {linkedLabs.length} lab{linkedLabs.length === 1 ? "" : "s"}
                                    </span>
                                  </div>
                                  {linkedLabs.length > 0 && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      Labs: {linkedLabs.slice(0, 3).map(lab => lab.name).join(", ")}
                                      {linkedLabs.length > 3 ? " +" : ""}
                                    </p>
                                  )}
                                </a>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {overviewTab === "activity" && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  {canPostNews ? (
                    <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">News</p>
                          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                            <ClipboardList className="h-4 w-4 text-primary" />
                            Recent updates from your labs
                          </h3>
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
                </motion.div>
              )}
            </>
          )}
          {activeTab === "edit" && <ProfilePortal embedded onProfileSaved={handleProfileSaved} />}

          {activeTab === "requests" && <Requests embedded />}

          {activeTab === "manageLab" && (
            <div className="space-y-4">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("overview");
                    setOverviewTab("labs");
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back
                </button>
              </div>
              <ManageSelect embedded />
            </div>
          )}

          {activeTab === "manageTeams" && (
            <ManageTeams
              embedded
              onBack={() => {
                setActiveTab("overview");
                setOverviewTab("team");
              }}
            />
          )}

          {activeTab === "adminLabs" && <AdminLabs embedded />}

          {activeTab === "favorites" && <Favorites embedded />}

          {activeTab === "legal" && (
            <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Connect with legal support
              </h3>
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
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary"
                    onClick={() => {
                      setLegalError(null);
                      setLegalSuccess(null);
                      setLegalTopic("");
                      setLegalDetails("");
                      setLegalLabId(labStats[0]?.id ?? null);
                    }}
                    disabled={legalSubmitting}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={submitLegalRequest}
                    className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-70"
                    disabled={legalSubmitting}
                  >
                    {legalSubmitting ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
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
      <p className="text-sm font-medium text-foreground/80">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function CardStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
      <p className="text-sm font-medium text-foreground/80">{label}</p>
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
          <p className="text-sm font-medium text-foreground/80">{title}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {badge ? <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">{badge}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{primary}</p>
      <p className="text-sm text-muted-foreground truncate">{secondary}</p>
    </div>
  );
}
