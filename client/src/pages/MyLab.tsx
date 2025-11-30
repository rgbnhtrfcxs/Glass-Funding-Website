import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { offerOptions, type OfferOption } from "@shared/labs";

type Form = {
  name: string;
  location: string;
  labManager: string;
  contactEmail: string;
  logoUrl: string;
  siretNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  website: string;
  linkedin: string;
  compliance: string;
  equipment: string;
  focusAreas: string;
  offers: OfferOption[];
  minimumStay: string;
  pricePrivacy: boolean;
};

export default function MyLab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [labId, setLabId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>({
    name: "",
    location: "",
    labManager: "",
    contactEmail: "",
    logoUrl: "",
    siretNumber: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    website: "",
    linkedin: "",
    compliance: "",
    equipment: "",
    focusAreas: "",
    offers: [],
    minimumStay: "",
    pricePrivacy: false,
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      setMessage(null);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const res = await fetch("/api/my-lab", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.status === 404) {
          setError("No lab is linked to your account yet. Ask an admin to connect your lab using your contact email.");
          setLoading(false);
          return;
        }
        const ct = res.headers.get("content-type") || "";
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Request failed (${res.status})`);
        }
        if (!ct.includes("application/json")) {
          throw new Error("Backend not running: /api returned HTML. Start the server with npm run dev.");
        }
        const lab = await res.json();
        setLabId(lab.id);
        setForm({
          name: lab.name || "",
          location: lab.location || "",
          labManager: lab.labManager || "",
          contactEmail: lab.contactEmail || user?.email || "",
          logoUrl: lab.logoUrl || "",
          siretNumber: lab.siretNumber || "",
          addressLine1: lab.addressLine1 || "",
          addressLine2: lab.addressLine2 || "",
          city: lab.city || "",
          state: lab.state || "",
          postalCode: lab.postalCode || "",
          country: lab.country || "",
          website: lab.website || "",
          linkedin: lab.linkedin || "",
          compliance: (lab.compliance || []).join(", "),
          equipment: (lab.equipment || []).join(", "),
          focusAreas: (lab.focusAreas || []).join(", "),
          offers: lab.offers || [],
          minimumStay: lab.minimumStay || "",
          pricePrivacy: !!lab.pricePrivacy,
        });
      } catch (err: any) {
        setError(err.message || "Unable to load your lab");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  function parseList(value: string) {
    return value
      .split(",")
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

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch("/api/my-lab", {
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
          addressLine1: form.addressLine1 || null,
          addressLine2: form.addressLine2 || null,
          city: form.city || null,
          state: form.state || null,
          postalCode: form.postalCode || null,
          country: form.country || null,
          website: form.website || null,
          linkedin: form.linkedin || null,
          compliance: parseList(form.compliance),
          equipment: parseList(form.equipment),
          focusAreas: parseList(form.focusAreas),
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
        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="mt-6 text-sm text-destructive">{error}</p>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-8 grid gap-4"
            onSubmit={e => { e.preventDefault(); void save(); }}
          >
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
              <input className="input" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} />
            </Field>
            <Field label="Logo (stored in Supabase)">
              <div className="flex items-center gap-3">
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="input" />
                {form.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, logoUrl: "" })}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
                  >
                    Remove
                  </button>
                )}
              </div>
              {logoUploading && <p className="text-xs text-muted-foreground">Uploading logo…</p>}
              {logoError && <p className="text-xs text-destructive">{logoError}</p>}
              {form.logoUrl && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                  <img src={form.logoUrl} alt={`${form.name || "Lab"} logo`} className="h-10 w-10 rounded-full object-cover" />
                  <span className="text-xs text-muted-foreground break-all max-w-[200px] truncate">{form.logoUrl}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Uploads go to the `lab-logos` bucket.</p>
            </Field>
            <Field label="Address line 1 (internal)">
              <input className="input" value={form.addressLine1} onChange={e => setForm({ ...form, addressLine1: e.target.value })} />
            </Field>
            <Field label="Address line 2 (internal)">
              <input className="input" value={form.addressLine2} onChange={e => setForm({ ...form, addressLine2: e.target.value })} />
            </Field>
            <Field label="SIRET (internal)">
              <input className="input" value={form.siretNumber} onChange={e => setForm({ ...form, siretNumber: e.target.value })} />
              <p className="text-xs text-muted-foreground">Internal only; not shown publicly.</p>
            </Field>
            <Field label="City (internal)">
              <input className="input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="State/Region (internal)">
              <input className="input" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} />
            </Field>
            <Field label="Postal code (internal)">
              <input className="input" value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} />
            </Field>
            <Field label="Country (internal)">
              <input className="input" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
            </Field>
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
            <Field label="Compliance (comma separated)">
              <input className="input" value={form.compliance} onChange={e => setForm({ ...form, compliance: e.target.value })} />
            </Field>
            <Field label="Equipment (comma separated)">
              <input className="input" value={form.equipment} onChange={e => setForm({ ...form, equipment: e.target.value })} />
            </Field>
            <Field label="Focus areas (comma separated)">
              <input className="input" value={form.focusAreas} onChange={e => setForm({ ...form, focusAreas: e.target.value })} />
            </Field>
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
            {message && <p className="text-sm text-emerald-600">{message}</p>}
            {saving ? (
              <button className="rounded-full bg-primary px-4 py-2 text-primary-foreground" disabled>Saving…</button>
            ) : (
              <button className="rounded-full bg-primary px-4 py-2 text-primary-foreground" type="submit">Save</button>
            )}
          </motion.form>
        )}
      </div>
      <style>{`.input{width:100%;border:1px solid var(--border);background:var(--background);padding:.5rem .75rem;border-radius:12px;}`}</style>
    </section>
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
