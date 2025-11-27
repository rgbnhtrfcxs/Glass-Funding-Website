import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import type { OfferOption } from "@shared/labs";

type Form = {
  name: string;
  location: string;
  labManager: string;
  contactEmail: string;
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
    minimumStay: "",
    pricePrivacy: false,
  });

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
