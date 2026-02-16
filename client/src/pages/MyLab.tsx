import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Edit2,
  FileCheck2,
  FileDown,
  ImageIcon,
  MapPin,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useConsent } from "@/context/ConsentContext";
import { supabase } from "@/lib/supabaseClient";
import {
  orgRoleOptions,
  type ErcDomainOption,
  type ErcDisciplineOption,
  type LabTechnique,
  type OfferOption,
  type MediaAsset,
  type OrgRoleOption,
  type PartnerLogo,
} from "@shared/labs";
import type { LabOfferTaxonomyOption } from "@shared/labOffers";
import { LabOfferProfileEditor } from "@/components/labs/LabOfferProfileEditor";
import {
  defaultLabOfferProfileDraft,
  draftFromProfile,
  draftToLegacyOffers,
  draftToProfilePayload,
  fetchLabOfferProfile,
  fetchLabOfferTaxonomy,
  type LabOfferProfileDraft,
  upsertLabOfferProfile,
} from "@/lib/labOfferProfile";
import { fetchErcDisciplineOptions } from "@/lib/ercDisciplines";
import { Link, useLocation } from "wouter";

const INPUT_CLASS =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const PHOTO_THUMB_CLASS = "h-24 w-full rounded object-cover transition duration-200 group-hover:brightness-110";
const BASICS_INPUT_CLASS =
  "w-full rounded-none border-0 border-b border-border bg-transparent px-0 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary";
const BASICS_LABEL_CLASS = "text-xs font-semibold tracking-[0.02em] text-foreground/90";
const BASICS_FIELD_CLASS = "rounded-xl border border-border/70 bg-background/40 px-4 py-3";

const ROLE_RANK_HELP_ITEMS = [
  "1 = Lab Director",
  "2 = Deputy Director",
  "3 = Team Leader",
  "4 = Researcher",
  "5 = Postdoc",
  "6 = PhD Student",
  "7 = Research/Technical support",
];

const TAB_ORDER = [
  "Basics",
  "Branding",
  "Location",
  "Compliance",
  "Team",
  "Photos",
  "Offers",
] as const;

const TAB_ICONS: Record<(typeof TAB_ORDER)[number], LucideIcon> = {
  Basics: Edit2,
  Branding: ClipboardList,
  Location: MapPin,
  Compliance: ShieldCheck,
  Team: Users,
  Photos: ImageIcon,
  Offers: FileCheck2,
};

type Form = {
  name: string;
  labManager: string;
  contactEmail: string;
  logoUrl: string;
  siretNumber: string;
  offersLabSpace: boolean;
  descriptionShort: string;
  descriptionLong: string;
  orgRole: "" | OrgRoleOption;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  website: string;
  linkedin: string;
  partnerLogos: PartnerLogo[];
  complianceTags: string[];
  halStructureId: string;
  halPersonId: string;
  teamMembers: Array<{
    name: string;
    title: string;
    linkedin?: string | null;
    website?: string | null;
    teamName?: string | null;
    roleRank?: number | null;
    isLead?: boolean;
  }>;
  equipmentTags: string[];
  priorityEquipmentTags: string[];
  techniques: LabTechnique[];
  focusTags: string[];
  ercDisciplineCodes: string[];
  primaryErcDisciplineCode: string;
  offers: OfferOption[];
};

export default function MyLab({ params }: { params: { id: string } }) {
  const labIdParam = Number(params?.id);
  const { user } = useAuth();
  const { hasFunctionalConsent } = useConsent();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [labStatus, setLabStatus] = useState<string>("listed");
  const [profileCaps, setProfileCaps] = useState<{
    canCreateLab: boolean;
    canManageMultipleLabs: boolean;
    canManageTeams: boolean;
    canManageMultipleTeams: boolean;
    canPostNews: boolean;
    canBrokerRequests: boolean;
    canReceiveInvestor: boolean;
  }>({
    canCreateLab: false,
    canManageMultipleLabs: false,
    canManageTeams: false,
    canManageMultipleTeams: false,
    canPostNews: false,
    canBrokerRequests: false,
    canReceiveInvestor: false,
  });
  const [analytics, setAnalytics] = useState<{
    views7d: number;
    views30d: number;
    favorites: number;
    recentFavorites: { userId: string; createdAt: string }[];
  } | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [labId, setLabId] = useState<number | null>(Number.isNaN(labIdParam) ? null : labIdParam);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [photos, setPhotos] = useState<MediaAsset[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<MediaAsset[]>([]);
  const [complianceUploading, setComplianceUploading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof TAB_ORDER)[number]>("Basics");
  const [form, setForm] = useState<Form>({
    name: "",
    labManager: "",
    contactEmail: "",
    logoUrl: "",
    siretNumber: "",
    offersLabSpace: false,
    descriptionShort: "",
    descriptionLong: "",
    orgRole: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    website: "",
    linkedin: "",
    partnerLogos: [],
    complianceTags: [],
    halStructureId: "",
    halPersonId: "",
    teamMembers: [],
    equipmentTags: [],
    priorityEquipmentTags: [],
    techniques: [],
    focusTags: [],
    ercDisciplineCodes: [],
    primaryErcDisciplineCode: "",
    offers: [],
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [partnerLogos, setPartnerLogos] = useState<PartnerLogo[]>([]);
  const [teamMemberInput, setTeamMemberInput] = useState({
    name: "",
    title: "",
    linkedin: "",
    website: "",
    teamName: "",
    roleRank: "",
  });
  const [tagInput, setTagInput] = useState<{ field: "complianceTags" | "equipmentTags" | "focusTags"; value: string }>({
    field: "complianceTags",
    value: "",
  });
  const [techniqueInput, setTechniqueInput] = useState<LabTechnique>({ name: "", description: "" });
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [draggingPhotoIndex, setDraggingPhotoIndex] = useState<number | null>(null);
  const [photoDeleteConfirmOpen, setPhotoDeleteConfirmOpen] = useState(false);
  const [pendingPhotoDelete, setPendingPhotoDelete] = useState<MediaAsset | null>(null);
  const [teamMembersExpanded, setTeamMembersExpanded] = useState(true);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [showRoleHelp, setShowRoleHelp] = useState(false);
  const [pinRoleHelp, setPinRoleHelp] = useState(false);
  const [teamLinkRequests, setTeamLinkRequests] = useState<Array<{
    id: number;
    team_id: number;
    status: string;
    created_at: string;
    teams?: { id: number; name: string; description_short?: string | null; logo_url?: string | null } | null;
  }>>([]);
  const [teamLinkLoading, setTeamLinkLoading] = useState(false);
  const [teamLinkError, setTeamLinkError] = useState<string | null>(null);
  const [offerProfileDraft, setOfferProfileDraft] = useState<LabOfferProfileDraft>(defaultLabOfferProfileDraft);
  const [offerTaxonomy, setOfferTaxonomy] = useState<LabOfferTaxonomyOption[]>([]);
  const [offerTaxonomyLoading, setOfferTaxonomyLoading] = useState(false);
  const [offerProfileError, setOfferProfileError] = useState<string | null>(null);
  const [ercOptions, setErcOptions] = useState<ErcDisciplineOption[]>([]);
  const [ercLoading, setErcLoading] = useState(false);
  const [ercError, setErcError] = useState<string | null>(null);
  const [primaryErcDomain, setPrimaryErcDomain] = useState<ErcDomainOption>("LS");
  const [secondaryErcDomain, setSecondaryErcDomain] = useState<ErcDomainOption>("LS");
  const draftKey = useMemo(() => `my-lab-draft:${labIdParam || "unknown"}`, [labIdParam]);
  const canUseLogo = ["verified_passive", "verified_active", "premier"].includes((labStatus || "listed").toLowerCase());
  const canUsePartnerLogos =
    (labStatus || "").toLowerCase() === "premier" || profileCaps.canManageMultipleLabs;
  const ercLabelByCode = useMemo(
    () => new Map(ercOptions.map(option => [option.code, `${option.code} - ${option.title}`])),
    [ercOptions],
  );
  const primaryDomainOptions = useMemo(
    () => ercOptions.filter(option => option.domain === primaryErcDomain),
    [ercOptions, primaryErcDomain],
  );
  const secondaryDomainOptions = useMemo(
    () =>
      ercOptions.filter(
        option => option.domain === secondaryErcDomain && option.code !== form.primaryErcDisciplineCode,
      ),
    [ercOptions, secondaryErcDomain, form.primaryErcDisciplineCode],
  );

  useEffect(() => {
    let active = true;
    setErcLoading(true);
    setErcError(null);
    fetchErcDisciplineOptions()
      .then(options => {
        if (!active) return;
        setErcOptions(options);
      })
      .catch((err: any) => {
        if (!active) return;
        setErcError(err?.message || "Unable to load ERC disciplines.");
      })
      .finally(() => {
        if (!active) return;
        setErcLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setOfferTaxonomyLoading(true);
    fetchLabOfferTaxonomy()
      .then(options => {
        if (!active) return;
        setOfferTaxonomy(options);
      })
      .catch((err: any) => {
        if (!active) return;
        setOfferProfileError(err?.message || "Unable to load offer options.");
      })
      .finally(() => {
        if (!active) return;
        setOfferTaxonomyLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const primaryCode = form.primaryErcDisciplineCode;
    if (!primaryCode) return;
    const option = ercOptions.find(item => item.code === primaryCode);
    if (!option) return;
    setPrimaryErcDomain(option.domain);
    setSecondaryErcDomain(option.domain);
  }, [form.primaryErcDisciplineCode, ercOptions]);

  useEffect(() => {
    (async () => {
      setError(null);
      setMessage(null);
      try {
        if (!labId) throw new Error("No lab selected. Go back and choose a lab.");
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        await loadLabDetails(labId, token);
      } catch (err: any) {
        setError(err.message || "Unable to load your lab");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, labId]);

  useEffect(() => {
    if (!labId) return;
    let active = true;
    async function loadTeamLinkRequests() {
      setTeamLinkLoading(true);
      setTeamLinkError(null);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const res = await fetch(`/api/labs/${labId}/team-link-requests`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message || "Unable to load team link requests");
        }
        const data = await res.json();
        if (active) setTeamLinkRequests(data ?? []);
      } catch (err: any) {
        if (active) setTeamLinkError(err.message || "Unable to load team link requests");
      } finally {
        if (active) setTeamLinkLoading(false);
      }
    }
    loadTeamLinkRequests();
    return () => {
      active = false;
    };
  }, [labId]);

  const respondToTeamRequest = async (requestId: number, status: "approved" | "declined") => {
    if (!labId) return;
    setTeamLinkError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(`/api/labs/${labId}/team-link-requests/${requestId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Unable to update request");
      }
      setTeamLinkRequests(prev =>
        prev.map(item => (item.id === requestId ? { ...item, status } : item)),
      );
    } catch (err: any) {
      setTeamLinkError(err.message || "Unable to update request");
    }
  };

  useEffect(() => {
    if (!hasFunctionalConsent || loading || draftLoaded || !labId) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) {
        setDraftLoaded(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed?.form) {
        setForm(prev => {
          const next = { ...prev };
          for (const [key, value] of Object.entries(parsed.form as Record<string, unknown>)) {
            if (value === null || value === undefined) continue;
            if (typeof value === "string") {
              if (value.trim().length > 0) (next as any)[key] = value;
              continue;
            }
            if (Array.isArray(value)) {
              if (value.length > 0) (next as any)[key] = value;
              continue;
            }
            (next as any)[key] = value;
          }
          return next;
        });
      }
      if (Array.isArray(parsed?.photos) && parsed.photos.length > 0) setPhotos(parsed.photos);
      if (Array.isArray(parsed?.partnerLogos) && parsed.partnerLogos.length > 0) setPartnerLogos(parsed.partnerLogos);
      if (Array.isArray(parsed?.complianceDocs) && parsed.complianceDocs.length > 0) setComplianceDocs(parsed.complianceDocs);
      const normalizedActiveTab = parsed?.activeTab === "Company details" ? "Location" : parsed?.activeTab;
      if (typeof normalizedActiveTab === "string" && (TAB_ORDER as readonly string[]).includes(normalizedActiveTab)) {
        setActiveTab(normalizedActiveTab as (typeof TAB_ORDER)[number]);
      }
    } catch {
      // Ignore invalid drafts.
    } finally {
      setDraftLoaded(true);
    }
  }, [draftKey, draftLoaded, labId, loading, hasFunctionalConsent]);

  useEffect(() => {
    if (!hasFunctionalConsent || !draftLoaded || !labId) return;
    const handle = window.setTimeout(() => {
      const payload = {
        form,
        photos,
        partnerLogos,
        complianceDocs,
        activeTab,
      };
      localStorage.setItem(draftKey, JSON.stringify(payload));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [draftKey, draftLoaded, form, photos, partnerLogos, complianceDocs, activeTab, labId, hasFunctionalConsent]);

  function parseList(value: string) {
    return value
      .split(/[\n,]/)
      .map(entry => entry.trim())
      .filter(Boolean);
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    setLogoUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const filename =
        (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`) + `.${ext}`;
      const filePath = `logos/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from("lab-logos")
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("lab-logos").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;
      setForm(prev => ({ ...prev, logoUrl: publicUrl }));
      setMessage("Logo uploaded");
    } catch (err: any) {
      setLogoError(err?.message || "Unable to upload logo");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handlePartnerLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage(null);
    try {
      const ext = file.name.split(".").pop() || "png";
      const filename =
        (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`) + `.${ext}`;
      const folder = labId ? `labs/${labId}/partners` : "partners";
      const filePath = `${folder}/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from("lab-logos")
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("lab-logos").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;
      const logo = { name: file.name, url: publicUrl, website: null };
      setPartnerLogos(prev => [...prev, logo]);
      setForm(prev => ({ ...prev, partnerLogos: [...prev.partnerLogos, logo] }));
      setMessage("Partner logo uploaded");
    } catch (err: any) {
      setMessage(err?.message || "Unable to upload partner logo");
    }
  }

  const removePartnerLogo = (url: string) => {
    setPartnerLogos(prev => prev.filter(item => item.url !== url));
    setForm(prev => ({ ...prev, partnerLogos: prev.partnerLogos.filter(item => item.url !== url) }));
  };

  const updatePartnerLogo = (url: string, updates: Partial<PartnerLogo>) => {
    setPartnerLogos(prev => prev.map(item => (item.url === url ? { ...item, ...updates } : item)));
    setForm(prev => ({
      ...prev,
      partnerLogos: prev.partnerLogos.map(item => (item.url === url ? { ...item, ...updates } : item)),
    }));
  };

  const removePhoto = (asset: MediaAsset) => {
    setPhotos(prev => prev.filter(item => item.url !== asset.url));
  };

  const movePhoto = (fromIndex: number, toIndex: number) => {
    setPhotos(prev => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !labId) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filename =
        (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`) + `.${ext}`;
      const path = `labs/${labId}/photos/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from("lab-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("lab-photos").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const asset = { name: file.name, url: publicUrl };
      setPhotos(prev => [...prev, asset]);
      setMessage("Photo uploaded");
    } catch (err: any) {
      setPhotoError(err?.message || "Unable to upload photo");
    } finally {
      setPhotoUploading(false);
      if (event.target) event.target.value = "";
    }
  }

  async function handleComplianceUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    if (!labId) return;
    setComplianceError(null);
    setComplianceUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "pdf";
        const filename =
          (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`) + `.${ext}`;
        const path = `labs/${labId}/compliance/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from("lab-pdfs")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("lab-pdfs").getPublicUrl(path);
        setComplianceDocs(prev => [...prev, { name: file.name, url: data.publicUrl }]);
      }
    } catch (err: any) {
      setComplianceError(err?.message || "Unable to upload compliance documents");
    } finally {
      setComplianceUploading(false);
      if (event.target) event.target.value = "";
    }
  }

  const addTag = (field: "complianceTags" | "equipmentTags" | "focusTags", raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setForm(prev => {
      if (prev[field].includes(value)) return prev;
      return { ...prev, [field]: [...prev[field], value] };
    });
  };

  const removeTag = (field: "complianceTags" | "equipmentTags" | "focusTags", value: string) => {
    setForm(prev => {
      const next = prev[field].filter(item => item !== value);
      if (field === "equipmentTags") {
        return {
          ...prev,
          equipmentTags: next,
          priorityEquipmentTags: prev.priorityEquipmentTags.filter(item => item !== value),
        };
      }
      return { ...prev, [field]: next };
    });
  };

  const handleTagKey = (field: "complianceTags" | "equipmentTags" | "focusTags") => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(field, tagInput.value || (e.target as HTMLInputElement).value);
      setTagInput({ field, value: "" });
    }
  };

  const setPrimaryErcDiscipline = (code: string) => {
    setForm(prev => {
      const selected = new Set(prev.ercDisciplineCodes);
      if (code) selected.add(code);
      const nextCodes = Array.from(selected);
      return {
        ...prev,
        ercDisciplineCodes: nextCodes,
        primaryErcDisciplineCode: code || "",
      };
    });
  };

  const toggleSecondaryErcDiscipline = (code: string, checked: boolean) => {
    setForm(prev => {
      if (!prev.primaryErcDisciplineCode) return prev;
      if (code === prev.primaryErcDisciplineCode) return prev;
      const selected = new Set(prev.ercDisciplineCodes);
      if (checked) selected.add(code);
      else selected.delete(code);
      return {
        ...prev,
        ercDisciplineCodes: Array.from(selected),
      };
    });
  };

  const togglePriorityEquipment = (item: string) => {
    setForm(prev => {
      const selected = new Set(prev.priorityEquipmentTags);
      if (selected.has(item)) {
        selected.delete(item);
      } else {
        if (selected.size >= 3) return prev;
        selected.add(item);
      }
      return { ...prev, priorityEquipmentTags: Array.from(selected) };
    });
  };

  const addTechnique = () => {
    const name = techniqueInput.name.trim();
    if (!name) return;
    const description = techniqueInput.description?.toString().trim() || null;
    setForm(prev => ({
      ...prev,
      techniques: [...prev.techniques, { name, description }],
    }));
    setTechniqueInput({ name: "", description: "" });
  };

  const removeTechnique = (index: number) => {
    setForm(prev => ({
      ...prev,
      techniques: prev.techniques.filter((_, idx) => idx !== index),
    }));
  };

  const addTeamMember = () => {
    const name = teamMemberInput.name.trim();
    const title = teamMemberInput.title.trim();
    if (!name || !title) return;
    const linkedin = teamMemberInput.linkedin.trim();
    const website = teamMemberInput.website.trim();
    const teamName = teamMemberInput.teamName.trim();
    const roleRank = teamMemberInput.roleRank.trim();
    const parsedRank = roleRank ? Number(roleRank) : null;
    setForm(prev => ({
      ...prev,
      teamMembers: [
        ...prev.teamMembers,
        {
          name,
          title,
          linkedin: linkedin || null,
          website: website || null,
          teamName: teamName || null,
          roleRank: parsedRank && !Number.isNaN(parsedRank) ? parsedRank : null,
          isLead: prev.teamMembers.length === 0,
        },
      ],
    }));
    setTeamMemberInput({ name: "", title: "", linkedin: "", website: "", teamName: "", roleRank: "" });
  };

  const removeTeamMember = (name: string, title: string) => {
    setForm(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.filter(member => !(member.name === name && member.title === title)),
    }));
  };

  const setLeadMember = (name: string, title: string) => {
    setForm(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.map(member => ({
        ...member,
        isLead: member.name === name && member.title === title,
      })),
    }));
  };

  async function loadLabDetails(labId: number, token?: string | null) {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/my-lab/${labId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Unable to load lab");
      }
      const lab = await res.json();
      setLabId(lab.id);
      setLabStatus((lab.labStatus || "listed").toLowerCase());
      setIsVisible(lab.isVisible !== false);
      setForm({
        name: lab.name || "",
        labManager: lab.labManager || "",
        contactEmail: lab.contactEmail || user?.email || "",
        logoUrl: lab.logoUrl || "",
        siretNumber: lab.siretNumber || "",
        offersLabSpace: lab.offersLabSpace ?? true,
        descriptionShort: lab.descriptionShort || "",
        descriptionLong: lab.descriptionLong || "",
        orgRole: lab.orgRole || "",
        addressLine1: lab.addressLine1 || "",
        addressLine2: lab.addressLine2 || "",
        city: lab.city || "",
        state: lab.state || "",
        postalCode: lab.postalCode || "",
        country: lab.country || "",
        website: lab.website || "",
        linkedin: lab.linkedin || "",
        partnerLogos: lab.partnerLogos || [],
        complianceTags: lab.compliance || [],
        halStructureId: lab.halStructureId || "",
        halPersonId: lab.halPersonId || "",
        teamMembers: lab.teamMembers || [],
        equipmentTags: lab.equipment || [],
        priorityEquipmentTags: lab.priorityEquipment || [],
        techniques: lab.techniques || [],
        focusTags: lab.focusAreas || [],
        ercDisciplineCodes: lab.ercDisciplineCodes || [],
        primaryErcDisciplineCode: lab.primaryErcDisciplineCode || "",
        offers: lab.offers || [],
      });
      setOfferProfileError(null);
      try {
        const offerProfile = await fetchLabOfferProfile(lab.id, { token: token ?? null });
        setOfferProfileDraft(
          draftFromProfile(offerProfile, {
            offersLabSpace: lab.offersLabSpace ?? false,
            offers: lab.offers ?? [],
          }),
        );
      } catch (err: any) {
        setOfferProfileError(err?.message || "Unable to load offer profile.");
        setOfferProfileDraft(
          draftFromProfile(null, {
            offersLabSpace: lab.offersLabSpace ?? false,
            offers: lab.offers ?? [],
          }),
        );
      }
      setPartnerLogos(lab.partnerLogos || []);
      setPhotos(lab.photos || []);
      setComplianceDocs(lab.complianceDocs || []);
      setAnalytics(null);
      setAnalyticsError(null);

      try {
        const analyticsRes = await fetch("/api/my-lab/analytics", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (analyticsRes.ok) {
          const data = await analyticsRes.json();
          setAnalytics({
            views7d: data.views7d ?? 0,
            views30d: data.views30d ?? 0,
            favorites: data.favorites ?? 0,
            recentFavorites: (data.recentFavorites ?? []).map((f: any) => ({
              userId: f.userId,
              createdAt: f.createdAt,
            })),
          });
        } else if (analyticsRes.status !== 403) {
          const txt = await analyticsRes.text();
          setAnalyticsError(txt || "Unable to load analytics");
        }
      } catch (err: any) {
        setAnalyticsError(err.message || "Unable to load analytics");
      }
    } catch (err: any) {
      setError(err.message || "Unable to load your lab");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select(
            [
              "can_create_lab",
              "can_manage_multiple_labs",
              "can_manage_teams",
              "can_manage_multiple_teams",
              "can_post_news",
              "can_broker_requests",
              "can_receive_investor",
              "is_admin",
            ].join(","),
          )
          .eq("user_id", user.id)
          .maybeSingle();
        if (!active) return;
        setProfileCaps({
          canCreateLab: Boolean((data as any)?.can_create_lab),
          canManageMultipleLabs: Boolean((data as any)?.can_manage_multiple_labs),
          canManageTeams: Boolean((data as any)?.can_manage_teams),
          canManageMultipleTeams: Boolean((data as any)?.can_manage_multiple_teams),
          canPostNews: Boolean((data as any)?.can_post_news),
          canBrokerRequests: Boolean((data as any)?.can_broker_requests),
          canReceiveInvestor: Boolean((data as any)?.can_receive_investor),
        });
      } catch {
        // Ignore profile capability load errors here.
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!labId) throw new Error("Select a lab first");
      const legacyOffers = draftToLegacyOffers(offerProfileDraft);
      const res = await fetch(`/api/my-lab/${labId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: form.name,
          labManager: form.labManager,
          contactEmail: form.contactEmail,
          logoUrl: form.logoUrl || null,
          siretNumber: form.siretNumber || null,
          offersLabSpace: form.offersLabSpace,
          descriptionShort: form.descriptionShort || null,
          descriptionLong: form.descriptionLong || null,
          orgRole: form.orgRole || null,
          ownerUserId: user?.id || null,
          addressLine1: form.addressLine1 || null,
          addressLine2: form.addressLine2 || null,
          city: form.city || null,
          state: form.state || null,
          postalCode: form.postalCode || null,
          country: form.country || null,
          website: form.website || null,
          linkedin: form.linkedin || null,
          photos,
          partnerLogos: form.partnerLogos,
          compliance: form.complianceTags,
          complianceDocs,
          halStructureId: form.halStructureId || null,
          halPersonId: form.halPersonId || null,
          teamMembers: form.teamMembers,
          equipment: form.equipmentTags,
          priorityEquipment: form.priorityEquipmentTags
            .filter(item => form.equipmentTags.includes(item))
            .slice(0, 3),
          techniques: form.techniques,
          focusAreas: form.focusTags,
          ercDisciplineCodes: form.ercDisciplineCodes,
          primaryErcDisciplineCode: form.primaryErcDisciplineCode || null,
          offers: legacyOffers,
        }),
      });
      if (!res.ok) {
        let msg = "Failed to save";
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          try { msg = (await res.json()).message || msg; } catch {}
        } else {
          try { msg = await res.text(); } catch {}
        }
        throw new Error(msg);
      }
      await upsertLabOfferProfile(
        labId,
        draftToProfilePayload(offerProfileDraft, {
          forceSupportsBenchRental: form.offersLabSpace ? offerProfileDraft.supportsBenchRental : false,
          forceSupportsEquipmentAccess: form.offersLabSpace ? offerProfileDraft.supportsEquipmentAccess : false,
        }),
        token,
      );
      if (hasFunctionalConsent) {
        localStorage.removeItem(draftKey);
      }
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function confirmAndSave() {
    const success = await save();
    if (success) {
      setLocation("/account?tab=manageLab");
    }
  }

  async function deleteLab() {
    if (!labId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(`/api/my-lab/${labId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        let msg = "Failed to delete lab";
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          try { msg = (await res.json()).message || msg; } catch {}
        } else {
          try { msg = await res.text(); } catch {}
        }
        throw new Error(msg);
      }
      if (hasFunctionalConsent) {
        localStorage.removeItem(draftKey);
      }
      setLocation("/account?tab=manageLab");
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete lab");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 lg:py-24 max-w-6xl">
        <Link href="/account?tab=manageLab" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4 rounded-full border border-border px-3 py-1">
          ← Back to manage labs
        </Link>
        <h1 className="text-3xl font-semibold text-foreground">Manage my lab</h1>
        <p className="text-sm text-muted-foreground mt-2">Update basic details for your lab.</p>
        {labId && isVisible === false && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            This lab is hidden from the public directory
          </div>
        )}
        {!labId && (
          <p className="mt-4 text-sm text-destructive">
            No lab selected. Go back and choose a lab to manage.
            <Link href="/account?tab=manageLab">
              <a className="ml-2 underline text-primary">Back to lab selection</a>
            </Link>
          </p>
        )}
        {analytics && (
          <div className="mt-4 rounded-2xl border border-border bg-card/70 p-4 text-sm">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Premier analytics</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Views (7d)</p>
                <p className="text-xl font-semibold text-foreground">{analytics.views7d}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Views (30d)</p>
                <p className="text-xl font-semibold text-foreground">{analytics.views30d}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <p className="text-xs text-muted-foreground">Favorites</p>
                <p className="text-xl font-semibold text-foreground">{analytics.favorites}</p>
              </div>
            </div>
            {analytics.recentFavorites.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Recent favorites</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {analytics.recentFavorites.map(fav => (
                    <span
                      key={`${fav.userId}-${fav.createdAt}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1"
                      title={new Date(fav.createdAt).toLocaleString()}
                    >
                      User {fav.userId.slice(0, 6)}… favorited
                    </span>
                  ))}
                </div>
              </div>
            )}
            {analyticsError && <p className="mt-2 text-xs text-destructive">{analyticsError}</p>}
          </div>
        )}
        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="mt-6 text-sm text-destructive">{error}</p>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-8"
            onSubmit={e => { e.preventDefault(); setSaveConfirmOpen(true); }}
          >
            <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
              <aside className="space-y-4 md:sticky md:top-24">
                <div className="rounded-2xl border border-border bg-card/70 p-3">
                  <div className="flex flex-wrap gap-2 md:flex-col">
                    {TAB_ORDER.map(tab => {
                      const TabIcon = TAB_ICONS[tab];
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveTab(tab)}
                          className={`rounded-full border px-4 py-1.5 text-sm font-medium text-left transition md:w-full ${
                            activeTab === tab
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <TabIcon className="h-4 w-4 flex-shrink-0" />
                            <span>{tab}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:flex-col">
                  <button
                    type="button"
                    onClick={() => setSaveConfirmOpen(true)}
                    className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground md:w-full"
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="rounded-full border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:border-destructive md:w-full"
                  >
                    Delete lab
                  </button>
                </div>
              </aside>

              <div className="min-w-0 space-y-8">

            {activeTab === "Basics" && (
              <Section title="Basics">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This section is what collaborators read first. Clear, specific details increase trust and help you
                  receive better-matched requests.
                </p>
                <Field label="Lab name" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                  <input
                    className={BASICS_INPUT_CLASS}
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Official public name, e.g., UAR 3286 CNRS/Unistra"
                  />
                </Field>
                <Field label="Lab manager / Director" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                  <input
                    className={BASICS_INPUT_CLASS}
                    value={form.labManager}
                    onChange={e => setForm({ ...form, labManager: e.target.value })}
                    placeholder="Decision-maker or scientific lead (full name)"
                  />
                </Field>
                <Field label="Contact email" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                  <div className="flex items-center gap-2">
                    <input className={BASICS_INPUT_CLASS} value={form.contactEmail} disabled />
                    <span className="text-muted-foreground" aria-hidden="true">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                        <rect x="5" y="11" width="14" height="9" rx="2" />
                        <path d="M8 11v-2a4 4 0 0 1 8 0v2" />
                      </svg>
                    </span>
                  </div>
                </Field>
                <Field label="Organization role (optional)" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                  <select
                    className={BASICS_INPUT_CLASS}
                    value={form.orgRole}
                    onChange={e => setForm({ ...form, orgRole: e.target.value as "" | OrgRoleOption })}
                  >
                    <option value="">Select role type</option>
                    {orgRoleOptions.map(role => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Primary ERC discipline (optional)" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        className={BASICS_INPUT_CLASS}
                        value={primaryErcDomain}
                        onChange={e => setPrimaryErcDomain(e.target.value as ErcDomainOption)}
                      >
                        <option value="PE">PE - Physical Sciences & Engineering</option>
                        <option value="LS">LS - Life Sciences</option>
                        <option value="SH">SH - Social Sciences & Humanities</option>
                      </select>
                      <select
                        className={BASICS_INPUT_CLASS}
                        value={form.primaryErcDisciplineCode}
                        onChange={e => setPrimaryErcDiscipline(e.target.value)}
                      >
                        <option value="">No primary discipline</option>
                        {primaryDomainOptions.map(option => (
                          <option key={option.code} value={option.code}>
                            {option.code} - {option.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Pick one primary ERC discipline first, then add any secondary disciplines below.
                    </p>
                  </div>
                </Field>
                <Field label="Secondary ERC disciplines (optional)" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                  <div className="space-y-3">
                    <select
                      className={BASICS_INPUT_CLASS}
                      value={secondaryErcDomain}
                      disabled={!form.primaryErcDisciplineCode}
                      onChange={e => setSecondaryErcDomain(e.target.value as ErcDomainOption)}
                    >
                      <option value="PE">PE - Physical Sciences & Engineering</option>
                      <option value="LS">LS - Life Sciences</option>
                      <option value="SH">SH - Social Sciences & Humanities</option>
                    </select>
                    <div className="max-h-56 overflow-auto rounded-xl border border-border bg-background px-3 py-2">
                      {!form.primaryErcDisciplineCode ? (
                        <p className="text-xs text-muted-foreground">Select a primary ERC discipline first.</p>
                      ) : ercLoading ? (
                        <p className="text-xs text-muted-foreground">Loading ERC disciplines...</p>
                      ) : ercOptions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No ERC disciplines available.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {secondaryDomainOptions.map(option => {
                            const checked = form.ercDisciplineCodes.includes(option.code);
                            return (
                              <label
                                key={option.code}
                                className="flex items-start gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-xs text-foreground"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  checked={checked}
                                  onChange={event => toggleSecondaryErcDiscipline(option.code, event.target.checked)}
                                />
                                <span>
                                  <span className="font-semibold">{option.code}</span>
                                  <span className="text-muted-foreground"> {option.title}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {ercError && <p className="text-xs text-destructive">{ercError}</p>}
                    {form.ercDisciplineCodes.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {form.ercDisciplineCodes.map(code => {
                          const isPrimary = code === form.primaryErcDisciplineCode;
                          return (
                            <span
                              key={code}
                              className={`rounded-full px-3 py-1 text-xs ${
                                isPrimary
                                  ? "border border-primary/40 bg-primary/10 text-primary"
                                  : "border border-border text-muted-foreground"
                              }`}
                            >
                              {ercLabelByCode.get(code) ?? code}
                              {isPrimary ? " (Primary)" : ""}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Field>
                <Field
                  label={
                    <span className="inline-flex items-center gap-2">
                      <span>HAL structure ID (optional)</span>
                      <span className="group relative inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background/85 text-[9px] font-semibold text-muted-foreground transition hover:border-primary hover:text-primary">
                        ↗
                        <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-background/95 px-2 py-1 text-[10px] font-medium normal-case tracking-normal text-muted-foreground opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100">
                          Used to link your lab profile to HAL organization records.
                        </span>
                      </span>
                    </span>
                  }
                  labelClassName={BASICS_LABEL_CLASS}
                  containerClassName={BASICS_FIELD_CLASS}
                >
                  <input
                    className={BASICS_INPUT_CLASS}
                    value={form.halStructureId}
                    onChange={e => setForm({ ...form, halStructureId: e.target.value })}
                    placeholder="If indexed in HAL, enter structure ID (e.g., struct-123456)"
                  />
                </Field>
                <Field label="Short description" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                  <textarea
                    className={BASICS_INPUT_CLASS}
                    rows={4}
                    value={form.descriptionShort}
                    onChange={e => setForm({ ...form, descriptionShort: e.target.value })}
                    placeholder="1-2 lines: who you are, what you do best, and who you typically support."
                  />
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Recommended: 120-180 characters</span>
                    <span
                      className={
                        form.descriptionShort.length >= 120 && form.descriptionShort.length <= 180
                          ? "text-emerald-600"
                          : "text-muted-foreground"
                      }
                    >
                      {form.descriptionShort.length} / 350
                    </span>
                  </div>
                </Field>
                <Field label="Long description (optional)" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                  <textarea
                    className={BASICS_INPUT_CLASS}
                    rows={6}
                    value={form.descriptionLong}
                    onChange={e => setForm({ ...form, descriptionLong: e.target.value })}
                    placeholder="Capabilities, sample types, turnaround expectations, compliance context, and collaboration style."
                  />
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Recommended: 400-900 characters</span>
                    <span
                      className={
                        form.descriptionLong.length >= 400 && form.descriptionLong.length <= 900
                          ? "text-emerald-600"
                          : "text-muted-foreground"
                      }
                    >
                      {form.descriptionLong.length} / 8000
                    </span>
                  </div>
                </Field>
              </Section>
            )}

            {activeTab === "Branding" && (
            <Section title="Branding & Links">

              <Field label="Website (optional)" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                <input
                  className={BASICS_INPUT_CLASS}
                  value={form.website}
                  onChange={e => setForm({ ...form, website: e.target.value })}
                  placeholder="Official website URL, e.g., https://labs.example.com"
                />
              </Field>
              <Field label="LinkedIn (optional)" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                <input
                  className={BASICS_INPUT_CLASS}
                  value={form.linkedin}
                  onChange={e => setForm({ ...form, linkedin: e.target.value })}
                  placeholder="LinkedIn page URL, e.g., https://www.linkedin.com/company/example"
                />
              </Field>
            </Section>
            )}

            {activeTab === "Location" && (
            <Section title="Location">
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Address line 1"
                  labelClassName={BASICS_LABEL_CLASS}
                  containerClassName={`${BASICS_FIELD_CLASS} md:col-span-2`}
                >
                  <input
                    className={BASICS_INPUT_CLASS}
                    value={form.addressLine1}
                    onChange={e => setForm({ ...form, addressLine1: e.target.value })}
                    placeholder="Street + number"
                  />
                </Field>
                <Field label="Address line 2" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                  <input
                    className={BASICS_INPUT_CLASS}
                    value={form.addressLine2}
                    onChange={e => setForm({ ...form, addressLine2: e.target.value })}
                    placeholder="Building, floor, unit (optional)"
                  />
                </Field>
                <Field label="SIRET" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                  <input
                    className={BASICS_INPUT_CLASS}
                    value={form.siretNumber}
                    onChange={e => setForm({ ...form, siretNumber: e.target.value })}
                    placeholder="French company SIRET number (if applicable)"
                  />
                </Field>
                <Field label="City" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                  <input
                    className={BASICS_INPUT_CLASS}
                    value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                    placeholder="City"
                  />
                </Field>
                <Field label="State/Region" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                  <input
                    className={BASICS_INPUT_CLASS}
                    value={form.state}
                    onChange={e => setForm({ ...form, state: e.target.value })}
                    placeholder="State or region"
                  />
                </Field>
                <Field label="Postal code" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                  <input
                    className={BASICS_INPUT_CLASS}
                    value={form.postalCode}
                    onChange={e => setForm({ ...form, postalCode: e.target.value })}
                    placeholder="Postal / ZIP code"
                  />
                </Field>
                <Field label="Country" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                  <input
                    className={BASICS_INPUT_CLASS}
                    value={form.country}
                    onChange={e => setForm({ ...form, country: e.target.value })}
                    placeholder="Country"
                  />
                </Field>
              </div>
            </Section>
            )}

            {activeTab === "Team" && (
            <>
            <Section title="Team link requests">
              {teamLinkLoading && <p className="text-sm text-muted-foreground">Loading requests...</p>}
              {teamLinkError && <p className="text-sm text-destructive">{teamLinkError}</p>}
              {!teamLinkLoading && teamLinkRequests.length === 0 && (
                <p className="text-sm text-muted-foreground">No pending team link requests.</p>
              )}
              <div className="space-y-3">
                {teamLinkRequests.map(request => (
                  <div
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {request.teams?.name || `Team #${request.team_id}`}
                      </p>
                      {request.teams?.description_short && (
                        <p className="text-xs text-muted-foreground">{request.teams.description_short}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">Status: {request.status}</p>
                    </div>
                    {request.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => respondToTeamRequest(request.id, "approved")}
                          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => respondToTeamRequest(request.id, "declined")}
                          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Team members">
              <div className="space-y-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className={INPUT_CLASS}
                    placeholder="Full name"
                    value={teamMemberInput.name}
                    onChange={e => setTeamMemberInput(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <input
                    className={INPUT_CLASS}
                    placeholder="Title"
                    value={teamMemberInput.title}
                    onChange={e => setTeamMemberInput(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className={INPUT_CLASS}
                    placeholder="Team / group (optional)"
                    value={teamMemberInput.teamName}
                    onChange={e => setTeamMemberInput(prev => ({ ...prev, teamName: e.target.value }))}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      className={`${INPUT_CLASS} flex-1`}
                      placeholder="Role rank (1-7)"
                      value={teamMemberInput.roleRank}
                      onChange={e => setTeamMemberInput(prev => ({ ...prev, roleRank: e.target.value }))}
                    />
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setPinRoleHelp(prev => !prev)}
                        onMouseEnter={() => setShowRoleHelp(true)}
                        onMouseLeave={() => setShowRoleHelp(false)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary"
                        aria-label="Role rank guidance"
                      >
                        i
                      </button>
                      {(pinRoleHelp || showRoleHelp) && (
                        <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-2xl border border-border bg-background/95 p-3 text-xs text-muted-foreground shadow-lg">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Rank guide
                          </p>
                          <ul className="mt-2 space-y-1">
                            {ROLE_RANK_HELP_ITEMS.map(item => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className={INPUT_CLASS}
                    placeholder="LinkedIn (optional)"
                    value={teamMemberInput.linkedin}
                    onChange={e => setTeamMemberInput(prev => ({ ...prev, linkedin: e.target.value }))}
                  />
                  <input
                    className={INPUT_CLASS}
                    placeholder="Website (optional)"
                    value={teamMemberInput.website}
                    onChange={e => setTeamMemberInput(prev => ({ ...prev, website: e.target.value }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={addTeamMember}
                  className="inline-flex items-center rounded-full border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
                >
                  Save team member
                </button>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Saved members</p>
                  <button
                    type="button"
                    onClick={() => setTeamMembersExpanded(prev => !prev)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    {teamMembersExpanded ? "Hide list" : "Show list"}
                  </button>
                </div>
                {teamMembersExpanded && (
                  <div className="space-y-2">
                    {form.teamMembers.map(member => (
                      <div
                        key={`${member.name}-${member.title}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {member.name}
                            {member.isLead && <span className="ml-2 text-xs text-primary">Lead</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.title}
                            {member.roleRank ? ` • Rank ${member.roleRank}` : ""}
                          </p>
                          {member.teamName && (
                            <p className="text-xs text-muted-foreground">Team: {member.teamName}</p>
                          )}
                          {(member.linkedin || member.website) && (
                            <p className="text-xs text-muted-foreground">
                              {member.linkedin || member.website}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setLeadMember(member.name, member.title)}
                            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                          >
                            Set lead
                          </button>
                          <button
                            type="button"
                            onClick={() => removeTeamMember(member.name, member.title)}
                            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Section>
            </>
            )}

            {activeTab === "Compliance" && (
            <Section title="Compliance & capabilities">
              <Field label="Compliance" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                <div className="space-y-2">
                  <input
                    className={BASICS_INPUT_CLASS}
                    placeholder="Add standards or certifications, then press Enter"
                    value={tagInput.field === "complianceTags" ? tagInput.value : ""}
                    onChange={e => setTagInput({ field: "complianceTags", value: e.target.value })}
                    onKeyDown={handleTagKey("complianceTags")}
                  />
                  <div className="flex flex-wrap gap-2">
                    {form.complianceTags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag("complianceTags", tag)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </Field>
              <Field label="Compliance documents (PDF)" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {complianceDocs.map(asset => (
                      <button
                        key={asset.url}
                        type="button"
                        onClick={() => setComplianceDocs(prev => prev.filter(doc => doc.url !== asset.url))}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-destructive hover:text-destructive"
                      >
                        <FileDown className="h-3 w-3 text-primary" />
                        {asset.name}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                  <label className="inline-flex items-center gap-3">
                    <span className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cursor-pointer transition hover:bg-primary/90">
                      Choose file
                      <input
                        type="file"
                        accept="application/pdf"
                        multiple
                        onChange={handleComplianceUpload}
                        className="hidden"
                      />
                    </span>
                  </label>
                  {complianceUploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
                  {complianceError && <p className="text-xs text-destructive">{complianceError}</p>}
                  <p className="text-xs text-muted-foreground">Upload PDF compliance certificates.</p>
                </div>
              </Field>
              <Field label="Equipment" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                <div className="space-y-2">
                  <input
                    className={BASICS_INPUT_CLASS}
                    placeholder="Add key instruments, then press Enter"
                    value={tagInput.field === "equipmentTags" ? tagInput.value : ""}
                    onChange={e => setTagInput({ field: "equipmentTags", value: e.target.value })}
                    onKeyDown={handleTagKey("equipmentTags")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Click a chip to mark it as priority (up to 3). Click × to remove it.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {form.equipmentTags.map(tag => {
                      const isPriority = form.priorityEquipmentTags.includes(tag);
                      return (
                        <div
                          key={tag}
                          role="button"
                          tabIndex={0}
                          onClick={() => togglePriorityEquipment(tag)}
                          onKeyDown={event => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              togglePriorityEquipment(tag);
                            }
                          }}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                            isPriority
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/60 hover:bg-primary/5 hover:text-foreground"
                          }`}
                          title={isPriority ? "Priority equipment" : "Click to mark as priority"}
                        >
                          <span>{tag}</span>
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              removeTag("equipmentTags", tag);
                            }}
                            className="text-current/80 hover:text-destructive"
                            aria-label={`Remove ${tag}`}
                            title={`Remove ${tag}`}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    {form.equipmentTags.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        Add equipment to start building your featured list.
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Priority selected: {form.priorityEquipmentTags.length}/3
                  </p>
                </div>
              </Field>
              <Field label="Techniques" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    {form.techniques.map((technique, index) => (
                      <div key={`${technique.name}-${index}`} className="rounded-2xl border border-border px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{technique.name}</p>
                            {technique.description && (
                              <p className="mt-1 text-xs text-muted-foreground">{technique.description}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTechnique(index)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      className={BASICS_INPUT_CLASS}
                      placeholder="Technique name"
                      value={techniqueInput.name}
                      onChange={e => setTechniqueInput(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <input
                      className={BASICS_INPUT_CLASS}
                      placeholder="Short description"
                      value={techniqueInput.description ?? ""}
                      onChange={e => setTechniqueInput(prev => ({ ...prev, description: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={addTechnique}
                      className="md:col-span-2 inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                    >
                      Save technique
                    </button>
                  </div>
                </div>
              </Field>
              <Field label="Focus areas" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                <div className="space-y-2">
                  <input
                    className={BASICS_INPUT_CLASS}
                    placeholder="Add thematic focus areas, then press Enter"
                    value={tagInput.field === "focusTags" ? tagInput.value : ""}
                    onChange={e => setTagInput({ field: "focusTags", value: e.target.value })}
                    onKeyDown={handleTagKey("focusTags")}
                  />
                  <div className="flex flex-wrap gap-2">
                    {form.focusTags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag("focusTags", tag)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                </Field>

            </Section>
            )}

            {activeTab === "Photos" && (
            <Section title="Photos">
              {canUseLogo && (
                <div className="grid gap-2">
                  <div className="rounded-2xl border border-border bg-card/50 p-3 overflow-hidden">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span>Logo</span>
                        <span className="rounded-full border border-emerald-300/60 bg-emerald-400/20 px-2 py-0.5 text-[10px] font-medium text-emerald-700 shadow-sm backdrop-blur-md">
                          verified labs
                        </span>
                      </p>
                      <label className="inline-flex items-center">
                        <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground cursor-pointer transition hover:bg-primary/90">
                          Upload file
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                        </span>
                      </label>
                    </div>
                    {logoUploading && <p className="text-xs text-muted-foreground">Uploading logo…</p>}
                    {logoError && <p className="text-xs text-destructive">{logoError}</p>}
                    {form.logoUrl ? (
                      <div className="flex w-full max-w-full gap-3 overflow-x-auto overflow-y-hidden pb-1 pr-3 pt-2">
                        <div className="group relative flex w-[170px] max-w-[170px] flex-shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-2 transition hover:border-primary/60 hover:bg-background/80 hover:shadow-md">
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, logoUrl: "" })}
                            className="absolute -right-1.5 -top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border border-destructive/70 bg-destructive/70 text-destructive-foreground ring-2 ring-background shadow-sm backdrop-blur-md transition hover:bg-destructive/85"
                            aria-label="Remove logo"
                            title="Remove logo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <div className="relative">
                            <img
                              src={form.logoUrl}
                              alt={`${form.name || "Lab"} logo`}
                              draggable={false}
                              className={PHOTO_THUMB_CLASS}
                            />
                            <span className="absolute bottom-2 left-2 rounded-full border border-white/40 bg-white/25 px-1.5 py-0.5 text-[9px] font-medium text-white shadow-sm backdrop-blur-md">
                              Logo
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">No logo uploaded yet.</p>
                    )}
                  </div>
                </div>
              )}

              {canUsePartnerLogos ? (
                <div className="grid gap-2">
                  <div className="rounded-2xl border border-border bg-card/50 p-3 overflow-hidden">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span>Partner logos</span>
                        <span className="rounded-full border border-emerald-300/60 bg-emerald-400/20 px-2 py-0.5 text-[10px] font-medium text-emerald-700 shadow-sm backdrop-blur-md">
                          premier or multi-lab feature
                        </span>
                      </p>
                      <label className="inline-flex items-center">
                        <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground cursor-pointer transition hover:bg-primary/90">
                          Upload file
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePartnerLogoUpload}
                            className="hidden"
                          />
                        </span>
                      </label>
                    </div>
                    {partnerLogos.length > 0 ? (
                      <div className="flex w-full max-w-full gap-3 overflow-x-auto overflow-y-hidden pb-1 pr-3 pt-2">
                        {partnerLogos.map(logo => (
                          <div
                            key={logo.url}
                            className="group relative flex w-[210px] flex-shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-2 transition hover:border-primary/60 hover:bg-background/80 hover:shadow-md"
                          >
                            <button
                              type="button"
                              onClick={() => removePartnerLogo(logo.url)}
                              className="absolute -right-1.5 -top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border border-destructive/70 bg-destructive/70 text-destructive-foreground ring-2 ring-background shadow-sm backdrop-blur-md transition hover:bg-destructive/85"
                              aria-label="Remove partner logo"
                              title="Remove partner logo"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <div className="relative">
                              <img
                                src={logo.url}
                                alt={logo.name}
                                draggable={false}
                                className={PHOTO_THUMB_CLASS}
                              />
                              <span className="absolute bottom-2 left-2 rounded-full border border-white/40 bg-white/25 px-1.5 py-0.5 text-[9px] font-medium text-white shadow-sm backdrop-blur-md">
                                Partner logo
                              </span>
                            </div>
                            <input
                              className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              placeholder="Partner website"
                              value={logo.website ?? ""}
                              onChange={e => updatePartnerLogo(logo.url, { website: e.target.value })}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">No partner logos yet. Upload files to add partner logos.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Partner logos are available on the premier plan or multi-lab accounts.</p>
              )}

              <div className="rounded-2xl border border-border bg-card/50 p-3 overflow-hidden">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Lab photos</p>
                  <label className="inline-flex items-center">
                    <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground cursor-pointer transition hover:bg-primary/90">
                      Upload file
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </span>
                  </label>
                </div>
                {photoUploading && <p className="mt-2 text-xs text-muted-foreground">Uploading photo…</p>}
                {photoError && <p className="mt-2 text-xs text-destructive">{photoError}</p>}
                {photos.length > 0 ? (
                  <div className="flex w-full max-w-full gap-3 overflow-x-auto overflow-y-hidden pb-1 pr-3 pt-2">
                    {photos.map((photo, index) => (
                      <div
                        key={photo.url}
                        draggable
                        onDragStart={event => {
                          event.dataTransfer.setData("text/plain", String(index));
                          event.dataTransfer.effectAllowed = "move";
                          setDraggingPhotoIndex(index);
                          const rect = event.currentTarget.getBoundingClientRect();
                          event.dataTransfer.setDragImage(
                            event.currentTarget,
                            rect.width / 2,
                            rect.height / 2,
                          );
                        }}
                        onDragEnd={() => setDraggingPhotoIndex(null)}
                        onDragOver={event => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={event => {
                          event.preventDefault();
                          const fromIndex = Number(event.dataTransfer.getData("text/plain"));
                          if (Number.isNaN(fromIndex)) return;
                          movePhoto(fromIndex, index);
                          setDraggingPhotoIndex(null);
                        }}
                        className={`group relative flex w-[170px] flex-shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-2 transition hover:border-primary/60 hover:bg-background/80 hover:shadow-md ${
                          draggingPhotoIndex === index ? "ring-2 ring-primary/30 opacity-90" : ""
                        }`}
                        title="Drag to reorder"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setPendingPhotoDelete(photo);
                            setPhotoDeleteConfirmOpen(true);
                          }}
                          className="absolute -right-1.5 -top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border border-destructive/70 bg-destructive/70 text-destructive-foreground ring-2 ring-background shadow-sm backdrop-blur-md transition hover:bg-destructive/85"
                          aria-label="Remove photo"
                          title="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="relative">
                          <img
                            src={photo.url}
                            alt={photo.name}
                            draggable={false}
                            className={PHOTO_THUMB_CLASS}
                          />
                          {index === 0 && (
                            <span className="absolute bottom-2 left-2 rounded-full border border-white/40 bg-white/25 px-1.5 py-0.5 text-[9px] font-medium text-white shadow-sm backdrop-blur-md">
                              Cover on Labs cards
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No photos yet. Upload files to build your photo order bar.</p>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Drag to reorder. Leftmost photo is the cover used on Labs cards.
                </p>
              </div>
            </Section>
            )}

            {activeTab === "Offers" && (
            <Section title="Offers">
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.offersLabSpace}
                  onChange={e => setForm({ ...form, offersLabSpace: e.target.checked })}
                />
                Offers lab space (enables pricing/offers on your page)
              </label>
              {form.offersLabSpace ? (
                <LabOfferProfileEditor
                  draft={offerProfileDraft}
                  onChange={setOfferProfileDraft}
                  taxonomy={offerTaxonomy}
                  loading={offerTaxonomyLoading}
                  error={offerProfileError}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Enable “Offers lab space” to reveal and edit rental offer details.
                </p>
              )}
            </Section>
            )}
              </div>
            </div>

          </motion.form>
        )}
        {message && <p className="mt-4 text-sm text-emerald-600">{message}</p>}
        {deleteError && <p className="mt-4 text-sm text-destructive">{deleteError}</p>}
      </div>
      {photoDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">Delete this photo?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This removes the photo from your lab gallery. You can keep it or delete it now.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPhotoDeleteConfirmOpen(false);
                  setPendingPhotoDelete(null);
                }}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
              >
                Keep photo
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingPhotoDelete) removePhoto(pendingPhotoDelete);
                  setPhotoDeleteConfirmOpen(false);
                  setPendingPhotoDelete(null);
                }}
                className="rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90"
              >
                Delete photo
              </button>
            </div>
          </div>
        </div>
      )}
      {saveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">Save changes?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will update the lab profile for everyone who can see it.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveConfirmOpen(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaveConfirmOpen(false);
                  void confirmAndSave();
                }}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save now"}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">Delete this lab?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently deletes the lab profile and its related data. This action cannot be undone.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  void deleteLab();
                }}
                className="rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-60"
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card/70 p-5 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="grid gap-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  labelClassName,
  containerClassName,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  labelClassName?: string;
  containerClassName?: string;
}) {
  return (
    <div className={`grid gap-2 ${containerClassName ?? ""}`.trim()}>
      <label className={labelClassName ?? "text-sm font-medium text-foreground"}>{label}</label>
      {children}
    </div>
  );
}
