import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Building2, ChevronRight, Search, Users, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { getLabHref } from "@/lib/labPaths";
import type { Org, OrgLab, OrgLabLinkRequest, OrgTypeOption } from "@shared/orgs";
import { orgTypeOptions } from "@shared/orgs";

type LabOption = {
  id: number;
  slug?: string | null;
  name: string;
  city?: string | null;
  country?: string | null;
  logoUrl?: string | null;
  labStatus?: string | null;
  isVisible?: boolean | null;
};

type WizardStep = "Basics" | "Branding" | "Members";
type LogoFrameColor = "white" | "black" | "custom";
type OrgEditorForm = {
  name: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  logoUrl: string;
  website: string;
  linkedin: string;
  orgType: OrgTypeOption;
};
type OrgEditorDraft = {
  form?: Partial<OrgEditorForm>;
  activeStep?: WizardStep;
  slugTouched?: boolean;
  logoPreviewScale?: number;
  logoPreviewOffsetX?: number;
  logoPreviewOffsetY?: number;
  logoFramePadding?: number;
  logoFrameColor?: LogoFrameColor;
  logoFrameCustomColor?: string;
};

const STEP_ORDER: WizardStep[] = ["Basics", "Branding", "Members"];
const INPUT_CLASS =
  "w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const EDITOR_PANEL_CLASS =
  "rounded-3xl border border-white/55 bg-white/58 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.10)] ring-1 ring-white/55 backdrop-blur-2xl";
const EDITOR_SUBPANEL_CLASS =
  "rounded-2xl border border-white/55 bg-white/45 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl";
const EDITOR_EMPTY_PANEL_CLASS =
  "rounded-2xl border border-dashed border-white/60 bg-white/35 p-5 text-sm text-muted-foreground shadow-inner backdrop-blur-xl";
const LAB_AVATAR_CLASS =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background";
const LAB_AVATAR_IMAGE_CLASS = "h-full w-full object-cover";
const LAB_MEMBER_CARD_CLASS =
  "flex h-[104px] items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-4 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md";
const LAB_NAME_CLASS = "line-clamp-3 text-[13px] font-medium leading-tight text-foreground";

const normalizeUrl = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeLabSearch = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const defaultOrgEditorForm: OrgEditorForm = {
  name: "",
  slug: "",
  shortDescription: "",
  longDescription: "",
  logoUrl: "",
  website: "",
  linkedin: "",
  orgType: "research_org",
};

const isWizardStep = (value: unknown): value is WizardStep =>
  typeof value === "string" && STEP_ORDER.includes(value as WizardStep);

const isLogoFrameColor = (value: unknown): value is LogoFrameColor =>
  value === "white" || value === "black" || value === "custom";

const asFiniteNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const readOrgEditorDraft = (draftKey: string): OrgEditorDraft | null => {
  if (typeof window === "undefined") return null;
  try {
    const rawDraft = window.localStorage.getItem(draftKey);
    if (!rawDraft) return null;
    const parsed = JSON.parse(rawDraft);
    return parsed && typeof parsed === "object" ? (parsed as OrgEditorDraft) : null;
  } catch {
    return null;
  }
};

const removeOrgEditorDraft = (draftKey: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(draftKey);
};

export default function OrgEditor({ params }: { params?: { id?: string } }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const hasId = params?.id !== undefined;
  const orgId = hasId ? Number(params?.id) : null;
  const isEditing = hasId;
  const draftKey = useMemo(() => `org-editor-draft:${orgId ?? "new"}`, [orgId]);

  const [form, setForm] = useState<OrgEditorForm>(defaultOrgEditorForm);
  const [allLabs, setAllLabs] = useState<LabOption[]>([]);
  const [members, setMembers] = useState<OrgLab[]>([]);
  const [memberRequests, setMemberRequests] = useState<OrgLabLinkRequest[]>([]);
  const [labSearch, setLabSearch] = useState("");
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<WizardStep>("Basics");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [memberActionLabId, setMemberActionLabId] = useState<number | null>(null);
  const [memberActionRequestId, setMemberActionRequestId] = useState<number | null>(null);
  const [logoPreviewOpen, setLogoPreviewOpen] = useState(false);
  const [logoPreviewScale, setLogoPreviewScale] = useState(1);
  const [logoPreviewOffsetX, setLogoPreviewOffsetX] = useState(0);
  const [logoPreviewOffsetY, setLogoPreviewOffsetY] = useState(0);
  const [logoFramePadding, setLogoFramePadding] = useState(6);
  const [logoFrameColor, setLogoFrameColor] = useState<LogoFrameColor>("white");
  const [logoFrameCustomColor, setLogoFrameCustomColor] = useState("#dbeafe");
  const draftHydratedRef = useRef(false);
  const skipNextDraftWriteRef = useRef(false);
  const logoEditorFrameRef = useRef<HTMLDivElement | null>(null);
  const logoDragRef = useRef<{ x: number; y: number; originX: number; originY: number; width: number; height: number } | null>(null);

  const hydrateDraftFromStorage = () => {
    const draft = readOrgEditorDraft(draftKey);
    if (!draft) return;

    if (draft.form) {
      setForm(prev => {
        const next = { ...prev };
        const stringFields: Array<keyof Omit<OrgEditorForm, "orgType">> = [
          "name",
          "slug",
          "shortDescription",
          "longDescription",
          "logoUrl",
          "website",
          "linkedin",
        ];

        stringFields.forEach(field => {
          const value = draft.form?.[field];
          if (typeof value === "string") {
            next[field] = value;
          }
        });

        if (
          typeof draft.form?.orgType === "string" &&
          (orgTypeOptions as readonly string[]).includes(draft.form.orgType)
        ) {
          next.orgType = draft.form.orgType;
        }

        return next;
      });
    }

    if (isWizardStep(draft.activeStep)) {
      setActiveStep(draft.activeStep);
    }
    if (typeof draft.slugTouched === "boolean") {
      setSlugTouched(draft.slugTouched);
    }
    setLogoPreviewScale(asFiniteNumber(draft.logoPreviewScale, 1));
    setLogoPreviewOffsetX(asFiniteNumber(draft.logoPreviewOffsetX, 0));
    setLogoPreviewOffsetY(asFiniteNumber(draft.logoPreviewOffsetY, 0));
    setLogoFramePadding(asFiniteNumber(draft.logoFramePadding, 6));
    if (isLogoFrameColor(draft.logoFrameColor)) {
      setLogoFrameColor(draft.logoFrameColor);
    }
    if (typeof draft.logoFrameCustomColor === "string") {
      setLogoFrameCustomColor(draft.logoFrameCustomColor);
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      draftHydratedRef.current = false;
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const [labsRes, orgRes, requestsRes] = await Promise.all([
          fetch("/api/labs", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
          isEditing && orgId
            ? fetch(`/api/my-org/${orgId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              })
            : Promise.resolve(null),
          isEditing && orgId
            ? fetch(`/api/orgs/${orgId}/member-requests`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              })
            : Promise.resolve(null),
        ]);

        if (!labsRes.ok) {
          const payload = await labsRes.json().catch(() => ({}));
          throw new Error(payload?.message || "Unable to load labs");
        }

        const labsData = (await labsRes.json()) as LabOption[];
        if (!active) return;
        setAllLabs((labsData ?? []).map(lab => ({
          ...lab,
          slug: (lab as any).slug ?? null,
          logoUrl: (lab as any).logoUrl ?? (lab as any).logo_url ?? null,
          labStatus: (lab as any).labStatus ?? (lab as any).lab_status ?? null,
          isVisible: (lab as any).isVisible ?? (lab as any).is_visible ?? true,
        })));

        if (orgRes) {
          if (!orgRes.ok) {
            const payload = await orgRes.json().catch(() => ({}));
            throw new Error(payload?.message || "Unable to load organization");
          }
          const data = (await orgRes.json()) as Org;
          if (!active) return;
          setForm({
            name: data.name ?? "",
            slug: data.slug ?? "",
            shortDescription: data.shortDescription ?? "",
            longDescription: data.longDescription ?? "",
            logoUrl: data.logoUrl ?? "",
            website: data.website ?? "",
            linkedin: data.linkedin ?? "",
            orgType: data.orgType ?? "research_org",
          });
          setMembers(data.members ?? []);
          setSlugTouched(true);
        } else {
          setForm(defaultOrgEditorForm);
          setMembers([]);
          setSlugTouched(false);
        }
        if (requestsRes) {
          if (!requestsRes.ok) {
            const payload = await requestsRes.json().catch(() => ({}));
            throw new Error(payload?.message || "Unable to load membership requests");
          }
          const requestData = (await requestsRes.json()) as OrgLabLinkRequest[];
          if (!active) return;
          setMemberRequests(requestData ?? []);
        } else {
          setMemberRequests([]);
        }

        hydrateDraftFromStorage();
        draftHydratedRef.current = true;
        setError(null);
      } catch (err) {
        if (!active) return;
        draftHydratedRef.current = true;
        setError(err instanceof Error ? err.message : "Unable to load organization editor");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [draftKey, isEditing, orgId]);

  useEffect(() => {
    if (slugTouched) return;
    setForm(prev => ({ ...prev, slug: slugify(prev.name) }));
  }, [form.name, slugTouched]);

  useEffect(() => {
    if (loading || !draftHydratedRef.current || typeof window === "undefined") return;
    if (skipNextDraftWriteRef.current) {
      skipNextDraftWriteRef.current = false;
      return;
    }

    const draft: OrgEditorDraft = {
      form,
      activeStep,
      slugTouched,
      logoPreviewScale,
      logoPreviewOffsetX,
      logoPreviewOffsetY,
      logoFramePadding,
      logoFrameColor,
      logoFrameCustomColor,
    };

    window.localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [
    activeStep,
    draftKey,
    form,
    loading,
    logoFrameColor,
    logoFrameCustomColor,
    logoFramePadding,
    logoPreviewOffsetX,
    logoPreviewOffsetY,
    logoPreviewScale,
    slugTouched,
  ]);

  const filteredLabs = useMemo(() => {
    const term = normalizeLabSearch(labSearch);
    if (!term) return allLabs;
    const tokens = term.split(" ").filter(Boolean);
    return allLabs.filter(lab => {
      const name = normalizeLabSearch(lab.name);
      return tokens.every(token => name.includes(token));
    });
  }, [allLabs, labSearch]);

  const memberIds = useMemo(() => new Set(members.map(member => member.id)), [members]);
  const filteredMembers = useMemo(() => {
    const term = normalizeLabSearch(memberSearch);
    if (!term) return members;
    const tokens = term.split(" ").filter(Boolean);
    return members.filter(member => {
      const name = normalizeLabSearch(member.name);
      return tokens.every(token => name.includes(token));
    });
  }, [members, memberSearch]);
  const pendingRequests = useMemo(
    () => memberRequests.filter(request => request.status === "pending"),
    [memberRequests],
  );
  const pendingRequestLabIds = useMemo(
    () => new Set(pendingRequests.map(request => request.labId)),
    [pendingRequests],
  );
  const currentStepIndex = STEP_ORDER.indexOf(activeStep);
  const canGoBack = currentStepIndex > 0;
  const canGoForward = currentStepIndex < STEP_ORDER.length - 1;
  const basicsReady = Boolean(form.name.trim() && slugify(form.slug));

  const logoPreviewTransform = `translate(${logoPreviewOffsetX}%, ${logoPreviewOffsetY}%) scale(${logoPreviewScale})`;
  const resolvedCustomFrameColor =
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(logoFrameCustomColor) ? logoFrameCustomColor : "#dbeafe";
  const logoFrameBackgroundColor =
    logoFrameColor === "black" ? "#000000" : logoFrameColor === "custom" ? resolvedCustomFrameColor : "#ffffff";
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

  const goToStep = (step: WizardStep) => {
    setActiveStep(step);
    setError(null);
    setSuccess(null);
  };

  const goNext = () => {
    if (activeStep === "Basics" && !basicsReady) {
      setError("Add the organization name and slug before moving on.");
      return;
    }
    const next = STEP_ORDER[currentStepIndex + 1];
    if (next) goToStep(next);
  };

  const goBack = () => {
    const prev = STEP_ORDER[currentStepIndex - 1];
    if (prev) goToStep(prev);
  };

  const openLabInNewWindow = (lab: Pick<LabOption, "id" | "slug"> | Pick<OrgLab, "id" | "slug">) => {
    window.open(getLabHref(lab), "_blank", "noopener,noreferrer");
  };

  const handleLogoPreviewMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const rect = logoEditorFrameRef.current?.getBoundingClientRect();
    if (!rect) return;
    logoDragRef.current = {
      x: event.clientX,
      y: event.clientY,
      originX: logoPreviewOffsetX,
      originY: logoPreviewOffsetY,
      width: rect.width,
      height: rect.height,
    };
  };

  const handleLogoPreviewMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!logoDragRef.current) return;
    const dx = event.clientX - logoDragRef.current.x;
    const dy = event.clientY - logoDragRef.current.y;
    const nextX = logoDragRef.current.originX + (dx / logoDragRef.current.width) * 100;
    const nextY = logoDragRef.current.originY + (dy / logoDragRef.current.height) * 100;
    setLogoPreviewOffsetX(Number(Math.max(-50, Math.min(50, nextX)).toFixed(2)));
    setLogoPreviewOffsetY(Number(Math.max(-50, Math.min(50, nextY)).toFixed(2)));
  };

  const handleLogoPreviewMouseUp = () => {
    logoDragRef.current = null;
  };

  async function renderAndUploadFramedLogoAsset(sourceUrl: string, filePath: string) {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = sourceUrl;
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

    mainCtx.fillStyle = logoFrameBackgroundColor;
    mainCtx.fillRect(0, 0, size, size);
    mainCtx.save();
    const dx = (logoPreviewOffsetX / 100) * innerSize;
    const dy = (logoPreviewOffsetY / 100) * innerSize;
    mainCtx.translate(size / 2 + dx, size / 2 + dy);
    mainCtx.scale(logoPreviewScale, logoPreviewScale);

    const imageRatio = image.width / image.height;
    const drawWidth = imageRatio >= 1 ? innerSize : innerSize * imageRatio;
    const drawHeight = imageRatio >= 1 ? innerSize / imageRatio : innerSize;
    mainCtx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
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

    const { error: uploadError } = await supabase.storage
      .from("lab-logos")
      .upload(filePath, blob, { upsert: true, contentType: "image/png" });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("lab-logos").getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    setLogoUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const filename = `${orgId ?? "new-org"}-${Date.now()}.${ext}`;
      const path = `orgs/${orgId ?? "new"}/logo/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from("lab-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("lab-logos").getPublicUrl(path);
      setForm(prev => ({ ...prev, logoUrl: data.publicUrl }));
      setSuccess("Logo uploaded.");
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Unable to upload logo");
    } finally {
      setLogoUploading(false);
      if (event.target) event.target.value = "";
    }
  }

  const requestMember = async (labId: number) => {
    if (!orgId) return;
    setMemberActionLabId(labId);
    setError(null);
    setSuccess(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(`/api/orgs/${orgId}/member-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ labId }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Unable to send membership request");
      }
      const lab = allLabs.find(item => item.id === labId);
      const payload = await res.json().catch(() => ({}));
      setMemberRequests(prev => [
        {
          id: Number(payload?.id ?? Date.now()),
          orgId,
          labId,
          status: "pending",
          createdAt: new Date().toISOString(),
          respondedAt: null,
          requestedByUserId: user?.id ?? null,
          lab: lab
            ? {
                id: lab.id,
                slug: null,
                name: lab.name,
                city: lab.city ?? null,
                country: lab.country ?? null,
                logoUrl: lab.logoUrl ?? null,
                labStatus: (lab.labStatus as any) ?? null,
              }
            : null,
        },
        ...prev,
      ]);
      setSuccess("Membership request sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send membership request");
    } finally {
      setMemberActionLabId(null);
    }
  };

  const cancelMemberRequest = async (requestId: number) => {
    if (!orgId) return;
    setMemberActionRequestId(requestId);
    setError(null);
    setSuccess(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(`/api/orgs/${orgId}/member-requests/${requestId}/cancel`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Unable to cancel request");
      }
      setMemberRequests(prev => prev.map(request => (
        request.id === requestId
          ? { ...request, status: "cancelled", respondedAt: new Date().toISOString() }
          : request
      )));
      setSuccess("Membership request cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel request");
    } finally {
      setMemberActionRequestId(null);
    }
  };

  const removeMember = async (labId: number) => {
    if (!orgId) return;
    setMemberActionLabId(labId);
    setError(null);
    setSuccess(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(`/api/orgs/${orgId}/members/${labId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Unable to remove member");
      }
      setMembers(prev => prev.filter(member => member.id !== labId));
      setSuccess("Member removed from organization.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove member");
    } finally {
      setMemberActionLabId(null);
    }
  };

  const handleSave = async () => {
    if (!user) {
      setError("Sign in to save an organization.");
      return;
    }
    if (!form.name.trim()) {
      setActiveStep("Basics");
      setError("Organization name is required.");
      return;
    }
    if (!form.slug.trim()) {
      setActiveStep("Basics");
      setError("Slug is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      let logoUrlForSave = normalizeUrl(form.logoUrl);
      const shouldProcessLogo =
        Boolean(form.logoUrl) &&
        (logoPreviewScale !== 1 ||
          logoPreviewOffsetX !== 0 ||
          logoPreviewOffsetY !== 0 ||
          logoFramePadding !== 6 ||
          logoFrameColor !== "white" ||
          logoFrameCustomColor.toLowerCase() !== "#dbeafe");

      if (logoUrlForSave && shouldProcessLogo) {
        const filename = `orgs/${orgId ?? "new"}/logo/${Date.now()}-framed.png`;
        logoUrlForSave = await renderAndUploadFramedLogoAsset(logoUrlForSave, filename);
      }

      const payload = {
        name: form.name.trim(),
        slug: slugify(form.slug) || form.slug.trim(),
        shortDescription: form.shortDescription.trim() || null,
        longDescription: form.longDescription.trim() || null,
        logoUrl: logoUrlForSave,
        website: normalizeUrl(form.website),
        linkedin: normalizeUrl(form.linkedin),
        orgType: form.orgType,
      };

      const res = await fetch(isEditing ? `/api/my-org/${orgId}` : "/api/orgs", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const responsePayload = await res.json().catch(() => ({}));
        throw new Error(responsePayload?.message || "Unable to save organization");
      }
      const saved = (await res.json()) as Org;
      skipNextDraftWriteRef.current = true;
      removeOrgEditorDraft(draftKey);
      setForm(prev => ({
        ...prev,
        slug: saved.slug ?? prev.slug,
        logoUrl: saved.logoUrl ?? prev.logoUrl,
      }));
      setSuccess(isEditing ? "Organization updated." : "Organization created.");
      if (!isEditing) {
        setLocation(`/org/manage/${saved.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save organization");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !orgId) return;
    const confirmed = window.confirm("Delete this organization? This cannot be undone.");
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(`/api/my-org/${orgId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Unable to delete organization");
      }
      draftHydratedRef.current = false;
      removeOrgEditorDraft(draftKey);
      setLocation("/account?tab=manageOrg");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete organization");
    } finally {
      setDeleting(false);
    }
  };

  const renderStepActions = () => (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
      {canGoBack && (
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          Back
        </button>
      )}
      {canGoForward ? (
        <button
          type="button"
          onClick={goNext}
          className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Next step
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || deleting}
          className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? "Saving..." : isEditing ? "Save" : "Create org"}
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto max-w-5xl px-4 py-16 lg:py-20">
          <p className="text-sm text-muted-foreground">Loading organization editor…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,rgba(219,234,254,0.82)_0%,rgba(255,255,255,0.96)_42%,rgba(252,231,243,0.78)_100%)]">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-72 bg-white/25" />
      <div className="container relative z-10 mx-auto max-w-5xl px-4 py-16 lg:py-20">
        <Link
          href="/account?tab=manageOrg"
          className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/50 px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur-xl transition hover:bg-white/70 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to organizations
        </Link>

        <div className="mt-4">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold text-foreground">
              {isEditing ? "Edit organization profile" : "Create a new organization"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This is now a guided setup so owners can move through the profile without facing one giant form.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="h-fit space-y-4 rounded-3xl border border-white/55 bg-white/58 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.10)] ring-1 ring-white/55 backdrop-blur-2xl lg:sticky lg:top-24">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Setup flow</p>
            </div>
            <div className="space-y-2">
              {STEP_ORDER.map((step, index) => {
                const isActive = step === activeStep;
                const isComplete = index < currentStepIndex;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => goToStep(step)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-primary/40 bg-primary/5 shadow-sm"
                        : "border-border/80 bg-background/90 shadow-sm hover:border-primary/30"
                    }`}
                  >
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      isActive || isComplete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {index + 1}
                    </span>
                    <span className="min-w-0 text-sm font-medium text-foreground">{step}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || deleting}
              className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "Saving..." : isEditing ? "Save" : "Create org"}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting}
                className="inline-flex w-full items-center justify-center rounded-full border border-destructive/30 px-5 py-2 text-sm font-medium text-destructive transition hover:border-destructive hover:bg-destructive/5 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </aside>

          <div className="space-y-6">
            {activeStep === "Basics" && (
              <div className={`${EDITOR_PANEL_CLASS} space-y-5`}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Organization name</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                      className={INPUT_CLASS}
                      placeholder="Organization name"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-foreground">Slug</label>
                      <span className="group relative inline-flex">
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground/70 transition hover:border-muted-foreground/30 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          aria-label="Show slug help"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <span className="pointer-events-none absolute left-7 top-1/2 z-20 hidden w-72 -translate-y-1/2 rounded-lg border border-border bg-popover px-3.5 py-2.5 text-xs font-normal leading-relaxed text-popover-foreground shadow-lg group-hover:block group-focus-within:block">
                          <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-b border-l border-border bg-popover" />
                          The slug is the clean identifier used in links and lookups, like <span className="font-medium">glass-funding</span>. We auto-fill it from the name, and you can fine-tune it if needed.
                        </span>
                      </span>
                    </div>
                    <input
                      value={form.slug}
                      onChange={e => {
                        setSlugTouched(true);
                        setForm(prev => ({ ...prev, slug: slugify(e.target.value) }));
                      }}
                      className={INPUT_CLASS}
                      placeholder="organization-slug"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Type</label>
                    <select
                      value={form.orgType}
                      onChange={e => setForm(prev => ({ ...prev, orgType: e.target.value as OrgTypeOption }))}
                      className={INPUT_CLASS}
                    >
                      {orgTypeOptions.map(option => (
                        <option key={option} value={option}>
                          {option.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Short description</label>
                    <textarea
                      rows={3}
                      value={form.shortDescription}
                      onChange={e => setForm(prev => ({ ...prev, shortDescription: e.target.value }))}
                      className={INPUT_CLASS}
                      placeholder="A short summary used in directory cards."
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">Long description</label>
                    <textarea
                      rows={6}
                      value={form.longDescription}
                      onChange={e => setForm(prev => ({ ...prev, longDescription: e.target.value }))}
                      className={INPUT_CLASS}
                      placeholder="Longer narrative about the organization."
                    />
                  </div>
                </div>
                {renderStepActions()}
              </div>
            )}

            {activeStep === "Branding" && (
              <div className={`${EDITOR_PANEL_CLASS} space-y-5`}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Website</label>
                    <input
                      value={form.website}
                      onChange={e => setForm(prev => ({ ...prev, website: e.target.value }))}
                      className={INPUT_CLASS}
                      placeholder="organization.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">LinkedIn</label>
                    <input
                      value={form.linkedin}
                      onChange={e => setForm(prev => ({ ...prev, linkedin: e.target.value }))}
                      className={INPUT_CLASS}
                      placeholder="linkedin.com/company/..."
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <p className="text-sm font-medium text-foreground">Logo</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-3">
                        <span className="cursor-pointer rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                          Choose logo
                          <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setLogoPreviewOpen(true)}
                        disabled={!form.logoUrl}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
                      >
                        Preview & edit
                      </button>
                    </div>
                    {logoUploading && <p className="text-xs text-muted-foreground">Uploading logo…</p>}
                    {logoError && <p className="text-xs text-destructive">{logoError}</p>}
                  </div>
                </div>

                {form.logoUrl ? (
                  <div className={EDITOR_SUBPANEL_CLASS}>
                    <div className="flex items-center gap-4">
                      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
                        <div
                          className="h-full w-full overflow-hidden rounded-2xl"
                          style={{ padding: logoFramePaddingPercent, backgroundColor: logoFrameBackgroundColor }}
                        >
                          <img
                            src={form.logoUrl}
                            alt={`${form.name || "Organization"} logo`}
                            className="h-full w-full object-contain"
                            style={{ transform: logoPreviewTransform, transformOrigin: "center center" }}
                          />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Current logo preview</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={EDITOR_EMPTY_PANEL_CLASS}>
                    Add a logo to bring the org profile to life. You can crop and frame it in the preview tool.
                  </div>
                )}
                {renderStepActions()}
              </div>
            )}

            {activeStep === "Members" && (
              <div className={`${EDITOR_PANEL_CLASS} space-y-5`}>
                <div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Members</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Send membership requests to labs. They only appear publicly after the lab owner approves.
                    </p>
                  </div>
                </div>

                {!isEditing && (
                  <div className={EDITOR_EMPTY_PANEL_CLASS}>
                    Create the organization first, then come back here to invite member labs.
                  </div>
                )}

                <div className={EDITOR_SUBPANEL_CLASS}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Users className="h-4 w-4 text-primary" />
                      {members.length} approved member{members.length === 1 ? "" : "s"}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMemberSearchOpen(prev => {
                          if (prev) setMemberSearch("");
                          return !prev;
                        });
                      }}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                        memberSearchOpen
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
                      }`}
                      aria-label="Search approved members"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                  {memberSearchOpen && (
                    <div className="relative mt-3 w-full md:max-w-sm">
                      <input
                        type="search"
                        value={memberSearch}
                        onChange={event => setMemberSearch(event.target.value)}
                        className="w-full rounded-full border border-border bg-background px-4 py-2 pr-10 text-sm text-foreground"
                        placeholder="Search member lab"
                        autoFocus
                      />
                      <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="mt-3 max-h-80 min-h-24 resize-y overflow-auto pr-1">
                    <div className="grid gap-3 md:grid-cols-2">
                      {filteredMembers.length > 0 ? filteredMembers.map(lab => (
                        <div
                          key={lab.id}
                          role="link"
                          tabIndex={0}
                          onClick={() => openLabInNewWindow(lab)}
                          onKeyDown={event => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            openLabInNewWindow(lab);
                          }}
                          className={`${LAB_MEMBER_CARD_CLASS} cursor-pointer`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className={LAB_AVATAR_CLASS}>
                              {lab.logoUrl ? (
                                <img src={lab.logoUrl} alt={lab.name} className={LAB_AVATAR_IMAGE_CLASS} />
                              ) : (
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className={LAB_NAME_CLASS}>{lab.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {[lab.city, lab.country].filter(Boolean).join(", ") || "Location not set"}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              removeMember(lab.id);
                            }}
                            onKeyDown={event => event.stopPropagation()}
                            disabled={memberActionLabId === lab.id}
                            className="rounded-full border border-destructive/25 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive transition hover:border-destructive/50 hover:bg-destructive/15 disabled:opacity-60"
                          >
                            {memberActionLabId === lab.id ? "Removing..." : "Remove"}
                          </button>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground">
                          {memberSearch.trim() ? "No approved members match that search." : "No approved members yet."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className={EDITOR_SUBPANEL_CLASS}>
                  <p className="text-sm font-medium text-foreground">Pending requests</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {pendingRequests.length > 0 ? (
                      pendingRequests.map(request => (
                        <div
                          key={request.id}
                          role={request.lab ? "link" : undefined}
                          tabIndex={request.lab ? 0 : undefined}
                          onClick={() => {
                            if (request.lab) openLabInNewWindow(request.lab);
                          }}
                          onKeyDown={event => {
                            if (!request.lab || (event.key !== "Enter" && event.key !== " ")) return;
                            event.preventDefault();
                            openLabInNewWindow(request.lab);
                          }}
                          className={`${LAB_MEMBER_CARD_CLASS} ${request.lab ? "cursor-pointer" : ""}`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className={LAB_AVATAR_CLASS}>
                              {request.lab?.logoUrl ? (
                                <img src={request.lab.logoUrl} alt={request.lab?.name || `Lab #${request.labId}`} className={LAB_AVATAR_IMAGE_CLASS} />
                              ) : (
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className={LAB_NAME_CLASS}>{request.lab?.name || `Lab #${request.labId}`}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {request.lab ? [request.lab.city, request.lab.country].filter(Boolean).join(", ") || "Location not set" : "Location not set"}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-medium text-amber-800">
                              Pending
                            </span>
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                cancelMemberRequest(request.id);
                              }}
                              onKeyDown={event => event.stopPropagation()}
                              disabled={memberActionRequestId === request.id}
                              className="rounded-full border border-destructive/25 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive transition hover:border-destructive/50 hover:bg-destructive/15 disabled:opacity-60"
                            >
                              {memberActionRequestId === request.id ? "Cancelling..." : "Cancel"}
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No pending membership requests.</p>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className={EDITOR_SUBPANEL_CLASS}>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-foreground">Add labs</p>
                      <p className="text-xs text-muted-foreground">
                        Search by lab name, then request to add it to this organization.
                      </p>
                    </div>
                    <div className="relative mt-3 w-full md:max-w-sm">
                      <input
                        type="search"
                        value={labSearch}
                        onChange={e => setLabSearch(e.target.value)}
                        className="w-full rounded-full border border-border bg-background px-4 py-2 pr-10 text-sm text-foreground"
                        placeholder="Search lab name"
                      />
                      <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {!labSearch.trim() ? (
                        null
                      ) : filteredLabs.length > 0 ? filteredLabs.map(lab => {
                        const isMember = memberIds.has(lab.id);
                        const isPending = pendingRequestLabIds.has(lab.id);
                        const canRequest = !isMember && !isPending;
                        return (
                          <div
                            key={lab.id}
                            role="link"
                            tabIndex={0}
                            onClick={() => openLabInNewWindow(lab)}
                            onKeyDown={event => {
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              openLabInNewWindow(lab);
                            }}
                            className={`${LAB_MEMBER_CARD_CLASS} cursor-pointer ${
                              isMember
                                ? "border-primary/40 bg-primary/5"
                                : isPending
                                  ? "border-amber-200 bg-amber-50/70"
                                  : "border-border bg-background hover:border-primary/30"
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className={LAB_AVATAR_CLASS}>
                                {lab.logoUrl ? (
                                  <img src={lab.logoUrl} alt={lab.name} className={LAB_AVATAR_IMAGE_CLASS} />
                                ) : (
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className={LAB_NAME_CLASS}>{lab.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {[lab.city, lab.country].filter(Boolean).join(", ") || "Location not set"}
                                </p>
                              </div>
                            </div>
                            {canRequest ? (
                              <button
                                type="button"
                                onClick={event => {
                                  event.stopPropagation();
                                  void requestMember(lab.id);
                                }}
                                onKeyDown={event => event.stopPropagation()}
                                disabled={memberActionLabId === lab.id}
                                className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-medium text-blue-700 transition hover:bg-blue-200 disabled:opacity-60"
                              >
                                {memberActionLabId === lab.id ? "Sending..." : "Add"}
                              </button>
                            ) : (
                              <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                                isMember ? "bg-primary text-primary-foreground" : "bg-amber-100 text-amber-800"
                              }`}>
                                {isMember ? "Member" : "Pending"}
                              </span>
                            )}
                          </div>
                        );
                      }) : (
                        <p className="text-sm text-muted-foreground md:col-span-2">
                          No lab names match that search.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {renderStepActions()}
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}
          </div>
        </div>
      </div>

      {logoPreviewOpen && form.logoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/52 px-4 py-8">
          <div className="w-full max-w-3xl rounded-3xl border border-white/45 bg-white/62 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Logo preview</h2>
                <p className="mt-1 text-sm text-slate-700">
                  Preview how the org logo appears, then drag and zoom to adjust.
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
                <p className="text-xs font-medium text-slate-700">Org card avatar preview</p>
                <div className="mt-3 rounded-2xl border border-white/55 bg-white/72 p-4 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <div className="size-14 min-h-14 min-w-14 max-h-14 max-w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-blue-400/80 bg-muted">
                      <div className="h-full w-full overflow-hidden rounded-2xl" style={{ padding: logoFramePaddingPercent, backgroundColor: logoFrameBackgroundColor }}>
                        <img
                          src={form.logoUrl}
                          alt={`${form.name || "Organization"} logo preview`}
                          draggable={false}
                          className="h-full w-full rounded-2xl object-contain"
                          style={{ transform: logoPreviewTransform, transformOrigin: "center center" }}
                        />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{form.name || "Organization name"}</p>
                      <p className="truncate text-xs text-slate-700">{members.length} members</p>
                    </div>
                  </div>
                </div>
                <div className="relative mx-auto mt-4 h-56 w-56 rounded-2xl border border-white/55 bg-white/50 p-2 backdrop-blur-md">
                  <div
                    ref={logoEditorFrameRef}
                    className="relative h-full w-full cursor-grab overflow-hidden rounded-2xl border-2 border-primary/80 active:cursor-grabbing"
                    onMouseDown={handleLogoPreviewMouseDown}
                    onMouseMove={handleLogoPreviewMouseMove}
                    onMouseUp={handleLogoPreviewMouseUp}
                    onMouseLeave={handleLogoPreviewMouseUp}
                  >
                    <div className="h-full w-full overflow-hidden rounded-2xl" style={{ padding: logoFramePaddingPercent, backgroundColor: logoFrameBackgroundColor }}>
                      <img
                        src={form.logoUrl}
                        alt={`${form.name || "Organization"} logo editor`}
                        draggable={false}
                        className="h-full w-full rounded-2xl object-contain"
                        style={{ transform: logoPreviewTransform, transformOrigin: "center center" }}
                      />
                    </div>
                  </div>
                  <span className="pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2 rounded-full border border-white/70 bg-white/75 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                    Exact crop area
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
                    <input type="range" min={1} max={2.5} step={0.01} value={logoPreviewScale} onChange={event => setLogoPreviewScale(Number(event.target.value))} className="w-full" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
                      <span>Horizontal</span>
                      <span>{logoPreviewOffsetX}%</span>
                    </div>
                    <input type="range" min={-50} max={50} step={0.1} value={logoPreviewOffsetX} onChange={event => setLogoPreviewOffsetX(Number(event.target.value))} className="w-full" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
                      <span>Vertical</span>
                      <span>{logoPreviewOffsetY}%</span>
                    </div>
                    <input type="range" min={-50} max={50} step={0.1} value={logoPreviewOffsetY} onChange={event => setLogoPreviewOffsetY(Number(event.target.value))} className="w-full" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
                      <span>Frame thickness</span>
                      <span>{logoFramePadding}px ({Math.round(logoFramePaddingRatio * 100)}%)</span>
                    </div>
                    <input type="range" min={0} max={24} step={1} value={logoFramePadding} onChange={event => setLogoFramePadding(Number(event.target.value))} className="w-full" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-slate-700">Frame color</p>
                    <div className="flex items-center gap-2">
                      {(["white", "black", "custom"] as const).map(option => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setLogoFrameColor(option)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                            logoFrameColor === option
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-slate-300 bg-white/80 text-slate-700 hover:border-primary/60"
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full border"
                            style={{
                              borderColor: option === "black" ? "#64748b" : "#cbd5e1",
                              backgroundColor: option === "white" ? "#ffffff" : option === "black" ? "#000000" : logoFrameCustomColor,
                            }}
                          />
                          {option[0].toUpperCase() + option.slice(1)}
                        </button>
                      ))}
                    </div>
                    {logoFrameColor === "custom" && (
                      <div className="mt-2 flex items-center gap-2">
                        <input type="color" value={logoFrameCustomColor} onChange={event => setLogoFrameCustomColor(event.target.value)} className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5" />
                        <input type="text" value={logoFrameCustomColor} onChange={event => setLogoFrameCustomColor(event.target.value)} className="h-8 w-28 rounded border border-slate-300 bg-white/90 px-2 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" placeholder="#RRGGBB" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <button type="button" onClick={resetLogoPreviewAdjustments} className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary hover:text-primary">
                      Reset
                    </button>
                    <button type="button" onClick={() => setLogoPreviewOpen(false)} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
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
