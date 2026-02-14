import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
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
  Upload,
  Users,
  X,
} from "lucide-react";
import { useLabs } from "@/context/LabsContext";
import { supabase } from "@/lib/supabaseClient";
import {
  offerOptions,
  orgRoleOptions,
  type LabPartner,
  type MediaAsset,
  type OrgRoleOption,
  type PartnerLogo,
  type OfferOption,
} from "@shared/labs";

type VerificationOption = "yes" | "no";
type LabStatusOption = "listed" | "confirmed" | "verified_passive" | "verified_active" | "premier";

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
  compliance: string;
  verification: VerificationOption;
  labStatus: LabStatusOption;
  orgRole: "" | OrgRoleOption;
  equipment: string;
  focusAreas: string;
  ercDisciplineCodes: string;
  primaryErcDisciplineCode: string;
  halStructureId: string;
  halPersonId: string;
  offers: OfferOption[];
  photoUrlInput: string;
  complianceDocUrlInput: string;
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
  compliance: "",
  verification: "no",
  labStatus: "listed",
  orgRole: "",
  equipment: "",
  focusAreas: "",
  ercDisciplineCodes: "",
  primaryErcDisciplineCode: "",
  halStructureId: "",
  halPersonId: "",
  offers: [],
  photoUrlInput: "",
  complianceDocUrlInput: "",
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
    compliance: lab.compliance.join(", "),
    verification: lab.auditPassed ? "yes" : "no",
    labStatus: (lab.labStatus || "listed") as LabStatusOption,
    orgRole: lab.orgRole || "",
    equipment: lab.equipment.join(", "),
    focusAreas: lab.focusAreas.join(", "),
    ercDisciplineCodes: (lab.ercDisciplineCodes ?? []).join(", "),
    primaryErcDisciplineCode: lab.primaryErcDisciplineCode || "",
    halStructureId: lab.halStructureId || "",
    halPersonId: lab.halPersonId || "",
    offers: [...lab.offers],
    photoUrlInput: "",
    complianceDocUrlInput: "",
    isVisible: lab.isVisible === false ? "no" : "yes",
  };
}

function parseList(value: string) {
  return value
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean);
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

function readFilesAsAssets(files: FileList): Promise<MediaAsset[]> {
  const fileArray = Array.from(files);
  return Promise.all(
    fileArray.map(
      file =>
        new Promise<MediaAsset>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result !== "string") {
              reject(new Error("Unsupported file format"));
              return;
            }
            resolve({
              name: file.name,
              url: reader.result,
            });
          };
          reader.onerror = () => {
            reject(reader.error ?? new Error("Failed to read file"));
          };
          reader.readAsDataURL(file);
        }),
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
    compliance: parseList(form.compliance),
    auditPassed: form.verification === "yes",
    labStatus: form.labStatus,
    orgRole: form.orgRole || null,
    equipment: parseList(form.equipment),
    focusAreas: parseList(form.focusAreas),
    ercDisciplineCodes: parseErcCodes(form.ercDisciplineCodes),
    primaryErcDisciplineCode: normalizeErcCode(form.primaryErcDisciplineCode) || null,
    ercDisciplines: [],
    offers: form.offers,
    photos,
    complianceDocs,
    isVisible: form.isVisible === "yes",
    halStructureId: form.halStructureId.trim() || null,
    halPersonId: form.halPersonId.trim() || null,
    teamMembers: [],
    priorityEquipment: [],
    techniques: [],
    field: null,
    public: null,
    alternateNames: [],
    tags: [],
  };
}

type StatusMessage = { type: "success" | "error"; text: string } | null;
type EditingState = number | "new" | null;
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
  const [formState, setFormState] = useState<LabFormState>(emptyForm);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>(null);
  const [photoAssets, setPhotoAssets] = useState<MediaAsset[]>([]);
  const [complianceAssets, setComplianceAssets] = useState<MediaAsset[]>([]);
  const [partnerLogos, setPartnerLogos] = useState<PartnerLogo[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
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

  const filteredLabs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return labs;
    return labs.filter(lab => {
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
  }, [labs, searchTerm]);

  const startCreate = () => {
    setEditing("new");
    setFormState(emptyForm);
    setStatusMessage(null);
    setPhotoAssets([]);
    setComplianceAssets([]);
    setPartnerLogos([]);
    setLogoError(null);
  };

  const startEdit = (lab: LabPartner) => {
    setEditing(lab.id);
    setFormState(labToForm(lab));
    setStatusMessage(null);
    setPhotoAssets(lab.photos);
    setComplianceAssets(lab.complianceDocs);
    setPartnerLogos(lab.partnerLogos || []);
    setLogoError(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setFormState(emptyForm);
    setPhotoAssets([]);
    setComplianceAssets([]);
    setPartnerLogos([]);
  };

  const handleChange = (field: keyof LabFormState, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));
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

  const toggleOffer = (offer: OfferOption) => {
    setFormState(prev => {
      const offers = prev.offers.includes(offer)
        ? prev.offers.filter(item => item !== offer)
        : [...prev.offers, offer];
      return { ...prev, offers };
    });
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
      setStatusMessage({ type: "success", text: "Logo uploaded" });
    } catch (err: any) {
      setLogoError(err?.message || "Unable to upload logo");
    } finally {
      setLogoUploading(false);
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

  const addPhotoFromUrl = () => {
    const url = formState.photoUrlInput.trim();
    if (!url) return;
    setPhotoAssets(prev => [
      ...prev,
      {
        name: url.split("/").pop() ?? `Photo ${prev.length + 1}`,
        url,
      },
    ]);
    setFormState(prev => ({ ...prev, photoUrlInput: "" }));
  };

  const addComplianceDocFromUrl = () => {
    const url = formState.complianceDocUrlInput.trim();
    if (!url) return;
    setComplianceAssets(prev => [
      ...prev,
      {
        name: url.split("/").pop() ?? `Document ${prev.length + 1}`,
        url,
      },
    ]);
    setFormState(prev => ({ ...prev, complianceDocUrlInput: "" }));
  };

  const handlePhotoUpload: React.ChangeEventHandler<HTMLInputElement> = async event => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    try {
      const uploaded = await readFilesAsAssets(files);
      setPhotoAssets(prev => [...prev, ...uploaded]);
      setStatusMessage(null);
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to process photo uploads",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleComplianceUpload: React.ChangeEventHandler<HTMLInputElement> = async event => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
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
      setStatusMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to upload documents",
      });
    } finally {
      event.target.value = "";
    }
  };

  const removePhoto = (asset: MediaAsset) => {
    setPhotoAssets(prev => prev.filter(item => item.url !== asset.url));
  };

  const removeComplianceDoc = (asset: MediaAsset) => {
    setComplianceAssets(prev => prev.filter(item => item.url !== asset.url));
  };

  const removePartnerLogo = (asset: MediaAsset) => {
    setPartnerLogos(prev => prev.filter(item => item.url !== asset.url));
  };

  const validateRequiredFields = () => {
    if (!formState.name.trim()) {
      throw new Error("Lab name is required");
    }
    if (!formState.contactEmail.trim()) {
      throw new Error("Contact email is required");
    }
    if (photoAssets.length === 0) {
      throw new Error("Please upload or link at least one lab photo.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setIsSaving(true);
      validateRequiredFields();
      const payload = formToPayload(formState, photoAssets, complianceAssets, partnerLogos);

      if (editing === "new") {
        const created = await addLab(payload);
        setStatusMessage({ type: "success", text: `Created ${created.name}` });
      } else if (typeof editing === "number") {
        await updateLab(editing, payload);
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

  const sectionClass = embedded ? "bg-transparent" : "bg-background min-h-screen";
  const containerClass = embedded
    ? "w-full px-0 py-0"
    : "container mx-auto px-4 py-20 lg:py-24";

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-sm uppercase tracking-[0.35em] text-muted-foreground">
              Lab directory
            </span>
            <h1 className="mt-3 flex items-center gap-2 text-4xl font-semibold text-foreground">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Admin: manage partner labs
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Keep the lab rental directory current by updating contacts, compliance, and equipment
              details. Edits go live instantly for the lab browsing experience.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <input
                type="search"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search by name, alternate name, contact, or role"
                className="w-full rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <MapPin className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
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
          </div>
        </div>

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

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_1fr]">
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
                const badgeLabel =
                  status === "premier"
                    ? "Premier"
                    : isVerified
                      ? "Verified"
                      : status === "confirmed"
                        ? "Confirmed"
                        : "Listed";
                return (
                <div
                  key={lab.id}
                  className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">{lab.name}</h2>
                      <div className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        {[lab.city, lab.country].filter(Boolean).join(", ") || "Location not set"}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                          isVerified
                            ? "bg-emerald-50 text-emerald-700"
                            : status === "confirmed"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isVerified ? (
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
                        {lab.isVisible === false ? "Hidden — click to show" : "Visible — click to hide"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span>{lab.labManager}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="break-all">{lab.contactEmail}</span>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 text-xs text-muted-foreground md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">Compliance</span>
                      <span>{lab.compliance.join(", ") || "—"}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">Focus areas</span>
                      <span>{lab.focusAreas.join(", ") || "—"}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">Organization role</span>
                      <span>{lab.orgRole || "—"}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">ERC disciplines</span>
                      <span>
                        {(lab.ercDisciplines ?? []).length > 0
                          ? (lab.ercDisciplines ?? []).map(item => `${item.code} - ${item.title}`).join(", ")
                          : (lab.ercDisciplineCodes ?? []).join(", ") || "—"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <span className="font-medium text-foreground">Equipment</span>
                      <span>{lab.equipment.join(", ") || "—"}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">Photos</span>
                      <span>{lab.photos.length ? `${lab.photos.length} supplied` : "—"}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">Compliance docs</span>
                      <span>{lab.complianceDocs.length ? `${lab.complianceDocs.length} uploaded` : "—"}</span>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
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
                      onClick={() => startEdit(lab)}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
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

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {editing === "new" ? "Add a lab partner" : editing ? "Edit lab details" : "Select a lab"}
              </h2>
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    cancelEdit();
                    setStatusMessage(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:text-primary hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
              )}
            </div>

            {editing ? (
              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-name">
                    Lab name
                  </label>
                  <input
                    id="lab-name"
                    type="text"
                    value={formState.name}
                    onChange={event => handleChange("name", event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="Atlas Applied Biology"
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="lab-manager">
                      Lab manager
                    </label>
                    <input
                      id="lab-manager"
                      type="text"
                      value={formState.labManager}
                      onChange={event => handleChange("labManager", event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Naomi Chen"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="lab-email">
                      Contact email
                    </label>
                    <input
                      id="lab-email"
                      type="email"
                      value={formState.contactEmail}
                      onChange={event => handleChange("contactEmail", event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="labs+atlas@glass.demo"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="lab-logo">
                      Logo (stored in Supabase)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="lab-logo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="w-full rounded-xl border border-dashed border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                      {formState.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setFormState(prev => ({ ...prev, logoUrl: "" }))}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-destructive hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                          Remove
                        </button>
                      )}
                    </div>
                    {logoUploading && <p className="text-xs text-muted-foreground">Uploading logo…</p>}
                    {logoError && <p className="text-xs text-destructive">{logoError}</p>}
                    {formState.logoUrl && (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                        <img
                          src={formState.logoUrl}
                          alt={`${formState.name || "Lab"} logo`}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                        <span className="text-xs text-muted-foreground break-all max-w-[200px] truncate">
                          {formState.logoUrl}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Upload saves to the `lab-logos` bucket. Keep files small (e.g., 300x300).
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Partner logos (premier feature)
                  </label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePartnerLogoUpload}
                      className="w-full rounded-xl border border-dashed border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                    <p className="text-xs text-muted-foreground">Stored in `lab-logos` under partners/ folders.</p>
                    {partnerLogos.length > 0 && (
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {partnerLogos.map(logo => (
                          <div
                            key={logo.url}
                            className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 flex-shrink-0"
                          >
                            <img src={logo.url} alt={logo.name} className="h-10 w-10 rounded object-cover" />
                            <input
                              className="w-48 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              placeholder="Partner website"
                              value={logo.website ?? ""}
                              onChange={event => {
                                const website = event.target.value;
                                setPartnerLogos(prev =>
                                  prev.map(item =>
                                    item.url === logo.url ? { ...item, website } : item,
                                  ),
                                );
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => removePartnerLogo(logo)}
                              className="text-xs text-muted-foreground hover:text-destructive"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-description-short">
                    Short description
                  </label>
                  <textarea
                    id="lab-description-short"
                    value={formState.descriptionShort}
                    onChange={event => handleChange("descriptionShort", event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="One or two sentences under the lab title."
                    rows={3}
                  />
                  <label className="text-sm font-medium text-foreground mt-4" htmlFor="lab-description-long">
                    Long description
                  </label>
                  <textarea
                    id="lab-description-long"
                    value={formState.descriptionLong}
                    onChange={event => handleChange("descriptionLong", event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="Longer overview shown later on the page."
                    rows={6}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-offers-space">
                    Offers lab space?
                  </label>
                  <select
                    id="lab-offers-space"
                    value={formState.offersLabSpace}
                    onChange={event => handleChange("offersLabSpace", event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="yes">Yes, accepting bench/space requests</option>
                    <option value="no">No, visibility only</option>
                  </select>
                  <p className="text-xs text-muted-foreground">Controls whether pricing/offers show on the lab page.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="lab-address1">
                      Address line 1 (internal)
                    </label>
                    <input
                      id="lab-address1"
                      type="text"
                      value={formState.addressLine1}
                      onChange={event => handleChange("addressLine1", event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="123 Bio Ave"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="lab-address2">
                      Address line 2 (internal)
                    </label>
                    <input
                      id="lab-address2"
                      type="text"
                      value={formState.addressLine2}
                      onChange={event => handleChange("addressLine2", event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Suite, floor, etc."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-hal-id">
                    HAL structure ID (optional)
                  </label>
                  <input
                    id="lab-hal-id"
                    type="text"
                    value={formState.halStructureId}
                    onChange={event => handleChange("halStructureId", event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="struct-123456"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-hal-person-id">
                    HAL person ID (optional)
                  </label>
                  <input
                    id="lab-hal-person-id"
                    type="text"
                    value={formState.halPersonId}
                    onChange={event => handleChange("halPersonId", event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="123456"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="lab-city">
                      City (internal)
                    </label>
                    <input
                      id="lab-city"
                      type="text"
                      value={formState.city}
                      onChange={event => handleChange("city", event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Boston"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="lab-state">
                      State/Region (internal)
                    </label>
                    <input
                      id="lab-state"
                      type="text"
                      value={formState.state}
                      onChange={event => handleChange("state", event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="MA"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="lab-postal">
                      Postal code (internal)
                    </label>
                    <input
                      id="lab-postal"
                      type="text"
                      value={formState.postalCode}
                      onChange={event => handleChange("postalCode", event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="02118"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-country">
                    Country (internal)
                  </label>
                  <input
                    id="lab-country"
                    type="text"
                    value={formState.country}
                    onChange={event => handleChange("country", event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="United States"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="lab-website">
                      Website (optional)
                    </label>
                    <input
                      id="lab-website"
                      type="url"
                      value={formState.website}
                      onChange={event => handleChange("website", event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="https://labs.example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="lab-linkedin">
                      LinkedIn (optional)
                    </label>
                    <input
                      id="lab-linkedin"
                      type="url"
                      value={formState.linkedin}
                      onChange={event => handleChange("linkedin", event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="https://www.linkedin.com/company/example"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="lab-siret">
                      SIRET (internal)
                    </label>
                    <input
                      id="lab-siret"
                      type="text"
                      value={formState.siretNumber}
                      onChange={event => handleChange("siretNumber", event.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="14-digit SIRET"
                    />
                    <p className="text-xs text-muted-foreground">Internal use only; not shown publicly.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-verification">
                    Audit status
                  </label>
                  <select
                    id="lab-verification"
                    value={formState.verification}
                    onChange={event => handleChange("verification", event.target.value as VerificationOption)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="yes">Audit passed</option>
                    <option value="no">Audit pending</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-status">
                    Lab status
                  </label>
                  <select
                    id="lab-status"
                    value={formState.labStatus}
                    onChange={event => handleChange("labStatus", event.target.value as LabStatusOption)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="listed">Listed (unverified)</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="verified_passive">Verified — passive</option>
                    <option value="verified_active">Verified — active</option>
                    <option value="premier">Premier</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-org-role">
                    Organization role
                  </label>
                  <select
                    id="lab-org-role"
                    value={formState.orgRole}
                    onChange={event => handleChange("orgRole", event.target.value as "" | OrgRoleOption)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="">Select role type</option>
                    {orgRoleOptions.map(role => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-visibility">
                    Visibility
                  </label>
                  <select
                    id="lab-visibility"
                    value={formState.isVisible}
                    onChange={event => handleChange("isVisible", event.target.value as "yes" | "no")}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="yes">Visible in directory</option>
                    <option value="no">Hidden (admin only)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-compliance">
                    Compliance (comma separated)
                  </label>
                  <input
                    id="lab-compliance"
                    type="text"
                    value={formState.compliance}
                    onChange={event => handleChange("compliance", event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="BSL-2, ISO 7 Cleanroom"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: BSL-2, ISO 7 Cleanroom, GMP-aligned SOPs.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-complianceDocs">
                    Compliance certificates (PDF)
                  </label>
                  <input
                    id="lab-complianceDocs"
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={handleComplianceUpload}
                    className="w-full rounded-xl border border-dashed border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground">Uploads are stored in the Supabase bucket `lab-pdfs`.</p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {complianceAssets.map(asset => (
                      <button
                        key={asset.url}
                        type="button"
                        onClick={() => removeComplianceDoc(asset)}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 transition hover:border-destructive hover:text-destructive"
                      >
                        <FileDown className="h-3 w-3 text-primary" />
                        {asset.name}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formState.complianceDocUrlInput}
                      onChange={event => handleChange("complianceDocUrlInput", event.target.value)}
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="https://example.com/certificate.pdf"
                    />
                    <button
                      type="button"
                      onClick={addComplianceDocFromUrl}
                      className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                    >
                      <Upload className="h-4 w-4" />
                      Add URL
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload or link to safety certifications. These appear alongside compliance notes for researchers.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-focusAreas">
                    Focus areas (comma separated)
                  </label>
                  <input
                    id="lab-focusAreas"
                    type="text"
                    value={formState.focusAreas}
                    onChange={event => handleChange("focusAreas", event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="Cell therapy, Process development"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-erc-disciplines">
                    ERC disciplines (codes, comma separated)
                  </label>
                  <input
                    id="lab-erc-disciplines"
                    type="text"
                    value={formState.ercDisciplineCodes}
                    onChange={event => handleChange("ercDisciplineCodes", event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="LS1, LS7, PE2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use official ERC panel codes: PE1-PE11, LS1-LS9, SH1-SH8.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-erc-primary">
                    Primary ERC discipline (single code)
                  </label>
                  <input
                    id="lab-erc-primary"
                    type="text"
                    value={formState.primaryErcDisciplineCode}
                    onChange={event => handleChange("primaryErcDisciplineCode", event.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="LS1"
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Offers</span>
                  <div className="flex flex-wrap gap-3">
                    {offerOptions.map(option => (
                      <label key={option} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={formState.offers.includes(option)}
                          onChange={() => toggleOffer(option)}
                          className="h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-equipment">
                    Equipment (comma separated)
                  </label>
                  <textarea
                    id="lab-equipment"
                    value={formState.equipment}
                    onChange={event => handleChange("equipment", event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="Single-use bioreactors, Cryostorage, Sequencing core"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    List flagship instrumentation available to teams.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-photos">
                    Lab photos
                  </label>
                  <input
                    id="lab-photos"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="w-full rounded-xl border border-dashed border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    {photoAssets.map(asset => (
                      <div key={asset.url} className="relative overflow-hidden rounded-2xl border border-border">
                        <img src={asset.url} alt={asset.name} className="h-24 w-full object-cover" />
                        <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground bg-background/80">
                          <span className="truncate">{asset.name}</span>
                          <button
                            type="button"
                            onClick={() => removePhoto(asset)}
                            className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] transition hover:border-destructive hover:text-destructive"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formState.photoUrlInput}
                      onChange={event => handleChange("photoUrlInput", event.target.value)}
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="https://example.com/photo.jpg"
                    />
                    <button
                      type="button"
                      onClick={addPhotoFromUrl}
                      className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Add URL
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload photos directly or link to hosted images. The first photo is used for the public thumbnail.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      cancelEdit();
                      setStatusMessage(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-16 text-center text-sm text-muted-foreground">
                Select a lab from the list or choose “Add lab” to create a new listing.
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
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
