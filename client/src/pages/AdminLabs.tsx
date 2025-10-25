import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  CheckCircle2,
  Edit2,
  FileDown,
  ImageIcon,
  MapPin,
  Mail,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useLabs } from "@/context/LabsContext";
import {
  offerOptions,
  type LabPartner,
  type MediaAsset,
  type OfferOption,
} from "@shared/labs";

type VerificationOption = "yes" | "no";
type PricePrivacyOption = "yes" | "no";

interface LabFormState {
  name: string;
  location: string;
  labManager: string;
  contactEmail: string;
  compliance: string;
  verification: VerificationOption;
  pricePrivacy: PricePrivacyOption;
  equipment: string;
  focusAreas: string;
  offers: OfferOption[];
  minimumStay: string;
  rating: string;
  photoUrlInput: string;
  complianceDocUrlInput: string;
}

const emptyForm: LabFormState = {
  name: "",
  location: "",
  labManager: "",
  contactEmail: "",
  compliance: "",
  verification: "no",
  pricePrivacy: "no",
  equipment: "",
  focusAreas: "",
  offers: [],
  minimumStay: "",
  rating: "",
  photoUrlInput: "",
  complianceDocUrlInput: "",
};

function labToForm(lab: LabPartner): LabFormState {
  return {
    name: lab.name,
    location: lab.location,
    labManager: lab.labManager,
    contactEmail: lab.contactEmail,
    compliance: lab.compliance.join(", "),
    verification: lab.isVerified ? "yes" : "no",
    pricePrivacy: lab.pricePrivacy ? "yes" : "no",
    equipment: lab.equipment.join(", "),
    focusAreas: lab.focusAreas.join(", "),
    offers: [...lab.offers],
    minimumStay: lab.minimumStay,
    rating: lab.rating.toString(),
    photoUrlInput: "",
    complianceDocUrlInput: "",
  };
}

function parseList(value: string) {
  return value
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean);
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
) {
  const ratingValue = form.rating.trim() === "" ? 0 : Number(form.rating);
  if (form.rating.trim() !== "" && (Number.isNaN(ratingValue) || ratingValue < 0 || ratingValue > 5)) {
    throw new Error("Rating must be a number between 0 and 5");
  }

  return {
    name: form.name.trim(),
    location: form.location.trim(),
    labManager: form.labManager.trim(),
    contactEmail: form.contactEmail.trim(),
    compliance: parseList(form.compliance),
    isVerified: form.verification === "yes",
    equipment: parseList(form.equipment),
    focusAreas: parseList(form.focusAreas),
    offers: form.offers,
    pricePrivacy: form.pricePrivacy === "yes",
    minimumStay: form.minimumStay.trim(),
    rating: form.rating.trim() === "" ? 0 : ratingValue,
    photos,
    complianceDocs,
  };
}

type StatusMessage = { type: "success" | "error"; text: string } | null;
type EditingState = number | "new" | null;

export default function AdminLabs() {
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
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const startCreate = () => {
    setEditing("new");
    setFormState(emptyForm);
    setStatusMessage(null);
    setPhotoAssets([]);
    setComplianceAssets([]);
  };

  const startEdit = (lab: LabPartner) => {
    setEditing(lab.id);
    setFormState(labToForm(lab));
    setStatusMessage(null);
    setPhotoAssets(lab.photos);
    setComplianceAssets(lab.complianceDocs);
  };

  const cancelEdit = () => {
    setEditing(null);
    setFormState(emptyForm);
    setPhotoAssets([]);
    setComplianceAssets([]);
  };

  const handleChange = (field: keyof LabFormState, value: string) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const toggleOffer = (offer: OfferOption) => {
    setFormState(prev => {
      const offers = prev.offers.includes(offer)
        ? prev.offers.filter(item => item !== offer)
        : [...prev.offers, offer];
      return { ...prev, offers };
    });
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
    try {
      const uploaded = await readFilesAsAssets(files);
      setComplianceAssets(prev => [...prev, ...uploaded]);
      setStatusMessage(null);
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to process document uploads",
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

  const validateRequiredFields = () => {
    if (!formState.name.trim()) {
      throw new Error("Lab name is required");
    }
    if (!formState.location.trim()) {
      throw new Error("Location is required");
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
      const payload = formToPayload(formState, photoAssets, complianceAssets);

      if (editing === "new") {
        const created = await addLab(payload);
        setStatusMessage({ type: "success", text: `Created ${created.name}` });
      } else if (typeof editing === "number") {
        await updateLab(editing, payload);
        setStatusMessage({ type: "success", text: "Lab details updated" });
      }

      cancelEdit();
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

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 lg:py-24">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-sm uppercase tracking-[0.35em] text-muted-foreground">
              Lab directory
            </span>
            <h1 className="mt-3 text-4xl font-semibold text-foreground">
              Admin: manage partner labs
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Keep the lab rental directory current by updating contacts, compliance, and equipment
              details. Edits go live instantly for the lab browsing experience.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/lab-profile">
              <a className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary">
                Lab profile guide
              </a>
            </Link>
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
              onClick={refresh}
              className="rounded-full border border-destructive/40 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em]"
            >
              Retry
            </button>
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
            ) : (
              labs.map(lab => (
                <div
                  key={lab.id}
                  className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">{lab.name}</h2>
                      <div className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        {lab.location}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                        lab.isVerified
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {lab.isVerified ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Verified
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Pending
                        </>
                      )}
                    </span>
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
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <span className="font-medium text-foreground">Equipment</span>
                      <span>{lab.equipment.join(", ") || "—"}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">Minimum stay</span>
                      <span>{lab.minimumStay || "—"}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">Pricing & rating</span>
                      <span>
                        {lab.pricePrivacy ? "Quotes required" : "Rates published"} · Rating {lab.rating.toFixed(1)}
                      </span>
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
              ))
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

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-location">
                    Location
                  </label>
                  <input
                    id="lab-location"
                    type="text"
                    value={formState.location}
                    onChange={event => handleChange("location", event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="Boston, MA"
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
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-verification">
                    Verification status
                  </label>
                  <select
                    id="lab-verification"
                    value={formState.verification}
                    onChange={event => handleChange("verification", event.target.value as VerificationOption)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="yes">Verified</option>
                    <option value="no">Pending verification</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-pricePrivacy">
                    Price privacy
                  </label>
                  <select
                    id="lab-pricePrivacy"
                    value={formState.pricePrivacy}
                    onChange={event => handleChange("pricePrivacy", event.target.value as PricePrivacyOption)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="no">Rates published</option>
                    <option value="yes">Quotes required</option>
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
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-minimumStay">
                    Minimum stay / commitment
                  </label>
                  <input
                    id="lab-minimumStay"
                    type="text"
                    value={formState.minimumStay}
                    onChange={event => handleChange("minimumStay", event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="20 lab hours per month"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="lab-rating">
                    Rating (0-5)
                  </label>
                  <input
                    id="lab-rating"
                    type="number"
                    min={0}
                    max={5}
                    step="0.1"
                    value={formState.rating}
                    onChange={event => handleChange("rating", event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    placeholder="4.5"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. Aggregate rating from teams that used the lab.
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
