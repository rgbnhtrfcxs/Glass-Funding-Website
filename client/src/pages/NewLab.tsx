import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useLabs } from "@/context/LabsContext";
import { useAuth } from "@/context/AuthContext";
import { useConsent } from "@/context/ConsentContext";
import {
  offerOptions,
  orgRoleOptions,
  type LabTechnique,
  type OfferOption,
  type OrgRoleOption,
  type PartnerLogo,
} from "@shared/labs";
import type { MediaAsset } from "@shared/labs";
import { supabase } from "@/lib/supabaseClient";
import { Link } from "wouter";

const TAB_ORDER = [
  "Basics",
  "Photos",
  "Company details",
  "Branding & Links",
  "Compliance",
  "Team",
  "Offers",
] as const;

const ROLE_RANK_HELP = [
  "1 = Lab Director",
  "2 = Deputy Director",
  "3 = Team Leader",
  "4 = Researcher",
  "5 = Postdoc",
  "6 = PhD Student",
  "7 = Research/Technical support",
];

export default function NewLab() {
  const { addLab } = useLabs();
  const { user } = useAuth();
  const { hasFunctionalConsent } = useConsent();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({
    name: "",
    labManager: "",
    contactEmail: user?.email ?? "",
    descriptionShort: "",
    descriptionLong: "",
    field: "",
    orgRole: "" as "" | OrgRoleOption,
    offersLabSpace: true,
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    website: "",
    linkedin: "",
    siretNumber: "",
    equipmentTags: [] as string[],
    priorityEquipmentTags: [] as string[],
    techniques: [] as LabTechnique[],
    focusTags: [] as string[],
    complianceTags: [] as string[],
    offers: [] as OfferOption[],
    logoUrl: "",
    halStructureId: "",
    halPersonId: "",
    teamMembers: [] as Array<{
      name: string;
      title: string;
      linkedin?: string | null;
      website?: string | null;
      teamName?: string | null;
      roleRank?: number | null;
      isLead?: boolean;
    }>,
  });
  const [photos, setPhotos] = useState<MediaAsset[]>([]);
  const [partnerLogos, setPartnerLogos] = useState<PartnerLogo[]>([]);
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [partnerUrlInput, setPartnerUrlInput] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [partnerUploading, setPartnerUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const [complianceDocs, setComplianceDocs] = useState<MediaAsset[]>([]);
  const [complianceUploading, setComplianceUploading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState<{ field: "equipmentTags" | "focusTags" | "complianceTags"; value: string }>({
    field: "equipmentTags",
    value: "",
  });
  const [techniqueInput, setTechniqueInput] = useState<LabTechnique>({ name: "", description: "" });
  const [teamMemberInput, setTeamMemberInput] = useState({
    name: "",
    title: "",
    linkedin: "",
    website: "",
    teamName: "",
    roleRank: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof TAB_ORDER)[number]>("Basics");
  const tabOrder = TAB_ORDER;
  const currentTabIndex = tabOrder.indexOf(activeTab);
  const isFirstTab = currentTabIndex <= 0;
  const isLastTab = currentTabIndex === tabOrder.length - 1;
  const [profileCaps, setProfileCaps] = useState<{
    isAdmin: boolean;
    canCreateLab: boolean;
    canManageMultipleLabs: boolean;
    canManageTeams: boolean;
    canManageMultipleTeams: boolean;
    canPostNews: boolean;
    canBrokerRequests: boolean;
    canReceiveInvestor: boolean;
  }>({
    isAdmin: false,
    canCreateLab: false,
    canManageMultipleLabs: false,
    canManageTeams: false,
    canManageMultipleTeams: false,
    canPostNews: false,
    canBrokerRequests: false,
    canReceiveInvestor: false,
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRoleHelp, setShowRoleHelp] = useState(false);
  const [pinRoleHelp, setPinRoleHelp] = useState(false);
  const draftKey = useMemo(
    () => `new-lab-draft:${user?.id ?? "guest"}`,
    [user?.id],
  );

  const canUseLogo = true;
  const canUsePartnerLogos = profileCaps.isAdmin || profileCaps.canManageMultipleLabs;
  const maxPhotos = profileCaps.canManageMultipleLabs ? Number.POSITIVE_INFINITY : 2;

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select(
        [
          "is_admin",
          "can_create_lab",
          "can_manage_multiple_labs",
          "can_manage_teams",
          "can_manage_multiple_teams",
          "can_post_news",
          "can_broker_requests",
          "can_receive_investor",
        ].join(","),
      )
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfileCaps({
          isAdmin: Boolean((data as any)?.is_admin),
          canCreateLab: Boolean((data as any)?.can_create_lab),
          canManageMultipleLabs: Boolean((data as any)?.can_manage_multiple_labs),
          canManageTeams: Boolean((data as any)?.can_manage_teams),
          canManageMultipleTeams: Boolean((data as any)?.can_manage_multiple_teams),
          canPostNews: Boolean((data as any)?.can_post_news),
          canBrokerRequests: Boolean((data as any)?.can_broker_requests),
          canReceiveInvestor: Boolean((data as any)?.can_receive_investor),
        });
      })
      .catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!hasFunctionalConsent) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.form) {
        setForm(prev => ({ ...prev, ...parsed.form }));
      }
      if (Array.isArray(parsed?.photos)) setPhotos(parsed.photos);
      if (Array.isArray(parsed?.partnerLogos)) setPartnerLogos(parsed.partnerLogos);
      if (Array.isArray(parsed?.complianceDocs)) setComplianceDocs(parsed.complianceDocs);
      if (typeof parsed?.activeTab === "string" && (tabOrder as readonly string[]).includes(parsed.activeTab)) {
        setActiveTab(parsed.activeTab as (typeof TAB_ORDER)[number]);
      }
    } catch {
      // Ignore invalid drafts.
    }
  }, [draftKey, tabOrder, hasFunctionalConsent]);

  useEffect(() => {
    if (!hasFunctionalConsent) return;
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
  }, [draftKey, form, photos, partnerLogos, complianceDocs, activeTab, hasFunctionalConsent]);

  const handleChange = (field: keyof typeof form, value: string | boolean | OfferOption[] | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const addTeamMember = () => {
    const name = teamMemberInput.name.trim();
    const title = teamMemberInput.title.trim();
    if (!name || !title) return;
    const linkedin = teamMemberInput.linkedin.trim();
    const website = teamMemberInput.website.trim();
    const teamName = teamMemberInput.teamName.trim();
    const roleRankValue = teamMemberInput.roleRank.trim();
    const parsedRank = roleRankValue ? Number(roleRankValue) : null;
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
          roleRank: parsedRank && Number.isFinite(parsedRank) && parsedRank > 0 ? parsedRank : null,
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

  const addTag = (field: "equipmentTags" | "focusTags" | "complianceTags", raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setForm(prev => {
      const next = new Set(prev[field]);
      next.add(value);
      return { ...prev, [field]: Array.from(next) };
    });
    setTagInput({ field, value: "" });
  };

  const removeTag = (field: "equipmentTags" | "focusTags" | "complianceTags", value: string) => {
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

  const handleTagKey = (field: "equipmentTags" | "focusTags" | "complianceTags") => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(field, tagInput.value);
    }
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

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await addLab({
        name: form.name.trim(),
        labManager: form.labManager.trim(),
        contactEmail: form.contactEmail.trim(),
        ownerUserId: user?.id ?? null,
        descriptionShort: form.descriptionShort.trim() || null,
        descriptionLong: form.descriptionLong.trim() || null,
        offersLabSpace: form.offersLabSpace,
        addressLine1: form.addressLine1.trim() || null,
        addressLine2: form.addressLine2.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        postalCode: form.postalCode.trim() || null,
        country: form.country.trim() || null,
        website: form.website.trim() || null,
        linkedin: form.linkedin.trim() || null,
        compliance: form.complianceTags,
        complianceDocs,
        labStatus: "confirmed",
        isVisible: true,
        equipment: form.equipmentTags,
        priorityEquipment: form.priorityEquipmentTags
          .filter(item => form.equipmentTags.includes(item))
          .slice(0, 3),
        techniques: form.techniques,
        focusAreas: form.focusTags,
        offers: form.offers,
        photos,
        logoUrl: form.logoUrl.trim() || null,
        siretNumber: form.siretNumber.trim() || null,
        partnerLogos,
        field: form.field.trim() || null,
        orgRole: form.orgRole || null,
        halStructureId: form.halStructureId.trim() || null,
        halPersonId: form.halPersonId.trim() || null,
        teamMembers: form.teamMembers,
      });
      if (hasFunctionalConsent) {
        localStorage.removeItem(draftKey);
      }
      setLocation(`/lab/manage/${created.id}`);
    } catch (err: any) {
      setError(err?.message || "Unable to create lab");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 lg:py-24 max-w-3xl">
        <Link href="/account?tab=manageLab" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4 rounded-full border border-border px-3 py-1">
          ← Back to manage labs
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Create</p>
          <h1 className="text-3xl font-semibold text-foreground mt-1">Add a new lab</h1>
          <p className="mt-2 text-sm text-muted-foreground">Start with the basics. You can add photos, equipment, and pricing later.</p>

          <form
            className="mt-8 space-y-8"
            onSubmit={event => event.preventDefault()}
            onKeyDown={event => {
              if (event.defaultPrevented || event.key !== "Enter") return;
              const target = event.target as HTMLElement;
              if (target instanceof HTMLTextAreaElement) return;
              if (target instanceof HTMLButtonElement) return;
              event.preventDefault();
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {tabOrder.map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                      activeTab === tab
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "Basics" && (
              <Section title="Basics">
                <Field label="Lab name" required>
                  <input
                    className="w-full rounded-xl border-2 border-primary/30 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={form.name}
                    onChange={e => handleChange("name", e.target.value)}
                    required
                  />
                </Field>
                <Field label="SIRET (optional)">
                  <input
                    className="w-full rounded-xl border-2 border-primary/30 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={form.siretNumber}
                    onChange={e => handleChange("siretNumber", e.target.value)}
                  />
                </Field>
                <Field label="Lab manager" required>
                  <input
                    className="w-full rounded-xl border-2 border-primary/30 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={form.labManager}
                    onChange={e => handleChange("labManager", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Contact email" required>
                  <input
                    type="email"
                    className="w-full rounded-xl border-2 border-primary/30 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={form.contactEmail}
                    onChange={e => handleChange("contactEmail", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Short description">
                  <textarea
                    className="w-full rounded-xl border-2 border-primary/30 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[96px]"
                    value={form.descriptionShort}
                    onChange={e => handleChange("descriptionShort", e.target.value)}
                    placeholder="One or two sentences that appear under your lab name."
                  />
                </Field>
                <Field label="Long description (optional)">
                  <textarea
                    className="w-full rounded-xl border-2 border-primary/30 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[140px]"
                    value={form.descriptionLong}
                    onChange={e => handleChange("descriptionLong", e.target.value)}
                    placeholder="A longer overview for partners who want more detail."
                  />
                </Field>
                <Field label="Science field (optional)">
                  <input
                    className="w-full rounded-xl border-2 border-primary/30 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={form.field}
                    onChange={e => handleChange("field", e.target.value)}
                    placeholder="e.g., immunology, materials science, bioengineering"
                  />
                </Field>
                <Field label="Organization role (optional)">
                  <select
                    className="w-full rounded-xl border-2 border-primary/30 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={form.orgRole}
                    onChange={e => handleChange("orgRole", e.target.value as "" | OrgRoleOption)}
                  >
                    <option value="">Select role type</option>
                    {orgRoleOptions.map(role => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="HAL structure ID (optional)">
                  <input
                    className="w-full rounded-xl border-2 border-primary/30 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={form.halStructureId}
                    onChange={e => handleChange("halStructureId", e.target.value)}
                    placeholder="e.g., struct-123456"
                  />
                </Field>
                <Field label="HAL person ID (optional)">
                  <input
                    className="w-full rounded-xl border-2 border-primary/30 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={form.halPersonId}
                    onChange={e => handleChange("halPersonId", e.target.value)}
                    placeholder="e.g., 123456"
                  />
                </Field>
                <label className="inline-flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="rounded border-border text-primary"
                    checked={form.offersLabSpace}
                    onChange={e => handleChange("offersLabSpace", e.target.checked)}
                  />
                  Offers lab space
                </label>
              </Section>
            )}

            {activeTab === "Photos" && (
              <Section title="Photos">
                {canUseLogo && (
                  <div className="space-y-2">
                    <Field label="Logo">
                      <input
                        className="input"
                        value={form.logoUrl}
                        onChange={e => handleChange("logoUrl", e.target.value)}
                      />
                    </Field>
                    <label className="inline-flex items-center gap-3">
                      <span className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cursor-pointer transition hover:bg-primary/90">
                        Choose file
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setLogoError(null);
                            setLogoUploading(true);
                            await uploadToBucket(
                              "lab-logos",
                              file,
                              "new/logos",
                              (url, name) => setForm(prev => ({ ...prev, logoUrl: url || prev.logoUrl || "", })),
                              msg => setLogoError(msg),
                            );
                            setLogoUploading(false);
                            if (e.target) e.target.value = "";
                          }}
                        />
                      </span>
                      {logoUploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
                      {logoError && <p className="text-xs text-destructive">{logoError}</p>}
                    </label>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Photos</p>
                  <div className="flex flex-wrap gap-2">
                    {photos.map(asset => (
                      <div key={asset.url} className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                        <span className="text-xs text-foreground break-all max-w-[200px] truncate">{asset.name || asset.url}</span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => setPhotos(prev => prev.filter(p => p.url !== asset.url))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      value={photoUrlInput}
                      onChange={e => setPhotoUrlInput(e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                    />
                    <button
                      type="button"
                      className="inline-flex items-center rounded-full border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary"
                      onClick={() => {
                        const url = photoUrlInput.trim();
                        if (!url || photos.length >= maxPhotos) return;
                        const name = url.split("/").pop() || `Photo ${photos.length + 1}`;
                        setPhotos(prev => [...prev, { name, url }]);
                        setPhotoUrlInput("");
                      }}
                      disabled={photos.length >= maxPhotos}
                    >
                      Add photo
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-3">
                      <span className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cursor-pointer transition hover:bg-primary/90">
                        Choose file
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={photos.length >= maxPhotos}
                          onChange={async e => {
                            const file = e.target.files?.[0];
                            if (!file || photos.length >= maxPhotos) return;
                            setPhotoError(null);
                            setPhotoUploading(true);
                            await uploadToBucket(
                              "lab-photos",
                              file,
                              "new/photos",
                              (url, name) => setPhotos(prev => [...prev, { name, url }]),
                              msg => setPhotoError(msg),
                            );
                            setPhotoUploading(false);
                            if (e.target) e.target.value = "";
                          }}
                        />
                      </span>
                    </label>
                    {photoUploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
                    {photoError && <p className="text-xs text-destructive">{photoError}</p>}
                  </div>
                </div>

                {canUsePartnerLogos && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Partner logos</p>
                    <div className="flex flex-wrap gap-2">
                      {partnerLogos.map(asset => (
                        <div key={asset.url} className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                          <span className="text-xs text-foreground break-all max-w-[200px] truncate">{asset.name || asset.url}</span>
                          <input
                            className="w-48 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            placeholder="Partner website"
                            value={asset.website ?? ""}
                            onChange={e =>
                              setPartnerLogos(prev =>
                                prev.map(item =>
                                  item.url === asset.url ? { ...item, website: e.target.value } : item,
                                ),
                              )
                            }
                          />
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => setPartnerLogos(prev => prev.filter(p => p.url !== asset.url))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="input flex-1"
                        value={partnerUrlInput}
                        onChange={e => setPartnerUrlInput(e.target.value)}
                        placeholder="https://example.com/logo.png"
                      />
                      <button
                        type="button"
                        className="inline-flex items-center rounded-full border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary"
                        onClick={() => {
                          const url = partnerUrlInput.trim();
                          if (!url) return;
                          const name = url.split("/").pop() || `Logo ${partnerLogos.length + 1}`;
                          setPartnerLogos(prev => [...prev, { name, url, website: null }]);
                          setPartnerUrlInput("");
                        }}
                      >
                        Add logo
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-3">
                        <span className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cursor-pointer transition hover:bg-primary/90">
                          Choose file
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setPartnerError(null);
                              setPartnerUploading(true);
                              await uploadToBucket(
                                "lab-logos",
                                file,
                                "new/partners",
                                (url, name) => setPartnerLogos(prev => [...prev, { name, url, website: null }]),
                                msg => setPartnerError(msg),
                              );
                              setPartnerUploading(false);
                              if (e.target) e.target.value = "";
                            }}
                          />
                        </span>
                      </label>
                      {partnerUploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
                      {partnerError && <p className="text-xs text-destructive">{partnerError}</p>}
                    </div>
                  </div>
                )}
              </Section>
            )}

            {activeTab === "Company details" && (
              <Section title="Company details">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Address line 1">
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      value={form.addressLine1}
                      onChange={e => handleChange("addressLine1", e.target.value)}
                    />
                  </Field>
                  <Field label="Address line 2">
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      value={form.addressLine2}
                      onChange={e => handleChange("addressLine2", e.target.value)}
                    />
                  </Field>
                  <Field label="City">
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      value={form.city}
                      onChange={e => handleChange("city", e.target.value)}
                    />
                  </Field>
                  <Field label="State/Region">
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      value={form.state}
                      onChange={e => handleChange("state", e.target.value)}
                    />
                  </Field>
                  <Field label="Postal code">
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      value={form.postalCode}
                      onChange={e => handleChange("postalCode", e.target.value)}
                    />
                  </Field>
                  <Field label="Country">
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      value={form.country}
                      onChange={e => handleChange("country", e.target.value)}
                    />
                  </Field>
                </div>

              </Section>
            )}

            {activeTab === "Team" && (
              <Section title="Team members">
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Full name"
                      value={teamMemberInput.name}
                      onChange={e => setTeamMemberInput(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Title"
                      value={teamMemberInput.title}
                      onChange={e => setTeamMemberInput(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Team / group (optional)"
                      value={teamMemberInput.teamName}
                      onChange={e => setTeamMemberInput(prev => ({ ...prev, teamName: e.target.value }))}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                              {ROLE_RANK_HELP.map(item => (
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
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="LinkedIn (optional)"
                      value={teamMemberInput.linkedin}
                      onChange={e => setTeamMemberInput(prev => ({ ...prev, linkedin: e.target.value }))}
                    />
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Website (optional)"
                      value={teamMemberInput.website}
                      onChange={e => setTeamMemberInput(prev => ({ ...prev, website: e.target.value }))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addTeamMember}
                    className="inline-flex items-center rounded-full border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:border-primary"
                  >
                    Save team member
                  </button>
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
                </div>
              </Section>
            )}

            {activeTab === "Branding & Links" && (
              <Section title="Branding & Links">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Website">
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      value={form.website}
                      onChange={e => handleChange("website", e.target.value)}
                    />
                  </Field>
                  <Field label="LinkedIn">
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      value={form.linkedin}
                      onChange={e => handleChange("linkedin", e.target.value)}
                    />
                  </Field>
                </div>
              </Section>
            )}

            {activeTab === "Compliance" && (
              <Section title="Compliance">
                <Field label="Equipment">
                  <div className="space-y-2">
                    <input
                      className="w-full rounded-xl border-2 border-primary/30 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Add equipment and press Enter"
                      value={tagInput.field === "equipmentTags" ? tagInput.value : ""}
                      onChange={e => setTagInput({ field: "equipmentTags", value: e.target.value })}
                      onKeyDown={handleTagKey("equipmentTags")}
                    />
                    <div className="flex flex-wrap gap-2">
                      {form.equipmentTags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag("equipmentTags", tag)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground">Select up to three priority items.</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {form.equipmentTags.map(tag => {
                          const isPriority = form.priorityEquipmentTags.includes(tag);
                          return (
                            <button
                              key={`priority-${tag}`}
                              type="button"
                              onClick={() => togglePriorityEquipment(tag)}
                              className={`rounded-full border px-3 py-1 text-xs ${
                                isPriority
                                  ? "border-primary bg-primary/10 font-semibold text-primary"
                                  : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                        {form.equipmentTags.length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            Add equipment to enable prioritization.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Field>
                <Field label="Techniques">
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
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        placeholder="Technique name"
                        value={techniqueInput.name}
                        onChange={e => setTechniqueInput(prev => ({ ...prev, name: e.target.value }))}
                      />
                      <input
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                <Field label="Focus areas">
                  <div className="space-y-2">
                    <input
                      className="w-full rounded-xl border-2 border-primary/30 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Add focus area and press Enter"
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
                <Field label="Compliance">
                  <div className="space-y-2">
                    <input
                      className="w-full rounded-xl border-2 border-primary/30 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Add compliance and press Enter"
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

                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Compliance documents (PDF)</p>
                  <div className="flex flex-wrap gap-2">
                    {complianceDocs.map(asset => (
                      <div key={asset.url} className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                        <span className="text-xs text-foreground break-all max-w-[200px] truncate">{asset.name || asset.url}</span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => setComplianceDocs(prev => prev.filter(doc => doc.url !== asset.url))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <label className="inline-flex items-center gap-3">
                    <span className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cursor-pointer transition hover:bg-primary/90">
                      Choose file
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setComplianceError(null);
                          setComplianceUploading(true);
                          await uploadToBucket(
                            "lab-pdfs",
                            file,
                            "new/compliance",
                            (url, name) => setComplianceDocs(prev => [...prev, { name, url }]),
                            msg => setComplianceError(msg),
                          );
                          setComplianceUploading(false);
                          if (e.target) e.target.value = "";
                        }}
                      />
                    </span>
                  </label>
                  {complianceUploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
                  {complianceError && <p className="text-xs text-destructive">{complianceError}</p>}
                  <p className="text-xs text-muted-foreground">Upload PDF compliance certificates; you can add more later.</p>
                </div>

              </Section>
            )}

            {activeTab === "Offers" && (
              <Section title="Offers">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Offers</p>
                  <div className="flex flex-wrap gap-2">
                    {offerOptions.map(opt => (
                      <label key={opt} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm text-foreground">
                        <input
                          type="checkbox"
                          className="rounded border-border text-primary"
                          checked={form.offers.includes(opt)}
                          onChange={e => {
                            const next = e.target.checked
                              ? [...form.offers, opt]
                              : form.offers.filter(item => item !== opt);
                            handleChange("offers", next);
                          }}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              </Section>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
              <button
                type="button"
                onClick={() => setActiveTab(tabOrder[Math.max(0, currentTabIndex - 1)])}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
                disabled={isFirstTab}
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                {!isLastTab && (
                  <button
                    type="button"
                    onClick={() => setActiveTab(tabOrder[Math.min(tabOrder.length - 1, currentTabIndex + 1)])}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    Next
                  </button>
                )}
                {isLastTab && (
                  <button
                    type="button"
                    onClick={() => setShowConfirm(true)}
                    disabled={saving}
                    className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                  >
                    {saving ? "Creating…" : "Create lab"}
                  </button>
                )}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </motion.div>
      </div>
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">Create this lab?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We&apos;ll publish this lab profile using the details you entered. You can update it anytime in Manage labs.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  void handleSubmit();
                }}
                disabled={saving}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? "Creating…" : "Yes, create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-foreground">
      {label} {required ? <span className="text-destructive">*</span> : null}
      <div className="text-foreground font-normal">{children}</div>
    </label>
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
  const randomName = (original: string) => {
    const ext = original.split(".").pop() || "jpg";
    if (typeof crypto !== "undefined" && crypto.randomUUID) return `${crypto.randomUUID()}.${ext}`;
    return `${Date.now()}.${ext}`;
  };

  const uploadToBucket = async (
    bucket: string,
    file: File,
    prefix: string,
    onSuccess: (url: string, name: string) => void,
    onError: (msg: string) => void,
  ) => {
    try {
      const filename = `${prefix}/${randomName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(filename, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
      onSuccess(data.publicUrl, file.name);
    } catch (err: any) {
      onError(err?.message || "Upload failed");
    }
  };
