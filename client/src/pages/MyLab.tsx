import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { offerOptions, type OfferOption, type MediaAsset } from "@shared/labs";
import { Link } from "wouter";

type Form = {
  name: string;
  location: string;
  labManager: string;
  contactEmail: string;
  logoUrl: string;
  siretNumber: string;
  offersLabSpace: boolean;
  description: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  website: string;
  linkedin: string;
  partnerLogos: { name: string; url: string }[];
  complianceTags: string[];
  equipmentTags: string[];
  focusTags: string[];
  offers: OfferOption[];
  minimumStay: string;
  pricePrivacy: boolean;
};

export default function MyLab({ params }: { params: { id: string } }) {
  const labIdParam = Number(params?.id);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string>("base");
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
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [form, setForm] = useState<Form>({
    name: "",
    location: "",
    labManager: "",
    contactEmail: "",
    logoUrl: "",
    siretNumber: "",
    offersLabSpace: false,
    description: "",
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
    equipmentTags: [],
    focusTags: [],
    offers: [],
    minimumStay: "",
    pricePrivacy: false,
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [partnerLogos, setPartnerLogos] = useState<{ name: string; url: string }[]>([]);
  const [tagInput, setTagInput] = useState<{ field: "complianceTags" | "equipmentTags" | "focusTags"; value: string }>({
    field: "complianceTags",
    value: "",
  });
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

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
      setPartnerLogos(prev => [...prev, { name: file.name, url: publicUrl }]);
      setForm(prev => ({ ...prev, partnerLogos: [...prev.partnerLogos, { name: file.name, url: publicUrl }] }));
      setMessage("Partner logo uploaded");
    } catch (err: any) {
      setMessage(err?.message || "Unable to upload partner logo");
    }
  }

  const removePartnerLogo = (url: string) => {
    setPartnerLogos(prev => prev.filter(item => item.url !== url));
    setForm(prev => ({ ...prev, partnerLogos: prev.partnerLogos.filter(item => item.url !== url) }));
  };

  const addPhotoFromUrl = () => {
    const url = photoUrlInput.trim();
    if (!url) return;
    setPhotos(prev => [...prev, { name: url.split("/").pop() ?? `Photo ${prev.length + 1}`, url }]);
    setPhotoUrlInput("");
  };

  const removePhoto = (asset: MediaAsset) => {
    setPhotos(prev => prev.filter(item => item.url !== asset.url));
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

  const addTag = (field: "complianceTags" | "equipmentTags" | "focusTags", raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setForm(prev => {
      if (prev[field].includes(value)) return prev;
      return { ...prev, [field]: [...prev[field], value] };
    });
  };

  const removeTag = (field: "complianceTags" | "equipmentTags" | "focusTags", value: string) => {
    setForm(prev => ({ ...prev, [field]: prev[field].filter(item => item !== value) }));
  };

  const handleTagKey = (field: "complianceTags" | "equipmentTags" | "focusTags") => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(field, tagInput.value || (e.target as HTMLInputElement).value);
      setTagInput({ field, value: "" });
    }
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
      setSubscriptionTier((lab.subscriptionTier || "base").toLowerCase());
      setIsVisible(lab.isVisible !== false);
      setForm({
        name: lab.name || "",
        location: lab.location || "",
        labManager: lab.labManager || "",
        contactEmail: lab.contactEmail || user?.email || "",
        logoUrl: lab.logoUrl || "",
        siretNumber: lab.siretNumber || "",
        offersLabSpace: lab.offersLabSpace ?? true,
        description: lab.description || "",
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
        equipmentTags: lab.equipment || [],
        focusTags: lab.focusAreas || [],
        offers: lab.offers || [],
        minimumStay: lab.minimumStay || "",
        pricePrivacy: !!lab.pricePrivacy,
      });
      setPartnerLogos(lab.partnerLogos || []);
      setPhotos(lab.photos || []);
      setAnalytics(null);
      setAnalyticsError(null);

      const labTier = (lab.subscriptionTier || "").toLowerCase?.() ?? "base";
      if (labTier === "premier" || labTier === "custom") {
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
      }
    } catch (err: any) {
      setError(err.message || "Unable to load your lab");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!labId) throw new Error("Select a lab first");
      const res = await fetch(`/api/my-lab/${labId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: form.name,
          location: form.location,
          labManager: form.labManager,
          contactEmail: form.contactEmail,
          logoUrl: form.logoUrl || null,
          siretNumber: form.siretNumber || null,
          offersLabSpace: form.offersLabSpace,
          description: form.description || null,
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
          equipment: form.equipmentTags,
          focusAreas: form.focusTags,
          offers: form.offers,
          minimumStay: form.minimumStay,
          pricePrivacy: form.pricePrivacy,
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
      setMessage("Saved");
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 lg:py-24 max-w-3xl">
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
            <Link href="/lab/manage">
              <a className="ml-2 underline text-primary">Back to lab selection</a>
            </Link>
          </p>
        )}
        {analytics && (
          <div className="mt-4 rounded-2xl border border-border bg-card/70 p-4 text-sm">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Premier / Custom analytics</p>
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
            className="mt-8 space-y-8"
            onSubmit={e => { e.preventDefault(); void save(); }}
          >
            <Section title="Basics">
              <Field label="Lab name">
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Location">
                <input className="input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              </Field>
              <Field label="Lab manager">
                <input className="input" value={form.labManager} onChange={e => setForm({ ...form, labManager: e.target.value })} />
              </Field>
            <Field label="Contact email">
              <div className="flex items-center gap-2">
                <input className="input" value={form.contactEmail} disabled />
                <span className="text-muted-foreground" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11v-2a4 4 0 0 1 8 0v2" />
                  </svg>
                </span>
              </div>
            </Field>
              <Field label="Lab description">
                <textarea
                  className="input"
                  rows={4}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Short intro to your lab (shown on Lab Details)"
                />
              </Field>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.offersLabSpace}
                  onChange={e => setForm({ ...form, offersLabSpace: e.target.checked })}
                />
                Offers lab space (enables pricing/offers on your page)
              </label>
            </Section>

            <Section title="Branding & Links">
              {(subscriptionTier === "premier" || subscriptionTier === "custom") && (
                <Field label="Logo">
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-3">
                      <span className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cursor-pointer transition hover:bg-primary/90">
                        Choose file
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </span>
                      {form.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, logoUrl: "" })}
                          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
                        >
                          Remove
                        </button>
                      )}
                    </label>
                    {logoUploading && <p className="text-xs text-muted-foreground">Uploading logo…</p>}
                    {logoError && <p className="text-xs text-destructive">{logoError}</p>}
                    {form.logoUrl && (
                      <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                        <img src={form.logoUrl} alt={`${form.name || "Lab"} logo`} className="h-10 w-10 rounded-full object-cover" />
                        <span className="text-xs text-muted-foreground break-all max-w-[200px] truncate">{form.logoUrl}</span>
                      </div>
                    )}
                  </div>
                </Field>
              )}

              {subscriptionTier === "premier" || subscriptionTier === "custom" ? (
                <Field label="Partner logos (premier/custom feature)">
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-3">
                      <span className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cursor-pointer transition hover:bg-primary/90">
                        Choose file
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePartnerLogoUpload}
                          className="hidden"
                        />
                      </span>
                    </label>
                    {partnerLogos.length > 0 && (
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {partnerLogos.map(logo => (
                          <div key={logo.url} className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 flex-shrink-0">
                            <img src={logo.url} alt={logo.name} className="h-10 w-10 rounded object-cover" />
                            <button
                              type="button"
                              onClick={() => removePartnerLogo(logo.url)}
                              className="text-xs text-muted-foreground hover:text-destructive"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Stored in `lab-logos` under partners/ folders. Shown for premier/custom labs.</p>
                  </div>
                </Field>
              ) : (
                <p className="text-xs text-muted-foreground">Partner logos are available on the premier or custom plan.</p>
              )}

              <Field label="Website (optional)">
                <input
                  className="input"
                  value={form.website}
                  onChange={e => setForm({ ...form, website: e.target.value })}
                  placeholder="https://labs.example.com"
                />
              </Field>
              <Field label="LinkedIn (optional)">
                <input
                  className="input"
                  value={form.linkedin}
                  onChange={e => setForm({ ...form, linkedin: e.target.value })}
                  placeholder="https://www.linkedin.com/company/example"
                />
              </Field>
            </Section>

            <Section title="Company details">
              <Field label="Address line 1">
                <input className="input" value={form.addressLine1} onChange={e => setForm({ ...form, addressLine1: e.target.value })} />
              </Field>
              <Field label="Address line 2">
                <input className="input" value={form.addressLine2} onChange={e => setForm({ ...form, addressLine2: e.target.value })} />
              </Field>
              <Field label="SIRET">
                <input className="input" value={form.siretNumber} onChange={e => setForm({ ...form, siretNumber: e.target.value })} />
              </Field>
              <Field label="City">
                <input className="input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </Field>
              <Field label="State/Region">
                <input className="input" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
              </Field>
              <Field label="Postal code">
                <input className="input" value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} />
              </Field>
              <Field label="Country">
                <input className="input" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
              </Field>
            </Section>

            <Section title="Compliance & capabilities">
              <Field label="Compliance">
                <div className="space-y-2">
                  <input
                    className="input"
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
              <Field label="Equipment">
                <div className="space-y-2">
                  <input
                    className="input"
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
                    className="input"
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
            </Section>

            <Section title="Photos">
              <Field label="Add photo">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex items-center gap-3">
                      <span className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cursor-pointer transition hover:bg-primary/90">
                        Upload file
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                      </span>
                    </label>
                    <div className="flex flex-1 gap-2">
                      <input
                        className="input flex-1"
                        value={photoUrlInput}
                        onChange={e => setPhotoUrlInput(e.target.value)}
                        placeholder="https://images.example.com/photo.jpg"
                      />
                      <button
                        type="button"
                        onClick={addPhotoFromUrl}
                        className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  {photoUploading && <p className="text-xs text-muted-foreground">Uploading photo…</p>}
                  {photoError && <p className="text-xs text-destructive">{photoError}</p>}
                </div>
              </Field>
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {photos.map(photo => (
                    <div
                      key={photo.url}
                      className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2"
                    >
                      <img src={photo.url} alt={photo.name} className="h-14 w-20 rounded object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(photo)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Offers & pricing">
              <Field label="Offers">
                <div className="flex flex-wrap gap-3">
                  {offerOptions.map(option => (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.offers.includes(option)}
                        onChange={e => {
                          setForm(prev => {
                            const nextOffers = e.target.checked
                              ? [...prev.offers, option]
                              : prev.offers.filter(item => item !== option);
                            return { ...prev, offers: nextOffers };
                          });
                        }}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Minimum stay">
                <input className="input" value={form.minimumStay} onChange={e => setForm({ ...form, minimumStay: e.target.value })} />
              </Field>
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input type="checkbox" checked={form.pricePrivacy} onChange={e => setForm({ ...form, pricePrivacy: e.target.checked })} />
                Pricing shared privately
              </label>
            </Section>

            {message && <p className="text-sm text-emerald-600">{message}</p>}
            <div className="flex gap-3">
              {saving ? (
                <button className="rounded-full bg-primary px-4 py-2 text-primary-foreground" disabled>Saving…</button>
              ) : (
                <button className="rounded-full bg-primary px-4 py-2 text-primary-foreground" type="submit">Save</button>
              )}
            </div>
          </motion.form>
        )}
      </div>
      <style>{`.input{width:100%;border:1px solid var(--border);background:var(--background);padding:.5rem .75rem;border-radius:12px;}`}</style>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
