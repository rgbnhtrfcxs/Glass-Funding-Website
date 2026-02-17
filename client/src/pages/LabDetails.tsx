import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Beaker,
  CheckCircle2,
  Globe2,
  Images,
  Linkedin,
  Lock,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Star,
  Unlock,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { useLabs } from "@/context/LabsContext";
import { useAuth } from "@/context/AuthContext";
import { useConsent } from "@/context/ConsentContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { MapboxMap, type MapMarker } from "@/components/maps/MapboxMap";
import { buildAddress, geocodeAddress, mapboxToken } from "@/lib/mapbox";
import { nanoid } from "nanoid";
import type { Team } from "@shared/teams";

interface LabDetailsProps {
  params: {
    id: string;
  };
}

const resolveProfileName = (profile: any, user: { email?: string | null; user_metadata?: any } | null) => {
  const candidates = [
    profile?.name,
    profile?.display_name,
    profile?.legal_full_name,
    user?.user_metadata?.name,
    user?.user_metadata?.full_name,
    user?.user_metadata?.display_name,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const email = typeof user?.email === "string" ? user.email.trim() : "";
  if (email.includes("@")) return email.split("@")[0];
  return "";
};

export default function LabDetails({ params }: LabDetailsProps) {
  const { labs, isLoading } = useLabs();
  const { user } = useAuth();
  const { hasAnalyticsConsent } = useConsent();
  const lab = labs.find(item => item.id === Number(params.id));
  const labId = lab?.id;
  const halConfigured = Boolean(lab?.halStructureId || lab?.halPersonId);
  const primaryErcDiscipline = lab?.primaryErcDisciplineCode
    ? (lab.ercDisciplines ?? []).find(item => item.code === lab.primaryErcDisciplineCode)
    : null;
  const primaryErcDisciplineLabel = lab?.primaryErcDisciplineCode
    ? primaryErcDiscipline?.title
      ? primaryErcDiscipline.title
      : lab.primaryErcDisciplineCode
    : null;
  const topErcLabel = (() => {
    if (primaryErcDisciplineLabel) return primaryErcDisciplineLabel;
    const disciplines = lab?.ercDisciplines ?? [];
    if (disciplines.length > 0) {
      return `${disciplines[0].title}${disciplines.length > 1 ? ` +${disciplines.length - 1}` : ""}`;
    }
    const codes = lab?.ercDisciplineCodes ?? [];
    if (codes.length > 0) {
      return `${codes[0]}${codes.length > 1 ? ` +${codes.length - 1}` : ""}`;
    }
    return null;
  })();
  const [backLabel, setBackLabel] = useState("Back to labs");
  const [profileCanCollaborate, setProfileCanCollaborate] = useState(false);
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [currentUserCanManageMultipleLabs, setCurrentUserCanManageMultipleLabs] = useState(false);
  const [currentUserCanBrokerRequests, setCurrentUserCanBrokerRequests] = useState(false);
  const [defaultProfileName, setDefaultProfileName] = useState("");
  useEffect(() => {
    let mounted = true;
    async function checkRole() {
      if (!user) {
        setProfileCanCollaborate(false);
        setCurrentUserIsAdmin(false);
        setCurrentUserCanManageMultipleLabs(false);
        setCurrentUserCanBrokerRequests(false);
        setDefaultProfileName("");
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        setProfileCanCollaborate(false);
        setCurrentUserIsAdmin(false);
        setCurrentUserCanManageMultipleLabs(false);
        setCurrentUserCanBrokerRequests(false);
        setDefaultProfileName(resolveProfileName(null, user as any));
        return;
      }
      const isAdmin = Boolean((data as any)?.is_admin);
      const canCreateLab = Boolean((data as any)?.can_create_lab);
      const canManageMultipleLabs = Boolean((data as any)?.can_manage_multiple_labs);
      const canBrokerRequests = Boolean((data as any)?.can_broker_requests);
      setProfileCanCollaborate(isAdmin || canCreateLab || canManageMultipleLabs);
      setCurrentUserIsAdmin(isAdmin);
      setCurrentUserCanManageMultipleLabs(canManageMultipleLabs);
      setCurrentUserCanBrokerRequests(canBrokerRequests);
      setDefaultProfileName(resolveProfileName(data, user as any));
    }
    checkRole();
    return () => {
      mounted = false;
    };
  }, [user?.id]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [showAllEquipment, setShowAllEquipment] = useState(false);
  const [showHalModal, setShowHalModal] = useState(false);
  const [halModalType, setHalModalType] = useState<"publications" | "patents">("publications");
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ index: number } | null>(null);
  const [showClaimInfo, setShowClaimInfo] = useState(false);
  const [labMarker, setLabMarker] = useState<MapMarker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "labs-return-target";
    const target = window.sessionStorage.getItem(key);
    if (target === "map") setBackLabel("Back to maps");
    window.sessionStorage.removeItem(key);
  }, []);
  const [labMapLoading, setLabMapLoading] = useState(false);
  const [labMapError, setLabMapError] = useState<string | null>(null);
  const [halItems, setHalItems] = useState<
    Array<{ title: string; url: string; year?: number | null; doi?: string | null }>
  >([]);
  const [halLoading, setHalLoading] = useState(false);
  const [halError, setHalError] = useState<string | null>(null);

  useEffect(() => {
    if (!lab) return;
    if (!mapboxToken) {
      setLabMarker(null);
      setLabMapError("Mapbox token missing. Add VITE_MAPBOX_TOKEN to enable maps.");
      return;
    }

    let active = true;
    const resolveLab = async () => {
      setLabMapLoading(true);
      setLabMapError(null);

      const address = buildAddress([
        lab.addressLine1,
        lab.addressLine2,
        lab.city,
        lab.state,
        lab.postalCode,
        lab.country,
      ]);
      if (!address) {
        setLabMarker(null);
        setLabMapError("No address on file for this lab.");
        setLabMapLoading(false);
        return;
      }

      const point = await geocodeAddress(address);
      if (!active) return;
      if (!point) {
        setLabMarker(null);
        setLabMapError("Unable to locate this address.");
        setLabMapLoading(false);
        return;
      }

      setLabMarker({ id: lab.id, ...point, label: lab.name });
      setLabMapLoading(false);
    };

    resolveLab();
    return () => {
      active = false;
    };
  }, [lab]);
  const [viewRecorded, setViewRecorded] = useState(false);
  const [showInvestor, setShowInvestor] = useState(false);
  const [investorName, setInvestorName] = useState("");
  const [investorEmail, setInvestorEmail] = useState<string>(user?.email || "");
  const [investorCompany, setInvestorCompany] = useState("");
  const [investorWebsite, setInvestorWebsite] = useState("");
  const [investorMessage, setInvestorMessage] = useState("");
  const [investorSubmitting, setInvestorSubmitting] = useState(false);
  const [investorError, setInvestorError] = useState<string | null>(null);
  const [investorSuccess, setInvestorSuccess] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState({
    requesterName: "",
    requesterEmail: user?.email || "",
    organization: "",
    roleTitle: "",
    projectSummary: "",
    workTimeline: "",
    weeklyHoursNeeded: "",
    teamSize: "",
    equipmentNeeds: "",
    complianceNotes: "",
    specialRequirements: "",
    referencesOrLinks: "",
    preferredContactMethods: ["email"],
  });
  const [showCollab, setShowCollab] = useState(false);
  const [collabSubmitting, setCollabSubmitting] = useState(false);
  const [collabError, setCollabError] = useState<string | null>(null);
  const [collabSuccess, setCollabSuccess] = useState<string | null>(null);
  const [collabForm, setCollabForm] = useState({
    contactName: "",
    contactEmail: user?.email || "",
    targetLabs: lab?.name || "",
    collaborationFocus: "",
    resourcesOffered: "",
    desiredTimeline: "",
    additionalNotes: "",
    preferredContact: "email" as "email" | "video_call" | "in_person",
  });
  const [linkedTeams, setLinkedTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    setInvestorEmail(prev => prev || user.email);
    setRequestForm(prev =>
      prev.requesterEmail ? prev : { ...prev, requesterEmail: user.email }
    );
    setCollabForm(prev =>
      prev.contactEmail ? prev : { ...prev, contactEmail: user.email }
    );
  }, [user?.email]);

  useEffect(() => {
    if (!defaultProfileName) return;
    setInvestorName(prev => (prev.trim() ? prev : defaultProfileName));
    setRequestForm(prev =>
      prev.requesterName.trim() ? prev : { ...prev, requesterName: defaultProfileName }
    );
    setCollabForm(prev =>
      prev.contactName.trim() ? prev : { ...prev, contactName: defaultProfileName }
    );
  }, [defaultProfileName, showInvestor, showRequest, showCollab]);

  useEffect(() => {
    if (!lab?.name) return;
    setCollabForm(prev =>
      prev.targetLabs ? prev : { ...prev, targetLabs: lab.name }
    );
  }, [lab?.name]);

  useEffect(() => {
    if (!labId) return;
    let active = true;
    async function loadTeams() {
      setTeamsLoading(true);
      try {
        const res = await fetch(`/api/labs/${labId}/teams`);
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message || "Unable to load teams");
        }
        const data = (await res.json()) as Team[];
        if (active) {
          setLinkedTeams(data ?? []);
          setTeamsError(null);
        }
      } catch (err) {
        if (active) setTeamsError(err instanceof Error ? err.message : "Unable to load teams");
      } finally {
        if (active) setTeamsLoading(false);
      }
    }
    loadTeams();
    return () => {
      active = false;
    };
  }, [labId]);

  const toggleFavorite = async () => {
    if (!user) {
      setFavoriteError("Sign in to favorite labs.");
      return;
    }
    if (!labId) {
      setFavoriteError("Lab not found.");
      return;
    }
    setFavoriteLoading(true);
    setFavoriteError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setFavoriteError("Please sign in again.");
        return;
      }
      const method = isFavorite ? "DELETE" : "POST";
      const res = await fetch(`/api/labs/${labId}/favorite`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Unable to update favorite");
      }
      const payload = await res.json();
      setIsFavorite(Boolean(payload?.favorited));
    } catch (error) {
      setFavoriteError(error instanceof Error ? error.message : "Unable to update favorite");
    } finally {
      setFavoriteLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    async function loadFavorite() {
      if (!user || !labId) {
        setIsFavorite(false);
        return;
      }
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) return;
        const res = await fetch(`/api/labs/${labId}/favorite`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const payload = await res.json();
        if (active) setIsFavorite(Boolean(payload?.favorited));
      } catch {
        // ignore
      }
    }
    loadFavorite();
    return () => {
      active = false;
    };
  }, [labId, user?.id]);

  useEffect(() => {
    if (!showHalModal || !labId) return;
    let active = true;
    if (halModalType === "publications" && !halConfigured) {
      setHalItems([]);
      setHalError(null);
      setHalLoading(false);
      return;
    }
    setHalLoading(true);
    setHalError(null);
    const endpoint =
      halModalType === "patents" ? `/api/labs/${labId}/patents` : `/api/labs/${labId}/hal-publications`;
    fetch(endpoint)
      .then(async res => {
        if (!res.ok) {
          const txt = await res.text();
          let message = txt;
          try {
            const parsed = txt ? JSON.parse(txt) : null;
            if (parsed?.message) message = parsed.message;
          } catch {
            // ignore parse failures
          }
          throw new Error(message || `Unable to load ${halModalType}`);
        }
        return res.json();
      })
      .then(data => {
        if (active) setHalItems(data?.items ?? []);
      })
      .catch(err => {
        if (active) setHalError(err instanceof Error ? err.message : `Unable to load ${halModalType}`);
      })
      .finally(() => {
        if (active) setHalLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showHalModal, halModalType, labId, halConfigured]);

  useEffect(() => {
    if (!hasAnalyticsConsent || viewRecorded || !labId) return;
    const sessionKey = "glass-view-session";
    let sessionId = localStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = nanoid();
      localStorage.setItem(sessionKey, sessionId);
    }
    const lastKey = `glass-view-${labId}`;
    const lastTs = localStorage.getItem(lastKey);
    const now = Date.now();
    if (lastTs && now - Number(lastTs) < 60 * 60 * 1000) {
      setViewRecorded(true);
      return;
    }
    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        await fetch(`/api/labs/${labId}/view`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            labId,
            sessionId,
            referrer: document.referrer || null,
          }),
        });
        localStorage.setItem(lastKey, String(now));
        setViewRecorded(true);
      } catch {
        // ignore
      }
    })();
  }, [labId, viewRecorded, hasAnalyticsConsent]);

  if (isLoading && !lab) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-12">
          <div className="rounded-3xl border border-border bg-card/80 p-8 text-muted-foreground">Loading lab…</div>
        </div>
      </section>
    );
  }

  if (!lab) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-12">
          <div className="rounded-3xl border border-border bg-card/80 p-8 text-muted-foreground">Lab not found.</div>
        </div>
      </section>
    );
  }

  const getImageUrl = (url: string, width = 1600) =>
    url.startsWith("data:")
      ? url
      : `${url}${url.includes("?") ? "&" : "?"}auto=format&fit=crop&w=${width}&q=80`;
  const labStatus = ((lab.labStatus || (lab as any).lab_status || "listed") as string).toLowerCase().trim();
  const isPremier = labStatus === "premier";
  const auditPassed = Boolean(lab.auditPassed);
  const isPendingStatus = ["pending", "confirmed"].includes(labStatus);
  const logoUrl = (lab as any)?.logoUrl ?? (lab as any)?.logo_url ?? null;
  const status = (() => {
    if (isPremier) return "premier";
    if (isPendingStatus) return "pending";
    if (["verified_active", "verified_passive", "verified"].includes(labStatus)) {
      return auditPassed ? "verified" : "pending";
    }
    return "listed";
  })();
  const canRequestLab = status === "verified" || status === "premier";
  const offersLabSpace = Boolean(lab.offersLabSpace);
  const teamGroups = (() => {
    const groups = new Map<string, typeof lab.teamMembers>();
    for (const member of lab.teamMembers) {
      const key = member.teamName?.trim() || "Team";
      const bucket = groups.get(key) ?? [];
      bucket.push(member);
      groups.set(key, bucket);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "Team") return 1;
      if (b === "Team") return -1;
      return a.localeCompare(b);
    });
  })();
  const badgeClass =
    status === "verified" || status === "premier"
      ? "bg-emerald-50 text-emerald-700"
      : status === "pending"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-700";
  const badgeLabel =
    status === "premier"
      ? "Premier"
      : status === "verified"
        ? "Verified"
        : status === "pending"
          ? "Pending"
          : "Added by GLASS";
  const listedDisclaimer = "Profile details compiled by GLASS from publicly available sources.";
  const claimEmail = "contact@glass-funding.com";
  const isListedOnly = status === "listed";
  const isLabOwnerByUserId = Boolean(user?.id) && Boolean(lab.ownerUserId) && lab.ownerUserId === user?.id;
  const isOwnLab = isLabOwnerByUserId;
  const canCollaborate = !isOwnLab && (profileCanCollaborate || currentUserCanBrokerRequests);
  const partnerLogos = lab.partnerLogos ?? [];
  const labTechniques = lab.techniques ?? [];
  const labEquipment = lab.equipment ?? [];
  const configuredPriorityEquipment = lab.priorityEquipment ?? [];
  const primaryEquipment =
    configuredPriorityEquipment.length > 0 ? configuredPriorityEquipment : labEquipment.slice(0, 3);
  const prioritySet = new Set(primaryEquipment);
  const remainingEquipment = labEquipment.filter(item => !prioritySet.has(item));
  const website = lab.website || null;
  const linkedin = lab.linkedin || null;
  const fullAddress = buildAddress([
    lab.addressLine1,
    lab.addressLine2,
    lab.city,
    lab.state,
    lab.postalCode,
    lab.country,
  ]);

  const submitRequest = async () => {
    if (!requestForm.requesterName.trim() || !requestForm.requesterEmail.trim() || !requestForm.projectSummary.trim()) {
      setRequestError("Name, email, and project summary are required.");
      return;
    }
    if (!requestForm.organization.trim() || !requestForm.roleTitle.trim()) {
      setRequestError("Organization and role/title are required.");
      return;
    }
    if (!requestForm.workTimeline.trim() || !requestForm.weeklyHoursNeeded.trim() || !requestForm.teamSize.trim()) {
      setRequestError("Timeline, weekly hours, and team size are required.");
      return;
    }
    if (requestForm.projectSummary.trim().length < 50) {
      setRequestError("Project summary must be at least 50 characters.");
      return;
    }
    if (requestForm.projectSummary.trim().length > 1000) {
      setRequestError("Project summary must be under 1000 characters.");
      return;
    }
    if (!requestForm.preferredContactMethods.length) {
      setRequestError("Select at least one preferred contact method.");
      return;
    }
    setRequestSubmitting(true);
    setRequestError(null);
    setRequestSuccess(null);
    try {
      const res = await fetch("/api/lab-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...requestForm,
          labId: lab.id,
          labName: lab.name,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Unable to submit request");
      }
      setRequestSuccess("Sent! The lab and our team have been notified.");
      setRequestForm(prev => ({
        ...prev,
        requesterName: defaultProfileName || "",
        requesterEmail: user?.email || "",
        organization: "",
        roleTitle: "",
        projectSummary: "",
        workTimeline: "",
        weeklyHoursNeeded: "",
        teamSize: "",
        equipmentNeeds: "",
        complianceNotes: "",
        specialRequirements: "",
        referencesOrLinks: "",
        preferredContactMethods: ["email"],
      }));
      setShowRequest(false);
    } catch (err: any) {
      setRequestError(err?.message || "Unable to submit request");
    } finally {
      setRequestSubmitting(false);
    }
  };

  const submitCollab = async () => {
    if (!collabForm.contactName.trim() || !collabForm.contactEmail.trim() || !collabForm.collaborationFocus.trim()) {
      setCollabError("Name, email, and collaboration focus are required.");
      return;
    }
    setCollabSubmitting(true);
    setCollabError(null);
    setCollabSuccess(null);
    try {
      const res = await fetch("/api/lab-collaborations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...collabForm,
          labId: lab.id,
          targetLabs: collabForm.targetLabs || lab.name,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Unable to submit collaboration");
      }
      setCollabSuccess("Sent! We'll notify the lab team.");
      setCollabForm({
        contactName: defaultProfileName || "",
        contactEmail: user?.email || "",
        targetLabs: lab.name,
        collaborationFocus: "",
        resourcesOffered: "",
        desiredTimeline: "",
        additionalNotes: "",
        preferredContact: "email",
      });
      setShowCollab(false);
    } catch (err: any) {
      setCollabError(err?.message || "Unable to submit collaboration");
    } finally {
      setCollabSubmitting(false);
    }
  };
  const submitInvestor = async () => {
    if (!investorName.trim() || !investorEmail.trim() || !investorMessage.trim()) {
      setInvestorError("Please add your name, email, and a brief message.");
      return;
    }
    setInvestorSubmitting(true);
    setInvestorError(null);
    setInvestorSuccess(null);
    try {
      const res = await fetch(`/api/labs/${lab.id}/investor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: investorName.trim(),
          email: investorEmail.trim(),
          company: investorCompany.trim() || null,
          website: investorWebsite.trim() || null,
          message: investorMessage.trim(),
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Unable to send inquiry");
      }
      setInvestorSuccess("Sent! The lab has been notified.");
      setInvestorName(defaultProfileName || "");
      setInvestorEmail(user?.email || "");
      setInvestorCompany("");
      setInvestorWebsite("");
      setInvestorMessage("");
      setShowInvestor(false);
    } catch (err: any) {
      setInvestorError(err?.message || "Unable to send inquiry");
    } finally {
      setInvestorSubmitting(false);
    }
  };

  if (isLoading && labs.length === 0) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-16 max-w-3xl text-center space-y-6">
          <h1 className="text-4xl font-semibold text-foreground">Loading lab details…</h1>
          <p className="text-muted-foreground">Pulling the latest information from the lab directory.</p>
        </div>
      </section>
    );
  }

  if (!lab) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-16 max-w-3xl text-center space-y-6">
          <h1 className="text-4xl font-semibold text-foreground">Lab not found</h1>
          <p className="text-muted-foreground">
            We could not find the lab you were looking for. It may have been removed or you might
            have followed an outdated link.
          </p>
          <Link href="/labs">
            <a className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary">
              Browse labs
            </a>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12 lg:py-16 max-w-5xl">
        <Link href="/labs" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary">
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mt-8 rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-10"
        >
          <header className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <MapPin className="h-3.5 w-3.5" />
                    {[
                      lab.city,
                      lab.country,
                    ].filter(Boolean).join(", ") || "Location not set"}
                  </span>
                  {status === "verified" || status === "premier" ? (
                    <Link href="/verified-by-glass">
                      <a
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition hover:opacity-90 ${badgeClass}`}
                        title="Learn what Verified by GLASS means"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {badgeLabel}
                      </a>
                    </Link>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}
                      title={isListedOnly ? listedDisclaimer : undefined}
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      {badgeLabel}
                    </span>
                  )}
                  {offersLabSpace && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground">
                      <Unlock className="h-3.5 w-3.5 text-primary" />
                      Offers lab space
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isListedOnly && (
                  <button
                    type="button"
                    onClick={() => setShowClaimInfo(prev => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
                  >
                    Claim this lab
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleFavorite}
                  disabled={favoriteLoading}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-60 disabled:cursor-not-allowed ${
                    isFavorite ? "border-red-500 bg-red-50 text-red-500" : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                  aria-label={isFavorite ? "Unfavorite lab" : "Favorite lab"}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill={isFavorite ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 21s-6.5-4.35-9-8.5C1 7.5 3.5 4 7 4c1.9 0 3.2 1.2 4 2.4C11.8 5.2 13.1 4 15 4c3.5 0 6 3.5 4 8.5-2.5 4.15-9 8.5-9 8.5Z"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {(logoUrl || isPremier) && (
                <div className="h-12 w-12 overflow-hidden rounded-full border border-dashed border-border bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-center flex-shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt={`${lab.name} logo`} className="h-full w-full object-cover" />
                  ) : (
                    "Logo"
                  )}
                </div>
              )}
              <h1 className="text-4xl font-semibold text-foreground">{lab.name}</h1>
            </div>
            {(lab.orgRole || topErcLabel) && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {lab.orgRole && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 font-medium text-foreground">
                    {lab.orgRole}
                  </span>
                )}
                {topErcLabel && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 font-medium text-foreground">
                    {topErcLabel}
                  </span>
                )}
              </div>
            )}
            {lab.descriptionShort ? (
              <p className="text-muted-foreground text-base leading-relaxed text-justify">{lab.descriptionShort}</p>
            ) : (
              <p className="text-muted-foreground text-base leading-relaxed">
                Review compliance, offers, and baseline expectations before requesting space.
              </p>
            )}
            {isListedOnly && showClaimInfo && (
              <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                To claim this lab, email{" "}
                <a className="text-primary underline" href={`mailto:${claimEmail}`}>
                  {claimEmail}
                </a>{" "}
                and tell us you&rsquo;d like to claim the listing.
              </div>
            )}
            {favoriteError && <span className="text-xs text-destructive">{favoriteError}</span>}
          </header>

          {lab.photos.length > 0 && (
            <div className="mt-2 overflow-x-auto pb-2">
              <div className="flex gap-4 min-w-full">
                {lab.photos.map((photo, index) => {
                  const alt = `${lab.name} photo ${index + 1} - ${photo.name}`;
                  return (
                    <button
                      key={photo.url}
                      type="button"
                      onClick={() => setPhotoPreview({ index })}
                      className="min-w-[320px] max-w-[420px] h-64 overflow-hidden rounded-3xl border border-border/80 bg-background/40 flex-shrink-0 cursor-zoom-in"
                      aria-label={`Open ${alt}`}
                    >
                      <img
                        src={getImageUrl(photo.url, 1200)}
                        alt={alt}
                        className="h-full w-full object-cover"
                        loading={index === 0 ? "eager" : "lazy"}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-border/80 bg-background/50 p-6 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Lab leadership
              </span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-primary" />
                {lab.labManager}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4 text-primary" />
                {website || linkedin ? "Connect with the team" : "Social links not provided yet"}
              </div>
              {(website || linkedin) && (
                <div className="flex flex-wrap gap-2">
                  {website && (
                    <a
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
                    >
                      <Globe2 className="h-3.5 w-3.5 text-primary" />
                      Website
                    </a>
                  )}
                  {linkedin && (
                    <a
                      href={linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
                    >
                      <Linkedin className="h-3.5 w-3.5 text-primary" />
                      LinkedIn
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/50 p-6 space-y-3 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Focus areas
              </span>
              <p className="text-sm text-muted-foreground">
                Primary scientific domains supported by the lab team.
              </p>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {lab.focusAreas.map(area => (
                  <span
                    key={area}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1"
                  >
                    {area}
                  </span>
                ))}
              </div>
              {((lab.ercDisciplines ?? []).length > 0 || (lab.ercDisciplineCodes ?? []).length > 0) && (
                <div className="pt-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                    ERC panels
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                    {(lab.ercDisciplines ?? []).length > 0
                      ? (lab.ercDisciplines ?? []).map(item => (
                          <span
                            key={item.code}
                            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1"
                          >
                            {item.code} - {item.title}
                          </span>
                        ))
                      : (lab.ercDisciplineCodes ?? []).map(code => (
                          <span
                            key={code}
                            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1"
                          >
                            {code}
                          </span>
                        ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {lab.descriptionLong && (
            <div className="mt-6 rounded-2xl border border-border/80 bg-background/50 p-6">
              <h2 className="text-lg font-semibold text-foreground">About this lab</h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed text-justify whitespace-pre-line">
                {lab.descriptionLong}
              </p>
            </div>
          )}

          {offersLabSpace && (
            <section className="rounded-2xl border border-border/80 bg-background/50 p-6">
              <h2 className="text-lg font-semibold text-foreground">Pricing & availability offers</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Labs may extend multiple engagement models; choose the approach that best matches your run plan.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {lab.offers.map(offer => (
                  <span
                    key={offer}
                    className="rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {offer}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/80 bg-background/50 p-6">
              <h2 className="text-lg font-semibold text-foreground">Compliance posture</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Compliance certifications and baseline expectations for this lab.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
                {lab.compliance.map(item => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    {item}
                  </span>
                ))}
              </div>
              {lab.complianceDocs.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    Supporting documents
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {lab.complianceDocs.map(doc => (
                      <li key={doc.url}>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 hover:border-primary hover:text-primary transition"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                          {doc.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/50 p-6">
              <h2 className="text-lg font-semibold text-foreground">Equipment inventory</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Priority equipment is highlighted first, followed by the full list.
              </p>
              <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                {primaryEquipment.map(item => (
                  <div key={item} className="inline-flex items-center gap-2">
                    <Beaker className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-primary">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                {(showAllEquipment ? remainingEquipment : remainingEquipment.slice(0, 6)).map(item => (
                  <div key={item} className="inline-flex items-center gap-2">
                    <Beaker className="h-4 w-4 text-primary" />
                    {item}
                  </div>
                ))}
                {labEquipment.length === 0 && <span>No equipment listed yet.</span>}
              </div>
              {remainingEquipment.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllEquipment(prev => !prev)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  {showAllEquipment ? "Show fewer" : `Show ${remainingEquipment.length - 6} more`}
                </button>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border/80 bg-background/50 p-6">
            <h2 className="text-lg font-semibold text-foreground">Techniques & expertise</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Detailed methods and domains where this lab specializes.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {labTechniques.map(technique => (
                <div key={technique.name} className="rounded-2xl border border-border px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{technique.name}</p>
                  {technique.description && (
                    <p className="mt-2 text-xs text-muted-foreground">{technique.description}</p>
                  )}
                </div>
              ))}
              {labTechniques.length === 0 && (
                <p className="text-sm text-muted-foreground">No techniques listed yet.</p>
              )}
            </div>
          </section>

          {lab.teamMembers.length > 0 && (
            <section className="rounded-2xl border border-border/80 bg-background/50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Team members</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Meet the people leading the lab.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTeamModal(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  View team
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {linkedTeams.length > 0 && (
            <section className="rounded-2xl border border-border/80 bg-background/50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Research teams</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Teams linked to this lab and their scientific focus.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTeamsModal(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  View teams
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {linkedTeams.slice(0, 3).map(team => (
                  <span
                    key={team.id}
                    className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                  >
                    {team.name}
                  </span>
                ))}
                {linkedTeams.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{linkedTeams.length - 3} more
                  </span>
                )}
              </div>
            </section>
          )}
          {teamsError && (
            <p className="text-sm text-destructive">{teamsError}</p>
          )}

          {halConfigured && (
            <section className="rounded-2xl border border-border/80 bg-background/50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Publications</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    View the lab&apos;s publications from HAL.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHalModalType("publications");
                      setShowHalModal(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    View publications
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {(partnerLogos.length > 0 &&
            (isPremier ||
              currentUserIsAdmin ||
              (currentUserCanManageMultipleLabs && lab.ownerUserId && lab.ownerUserId === user?.id))) && (
            <div className="mt-8 rounded-2xl border border-primary/40 bg-primary/5 p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Featured partners</h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {partnerLogos.map((logo, idx) => {
                  const card = (
                    <div
                      className="h-20 w-32 overflow-hidden rounded-xl border border-primary/40 bg-background flex-shrink-0"
                      title={logo.name}
                    >
                      <img src={logo.url} alt={logo.name} className="h-full w-full object-cover" />
                    </div>
                  );
                  if (!logo.website) return <div key={`${logo.url}-${idx}`}>{card}</div>;
                  return (
                    <a
                      key={`${logo.url}-${idx}`}
                      href={logo.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex"
                    >
                      {card}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

        {showHalModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 py-8">
            <div className="w-full max-w-3xl rounded-3xl border border-border bg-background p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                  {halModalType === "patents" ? "Patents" : "Publications"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowHalModal(false)}
                  className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {halLoading && (
                  <p className="text-sm text-muted-foreground">
                    Loading {halModalType === "patents" ? "patents" : "publications"}…
                  </p>
                )}
                {halError && <p className="text-sm text-destructive">{halError}</p>}
                {!halLoading && !halError && halItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No {halModalType === "patents" ? "patents" : "publications"} found for this lab.
                  </p>
                )}
                {halItems.map((item, index) => {
                  const content = (
                    <>
                      <div className="min-w-0">
                        <p className="truncate text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.year ? `${item.year} • ` : ""}
                          {item.doi || item.url || "No external link"}
                        </p>
                      </div>
                      {item.url && <ArrowUpRight className="h-4 w-4 flex-shrink-0" />}
                    </>
                  );

                  const className =
                    "flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition";

                  if (!item.url) {
                    return (
                      <div key={`item-${item.title}-${index}`} className={className}>
                        {content}
                      </div>
                    );
                  }

                  return (
                    <a
                      key={`${item.url}-${item.title}-${index}`}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${className} hover:border-primary hover:text-primary`}
                    >
                      {content}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {showTeamModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 py-8">
            <div className="w-full max-w-2xl rounded-3xl border border-border bg-background p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Lab team</h3>
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 space-y-6 max-h-[60vh] overflow-y-auto pr-1">
                {lab.teamMembers.find(member => member.isLead) && (
                  <div className="rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Lead
                    </p>
                    {lab.teamMembers
                      .filter(member => member.isLead)
                      .map(member => (
                        <div key={`${member.name}-${member.title}`} className="mt-3 flex flex-wrap items-center gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{member.name}</p>
                            <span className="mt-1 inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                              {member.title}
                            </span>
                            {(member.linkedin || member.website) && (
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {member.linkedin && (
                                  <a
                                    href={member.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 hover:border-primary hover:text-primary"
                                  >
                                    LinkedIn
                                    <ArrowUpRight className="h-3 w-3" />
                                  </a>
                                )}
                                {member.website && (
                                  <a
                                    href={member.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 hover:border-primary hover:text-primary"
                                  >
                                    Website
                                    <ArrowUpRight className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                {teamGroups.map(([groupName, members]) => (
                  <div key={groupName} className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {groupName} · {members.length}
                    </p>
                    {members.map(member => (
                      member.isLead ? null : (
                      <div
                        key={`${member.name}-${member.title}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {member.name}
                          </p>
                          <span className="mt-1 inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                            {member.title}
                          </span>
                          {(member.linkedin || member.website) && (
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {member.linkedin && (
                                <a
                                  href={member.linkedin}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 hover:border-primary hover:text-primary"
                                >
                                  LinkedIn
                                  <ArrowUpRight className="h-3 w-3" />
                                </a>
                              )}
                              {member.website && (
                                <a
                                  href={member.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 hover:border-primary hover:text-primary"
                                >
                                  Website
                                  <ArrowUpRight className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      )
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      {showTeamsModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 py-8">
            <div className="w-full max-w-3xl rounded-3xl border border-border bg-background p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Research teams</h3>
                <button
                  type="button"
                  onClick={() => setShowTeamsModal(false)}
                  className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {teamsLoading && (
                  <p className="text-sm text-muted-foreground">Loading teams…</p>
      )}

                {teamsError && <p className="text-sm text-destructive">{teamsError}</p>}
                {!teamsLoading && !teamsError && linkedTeams.length === 0 && (
                  <p className="text-sm text-muted-foreground">No teams linked to this lab yet.</p>
                )}
                {linkedTeams.map(team => (
                  <Link
                    key={team.id}
                    href={`/teams/${team.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{team.name}</p>
                      {team.descriptionShort && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{team.descriptionShort}</p>
                      )}
                    </div>
                    <ArrowUpRight className="h-4 w-4 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

      {photoPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur"
          onClick={() => setPhotoPreview(null)}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/30 bg-white/25 shadow-2xl backdrop-blur-2xl"
            onClick={event => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPhotoPreview(null)}
              className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/25 text-sm text-white/90 backdrop-blur transition hover:bg-white/40"
              aria-label="Close"
            >
              ✕
            </button>
            <div className="relative flex items-center justify-center bg-white/10 p-4">
              <button
                type="button"
                onClick={() =>
                  setPhotoPreview(prev => {
                    if (!prev) return prev;
                    const total = lab.photos.length;
                    const nextIndex = (prev.index - 1 + total) % total;
                    return { index: nextIndex };
                  })
                }
                className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/25 text-white/90 backdrop-blur transition hover:bg-white/40"
                aria-label="Previous photo"
              >
                ‹
              </button>
              <img
                src={getImageUrl(lab.photos[photoPreview.index].url, 2000)}
                alt={`${lab.name} photo ${photoPreview.index + 1} - ${lab.photos[photoPreview.index].name}`}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-2xl"
              />
              <button
                type="button"
                onClick={() =>
                  setPhotoPreview(prev => {
                    if (!prev) return prev;
                    const total = lab.photos.length;
                    const nextIndex = (prev.index + 1) % total;
                    return { index: nextIndex };
                  })
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/25 text-white/90 backdrop-blur transition hover:bg-white/40"
                aria-label="Next photo"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}

          <div className="rounded-2xl border border-border/80 bg-background/60 p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Lab location</h3>
                <p className="text-sm text-muted-foreground">
                  A quick visual for where this lab is based.
                </p>
              </div>
              {fullAddress ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full rounded-full border border-border bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur transition hover:border-primary hover:text-primary"
                >
                  {fullAddress}
                </a>
              ) : (
                <div className="inline-flex max-w-full rounded-full border border-border bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                  Address not set
                </div>
              )}
            </div>
            <div className="relative">
              <MapboxMap
                markers={labMarker ? [labMarker] : []}
                resizeKey={labMarker?.id ?? lab?.id ?? "lab"}
                interactive={false}
                className="h-56 w-full rounded-2xl border border-border"
                zoom={12}
              />
            </div>
            {labMapLoading && <p className="text-xs text-muted-foreground">Loading location…</p>}
            {labMapError && <p className="text-xs text-muted-foreground">{labMapError}</p>}
          </div>

          <footer className="flex flex-wrap gap-3 mt-6">
            {canRequestLab && (
              <button
                type="button"
                onClick={() => {
                  setShowRequest(true);
                  setRequestError(null);
                  setRequestSuccess(null);
                }}
                className="inline-flex items-center justify-center rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                Request lab time
              </button>
            )}
            {isPremier && (
              <button
                type="button"
                onClick={() => {
                  setShowInvestor(true);
                  setInvestorError(null);
                  setInvestorSuccess(null);
                }}
                className="inline-flex items-center justify-center rounded-full border border-primary/70 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                Contact for investment
              </button>
            )}
            {canCollaborate && (
              <button
                type="button"
                onClick={() => {
                  setShowCollab(true);
                  setCollabError(null);
                  setCollabSuccess(null);
                }}
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                Collaborate
              </button>
            )}
            <Link
              href="/labs"
              className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              Explore other labs
            </Link>
          </footer>

          {showInvestor && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 py-8">
              <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
                <button
                  type="button"
                  className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowInvestor(false)}
                >
                  ✕
                </button>
                <h3 className="text-lg font-semibold text-foreground">Investor inquiry</h3>
                <p className="mt-1 text-sm text-muted-foreground">Reach out to {lab.name}. We’ll forward this to their team.</p>

                <div className="mt-4 grid gap-3">
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Name</label>
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={investorName}
                      onChange={e => setInvestorName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <input
                      type="email"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={investorEmail}
                      onChange={e => setInvestorEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Company (optional)</label>
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={investorCompany}
                      onChange={e => setInvestorCompany(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Website (optional)</label>
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={investorWebsite}
                      onChange={e => setInvestorWebsite(e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Message</label>
                    <textarea
                      className="min-h-[120px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={investorMessage}
                      onChange={e => setInvestorMessage(e.target.value)}
                      placeholder="Brief intro and what you’re interested in."
                    />
                  </div>
                  {investorError && <p className="text-sm text-destructive">{investorError}</p>}
                  {investorSuccess && <p className="text-sm text-emerald-600">{investorSuccess}</p>}
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition"
                      onClick={() => setShowInvestor(false)}
                      disabled={investorSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-70"
                      onClick={submitInvestor}
                      disabled={investorSubmitting}
                    >
                      {investorSubmitting ? "Sending…" : "Send inquiry"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showRequest && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 py-8">
              <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <button
                  type="button"
                  className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowRequest(false)}
                >
                  ✕
                </button>
                <h3 className="text-lg font-semibold text-foreground">Request lab time</h3>
                <p className="mt-1 text-sm text-muted-foreground">Tell {lab.name} what you need. We’ll route this to their team.</p>

                <div className="mt-4 grid gap-3">
                  <div className="grid gap-1 md:grid-cols-2 md:gap-4">
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-foreground">Your name</label>
                      <input
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        value={requestForm.requesterName}
                        onChange={e => setRequestForm(prev => ({ ...prev, requesterName: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-foreground">Email</label>
                      <input
                        type="email"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        value={requestForm.requesterEmail}
                        onChange={e => setRequestForm(prev => ({ ...prev, requesterEmail: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-1 md:grid-cols-2 md:gap-4">
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-foreground">Organization</label>
                      <input
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        value={requestForm.organization}
                        onChange={e => setRequestForm(prev => ({ ...prev, organization: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-foreground">Role / Title</label>
                      <input
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        value={requestForm.roleTitle}
                        onChange={e => setRequestForm(prev => ({ ...prev, roleTitle: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Project summary</label>
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={requestForm.projectSummary}
                      onChange={e => setRequestForm(prev => ({ ...prev, projectSummary: e.target.value }))}
                      placeholder="We need access to a GMP-ready wet lab for 8 weeks to validate a biosensor prototype."
                    />
                    <p className="text-xs text-muted-foreground">Minimum 50 characters. Max 1000 characters.</p>
                  </div>
                  <div className="grid gap-1 md:grid-cols-2 md:gap-4">
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-foreground">Timeline</label>
                      <input
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        value={requestForm.workTimeline}
                        onChange={e => setRequestForm(prev => ({ ...prev, workTimeline: e.target.value }))}
                        placeholder="Start in 4–6 weeks"
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-foreground">Weekly hours needed</label>
                      <input
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        value={requestForm.weeklyHoursNeeded}
                        onChange={e => setRequestForm(prev => ({ ...prev, weeklyHoursNeeded: e.target.value }))}
                        placeholder="20–30 hrs/week"
                      />
                    </div>
                  </div>
                  <div className="grid gap-1 md:grid-cols-2 md:gap-4">
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-foreground">Team size</label>
                      <input
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        value={requestForm.teamSize}
                        onChange={e => setRequestForm(prev => ({ ...prev, teamSize: e.target.value }))}
                        placeholder="3 researchers"
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-foreground">Equipment needs</label>
                      <input
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        value={requestForm.equipmentNeeds}
                        onChange={e => setRequestForm(prev => ({ ...prev, equipmentNeeds: e.target.value }))}
                        placeholder="HPLC, centrifuge, biosafety hood"
                      />
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Special requirements</label>
                    <textarea
                      className="min-h-[80px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={requestForm.specialRequirements}
                      onChange={e => setRequestForm(prev => ({ ...prev, specialRequirements: e.target.value }))}
                      placeholder="BSL-2 room access, temperature-controlled storage"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Links</label>
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={requestForm.referencesOrLinks}
                      onChange={e => setRequestForm(prev => ({ ...prev, referencesOrLinks: e.target.value }))}
                      placeholder="Optional links to docs or examples"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Preferred contact</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "email", label: "Email" },
                        { value: "video_call", label: "Video call" },
                        { value: "phone", label: "Phone" },
                      ].map(option => {
                        const checked = requestForm.preferredContactMethods.includes(option.value);
                        return (
                          <label
                            key={option.value}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                              checked
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="rounded border-border text-primary"
                              checked={checked}
                              onChange={e =>
                                setRequestForm(prev => ({
                                  ...prev,
                                  preferredContactMethods: e.target.checked
                                    ? [...prev.preferredContactMethods, option.value]
                                    : prev.preferredContactMethods.filter(item => item !== option.value),
                                }))
                              }
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {requestError && <p className="text-sm text-destructive">{requestError}</p>}
                  {requestSuccess && <p className="text-sm text-emerald-600">{requestSuccess}</p>}
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition"
                      onClick={() => setShowRequest(false)}
                      disabled={requestSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-70"
                      onClick={submitRequest}
                      disabled={requestSubmitting}
                    >
                      {requestSubmitting ? "Sending…" : "Send request"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showCollab && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 py-8">
              <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <button
                  type="button"
                  className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCollab(false)}
                >
                  ✕
                </button>
                <h3 className="text-lg font-semibold text-foreground">Collaboration inquiry</h3>
                <p className="mt-1 text-sm text-muted-foreground">Share how you’d like to collaborate with {lab.name}.</p>

                <div className="mt-4 grid gap-3">
                  <div className="grid gap-1 md:grid-cols-2 md:gap-4">
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-foreground">Your name</label>
                      <input
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        value={collabForm.contactName}
                        onChange={e => setCollabForm(prev => ({ ...prev, contactName: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-foreground">Email</label>
                      <input
                        type="email"
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        value={collabForm.contactEmail}
                        onChange={e => setCollabForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Target labs</label>
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={collabForm.targetLabs}
                      onChange={e => setCollabForm(prev => ({ ...prev, targetLabs: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Collaboration focus</label>
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={collabForm.collaborationFocus}
                      onChange={e => setCollabForm(prev => ({ ...prev, collaborationFocus: e.target.value }))}
                      placeholder="What would you like to collaborate on?"
                    />
                  </div>
                  <div className="grid gap-1 md:grid-cols-2 md:gap-4">
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-foreground">Resources offered</label>
                      <textarea
                        className="min-h-[80px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        value={collabForm.resourcesOffered}
                        onChange={e => setCollabForm(prev => ({ ...prev, resourcesOffered: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm font-medium text-foreground">Timeline</label>
                      <input
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        value={collabForm.desiredTimeline}
                        onChange={e => setCollabForm(prev => ({ ...prev, desiredTimeline: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Additional notes</label>
                    <textarea
                      className="min-h-[80px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={collabForm.additionalNotes}
                      onChange={e => setCollabForm(prev => ({ ...prev, additionalNotes: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm font-medium text-foreground">Preferred contact</label>
                    <select
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                      value={collabForm.preferredContact}
                      onChange={e => setCollabForm(prev => ({ ...prev, preferredContact: e.target.value as any }))}
                    >
                      <option value="email">Email</option>
                      <option value="video_call">Video call</option>
                      <option value="in_person">In person</option>
                    </select>
                  </div>
                  {collabError && <p className="text-sm text-destructive">{collabError}</p>}
                  {collabSuccess && <p className="text-sm text-emerald-600">{collabSuccess}</p>}
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition"
                      onClick={() => setShowCollab(false)}
                      disabled={collabSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-70"
                      onClick={submitCollab}
                      disabled={collabSubmitting}
                    >
                      {collabSubmitting ? "Sending…" : "Send collaboration"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {isListedOnly && (
            <p className="mt-10 text-xs text-muted-foreground">
              {listedDisclaimer}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
