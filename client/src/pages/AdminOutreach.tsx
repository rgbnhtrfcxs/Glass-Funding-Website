import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import { Search, FileText, Loader2, Plus, X } from "lucide-react";

type LabStub = { id: number; name: string; owner_user_id: string | null };

type BuiltinTemplate = { id: string; label: string; builtin: true; body: (labName: string) => string };
type CustomTemplate  = { id: string; label: string; builtin: false; bodyTemplate: string };
type AnyTemplate = BuiltinTemplate | CustomTemplate;

function applyBody(tpl: AnyTemplate, labName: string): string {
  if (tpl.builtin) return tpl.body(labName);
  return tpl.bodyTemplate.replace(/\{labName\}/g, labName);
}

const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: "biovalley",
    label: "BioValley",
    builtin: true,
    body: (labName) =>
      `Dear ${labName} team,

We are reaching out on behalf of Glass-Connect — a trusted network and verified marketplace that connects research labs with the industry partners, startups, and investors looking to collaborate and access cutting-edge expertise.

We are building our network in partnership with BioValley and believe ${labName} would be a valuable addition to our verified directory. Listing your lab on Glass-Connect gives you visibility with a curated network of potential collaborators and clients — at no cost.

To claim your lab profile and get started, simply scan the QR code below with your phone. It takes less than two minutes.

We look forward to welcoming you to the Glass-Connect network.

The Glass-Connect Team`,
  },
  {
    id: "general",
    label: "General",
    builtin: true,
    body: (labName) =>
      `Dear ${labName} team,

We are reaching out on behalf of Glass-Connect — a trusted network and verified marketplace that connects research labs with the industry partners, startups, and investors looking to collaborate and access cutting-edge expertise.

We believe ${labName} would be a valuable addition to our verified directory. Listing your lab on Glass-Connect gives you visibility with a curated network of potential collaborators and clients — at no cost.

To claim your lab profile and get started, simply scan the QR code below with your phone. It takes less than two minutes.

We look forward to welcoming you to the Glass-Connect network.

The Glass-Connect Team`,
  },
];

const STORAGE_KEY = "outreach_custom_templates";

function loadCustomTemplates(): CustomTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveCustomTemplates(templates: CustomTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

const NEW_TEMPLATE_PLACEHOLDER =
  `Dear {labName} team,

We are reaching out on behalf of Glass-Connect — a trusted network and verified marketplace that connects research labs with the industry partners, startups, and investors looking to collaborate and access cutting-edge expertise.

We believe {labName} would be a valuable addition to our verified directory. Listing your lab on Glass-Connect gives you visibility with a curated network of potential collaborators and clients — at no cost.

To claim your lab profile and get started, simply scan the QR code below with your phone. It takes less than two minutes.

We look forward to welcoming you to the Glass-Connect network.

The Glass-Connect Team`;

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function AdminOutreach() {
  const [, navigate] = useLocation();
  const [labs, setLabs] = useState<LabStub[]>([]);
  const [labsLoading, setLabsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLab, setSelectedLab] = useState<LabStub | null>(null);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(loadCustomTemplates);
  const [activeTemplate, setActiveTemplate] = useState<string>(BUILTIN_TEMPLATES[0].id);
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New-template form state
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newBody, setNewBody] = useState(NEW_TEMPLATE_PLACEHOLDER);

  const allTemplates: AnyTemplate[] = [...BUILTIN_TEMPLATES, ...customTemplates];

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/admin/all-labs", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        setLabs((json as LabStub[]).filter(l => !l.owner_user_id));
      } finally {
        setLabsLoading(false);
      }
    })();
  }, []);

  const filteredLabs = labs.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectLab = (lab: LabStub) => {
    setSelectedLab(lab);
    const tpl = allTemplates.find(t => t.id === activeTemplate) ?? BUILTIN_TEMPLATES[0];
    setBody(applyBody(tpl, lab.name));
    setError(null);
  };

  const handleApplyTemplate = (templateId: string) => {
    setActiveTemplate(templateId);
    if (selectedLab) {
      const tpl = allTemplates.find(t => t.id === templateId) ?? BUILTIN_TEMPLATES[0];
      setBody(applyBody(tpl, selectedLab.name));
    }
  };

  const handleSaveTemplate = () => {
    if (!newLabel.trim() || !newBody.trim()) return;
    const tpl: CustomTemplate = {
      id: `custom_${Date.now()}`,
      label: newLabel.trim(),
      builtin: false,
      bodyTemplate: newBody,
    };
    const updated = [...customTemplates, tpl];
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    setCreating(false);
    setNewLabel("");
    setNewBody(NEW_TEMPLATE_PLACEHOLDER);
    handleApplyTemplate(tpl.id);
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    if (activeTemplate === id) handleApplyTemplate(BUILTIN_TEMPLATES[0].id);
  };

  const handleGenerate = async () => {
    if (!selectedLab) return;
    setGenerating(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/labs/${selectedLab.id}/claim-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to generate token.");

      const params = new URLSearchParams({
        lab: String(selectedLab.id),
        token: json.token,
        claimUrl: json.claimUrl,
        body: body,
      });
      window.open(`/admin/outreach/letter?${params.toString()}`, "_blank");
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-20 lg:py-24 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Admin</span>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Outreach letters</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a personalised letter with QR code to bring to lab visits.
            </p>
          </div>
          <Link href="/admin">
            <a className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition">
              ← Admin
            </a>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Step 1 — Lab picker */}
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">1. Select lab</p>
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search unassigned labs…"
                className="w-full bg-transparent text-sm focus:outline-none"
              />
            </div>

            {labsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading labs…
              </div>
            ) : filteredLabs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No unassigned labs found.</p>
            ) : (
              <ul className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {filteredLabs.map(lab => (
                  <li key={lab.id}>
                    <button
                      type="button"
                      onClick={() => selectLab(lab)}
                      className={`w-full text-left rounded-2xl border px-4 py-3 text-sm transition ${
                        selectedLab?.id === lab.id
                          ? "border-primary/50 bg-primary/5 text-primary"
                          : "border-border text-foreground hover:border-primary/30 hover:bg-muted/30"
                      }`}
                    >
                      {lab.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Step 2 — Letter editor */}
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              2. Edit letter {selectedLab ? `— ${selectedLab.name}` : ""}
            </p>

            {!selectedLab ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Select a lab to start editing the letter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Template picker */}
                <div className="flex gap-2 flex-wrap items-center">
                  {allTemplates.map(tpl => (
                    <div key={tpl.id} className="relative group flex items-center">
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(tpl.id)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          !tpl.builtin ? "pr-6" : ""
                        } ${
                          activeTemplate === tpl.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {tpl.label}
                      </button>
                      {!tpl.builtin && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-destructive transition"
                          title="Delete template"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition inline-flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> New template
                  </button>
                </div>

                {/* New template form */}
                {creating && (
                  <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                    <p className="text-xs font-medium text-foreground">New template</p>
                    <input
                      type="text"
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      placeholder="Template name (e.g. Swiss Innovation Park)"
                      className="w-full rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      autoFocus
                    />
                    <textarea
                      value={newBody}
                      onChange={e => setNewBody(e.target.value)}
                      rows={10}
                      className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono leading-relaxed"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use <code className="bg-muted px-1 rounded">{"{labName}"}</code> where the lab's name should appear.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveTemplate}
                        disabled={!newLabel.trim() || !newBody.trim()}
                        className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
                      >
                        Save template
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCreating(false); setNewLabel(""); setNewBody(NEW_TEMPLATE_PLACEHOLDER); }}
                        className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={14}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono leading-relaxed"
                />

                {error && (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || !body.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {generating ? "Generating…" : "Generate letter"}
                </button>
                <p className="text-xs text-muted-foreground text-center">
                  Opens a printable letter in a new tab. Generating a new letter invalidates any previous QR for this lab.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
