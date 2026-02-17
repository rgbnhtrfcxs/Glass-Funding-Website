import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ClipboardList,
  ChevronDown,
  CheckCircle2,
  Edit2,
  FileCheck2,
  FileDown,
  ImageIcon,
  MapPin,
  Mail,
  Plus,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLabs } from "@/context/LabsContext";
import { supabase } from "@/lib/supabaseClient";
import {
  orgRoleOptions,
  type ErcDisciplineOption,
  type ErcDomainOption,
  type LabTechnique,
  type LabPartner,
  type MediaAsset,
  type OrgRoleOption,
  type PartnerLogo,
  type OfferOption,
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
} from "@/lib/labOfferProfile";
import { fetchErcDisciplineOptions } from "@/lib/ercDisciplines";

type VerificationOption = "yes" | "no";
type LabStatusOption = "listed" | "confirmed" | "verified_passive" | "verified_active" | "premier";
const PHOTO_THUMB_CLASS = "h-24 w-full rounded object-cover transition duration-200 group-hover:brightness-110";
const BASICS_INPUT_CLASS =
  "w-full rounded-none border-0 border-b border-border bg-transparent px-0 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:border-primary";
const BASICS_LABEL_CLASS = "text-xs font-semibold tracking-[0.02em] text-foreground/90";
const BASICS_FIELD_CLASS = "rounded-xl border border-border/70 bg-background/40 px-4 py-3";
const ADMIN_EDIT_TAB_ORDER = ["Basics", "Branding", "Location", "Compliance", "Photos", "Offers"] as const;
const ADMIN_EDIT_TAB_ICONS: Record<(typeof ADMIN_EDIT_TAB_ORDER)[number], LucideIcon> = {
  Basics: Edit2,
  Branding: ClipboardList,
  Location: MapPin,
  Compliance: ShieldCheck,
  Photos: ImageIcon,
  Offers: FileCheck2,
};
type AdminEditTab = (typeof ADMIN_EDIT_TAB_ORDER)[number];

interface LabFormState {
  name: string;
  labManager: string;
  contactEmail: string;
  logoUrl: string;
  descriptionShort: string;
  descriptionLong: string;
  offersLabSpace: string;
  siretNumber: string;
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
  verification: VerificationOption;
  labStatus: LabStatusOption;
  orgRole: "" | OrgRoleOption;
  equipmentTags: string[];
  priorityEquipmentTags: string[];
  techniques: LabTechnique[];
  focusTags: string[];
  ercDisciplineCodes: string;
  primaryErcDisciplineCode: string;
  halStructureId: string;
  offers: OfferOption[];
  isVisible: "yes" | "no";
}

const emptyForm: LabFormState = {
  name: "",
  labManager: "",
  contactEmail: "",
  logoUrl: "",
  descriptionShort: "",
  descriptionLong: "",
  offersLabSpace: "no",
  siretNumber: "",
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
  verification: "no",
  labStatus: "listed",
  orgRole: "",
  equipmentTags: [],
  priorityEquipmentTags: [],
  techniques: [],
  focusTags: [],
  ercDisciplineCodes: "",
  primaryErcDisciplineCode: "",
  halStructureId: "",
  offers: [],
  isVisible: "yes",
};

function labToForm(lab: LabPartner): LabFormState {
  return {
    name: lab.name,
    labManager: lab.labManager || "",
    contactEmail: lab.contactEmail || "",
    logoUrl: lab.logoUrl || "",
    descriptionShort: lab.descriptionShort || "",
    descriptionLong: lab.descriptionLong || "",
    offersLabSpace: lab.offersLabSpace ? "yes" : "no",
    siretNumber: lab.siretNumber || "",
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
    verification: lab.auditPassed ? "yes" : "no",
    labStatus: (lab.labStatus || "listed") as LabStatusOption,
    orgRole: lab.orgRole || "",
    equipmentTags: lab.equipment || [],
    priorityEquipmentTags: lab.priorityEquipment || [],
    techniques: lab.techniques || [],
    focusTags: lab.focusAreas || [],
    ercDisciplineCodes: (lab.ercDisciplineCodes ?? []).join(", "),
    primaryErcDisciplineCode: lab.primaryErcDisciplineCode || "",
    halStructureId: lab.halStructureId || "",
    offers: [...lab.offers],
    isVisible: lab.isVisible === false ? "no" : "yes",
  };
}

function normalizeErcCode(value: string) {
  const normalized = value.trim().toUpperCase();
  return /^(PE(1[0-1]|[1-9])|LS[1-9]|SH[1-8])$/.test(normalized) ? normalized : null;
}

function parseErcCodes(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map(entry => normalizeErcCode(entry))
        .filter((code): code is string => Boolean(code)),
    ),
  );
}

function formToPayload(
  form: LabFormState,
  photos: MediaAsset[],
  complianceDocs: MediaAsset[],
  partnerLogos: PartnerLogo[],
) {
  return {
    name: form.name.trim(),
    labManager: form.labManager.trim(),
    contactEmail: form.contactEmail.trim(),
    logoUrl: form.logoUrl.trim() || null,
    descriptionShort: form.descriptionShort.trim() || null,
    descriptionLong: form.descriptionLong.trim() || null,
    offersLabSpace: form.offersLabSpace === "yes",
    siretNumber: form.siretNumber.trim() || null,
    addressLine1: form.addressLine1.trim() || null,
    addressLine2: form.addressLine2.trim() || null,
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    postalCode: form.postalCode.trim() || null,
    country: form.country.trim() || null,
    website: form.website.trim() || null,
    linkedin: form.linkedin.trim() || null,
    partnerLogos,
    compliance: form.complianceTags,
    auditPassed: form.verification === "yes",
    labStatus: form.labStatus,
    orgRole: form.orgRole || null,
    equipment: form.equipmentTags,
    ercDisciplineCodes: parseErcCodes(form.ercDisciplineCodes),
    primaryErcDisciplineCode: normalizeErcCode(form.primaryErcDisciplineCode) || null,
    ercDisciplines: [],
    offers: form.offers,
    photos,
    complianceDocs,
    isVisible: form.isVisible === "yes",
    halStructureId: form.halStructureId.trim() || null,
    teamMembers: [],
    priorityEquipment: form.priorityEquipmentTags
      .filter(item => form.equipmentTags.includes(item))
      .slice(0, 3),
    techniques: form.techniques,
    focusAreas: form.focusTags,
    field: null,
    public: null,
    alternateNames: [],
    tags: [],
  };
}

type StatusMessage = { type: "success" | "error"; text: string } | null;
type EditingState = number | "new" | null;
type VisibilityFilter = "all" | "visible" | "hidden";
type VerificationFilter = "all" | "verified" | "unverified" | "pending";
type LabVerificationCertificate = {
  id: number;
  lab_id: number;
  glass_id: string | null;
  lab_signer_name: string;
  lab_signer_title: string | null;
  glass_signer_name: string;
  glass_signer_title: string | null;
  issued_at: string | null;
  pdf_url: string;
};

type CertificateFormState = {
  labSignerName: string;
  labSignerTitle: string;
  labSignatureDataUrl: string | null;
  glassSignerName: string;
  glassSignerTitle: string;
  glassSignatureDataUrl: string | null;
};

const defaultCertificateFormState: CertificateFormState = {
  labSignerName: "",
  labSignerTitle: "",
  labSignatureDataUrl: null,
  glassSignerName: "",
  glassSignerTitle: "GLASS Admin",
  glassSignatureDataUrl: null,
};

export default function AdminLabs({ embedded = false }: { embedded?: boolean }) {
  const {
    labs,
    addLab,
    updateLab,
    removeLab,
    isLoading,
    error: labsError,
    refresh,
  } = useLabs();
  const [editing, setEditing] = useState<EditingState>(null);
  const [editTab, setEditTab] = useState<(typeof ADMIN_EDIT_TAB_ORDER)[number]>("Basics");
  const [formState, setFormState] = useState<LabFormState>(emptyForm);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [requiredProgressOpen, setRequiredProgressOpen] = useState(false);
  const [flashingRequiredKey, setFlashingRequiredKey] = useState<string | null>(null);
  const requiredFlashTimerRef = useRef<number | null>(null);
  const [offerProfileDraft, setOfferProfileDraft] = useState<LabOfferProfileDraft>(defaultLabOfferProfileDraft);
  const [offerTaxonomy, setOfferTaxonomy] = useState<LabOfferTaxonomyOption[]>([]);
  const [offerTaxonomyLoading, setOfferTaxonomyLoading] = useState(false);
  const [offerProfileError, setOfferProfileError] = useState<string | null>(null);
  const [ercOptions, setErcOptions] = useState<ErcDisciplineOption[]>([]);
  const [ercLoading, setErcLoading] = useState(false);
  const [ercError, setErcError] = useState<string | null>(null);
  const [primaryErcDomain, setPrimaryErcDomain] = useState<ErcDomainOption>("LS");
  const [secondaryErcDomain, setSecondaryErcDomain] = useState<ErcDomainOption>("LS");
  const [photoAssets, setPhotoAssets] = useState<MediaAsset[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [complianceAssets, setComplianceAssets] = useState<MediaAsset[]>([]);
  const [complianceUploading, setComplianceUploading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);
  const [partnerLogos, setPartnerLogos] = useState<PartnerLogo[]>([]);
  const [tagInput, setTagInput] = useState<{ field: "complianceTags" | "equipmentTags" | "focusTags"; value: string }>({
    field: "complianceTags",
    value: "",
  });
  const [techniqueInput, setTechniqueInput] = useState<LabTechnique>({ name: "", description: "" });
  const [draggingPriorityEquipmentIndex, setDraggingPriorityEquipmentIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoPreviewOpen, setLogoPreviewOpen] = useState(false);
  const [logoPreviewScale, setLogoPreviewScale] = useState(1);
  const [logoPreviewOffsetX, setLogoPreviewOffsetX] = useState(0);
  const [logoPreviewOffsetY, setLogoPreviewOffsetY] = useState(0);
  const [logoFramePadding, setLogoFramePadding] = useState(6);
  const [logoFrameColor, setLogoFrameColor] = useState<"white" | "black" | "custom">("white");
  const [logoFrameCustomColor, setLogoFrameCustomColor] = useState("#dbeafe");
  const logoDragRef = useRef<{ x: number; y: number; originX: number; originY: number; width: number; height: number } | null>(null);
  const logoEditorFrameRef = useRef<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [draggingPhotoIndex, setDraggingPhotoIndex] = useState<number | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("all");
  const [certificateLabId, setCertificateLabId] = useState<number | null>(null);
  const [certificateForm, setCertificateForm] = useState<CertificateFormState>(defaultCertificateFormState);
  const [certificateExisting, setCertificateExisting] = useState<LabVerificationCertificate | null>(null);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [certificateSaving, setCertificateSaving] = useState(false);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [certificateSuccess, setCertificateSuccess] = useState<string | null>(null);

  const selectedCertificateLab = useMemo(
    () => (certificateLabId ? labs.find(lab => lab.id === certificateLabId) ?? null : null),
    [certificateLabId, labs],
  );
  const requiredChecklist = useMemo(
    () => [
      { key: "name", label: "Lab name", tab: "Basics" as AdminEditTab, done: formState.name.trim().length > 0 },
      { key: "manager", label: "Lab manager / Director", tab: "Basics" as AdminEditTab, done: formState.labManager.trim().length > 0 },
      { key: "email", label: "Contact email", tab: "Basics" as AdminEditTab, done: formState.contactEmail.trim().length > 0 },
      { key: "shortDescription", label: "Short description", tab: "Basics" as AdminEditTab, done: formState.descriptionShort.trim().length > 0 },
      { key: "longDescription", label: "Long description", tab: "Basics" as AdminEditTab, done: formState.descriptionLong.trim().length > 0 },
      { key: "website", label: "Website", tab: "Branding" as AdminEditTab, done: formState.website.trim().length > 0 },
      { key: "addressLine1", label: "Address line 1", tab: "Location" as AdminEditTab, done: formState.addressLine1.trim().length > 0 },
      { key: "city", label: "City", tab: "Location" as AdminEditTab, done: formState.city.trim().length > 0 },
      { key: "state", label: "State / region", tab: "Location" as AdminEditTab, done: formState.state.trim().length > 0 },
      { key: "postalCode", label: "Postal / ZIP code", tab: "Location" as AdminEditTab, done: formState.postalCode.trim().length > 0 },
      { key: "country", label: "Country", tab: "Location" as AdminEditTab, done: formState.country.trim().length > 0 },
    ],
    [
      formState.name,
      formState.labManager,
      formState.contactEmail,
      formState.descriptionShort,
      formState.descriptionLong,
      formState.website,
      formState.addressLine1,
      formState.city,
      formState.state,
      formState.postalCode,
      formState.country,
    ],
  );
  const requiredProgress = useMemo(() => {
    const completed = requiredChecklist.filter(item => item.done).length;
    const total = requiredChecklist.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percent };
  }, [requiredChecklist]);
  const missingRequiredItems = useMemo(
    () =>
      requiredChecklist
        .filter(item => !item.done)
        .sort((a, b) => {
          const tabOrderDiff = ADMIN_EDIT_TAB_ORDER.indexOf(a.tab) - ADMIN_EDIT_TAB_ORDER.indexOf(b.tab);
          if (tabOrderDiff !== 0) return tabOrderDiff;
          return requiredChecklist.findIndex(item => item.key === a.key) - requiredChecklist.findIndex(item => item.key === b.key);
        }),
    [requiredChecklist],
  );
  const selectedErcCodes = useMemo(() => parseErcCodes(formState.ercDisciplineCodes), [formState.ercDisciplineCodes]);
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
        option => option.domain === secondaryErcDomain && option.code !== formState.primaryErcDisciplineCode,
      ),
    [ercOptions, secondaryErcDomain, formState.primaryErcDisciplineCode],
  );

  const getAccessToken = async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const token = sessionData.session?.access_token ?? null;
    if (!token) return null;

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (!userError && userData.user) return token;

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

    const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
    const refreshedToken = refreshedData.session?.access_token ?? null;
    if (refreshError || !refreshedToken) return first;

    headers.set("Authorization", `Bearer ${refreshedToken}`);
    return fetch(input, { ...(init ?? {}), headers });
  };

  const parseJsonResponse = async <T,>(response: Response): Promise<T | null> => {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) return null;
    try {
      return (await response.json()) as T;
    } catch {
      return null;
    }
  };

  const extractApiError = async (response: Response, fallback: string) => {
    const payload = await parseJsonResponse<{ message?: string; error?: string }>(response);
    if (payload?.message) return payload.message;
    if (payload?.error) return payload.error;
    const raw = (await response.text()).trim();
    if (!raw) return fallback;
    if (raw.startsWith("<!DOCTYPE") || raw.startsWith("<html")) {
      return `${fallback} (API returned HTML instead of JSON).`;
    }
    return raw;
  };

  const closeCertificateModal = () => {
    setCertificateLabId(null);
    setCertificateError(null);
    setCertificateSuccess(null);
    setCertificateExisting(null);
    setCertificateLoading(false);
    setCertificateSaving(false);
    setCertificateForm(defaultCertificateFormState);
  };

  const openCertificateModal = async (lab: LabPartner) => {
    setCertificateLabId(lab.id);
    setCertificateError(null);
    setCertificateSuccess(null);
    setCertificateExisting(null);
    setCertificateForm(defaultCertificateFormState);
    setCertificateLoading(true);
    try {
      const response = await fetchAuthed(`/api/admin/labs/${lab.id}/verification-certificate`);
      if (response.status === 404) {
        setCertificateExisting(null);
        return;
      }
      if (!response.ok) {
        throw new Error(await extractApiError(response, "Unable to load verification certificate"));
      }
      const payload = await parseJsonResponse<LabVerificationCertificate>(response);
      if (!payload) {
        throw new Error(
          "Unable to load verification certificate (API returned non-JSON response).",
        );
      }
      setCertificateExisting(payload);
      setCertificateForm(prev => ({
        ...prev,
        labSignerName: payload.lab_signer_name ?? "",
        labSignerTitle: payload.lab_signer_title ?? "",
        glassSignerName: payload.glass_signer_name ?? "",
        glassSignerTitle: payload.glass_signer_title ?? "",
      }));
    } catch (error) {
      setCertificateError(error instanceof Error ? error.message : "Unable to load certificate");
    } finally {
      setCertificateLoading(false);
    }
  };

  const issueVerificationCertificate = async () => {
    if (!certificateLabId) return;
    if (!certificateForm.labSignerName.trim() || !certificateForm.glassSignerName.trim()) {
      setCertificateError("Both signer names are required.");
      return;
    }
    if (!certificateForm.labSignatureDataUrl || !certificateForm.glassSignatureDataUrl) {
      setCertificateError("Both signatures are required.");
      return;
    }

    setCertificateSaving(true);
    setCertificateError(null);
    setCertificateSuccess(null);
    try {
      const response = await fetchAuthed(`/api/admin/labs/${certificateLabId}/verification-certificate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          labSignerName: certificateForm.labSignerName.trim(),
          labSignerTitle: certificateForm.labSignerTitle.trim() || null,
          labSignatureDataUrl: certificateForm.labSignatureDataUrl,
          glassSignerName: certificateForm.glassSignerName.trim(),
          glassSignerTitle: certificateForm.glassSignerTitle.trim() || null,
          glassSignatureDataUrl: certificateForm.glassSignatureDataUrl,
        }),
      });
      if (!response.ok) {
        throw new Error(await extractApiError(response, "Unable to issue verification certificate"));
      }
      const payload = await parseJsonResponse<LabVerificationCertificate>(response);
      if (!payload) {
        throw new Error(
          "Unable to issue verification certificate (API returned non-JSON response).",
        );
      }
      setCertificateExisting(payload);
      setCertificateSuccess("Verification certificate generated.");
    } catch (error) {
      setCertificateError(error instanceof Error ? error.message : "Unable to issue certificate");
    } finally {
      setCertificateSaving(false);
    }
  };

  useEffect(() => {
    // Ensure admins can see hidden labs as well
    refresh(true).catch(() => {});
  }, [refresh]);

  useEffect(() => {
    let active = true;
    setOfferTaxonomyLoading(true);
    fetchLabOfferTaxonomy()
      .then(options => {
        if (!active) return;
        setOfferTaxonomy(options);
      })
      .catch((error: any) => {
        if (!active) return;
        setOfferProfileError(error?.message || "Unable to load offer options.");
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
    let active = true;
    setErcLoading(true);
    setErcError(null);
    fetchErcDisciplineOptions()
      .then(options => {
        if (!active) return;
        setErcOptions(options);
      })
      .catch((error: any) => {
        if (!active) return;
        setErcError(error?.message || "Unable to load ERC disciplines.");
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
    const primaryCode = formState.primaryErcDisciplineCode;
    if (!primaryCode) return;
    const option = ercOptions.find(item => item.code === primaryCode);
    if (!option) return;
    setPrimaryErcDomain(option.domain);
    setSecondaryErcDomain(option.domain);
  }, [formState.primaryErcDisciplineCode, ercOptions]);

  useEffect(() => {
    return () => {
      if (requiredFlashTimerRef.current) {
        window.clearTimeout(requiredFlashTimerRef.current);
      }
    };
  }, []);

  const flashRequiredField = (key: string, tab: AdminEditTab) => {
    setEditTab(tab);
    setRequiredProgressOpen(false);
    setFlashingRequiredKey(key);
    if (requiredFlashTimerRef.current) {
      window.clearTimeout(requiredFlashTimerRef.current);
      requiredFlashTimerRef.current = null;
    }
    window.setTimeout(() => {
      const target = document.getElementById(`required-${key}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    requiredFlashTimerRef.current = window.setTimeout(() => {
      setFlashingRequiredKey(null);
      requiredFlashTimerRef.current = null;
    }, 2200);
  };

  const filteredLabs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return labs.filter(lab => {
      const status = (lab.labStatus || "listed").toLowerCase();
      const isVerified = ["verified_passive", "verified_active", "premier"].includes(status);
      const hasAuditFlag = lab.auditPassed !== undefined && lab.auditPassed !== null;
      const auditPassed = ["true", true, 1, "1"].includes(lab.auditPassed as any);
      const isAuditPending = isVerified && hasAuditFlag && !auditPassed;

      if (visibilityFilter === "visible" && lab.isVisible === false) return false;
      if (visibilityFilter === "hidden" && lab.isVisible !== false) return false;
      if (verificationFilter === "verified" && (!isVerified || isAuditPending)) return false;
      if (verificationFilter === "pending" && status !== "confirmed" && !isAuditPending) return false;
      if (verificationFilter === "unverified" && (isVerified || status === "confirmed")) return false;

      if (!term) return true;
      const location = [lab.city, lab.country].filter(Boolean).join(", ");
      const haystack = [
        lab.name,
        ...(lab.alternateNames ?? []),
        location,
        lab.labManager,
        lab.contactEmail,
        lab.orgRole,
        ...(lab.ercDisciplineCodes ?? []),
        ...(lab.ercDisciplines ?? []).map(item => item.title),
        lab.primaryErcDisciplineCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [labs, searchTerm, verificationFilter, visibilityFilter]);
  const totalLabs = labs.length;
  const visibleLabsCount = labs.filter(lab => lab.isVisible !== false).length;
  const hiddenLabsCount = labs.filter(lab => lab.isVisible === false).length;
  const verifiedLabsCount = labs.filter(lab => {
    const status = (lab.labStatus || "listed").toLowerCase();
    const isVerified = ["verified_passive", "verified_active", "premier"].includes(status);
    const hasAuditFlag = lab.auditPassed !== undefined && lab.auditPassed !== null;
    const auditPassed = ["true", true, 1, "1"].includes(lab.auditPassed as any);
    const isAuditPending = isVerified && hasAuditFlag && !auditPassed;
    return isVerified && !isAuditPending;
  }).length;
  const premierLabsCount = labs.filter(lab => (lab.labStatus || "listed").toLowerCase() === "premier").length;
  const canUseLogo = ["verified_passive", "verified_active", "premier"].includes(
    (formState.labStatus || "listed").toLowerCase(),
  );
  const canUsePartnerLogos = (formState.labStatus || "").toLowerCase() === "premier";
  const logoPreviewTransform = `translate(${logoPreviewOffsetX}%, ${logoPreviewOffsetY}%) scale(${logoPreviewScale})`;
  const validatedCustomLogoFrameColor =
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(logoFrameCustomColor) ? logoFrameCustomColor : "#dbeafe";
  const logoFrameBackgroundColor =
    logoFrameColor === "black"
      ? "#000000"
      : logoFrameColor === "custom"
        ? validatedCustomLogoFrameColor
        : "#ffffff";
  const logoFramePaddingRatio = Math.max(0, Math.min(0.45, logoFramePadding / 224));
  const logoFramePaddingPercent = `${(logoFramePaddingRatio * 100).toFixed(2)}%`;

  const resetLogoPreviewAdjustments = () => {
    setLogoPreviewScale(1);
    setLogoPreviewOffsetX(0);
    setLogoPreviewOffsetY(0);
    setLogoFramePadding(6);
    setLogoFrameColor("white");
    setLogoFrameCustomColor("#dbeafe");
  };

  const handleLogoPreviewMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = logoEditorFrameRef.current?.getBoundingClientRect();
    logoDragRef.current = {
      x: event.clientX,
      y: event.clientY,
      originX: logoPreviewOffsetX,
      originY: logoPreviewOffsetY,
      width: rect?.width || 1,
      height: rect?.height || 1,
    };
  };

  const handleLogoPreviewMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!logoDragRef.current) return;
    const dx = event.clientX - logoDragRef.current.x;
    const dy = event.clientY - logoDragRef.current.y;
    const nextX = logoDragRef.current.originX + (dx / logoDragRef.current.width) * 100;
    const nextY = logoDragRef.current.originY + (dy / logoDragRef.current.height) * 100;
    setLogoPreviewOffsetX(Math.max(-50, Math.min(50, Number(nextX.toFixed(1)))));
    setLogoPreviewOffsetY(Math.max(-50, Math.min(50, Number(nextY.toFixed(1)))));
  };

  const handleLogoPreviewMouseUp = () => {
    logoDragRef.current = null;
  };

  const renderAndUploadFramedLogo = async (labIdValue?: number | null) => {
    if (!formState.logoUrl) return formState.logoUrl;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = formState.logoUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to load logo for processing."));
    });

    const size = 1024;
    const editorBaseSize = 224;
    const paddingRatio = Math.max(0, Math.min(0.45, logoFramePadding / editorBaseSize));
    const paddingPx = Math.round(size * paddingRatio);
    const innerSize = Math.max(1, size - paddingPx * 2);

    const mainCanvas = document.createElement("canvas");
    mainCanvas.width = size;
    mainCanvas.height = size;
    const mainCtx = mainCanvas.getContext("2d");
    if (!mainCtx) throw new Error("Unable to prepare logo output canvas.");

    const frameColor =
      logoFrameColor === "black"
        ? "#000000"
        : logoFrameColor === "custom"
          ? validatedCustomLogoFrameColor
          : "#ffffff";
    mainCtx.fillStyle = frameColor;
    mainCtx.fillRect(0, 0, size, size);

    mainCtx.save();
    const dx = (logoPreviewOffsetX / 100) * innerSize;
    const dy = (logoPreviewOffsetY / 100) * innerSize;
    mainCtx.translate(size / 2 + dx, size / 2 + dy);
    mainCtx.scale(logoPreviewScale, logoPreviewScale);
    const imageRatio = image.width / image.height;
    const targetRatio = 1;
    let sx = 0;
    let sy = 0;
    let sWidth = image.width;
    let sHeight = image.height;
    if (imageRatio > targetRatio) {
      sWidth = image.height * targetRatio;
      sx = (image.width - sWidth) / 2;
    } else if (imageRatio < targetRatio) {
      sHeight = image.width / targetRatio;
      sy = (image.height - sHeight) / 2;
    }
    mainCtx.drawImage(image, sx, sy, sWidth, sHeight, -innerSize / 2, -innerSize / 2, innerSize, innerSize);
    mainCtx.restore();

    const blob = await new Promise<Blob>((resolve, reject) => {
      mainCanvas.toBlob(result => {
        if (!result) {
          reject(new Error("Unable to encode processed logo."));
          return;
        }
        resolve(result);
      }, "image/png");
    });

    const filePrefix = typeof labIdValue === "number" && Number.isFinite(labIdValue) ? `${labIdValue}` : "admin";
    const filename = `${filePrefix}-logo-v2-${Date.now()}.png`;
    const filePath = `logos/${filename}`;
    const { error: uploadError } = await supabase.storage
      .from("lab-logos")
      .upload(filePath, blob, { upsert: true, contentType: "image/png" });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("lab-logos").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const startCreate = () => {
    setEditing("new");
    setEditTab("Basics");
    setRequiredProgressOpen(false);
    setFlashingRequiredKey(null);
    setFormState(emptyForm);
    setOfferProfileDraft(defaultLabOfferProfileDraft);
    setOfferProfileError(null);
    setStatusMessage(null);
    setPhotoAssets([]);
    setComplianceAssets([]);
    setPartnerLogos([]);
    setTagInput({ field: "complianceTags", value: "" });
    setTechniqueInput({ name: "", description: "" });
    setDraggingPriorityEquipmentIndex(null);
    setComplianceUploading(false);
    setComplianceError(null);
    setLogoError(null);
    setPhotoError(null);
    setLogoPreviewOpen(false);
    resetLogoPreviewAdjustments();
    setDraggingPhotoIndex(null);
  };

  const startEdit = async (lab: LabPartner) => {
    setEditing(lab.id);
    setEditTab("Basics");
    setRequiredProgressOpen(false);
    setFlashingRequiredKey(null);
    setFormState(labToForm(lab));
    setOfferProfileError(null);
    try {
      const profile = await fetchLabOfferProfile(lab.id);
      setOfferProfileDraft(
        draftFromProfile(profile, {
          offersLabSpace: lab.offersLabSpace ?? false,
          offers: lab.offers ?? [],
        }),
      );
    } catch (error: any) {
      setOfferProfileError(error?.message || "Unable to load offer profile.");
      setOfferProfileDraft(
        draftFromProfile(null, {
          offersLabSpace: lab.offersLabSpace ?? false,
          offers: lab.offers ?? [],
        }),
      );
    }
    setStatusMessage(null);
    setPhotoAssets(lab.photos);
    setComplianceAssets(lab.complianceDocs);
    setPartnerLogos(lab.partnerLogos || []);
    setTagInput({ field: "complianceTags", value: "" });
    setTechniqueInput({ name: "", description: "" });
    setDraggingPriorityEquipmentIndex(null);
    setComplianceUploading(false);
    setComplianceError(null);
    setLogoError(null);
    setPhotoError(null);
    setLogoPreviewOpen(false);
    resetLogoPreviewAdjustments();
    setDraggingPhotoIndex(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditTab("Basics");
    setRequiredProgressOpen(false);
    setFlashingRequiredKey(null);
    setFormState(emptyForm);
    setOfferProfileDraft(defaultLabOfferProfileDraft);
    setPhotoAssets([]);
    setComplianceAssets([]);
    setPartnerLogos([]);
    setTagInput({ field: "complianceTags", value: "" });
    setTechniqueInput({ name: "", description: "" });
    setDraggingPriorityEquipmentIndex(null);
    setComplianceUploading(false);
    setComplianceError(null);
    setPhotoError(null);
    setLogoPreviewOpen(false);
    resetLogoPreviewAdjustments();
    setDraggingPhotoIndex(null);
  };

  const handleChange = (field: keyof LabFormState, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const setPrimaryErcDiscipline = (code: string) => {
    const selected = new Set(parseErcCodes(formState.ercDisciplineCodes));
    if (code) selected.add(code);
    setFormState(prev => ({
      ...prev,
      primaryErcDisciplineCode: code || "",
      ercDisciplineCodes: Array.from(selected).join(", "),
    }));
  };

  const toggleSecondaryErcDiscipline = (code: string, checked: boolean) => {
    const selected = new Set(parseErcCodes(formState.ercDisciplineCodes));
    if (checked) selected.add(code);
    else selected.delete(code);
    if (formState.primaryErcDisciplineCode) selected.add(formState.primaryErcDisciplineCode);
    setFormState(prev => ({ ...prev, ercDisciplineCodes: Array.from(selected).join(", ") }));
  };

  const addTag = (field: "complianceTags" | "equipmentTags" | "focusTags", raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setFormState(prev => {
      if (prev[field].includes(value)) return prev;
      return { ...prev, [field]: [...prev[field], value] };
    });
  };

  const removeTag = (field: "complianceTags" | "equipmentTags" | "focusTags", value: string) => {
    setFormState(prev => {
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

  const handleTagKey = (field: "complianceTags" | "equipmentTags" | "focusTags") => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag(field, tagInput.value || (event.target as HTMLInputElement).value);
      setTagInput({ field, value: "" });
    }
  };

  const togglePriorityEquipment = (item: string) => {
    setFormState(prev => {
      const currentTags = [...prev.equipmentTags];
      const currentPriority = [...prev.priorityEquipmentTags];
      const isPriority = currentPriority.includes(item);
      const tagsWithoutItem = currentTags.filter(tag => tag !== item);

      if (isPriority) {
        const nextPriority = currentPriority.filter(tag => tag !== item);
        const prioritySet = new Set(nextPriority);
        const priorityOrdered = tagsWithoutItem.filter(tag => prioritySet.has(tag));
        const nonPriorityOrdered = tagsWithoutItem.filter(tag => !prioritySet.has(tag));
        return {
          ...prev,
          priorityEquipmentTags: nextPriority,
          equipmentTags: [...priorityOrdered, item, ...nonPriorityOrdered],
        };
      }

      if (currentPriority.length >= 3) return prev;
      const nextPriority = [...currentPriority, item];
      const prioritySet = new Set(nextPriority);
      const priorityOrdered = nextPriority.filter(tag => tagsWithoutItem.includes(tag) || tag === item);
      const nonPriorityOrdered = tagsWithoutItem.filter(tag => !prioritySet.has(tag));

      return {
        ...prev,
        priorityEquipmentTags: nextPriority,
        equipmentTags: [...priorityOrdered, ...nonPriorityOrdered],
      };
    });
  };

  const reorderPriorityEquipment = (fromIndex: number, toIndex: number) => {
    setFormState(prev => {
      const priority = [...prev.priorityEquipmentTags];
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= priority.length ||
        toIndex >= priority.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const [moved] = priority.splice(fromIndex, 1);
      priority.splice(toIndex, 0, moved);

      const prioritySet = new Set(priority);
      const nonPriorityOrdered = prev.equipmentTags.filter(tag => !prioritySet.has(tag));
      return {
        ...prev,
        priorityEquipmentTags: priority,
        equipmentTags: [...priority, ...nonPriorityOrdered],
      };
    });
  };

  const addTechnique = () => {
    const name = techniqueInput.name.trim();
    if (!name) return;
    const description = techniqueInput.description?.toString().trim() || null;
    setFormState(prev => ({
      ...prev,
      techniques: [...prev.techniques, { name, description }],
    }));
    setTechniqueInput({ name: "", description: "" });
  };

  const removeTechnique = (index: number) => {
    setFormState(prev => ({
      ...prev,
      techniques: prev.techniques.filter((_, idx) => idx !== index),
    }));
  };

  const toggleVisibilityQuick = async (lab: LabPartner) => {
    try {
      setStatusMessage(null);
      await updateLab(lab.id, { isVisible: !(lab.isVisible ?? true) });
      await refresh(true);
      setStatusMessage({
        type: "success",
        text: `Marked ${lab.name} as ${lab.isVisible === false ? "visible" : "hidden"}`,
      });
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to update visibility",
      });
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      setFormState(prev => ({ ...prev, logoUrl: publicUrl }));
      resetLogoPreviewAdjustments();
      setStatusMessage({ type: "success", text: "Logo uploaded" });
    } catch (err: any) {
      setLogoError(err?.message || "Unable to upload logo");
    } finally {
      setLogoUploading(false);
      event.target.value = "";
    }
  };

  const handlePartnerLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatusMessage(null);
    try {
      const ext = file.name.split(".").pop() || "png";
      const filename =
        (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`) + `.${ext}`;
      const folder = typeof editing === "number" ? `labs/${editing}/partners` : "partners";
      const filePath = `${folder}/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from("lab-logos")
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("lab-logos").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;
      setPartnerLogos(prev => [...prev, { name: file.name, url: publicUrl, website: null }]);
      setStatusMessage({ type: "success", text: "Partner logo uploaded" });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err?.message || "Unable to upload partner logo" });
    }
  };

  const handlePhotoUpload: React.ChangeEventHandler<HTMLInputElement> = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      if (typeof editing === "number") {
        const ext = file.name.split(".").pop() || "jpg";
        const filename =
          (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`) + `.${ext}`;
        const path = `labs/${editing}/photos/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from("lab-photos")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("lab-photos").getPublicUrl(path);
        const publicUrl = data.publicUrl;
        const asset = { name: file.name, url: publicUrl };
        setPhotoAssets(prev => [...prev, asset]);
      } else {
        const uploaded = await new Promise<MediaAsset>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result !== "string") {
              reject(new Error("Unsupported file format"));
              return;
            }
            resolve({ name: file.name, url: reader.result });
          };
          reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });
        setPhotoAssets(prev => [...prev, uploaded]);
      }
      setPhotoError(null);
      setStatusMessage({ type: "success", text: "Photo uploaded" });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Unable to upload photo");
    } finally {
      setPhotoUploading(false);
      event.target.value = "";
    }
  };

  const handleComplianceUpload: React.ChangeEventHandler<HTMLInputElement> = async event => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setComplianceError(null);
    setComplianceUploading(true);
    const labFolder = typeof editing === "number" ? `labs/${editing}/docs` : "docs";
    const uploaded: MediaAsset[] = [];
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "pdf";
        const filename =
          (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`) + `.${ext}`;
        const path = `${labFolder}/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from("lab-pdfs")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("lab-pdfs").getPublicUrl(path);
        uploaded.push({ name: file.name, url: data.publicUrl });
      }
      if (uploaded.length) {
        setComplianceAssets(prev => [...prev, ...uploaded]);
        setStatusMessage({ type: "success", text: "Documents uploaded" });
      }
    } catch (error) {
      setComplianceError(error instanceof Error ? error.message : "Unable to upload compliance documents");
    } finally {
      setComplianceUploading(false);
      event.target.value = "";
    }
  };

  const removePhoto = (asset: MediaAsset) => {
    setPhotoAssets(prev => prev.filter(item => item.url !== asset.url));
  };

  const movePhoto = (fromIndex: number, toIndex: number) => {
    setPhotoAssets(prev => {
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

  const removeComplianceDoc = (asset: MediaAsset) => {
    setComplianceAssets(prev => prev.filter(item => item.url !== asset.url));
  };

  const removePartnerLogo = (url: string) => {
    setPartnerLogos(prev => prev.filter(item => item.url !== url));
  };

  const updatePartnerLogo = (url: string, updates: Partial<PartnerLogo>) => {
    setPartnerLogos(prev => prev.map(item => (item.url === url ? { ...item, ...updates } : item)));
  };

  const validateRequiredFields = () => {
    if (!formState.name.trim()) {
      throw new Error("Lab name is required");
    }
    if (!formState.contactEmail.trim()) {
      throw new Error("Contact email is required");
    }
    if (photoAssets.length === 0) {
      throw new Error("Please upload at least one lab photo.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setIsSaving(true);
      validateRequiredFields();
      const payload = formToPayload(formState, photoAssets, complianceAssets, partnerLogos);
      const hasLogoProcessingAdjustments =
        Boolean(formState.logoUrl) &&
        (logoPreviewScale !== 1 ||
          logoPreviewOffsetX !== 0 ||
          logoPreviewOffsetY !== 0 ||
          logoFramePadding !== 6 ||
          logoFrameColor !== "white" ||
          logoFrameCustomColor.toLowerCase() !== "#dbeafe");
      if (hasLogoProcessingAdjustments) {
        const processedLogoUrl = await renderAndUploadFramedLogo(typeof editing === "number" ? editing : null);
        payload.logoUrl = processedLogoUrl || null;
        if (processedLogoUrl) {
          setFormState(prev => ({ ...prev, logoUrl: processedLogoUrl }));
        }
      }
      payload.offers = draftToLegacyOffers(offerProfileDraft);

      if (editing === "new") {
        const created = await addLab(payload);
        await fetchAuthed(`/api/labs/${created.id}/offers-profile`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            draftToProfilePayload(offerProfileDraft, {
              forceSupportsBenchRental:
                payload.offersLabSpace ? offerProfileDraft.supportsBenchRental : false,
              forceSupportsEquipmentAccess:
                payload.offersLabSpace ? offerProfileDraft.supportsEquipmentAccess : false,
            }),
          ),
        });
        setStatusMessage({ type: "success", text: `Created ${created.name}` });
      } else if (typeof editing === "number") {
        await updateLab(editing, payload);
        await fetchAuthed(`/api/labs/${editing}/offers-profile`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            draftToProfilePayload(offerProfileDraft, {
              forceSupportsBenchRental:
                payload.offersLabSpace ? offerProfileDraft.supportsBenchRental : false,
              forceSupportsEquipmentAccess:
                payload.offersLabSpace ? offerProfileDraft.supportsEquipmentAccess : false,
            }),
          ),
        });
        setStatusMessage({ type: "success", text: "Lab details updated" });
      }

      cancelEdit();
      await refresh(true);
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to save lab details",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setDeletingId(id);
      await removeLab(id);
      if (editing === id) {
        cancelEdit();
      }
      setStatusMessage({ type: "success", text: "Lab removed from the directory" });
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to remove lab",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const sectionClass = embedded
    ? "bg-transparent"
    : editing
      ? "min-h-screen bg-[radial-gradient(1200px_420px_at_10%_-10%,rgba(56,189,248,0.18),transparent_60%),radial-gradient(900px_360px_at_90%_-5%,rgba(59,130,246,0.14),transparent_60%),linear-gradient(to_bottom,rgba(248,250,252,0.96),rgba(241,245,249,0.92))]"
      : "bg-background min-h-screen";
  const containerClass = embedded
    ? "w-full px-0 py-0"
    : editing
      ? "container relative mx-auto max-w-6xl px-4 py-20 lg:py-24"
      : "container mx-auto px-4 py-20 lg:py-24";

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {editing ? (
              <>
                <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Lab edit mode</span>
                <h1 className="mt-2 text-3xl font-semibold text-foreground">Manage lab profile</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Update basic details for this lab with the same structure as Manage Lab.
                </p>
              </>
            ) : (
              <>
                <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Lab admin workspace</span>
                <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold text-foreground md:text-4xl">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                  Admin: manage partner labs
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Keep listings consistent and actionable. Use quick filters to find labs that need updates,
                  then open a lab to edit it in focused mode.
                </p>
              </>
            )}
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  cancelEdit();
                  setStatusMessage(null);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                <X className="h-4 w-4" />
                Back to labs
              </button>
            ) : (
              <>
                <div className="relative w-full sm:w-72">
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={event => setSearchTerm(event.target.value)}
                    placeholder="Search name, location, manager, email, role..."
                    className="w-full rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <MapPin className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
                <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/70 p-1">
                  <button
                    type="button"
                    onClick={() => setVisibilityFilter("all")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      visibilityFilter === "all" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibilityFilter("visible")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      visibilityFilter === "visible" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    Visible
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibilityFilter("hidden")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      visibilityFilter === "hidden" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    Hidden
                  </button>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/70 p-1">
                  <button
                    type="button"
                    onClick={() =>
                      setVerificationFilter(prev => (prev === "unverified" ? "all" : "unverified"))
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      verificationFilter === "unverified" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    Unverified
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerificationFilter(prev => (prev === "pending" ? "all" : "pending"))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      verificationFilter === "pending" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerificationFilter(prev => (prev === "verified" ? "all" : "verified"))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      verificationFilter === "verified" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    Verified
                  </button>
                </div>
                <Link href="/lab-profile">
                  <a className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary">
                    Lab profile guide
                  </a>
                </Link>
                <a
                  href="/certificate-template.html"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                >
                  Certificate template
                </a>
                <button
                  type="button"
                  onClick={startCreate}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                >
                  <Plus className="h-4 w-4" />
                  Add lab
                </button>
              </>
            )}
          </div>
        </div>
        {!editing && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <AdminStat label="Total labs" value={String(totalLabs)} />
            <AdminStat label="Visible" value={String(visibleLabsCount)} />
            <AdminStat label="Hidden" value={String(hiddenLabsCount)} />
            <AdminStat label="Verified" value={String(verifiedLabsCount)} />
            <AdminStat label="Premier" value={String(premierLabsCount)} />
          </div>
        )}

        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 rounded-2xl border p-4 text-sm ${
              statusMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
          >
            {statusMessage.text}
          </motion.div>
        )}

        {labsError && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>{labsError}</span>
            <button
              type="button"
              onClick={() => {
                void refresh();
              }}
              className="rounded-full border border-destructive/40 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em]"
            >
              Retry
            </button>
          </div>
        )}

        {certificateLabId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6"
            onClick={closeCertificateModal}
          >
            <div
              className="relative w-full max-w-3xl rounded-3xl border border-border bg-card p-6 shadow-2xl"
              onClick={event => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeCertificateModal}
                className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary"
                aria-label="Close certificate modal"
              >
                <X className="h-4 w-4" />
              </button>
              <h3 className="text-xl font-semibold text-foreground">Verification certificate</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedCertificateLab
                  ? `Lab: ${selectedCertificateLab.name}`
                  : "Select the lab you are issuing this certificate for."}
              </p>

              {certificateLoading ? (
                <p className="mt-6 text-sm text-muted-foreground">Loading certificate details...</p>
              ) : (
                <div className="mt-6 space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Lab signer name</label>
                      <input
                        type="text"
                        value={certificateForm.labSignerName}
                        onChange={event =>
                          setCertificateForm(prev => ({ ...prev, labSignerName: event.target.value }))
                        }
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        placeholder="Name of lab representative"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Lab signer title</label>
                      <input
                        type="text"
                        value={certificateForm.labSignerTitle}
                        onChange={event =>
                          setCertificateForm(prev => ({ ...prev, labSignerTitle: event.target.value }))
                        }
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        placeholder="Director, Lab manager, etc."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">GLASS signer name</label>
                      <input
                        type="text"
                        value={certificateForm.glassSignerName}
                        onChange={event =>
                          setCertificateForm(prev => ({ ...prev, glassSignerName: event.target.value }))
                        }
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        placeholder="Name of GLASS admin"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">GLASS signer title</label>
                      <input
                        type="text"
                        value={certificateForm.glassSignerTitle}
                        onChange={event =>
                          setCertificateForm(prev => ({ ...prev, glassSignerTitle: event.target.value }))
                        }
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        placeholder="GLASS admin"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <SignaturePad
                      label="Lab representative signature"
                      value={certificateForm.labSignatureDataUrl}
                      onChange={value =>
                        setCertificateForm(prev => ({ ...prev, labSignatureDataUrl: value }))
                      }
                    />
                    <SignaturePad
                      label="GLASS signature"
                      value={certificateForm.glassSignatureDataUrl}
                      onChange={value =>
                        setCertificateForm(prev => ({ ...prev, glassSignatureDataUrl: value }))
                      }
                    />
                  </div>

                  {certificateExisting && (
                    <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-xs text-muted-foreground">
                      <p>
                        Existing certificate issued on{" "}
                        {certificateExisting.issued_at
                          ? new Date(certificateExisting.issued_at).toLocaleDateString()
                          : "unknown date"}
                        .
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <a
                          href={certificateExisting.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          View current PDF
                        </a>
                      </div>
                    </div>
                  )}

                  {certificateError && (
                    <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      {certificateError}
                    </p>
                  )}
                  {certificateSuccess && (
                    <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      {certificateSuccess}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeCertificateModal}
                      className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void issueVerificationCertificate();
                      }}
                      disabled={certificateSaving}
                      className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {certificateSaving ? "Generating PDF..." : "Generate certificate PDF"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-10">
          {!editing && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            {labs.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
                {isLoading
                  ? "Loading lab directory…"
                  : labsError
                    ? "Unable to load the lab directory right now."
                    : "No labs in the directory yet. Use “Add lab” to create your first listing."}
              </div>
            ) : filteredLabs.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center text-muted-foreground">
                No labs match that search.
              </div>
            ) : (
              filteredLabs.map(lab => {
                const status = (lab.labStatus || "listed").toLowerCase();
                const isVerified = ["verified_passive", "verified_active", "premier"].includes(status);
                const hasAuditFlag = lab.auditPassed !== undefined && lab.auditPassed !== null;
                const auditPassed = ["true", true, 1, "1"].includes(lab.auditPassed as any);
                const isAuditPending = isVerified && hasAuditFlag && !auditPassed;
                const badgeLabel =
                  isAuditPending
                    ? "Pending"
                    : status === "premier"
                    ? "Premier"
                    : isVerified
                      ? "Verified"
                      : status === "confirmed"
                        ? "Pending"
                        : "Listed";
                return (
                <div
                  key={lab.id}
                  className="rounded-3xl border border-border bg-card/80 p-5 shadow-sm transition"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground md:text-xl">{lab.name}</h2>
                      <div className="mt-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        {[lab.city, lab.country].filter(Boolean).join(", ") || "Location not set"}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                          isAuditPending
                            ? "bg-amber-50 text-amber-700"
                            : isVerified
                            ? "bg-emerald-50 text-emerald-700"
                            : status === "confirmed"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isVerified && !isAuditPending ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {badgeLabel}
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="h-3.5 w-3.5" />
                            {badgeLabel}
                          </>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleVisibilityQuick(lab)}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
                          lab.isVisible === false
                            ? "bg-slate-200 text-slate-800 hover:bg-slate-300"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                        title={lab.isVisible === false ? "Currently hidden. Click to show." : "Currently visible. Click to hide."}
                      >
                        {lab.isVisible === false ? "Hidden" : "Visible"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span>{lab.labManager || "Manager not set"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="break-all">{lab.contactEmail || "Email not set"}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {lab.orgRole && (
                      <span className="rounded-full border border-border px-2.5 py-1">
                        Role: {lab.orgRole}
                      </span>
                    )}
                    <span className="rounded-full border border-border px-2.5 py-1">
                      Equipment: {lab.equipment.length}
                    </span>
                    <span className="rounded-full border border-border px-2.5 py-1">
                      Focus: {lab.focusAreas.length}
                    </span>
                    <span className="rounded-full border border-border px-2.5 py-1">
                      Photos: {lab.photos.length}
                    </span>
                    <span className="rounded-full border border-border px-2.5 py-1">
                      Docs: {lab.complianceDocs.length}
                    </span>
                    {lab.primaryErcDisciplineCode && (
                      <span className="rounded-full border border-border px-2.5 py-1">
                        ERC: {lab.primaryErcDisciplineCode}
                      </span>
                    )}
                  </div>

                  <details className="mt-4 rounded-2xl border border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none font-medium text-foreground">
                      View full metadata
                    </summary>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div>
                        <span className="font-medium text-foreground">Compliance</span>
                        <p className="mt-1">{lab.compliance.join(", ") || "—"}</p>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Focus areas</span>
                        <p className="mt-1">{lab.focusAreas.join(", ") || "—"}</p>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">ERC disciplines</span>
                        <p className="mt-1">
                          {(lab.ercDisciplines ?? []).length > 0
                            ? (lab.ercDisciplines ?? []).map(item => `${item.code} - ${item.title}`).join(", ")
                            : (lab.ercDisciplineCodes ?? []).join(", ") || "—"}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <span className="font-medium text-foreground">Equipment list</span>
                        <p className="mt-1">{lab.equipment.join(", ") || "—"}</p>
                      </div>
                    </div>
                  </details>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(lab)}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void openCertificateModal(lab);
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                    >
                      <FileCheck2 className="h-3.5 w-3.5" />
                      Verification certificate
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(lab.id)}
                      disabled={deletingId === lab.id}
                      className="inline-flex items-center gap-2 rounded-full border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deletingId === lab.id ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </div>
                );
              })
            )}
          </motion.div>
          )}

          {editing && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto max-w-6xl"
          >
              <form className="mt-2" onSubmit={handleSubmit}>
                <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
                  <aside className="space-y-4 md:sticky md:top-24">
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-3 shadow-[0_10px_26px_-14px_rgba(30,64,175,0.45)] backdrop-blur-sm">
                      <div className="flex flex-wrap gap-2 md:flex-col">
                        {ADMIN_EDIT_TAB_ORDER.map(tab => {
                          const TabIcon = ADMIN_EDIT_TAB_ICONS[tab];
                          return (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setEditTab(tab)}
                              className={`rounded-full border px-4 py-1.5 text-sm font-medium text-left transition md:w-full ${
                                editTab === tab
                                  ? "border-primary/70 bg-gradient-to-r from-primary/20 to-sky-500/20 text-primary shadow-[0_6px_16px_-10px_rgba(59,130,246,0.65)]"
                                  : "border-border/80 bg-background/75 text-muted-foreground hover:border-primary/50 hover:bg-background hover:text-primary"
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
                      <div className="mt-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                        <button
                          type="button"
                          onClick={() => setRequiredProgressOpen(prev => !prev)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Required progress</span>
                            <span className="inline-flex items-center gap-1.5">
                              <span>{requiredProgress.percent}%</span>
                              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/70 bg-background/80">
                                <ChevronDown
                                  className={`h-3 w-3 transition-transform duration-200 ${
                                    requiredProgressOpen ? "rotate-180" : ""
                                  }`}
                                />
                              </span>
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-300"
                              style={{ width: `${requiredProgress.percent}%` }}
                            />
                          </div>
                        </button>
                        {requiredProgressOpen && (
                          <div className="mt-2 border-t border-border/60 pt-2">
                            {missingRequiredItems.length === 0 ? (
                              <p className="text-[11px] text-emerald-600">All required fields are complete.</p>
                            ) : (
                              <div className="space-y-1">
                                {missingRequiredItems.map((item, index) => (
                                  <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => flashRequiredField(item.key, item.tab)}
                                    className="flex w-full items-start gap-1.5 text-left text-[11px] text-muted-foreground hover:text-primary"
                                  >
                                    <span className="min-w-[14px] text-foreground/80">{index + 1}.</span>
                                    <span>{item.label} ({item.tab})</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:flex-col">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground shadow-[0_10px_20px_-12px_rgba(59,130,246,0.85)] md:w-full disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          cancelEdit();
                          setStatusMessage(null);
                        }}
                        className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary md:w-full"
                      >
                        Cancel
                      </button>
                    </div>
                  </aside>

                  <div className="min-w-0 space-y-8">
                    {editTab === "Basics" && (
                      <Section title="Basics">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          This section is what collaborators read first. Clear, specific details increase trust and help
                          you receive better-matched requests.
                        </p>
                        <Field
                          label={
                            <span>
                              Lab name <span className="text-destructive">*</span>
                            </span>
                          }
                          labelClassName={BASICS_LABEL_CLASS}
                          containerClassName={BASICS_FIELD_CLASS}
                          fieldId="required-name"
                          highlighted={flashingRequiredKey === "name"}
                        >
                          <input
                            id="lab-name"
                            type="text"
                            value={formState.name}
                            onChange={event => handleChange("name", event.target.value)}
                            className={BASICS_INPUT_CLASS}
                            placeholder="Official public name, e.g., UAR 3286 CNRS/Unistra"
                            required
                          />
                        </Field>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field
                            label={
                              <span>
                                Lab manager / Director <span className="text-destructive">*</span>
                              </span>
                            }
                            labelClassName={BASICS_LABEL_CLASS}
                            containerClassName={BASICS_FIELD_CLASS}
                            fieldId="required-manager"
                            highlighted={flashingRequiredKey === "manager"}
                          >
                            <input
                              id="lab-manager"
                              type="text"
                              value={formState.labManager}
                              onChange={event => handleChange("labManager", event.target.value)}
                              className={BASICS_INPUT_CLASS}
                              placeholder="Decision-maker or scientific lead (full name)"
                              required
                            />
                          </Field>
                          <Field
                            label={
                              <span>
                                Contact email <span className="text-destructive">*</span>
                              </span>
                            }
                            labelClassName={BASICS_LABEL_CLASS}
                            containerClassName={BASICS_FIELD_CLASS}
                            fieldId="required-email"
                            highlighted={flashingRequiredKey === "email"}
                          >
                            <input
                              id="lab-email"
                              type="email"
                              value={formState.contactEmail}
                              onChange={event => handleChange("contactEmail", event.target.value)}
                              className={BASICS_INPUT_CLASS}
                              placeholder="Team contact email used for collaboration requests"
                              required
                            />
                          </Field>
                        </div>
                        <Field label="Organization role" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                          <select
                            id="lab-org-role"
                            value={formState.orgRole}
                            onChange={event => handleChange("orgRole", event.target.value as "" | OrgRoleOption)}
                            className={BASICS_INPUT_CLASS}
                          >
                            <option value="">Select role type</option>
                            {orgRoleOptions.map(role => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          label={
                            <span className="inline-flex items-center gap-2">
                              <span>HAL structure ID</span>
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
                            id="lab-hal-id"
                            type="text"
                            value={formState.halStructureId}
                            onChange={event => handleChange("halStructureId", event.target.value)}
                            className={BASICS_INPUT_CLASS}
                            placeholder="If indexed in HAL, enter structure ID (e.g., struct-123456)"
                          />
                        </Field>
                        <Field label="Primary ERC discipline" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                          <div className="space-y-3">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <select
                                className={BASICS_INPUT_CLASS}
                                value={primaryErcDomain}
                                onChange={event => setPrimaryErcDomain(event.target.value as ErcDomainOption)}
                              >
                                <option value="PE">PE - Physical Sciences & Engineering</option>
                                <option value="LS">LS - Life Sciences</option>
                                <option value="SH">SH - Social Sciences & Humanities</option>
                              </select>
                              <select
                                className={BASICS_INPUT_CLASS}
                                value={formState.primaryErcDisciplineCode}
                                onChange={event => setPrimaryErcDiscipline(event.target.value)}
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
                        <Field label="Secondary ERC disciplines" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                          <div className="space-y-3">
                            <select
                              className={BASICS_INPUT_CLASS}
                              value={secondaryErcDomain}
                              disabled={!formState.primaryErcDisciplineCode}
                              onChange={event => setSecondaryErcDomain(event.target.value as ErcDomainOption)}
                            >
                              <option value="PE">PE - Physical Sciences & Engineering</option>
                              <option value="LS">LS - Life Sciences</option>
                              <option value="SH">SH - Social Sciences & Humanities</option>
                            </select>
                            <div className="max-h-56 overflow-auto rounded-xl border border-border bg-background px-3 py-2">
                              {!formState.primaryErcDisciplineCode ? (
                                <p className="text-xs text-muted-foreground">Select a primary ERC discipline first.</p>
                              ) : ercLoading ? (
                                <p className="text-xs text-muted-foreground">Loading ERC disciplines...</p>
                              ) : ercOptions.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No ERC disciplines available.</p>
                              ) : (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {secondaryDomainOptions.map(option => {
                                    const checked = selectedErcCodes.includes(option.code);
                                    return (
                                      <label
                                        key={option.code}
                                        className="flex items-start gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-xs text-foreground"
                                      >
                                        <input
                                          type="checkbox"
                                          className="mt-0.5"
                                          checked={checked}
                                          onChange={event =>
                                            toggleSecondaryErcDiscipline(option.code, event.target.checked)
                                          }
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
                            {selectedErcCodes.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {selectedErcCodes.map(code => {
                                  const isPrimary = code === formState.primaryErcDisciplineCode;
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
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Audit status" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                            <select
                              id="lab-verification"
                              value={formState.verification}
                              onChange={event => handleChange("verification", event.target.value as VerificationOption)}
                              className={BASICS_INPUT_CLASS}
                            >
                              <option value="yes">Audit passed</option>
                              <option value="no">Audit pending</option>
                            </select>
                          </Field>
                          <Field label="Lab status" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                            <select
                              id="lab-status"
                              value={formState.labStatus}
                              onChange={event => handleChange("labStatus", event.target.value as LabStatusOption)}
                              className={BASICS_INPUT_CLASS}
                            >
                              <option value="listed">Listed (unverified)</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="verified_passive">Verified — passive</option>
                              <option value="verified_active">Verified — active</option>
                              <option value="premier">Premier</option>
                            </select>
                          </Field>
                        </div>
                        <Field
                          label={
                            <span>
                              Short description <span className="text-destructive">*</span>
                            </span>
                          }
                          labelClassName={BASICS_LABEL_CLASS}
                          containerClassName={BASICS_FIELD_CLASS}
                          fieldId="required-shortDescription"
                          highlighted={flashingRequiredKey === "shortDescription"}
                        >
                          <textarea
                            id="lab-description-short"
                            value={formState.descriptionShort}
                            onChange={event => handleChange("descriptionShort", event.target.value)}
                            className={BASICS_INPUT_CLASS}
                            placeholder="1-2 lines: who you are, what you do best, and who you typically support."
                            rows={4}
                            required
                          />
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">Recommended: 120-180 characters</span>
                            <span
                              className={
                                formState.descriptionShort.length >= 120 && formState.descriptionShort.length <= 180
                                  ? "text-emerald-600"
                                  : "text-muted-foreground"
                              }
                            >
                              {formState.descriptionShort.length} / 350
                            </span>
                          </div>
                        </Field>
                        <Field
                          label={
                            <span>
                              Long description <span className="text-destructive">*</span>
                            </span>
                          }
                          labelClassName={BASICS_LABEL_CLASS}
                          containerClassName={BASICS_FIELD_CLASS}
                          fieldId="required-longDescription"
                          highlighted={flashingRequiredKey === "longDescription"}
                        >
                          <textarea
                            id="lab-description-long"
                            value={formState.descriptionLong}
                            onChange={event => handleChange("descriptionLong", event.target.value)}
                            className={BASICS_INPUT_CLASS}
                            placeholder="Capabilities, sample types, turnaround expectations, compliance context, and collaboration style."
                            rows={6}
                            required
                          />
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">Recommended: 400-900 characters</span>
                            <span
                              className={
                                formState.descriptionLong.length >= 400 && formState.descriptionLong.length <= 900
                                  ? "text-emerald-600"
                                  : "text-muted-foreground"
                              }
                            >
                              {formState.descriptionLong.length} / 8000
                            </span>
                          </div>
                        </Field>
                      </Section>
                    )}

                    {editTab === "Branding" && (
                      <Section title="Branding & Links">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field
                            label={
                              <span>
                                Website <span className="text-destructive">*</span>
                              </span>
                            }
                            labelClassName={BASICS_LABEL_CLASS}
                            containerClassName={BASICS_FIELD_CLASS}
                            fieldId="required-website"
                            highlighted={flashingRequiredKey === "website"}
                          >
                            <input
                              id="lab-website"
                              type="url"
                              value={formState.website}
                              onChange={event => handleChange("website", event.target.value)}
                              className={BASICS_INPUT_CLASS}
                              placeholder="Official website URL, e.g., https://labs.example.com"
                              required
                            />
                          </Field>
                          <Field label="LinkedIn" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                            <input
                              id="lab-linkedin"
                              type="url"
                              value={formState.linkedin}
                              onChange={event => handleChange("linkedin", event.target.value)}
                              className={BASICS_INPUT_CLASS}
                              placeholder="LinkedIn page URL, e.g., https://www.linkedin.com/company/example"
                            />
                          </Field>
                        </div>
                      </Section>
                    )}

                    {editTab === "Location" && (
                      <Section title="Location">
                        <div className="grid gap-3 md:grid-cols-2">
                          <Field
                            label={
                              <span>
                                Address line 1 <span className="text-destructive">*</span>
                              </span>
                            }
                            labelClassName={BASICS_LABEL_CLASS}
                            containerClassName={`${BASICS_FIELD_CLASS} md:col-span-2`}
                            fieldId="required-addressLine1"
                            highlighted={flashingRequiredKey === "addressLine1"}
                          >
                            <input
                              id="lab-address1"
                              type="text"
                              value={formState.addressLine1}
                              onChange={event => handleChange("addressLine1", event.target.value)}
                              className={BASICS_INPUT_CLASS}
                              placeholder="Street + number"
                              required
                            />
                          </Field>
                          <Field label="Address line 2" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                            <input
                              id="lab-address2"
                              type="text"
                              value={formState.addressLine2}
                              onChange={event => handleChange("addressLine2", event.target.value)}
                              className={BASICS_INPUT_CLASS}
                              placeholder="Building, floor, unit (optional)"
                            />
                          </Field>
                          <Field
                            label={
                              <span>
                                City <span className="text-destructive">*</span>
                              </span>
                            }
                            labelClassName={BASICS_LABEL_CLASS}
                            containerClassName={BASICS_FIELD_CLASS}
                            fieldId="required-city"
                            highlighted={flashingRequiredKey === "city"}
                          >
                            <input
                              id="lab-city"
                              type="text"
                              value={formState.city}
                              onChange={event => handleChange("city", event.target.value)}
                              className={BASICS_INPUT_CLASS}
                              placeholder="City"
                              required
                            />
                          </Field>
                          <Field
                            label={
                              <span>
                                State/Region <span className="text-destructive">*</span>
                              </span>
                            }
                            labelClassName={BASICS_LABEL_CLASS}
                            containerClassName={BASICS_FIELD_CLASS}
                            fieldId="required-state"
                            highlighted={flashingRequiredKey === "state"}
                          >
                            <input
                              id="lab-state"
                              type="text"
                              value={formState.state}
                              onChange={event => handleChange("state", event.target.value)}
                              className={BASICS_INPUT_CLASS}
                              placeholder="State or region"
                              required
                            />
                          </Field>
                          <Field
                            label={
                              <span>
                                Postal code <span className="text-destructive">*</span>
                              </span>
                            }
                            labelClassName={BASICS_LABEL_CLASS}
                            containerClassName={BASICS_FIELD_CLASS}
                            fieldId="required-postalCode"
                            highlighted={flashingRequiredKey === "postalCode"}
                          >
                            <input
                              id="lab-postal"
                              type="text"
                              value={formState.postalCode}
                              onChange={event => handleChange("postalCode", event.target.value)}
                              className={BASICS_INPUT_CLASS}
                              placeholder="Postal / ZIP code"
                              required
                            />
                          </Field>
                          <Field
                            label={
                              <span>
                                Country <span className="text-destructive">*</span>
                              </span>
                            }
                            labelClassName={BASICS_LABEL_CLASS}
                            containerClassName={BASICS_FIELD_CLASS}
                            fieldId="required-country"
                            highlighted={flashingRequiredKey === "country"}
                          >
                            <input
                              id="lab-country"
                              type="text"
                              value={formState.country}
                              onChange={event => handleChange("country", event.target.value)}
                              className={BASICS_INPUT_CLASS}
                              placeholder="Country"
                              required
                            />
                          </Field>
                          <Field
                            label={
                              <span className="inline-flex items-center gap-2">
                                <span>SIRET</span>
                                <span className="group relative inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background/85 text-[9px] font-semibold text-muted-foreground transition hover:border-primary hover:text-primary">
                                  ↗
                                  <span className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-background/95 px-2 py-1 text-[10px] font-medium normal-case tracking-normal text-muted-foreground opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100">
                                    Used for patent search in your lab profile.
                                  </span>
                                </span>
                              </span>
                            }
                            labelClassName={BASICS_LABEL_CLASS}
                            containerClassName={BASICS_FIELD_CLASS}
                          >
                            <input
                              id="lab-siret"
                              type="text"
                              value={formState.siretNumber}
                              onChange={event => handleChange("siretNumber", event.target.value)}
                              className={BASICS_INPUT_CLASS}
                              placeholder="French company SIRET number (if applicable)"
                            />
                          </Field>
                        </div>
                      </Section>
                    )}

                    {editTab === "Compliance" && (
                      <Section title="Compliance & capabilities">
                        <Field label="Visibility" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                          <select
                            id="lab-visibility"
                            value={formState.isVisible}
                            onChange={event => handleChange("isVisible", event.target.value as "yes" | "no")}
                            className={BASICS_INPUT_CLASS}
                          >
                            <option value="yes">Visible in directory</option>
                            <option value="no">Hidden (admin only)</option>
                          </select>
                        </Field>
                        <Field label="Compliance" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                          <div className="space-y-2">
                            <input
                              className={BASICS_INPUT_CLASS}
                              placeholder="Add standards or certifications, then press Enter"
                              value={tagInput.field === "complianceTags" ? tagInput.value : ""}
                              onChange={event => setTagInput({ field: "complianceTags", value: event.target.value })}
                              onKeyDown={handleTagKey("complianceTags")}
                            />
                            <div className="flex flex-wrap gap-2">
                              {formState.complianceTags.map(tag => (
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
                              {complianceAssets.map(asset => (
                                <button
                                  key={asset.url}
                                  type="button"
                                  onClick={() => removeComplianceDoc(asset)}
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
                                  id="lab-complianceDocs"
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
                              onChange={event => setTagInput({ field: "equipmentTags", value: event.target.value })}
                              onKeyDown={handleTagKey("equipmentTags")}
                            />
                            <p className="text-xs text-muted-foreground">
                              Click a chip to mark it as priority (up to 3). Click × to remove it.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {formState.equipmentTags.map(tag => {
                                const isPriority = formState.priorityEquipmentTags.includes(tag);
                                const priorityIndex = formState.priorityEquipmentTags.indexOf(tag);
                                return (
                                  <div
                                    key={tag}
                                    role="button"
                                    tabIndex={0}
                                    draggable={isPriority}
                                    onClick={() => togglePriorityEquipment(tag)}
                                    onKeyDown={event => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        togglePriorityEquipment(tag);
                                      }
                                    }}
                                    onDragStart={event => {
                                      if (!isPriority || priorityIndex < 0) return;
                                      event.dataTransfer.setData("text/plain", String(priorityIndex));
                                      event.dataTransfer.effectAllowed = "move";
                                      setDraggingPriorityEquipmentIndex(priorityIndex);
                                    }}
                                    onDragEnd={() => setDraggingPriorityEquipmentIndex(null)}
                                    onDragOver={event => {
                                      if (!isPriority || draggingPriorityEquipmentIndex === null) return;
                                      event.preventDefault();
                                      event.dataTransfer.dropEffect = "move";
                                    }}
                                    onDrop={event => {
                                      if (!isPriority || priorityIndex < 0) return;
                                      event.preventDefault();
                                      const fromIndex = Number(event.dataTransfer.getData("text/plain"));
                                      if (Number.isNaN(fromIndex)) return;
                                      reorderPriorityEquipment(fromIndex, priorityIndex);
                                      setDraggingPriorityEquipmentIndex(null);
                                    }}
                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
                                      isPriority
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border text-muted-foreground hover:border-primary/60 hover:bg-primary/5 hover:text-foreground"
                                    } ${isPriority ? "cursor-grab active:cursor-grabbing" : ""}`}
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
                              {formState.equipmentTags.length === 0 && (
                                <span className="text-xs text-muted-foreground">
                                  Add equipment to start building your featured list.
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Priority selected: {formState.priorityEquipmentTags.length}/3
                            </p>
                          </div>
                        </Field>
                        <Field label="Techniques" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                          <div className="space-y-3">
                            <div className="grid gap-2 md:grid-cols-2">
                              {formState.techniques.map((technique, index) => (
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
                                onChange={event => setTechniqueInput(prev => ({ ...prev, name: event.target.value }))}
                              />
                              <input
                                className={BASICS_INPUT_CLASS}
                                placeholder="Short description"
                                value={techniqueInput.description ?? ""}
                                onChange={event => setTechniqueInput(prev => ({ ...prev, description: event.target.value }))}
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
                              onChange={event => setTagInput({ field: "focusTags", value: event.target.value })}
                              onKeyDown={handleTagKey("focusTags")}
                            />
                            <div className="flex flex-wrap gap-2">
                              {formState.focusTags.map(tag => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:bg-primary/10 hover:text-foreground"
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

                    {editTab === "Photos" && (
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
                                <div className="flex items-center gap-2">
                                  {formState.logoUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setLogoPreviewOpen(true)}
                                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                                    >
                                      Preview
                                    </button>
                                  )}
                                  <label className="inline-flex items-center">
                                    <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground cursor-pointer transition hover:bg-primary/90">
                                      Upload file
                                      <input
                                        id="lab-logo"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                        className="hidden"
                                      />
                                    </span>
                                  </label>
                                </div>
                              </div>
                              {logoUploading && <p className="text-xs text-muted-foreground">Uploading logo…</p>}
                              {logoError && <p className="text-xs text-destructive">{logoError}</p>}
                              {formState.logoUrl ? (
                                <div className="flex w-full max-w-full gap-3 overflow-x-auto overflow-y-hidden pb-1 pr-3 pt-2">
                                  <div className="group relative flex w-[170px] max-w-[170px] flex-shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-2 transition hover:border-primary/60 hover:bg-background/80 hover:shadow-md">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormState(prev => ({ ...prev, logoUrl: "" }));
                                        resetLogoPreviewAdjustments();
                                      }}
                                      className="absolute -right-1.5 -top-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border border-destructive/70 bg-destructive/70 text-destructive-foreground ring-2 ring-background shadow-sm backdrop-blur-md transition hover:bg-destructive/85"
                                      aria-label="Remove logo"
                                      title="Remove logo"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                    <div className="relative">
                                      <div
                                        className="h-24 w-full overflow-hidden rounded"
                                        style={{ padding: logoFramePaddingPercent, backgroundColor: logoFrameBackgroundColor }}
                                      >
                                        <img
                                          src={formState.logoUrl}
                                          alt={`${formState.name || "Lab"} logo`}
                                          draggable={false}
                                          className={PHOTO_THUMB_CLASS}
                                          style={{ transform: logoPreviewTransform, transformOrigin: "center center" }}
                                        />
                                      </div>
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
                                        onChange={event => updatePartnerLogo(logo.url, { website: event.target.value })}
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
                          {photoAssets.length > 0 ? (
                            <div className="flex w-full max-w-full gap-3 overflow-x-auto overflow-y-hidden pb-1 pr-3 pt-2">
                              {photoAssets.map((photo, index) => (
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
                                    onClick={() => removePhoto(photo)}
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

                    {editTab === "Offers" && (
                      <Section title="Offers">
                        <Field label="Offers lab space?" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                          <select
                            id="lab-offers-space"
                            value={formState.offersLabSpace}
                            onChange={event => handleChange("offersLabSpace", event.target.value)}
                            className={BASICS_INPUT_CLASS}
                          >
                            <option value="yes">Yes, accepting bench/space requests</option>
                            <option value="no">No, visibility only</option>
                          </select>
                        </Field>
                        <Field label="Rental offer profile" labelClassName={BASICS_LABEL_CLASS} containerClassName={BASICS_FIELD_CLASS}>
                          <LabOfferProfileEditor
                            draft={offerProfileDraft}
                            onChange={setOfferProfileDraft}
                            taxonomy={offerTaxonomy}
                            loading={offerTaxonomyLoading}
                            error={offerProfileError}
                            disabled={formState.offersLabSpace !== "yes"}
                          />
                        </Field>
                      </Section>
                    )}
                  </div>
                </div>
              </form>
          </motion.div>
          )}
        </div>
      </div>
      {logoPreviewOpen && formState.logoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/52 px-4 py-8">
          <div className="w-full max-w-3xl rounded-3xl border border-white/45 bg-white/62 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Logo preview</h2>
                <p className="mt-1 text-sm text-slate-700">
                  Preview how the logo avatar appears on Labs cards, then drag/zoom to adjust.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLogoPreviewOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-white/70 text-slate-700 transition hover:border-primary hover:text-primary"
                aria-label="Close logo preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="rounded-2xl border border-white/50 bg-white/56 p-4 backdrop-blur-lg">
                <p className="text-xs font-medium text-slate-700">Labs card avatar preview</p>
                <div className="mt-3 rounded-2xl border border-white/55 bg-white/72 p-4 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="size-14 min-h-14 min-w-14 max-h-14 max-w-14 shrink-0 overflow-hidden rounded-full border-2 border-blue-400/80 bg-muted">
                      <div
                        className="h-full w-full overflow-hidden rounded-full"
                        style={{
                          padding: logoFramePaddingPercent,
                          backgroundColor: logoFrameBackgroundColor,
                          clipPath: "circle(50% at 50% 50%)",
                        }}
                      >
                        <img
                          src={formState.logoUrl}
                          alt={`${formState.name || "Lab"} logo preview`}
                          draggable={false}
                          className="h-full w-full rounded-full object-cover"
                          style={{
                            transform: logoPreviewTransform,
                            transformOrigin: "center center",
                            clipPath: "circle(50% at 50% 50%)",
                          }}
                        />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{formState.name || "Your lab name"}</p>
                      <p className="truncate text-xs text-slate-700">
                        {formState.city || "City"}, {formState.country || "Country"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="relative mx-auto mt-4 h-56 w-56 rounded-2xl border border-white/55 bg-white/50 p-2 backdrop-blur-md">
                  <div
                    ref={logoEditorFrameRef}
                    className="relative h-full w-full overflow-hidden rounded-full border-2 border-primary/80 cursor-grab active:cursor-grabbing"
                    onMouseDown={handleLogoPreviewMouseDown}
                    onMouseMove={handleLogoPreviewMouseMove}
                    onMouseUp={handleLogoPreviewMouseUp}
                    onMouseLeave={handleLogoPreviewMouseUp}
                  >
                    <div
                      className="h-full w-full overflow-hidden rounded-full"
                      style={{
                        padding: logoFramePaddingPercent,
                        backgroundColor: logoFrameBackgroundColor,
                        clipPath: "circle(50% at 50% 50%)",
                      }}
                    >
                      <img
                        src={formState.logoUrl}
                        alt={`${formState.name || "Lab"} logo editor`}
                        draggable={false}
                        className="h-full w-full rounded-full object-cover"
                        style={{
                          transform: logoPreviewTransform,
                          transformOrigin: "center center",
                          clipPath: "circle(50% at 50% 50%)",
                        }}
                      />
                    </div>
                    <div
                      className="pointer-events-none absolute inset-0 opacity-45"
                      style={{
                        backgroundImage:
                          "linear-gradient(to right, rgba(15,23,42,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.12) 1px, transparent 1px)",
                        backgroundSize: "20px 20px",
                      }}
                    />
                  </div>
                  <span className="pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2 rounded-full border border-white/70 bg-white/75 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                    Exact avatar crop area
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/50 bg-white/56 p-4 backdrop-blur-lg">
                <p className="text-xs font-medium text-slate-700">Adjust image</p>
                <div className="mt-3 space-y-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
                      <span>Zoom</span>
                      <span>{logoPreviewScale.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={2.5}
                      step={0.01}
                      value={logoPreviewScale}
                      onChange={event => setLogoPreviewScale(Number(event.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
                      <span>Horizontal</span>
                      <span>{logoPreviewOffsetX}%</span>
                    </div>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      step={0.1}
                      value={logoPreviewOffsetX}
                      onChange={event => setLogoPreviewOffsetX(Number(event.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
                      <span>Vertical</span>
                      <span>{logoPreviewOffsetY}%</span>
                    </div>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      step={0.1}
                      value={logoPreviewOffsetY}
                      onChange={event => setLogoPreviewOffsetY(Number(event.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
                      <span>Frame thickness</span>
                      <span>{logoFramePadding}px ({Math.round(logoFramePaddingRatio * 100)}%)</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={24}
                      step={1}
                      value={logoFramePadding}
                      onChange={event => setLogoFramePadding(Number(event.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-slate-700">Frame color</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLogoFrameColor("white")}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                          logoFrameColor === "white"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-slate-300 bg-white/80 text-slate-700 hover:border-primary/60"
                        }`}
                      >
                        <span className="h-2.5 w-2.5 rounded-full border border-slate-300 bg-white" />
                        White
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogoFrameColor("black")}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                          logoFrameColor === "black"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-slate-300 bg-white/80 text-slate-700 hover:border-primary/60"
                        }`}
                      >
                        <span className="h-2.5 w-2.5 rounded-full border border-slate-500 bg-black" />
                        Black
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogoFrameColor("custom")}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                          logoFrameColor === "custom"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-slate-300 bg-white/80 text-slate-700 hover:border-primary/60"
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-slate-400"
                          style={{ backgroundColor: logoFrameCustomColor }}
                        />
                        Custom
                      </button>
                    </div>
                    {logoFrameColor === "custom" && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="color"
                          value={logoFrameCustomColor}
                          onChange={event => setLogoFrameCustomColor(event.target.value)}
                          className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                          aria-label="Choose custom frame color"
                        />
                        <input
                          type="text"
                          value={logoFrameCustomColor}
                          onChange={event => setLogoFrameCustomColor(event.target.value)}
                          className="h-8 w-28 rounded border border-slate-300 bg-white/90 px-2 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          placeholder="#RRGGBB"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={resetLogoPreviewAdjustments}
                      className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary hover:text-primary"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoPreviewOpen(false)}
                      className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AdminStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4 rounded-3xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,250,252,0.78))] p-5 shadow-[0_18px_34px_-22px_rgba(15,23,42,0.45)] backdrop-blur-sm">
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
  fieldId,
  highlighted = false,
}: {
  label: ReactNode;
  children: ReactNode;
  labelClassName?: string;
  containerClassName?: string;
  fieldId?: string;
  highlighted?: boolean;
}) {
  return (
    <div
      id={fieldId}
      className={`grid gap-2 transition ${
        highlighted ? "ring-2 ring-primary/60 animate-[pulse_0.45s_ease-in-out_4]" : ""
      } ${containerClassName ?? ""} shadow-[0_8px_18px_-16px_rgba(30,64,175,0.45)]`.trim()}
    >
      <label className={labelClassName ?? "text-sm font-medium text-foreground"}>{label}</label>
      {children}
    </div>
  );
}

function SignaturePad({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const resizedRef = useRef(false);

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const width = Math.max(240, parent?.clientWidth ?? 320);
    const height = 150;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111827";
    resizedRef.current = true;
  };

  useEffect(() => {
    resizeCanvas();
    const onResize = () => {
      resizeCanvas();
      if (!value) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const image = new Image();
      image.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        ctx.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight);
      };
      image.src = value;
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !resizedRef.current) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    if (!value) return;
    const image = new Image();
    image.onload = () => {
      ctx.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight);
    };
    image.src = value;
  }, [value]);

  const drawPoint = (clientX: number, clientY: number, start = false) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (start) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      return;
    }
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <button
          type="button"
          onClick={() => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (!canvas || !ctx) return;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
            onChange(null);
          }}
          className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          Clear
        </button>
      </div>
      <div className="rounded-xl border border-border bg-background p-2">
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair rounded-lg bg-white"
          onPointerDown={event => {
            drawingRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            drawPoint(event.clientX, event.clientY, true);
          }}
          onPointerMove={event => {
            if (!drawingRef.current) return;
            drawPoint(event.clientX, event.clientY);
          }}
          onPointerUp={event => {
            drawingRef.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
            const canvas = canvasRef.current;
            if (!canvas) return;
            onChange(canvas.toDataURL("image/png"));
          }}
          onPointerLeave={() => {
            drawingRef.current = false;
          }}
        />
      </div>
    </div>
  );
}
