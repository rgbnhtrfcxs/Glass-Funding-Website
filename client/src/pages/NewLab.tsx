import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useLabs } from "@/context/LabsContext";
import { useAuth } from "@/context/AuthContext";
import { offerOptions, type OfferOption } from "@shared/labs";
import type { MediaAsset } from "@shared/labs";
import { supabase } from "@/lib/supabaseClient";
import { Link } from "wouter";

export default function NewLab() {
  const { addLab } = useLabs();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({
    name: "",
    labManager: "",
    contactEmail: user?.email ?? "",
    descriptionShort: "",
    descriptionLong: "",
    field: "",
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
    minimumStay: "",
    pricePrivacy: false,
    equipmentTags: [] as string[],
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
  const [partnerLogos, setPartnerLogos] = useState<MediaAsset[]>([]);
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
  const [activeTab, setActiveTab] = useState<
    "Basics" | "Photos" | "Company details" | "Branding & Links" | "Compliance" | "Offers & pricing" | "Team"
  >("Basics");
  const [profileTier, setProfileTier] = useState<string>("base");

  const canUseLogo = profileTier === "premier" || profileTier === "custom" || profileTier === "verified";
  const canUsePartnerLogos = profileTier === "premier" || profileTier === "custom";
  const maxPhotos = profileTier === "base" ? 2 : Number.POSITIVE_INFINITY;

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const tier = (data?.subscription_tier || "base").toLowerCase();
        setProfileTier(tier);
      })
      .catch(() => {});
  }, [user?.id]);

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
    setForm(prev => ({ ...prev, [field]: prev[field].filter(item => item !== value) }));
  };

  const handleTagKey = (field: "equipmentTags" | "focusTags" | "complianceTags") => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(field, tagInput.value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        isVerified: false,
        isVisible: true,
        equipment: form.equipmentTags,
        focusAreas: form.focusTags,
        offers: form.offers,
        pricePrivacy: form.pricePrivacy,
        minimumStay: form.minimumStay.trim(),
        rating: 0,
        photos,
        logoUrl: form.logoUrl.trim() || null,
        siretNumber: form.siretNumber.trim() || null,
        partnerLogos,
        field: form.field.trim() || null,
        halStructureId: form.halStructureId.trim() || null,
        halPersonId: form.halPersonId.trim() || null,
        teamMembers: form.teamMembers,
      });
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
        <Link href="/lab/manage" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4">
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

          <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(["Basics", "Photos", "Company details", "Branding & Links", "Compliance", "Team", "Offers & pricing"] as const).map(tab => (
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
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create lab"}
              </button>
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
                          setPartnerLogos(prev => [...prev, { name, url }]);
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
                                (url, name) => setPartnerLogos(prev => [...prev, { name, url }]),
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
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="Role rank (1-8)"
                      value={teamMemberInput.roleRank}
                      onChange={e => setTeamMemberInput(prev => ({ ...prev, roleRank: e.target.value }))}
                    />
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
                    Add team member
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

            {activeTab === "Offers & pricing" && (
              <Section title="Offers & pricing">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Minimum stay">
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      value={form.minimumStay}
                      onChange={e => handleChange("minimumStay", e.target.value)}
                    />
                  </Field>
                  <label className="grid gap-1 text-sm font-medium text-foreground">
                    Price privacy
                    <select
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      value={form.pricePrivacy ? "yes" : "no"}
                      onChange={e => handleChange("pricePrivacy", e.target.value === "yes")}
                    >
                      <option value="no">Rates published</option>
                      <option value="yes">Quotes required</option>
                    </select>
                  </label>
                </div>

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

            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </motion.div>
      </div>
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
