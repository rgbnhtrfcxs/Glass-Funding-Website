import { useEffect, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import { Search, FileText, Loader2, Plus, X, ExternalLink, CheckSquare, Square } from "lucide-react";

type LabStub = { id: number; name: string; owner_user_id: string | null };

type BuiltinTemplate = { id: string; label: string; builtin: true; body: (labName: string) => string };
type CustomTemplate  = { id: string; label: string; builtin: false; bodyTemplate: string };
type AnyTemplate = BuiltinTemplate | CustomTemplate;

type GeneratedLetter = { lab: LabStub; url: string; error?: string };

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
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
  catch { return []; }
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

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function AdminOutreach() {
  const [labs, setLabs] = useState<LabStub[]>([]);
  const [labsLoading, setLabsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(loadCustomTemplates);
  const [activeTemplate, setActiveTemplate] = useState<string>(BUILTIN_TEMPLATES[0].id);
  const [bodyTemplate, setBodyTemplate] = useState(BUILTIN_TEMPLATES[0].body("{labName}"));
  const [generating, setGenerating] = useState(false);
  const [generatedLetters, setGeneratedLetters] = useState<GeneratedLetter[]>([]);
  const [error, setError] = useState<string | null>(null);

  // New-template form
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newBody, setNewBody] = useState(NEW_TEMPLATE_PLACEHOLDER);

  const allTemplates: AnyTemplate[] = [...BUILTIN_TEMPLATES, ...customTemplates];

  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthToken();
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

  const toggleLab = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setGeneratedLetters([]);
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredLabs.map(l => l.id)));
    setGeneratedLetters([]);
  };

  const clearAll = () => {
    setSelectedIds(new Set());
    setGeneratedLetters([]);
  };

  const handleApplyTemplate = (templateId: string) => {
    setActiveTemplate(templateId);
    const tpl = allTemplates.find(t => t.id === templateId) ?? BUILTIN_TEMPLATES[0];
    setBodyTemplate(applyBody(tpl, "{labName}"));
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
    if (selectedIds.size === 0) return;
    setGenerating(true);
    setError(null);
    setGeneratedLetters([]);

    const selectedLabs = labs.filter(l => selectedIds.has(l.id));
    const token = await getAuthToken();
    const results: GeneratedLetter[] = [];

    for (const lab of selectedLabs) {
      try {
        const res = await fetch(`/api/admin/labs/${lab.id}/claim-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || "Failed");

        const letterBody = bodyTemplate.replace(/\{labName\}/g, lab.name);
        const params = new URLSearchParams({
          lab: String(lab.id),
          token: json.token,
          claimUrl: json.claimUrl,
          body: letterBody,
        });
        results.push({ lab, url: `/admin/outreach/letter?${params.toString()}` });
      } catch (err: any) {
        results.push({ lab, url: "", error: err?.message || "Failed to generate" });
      }
    }

    setGeneratedLetters(results);
    setGenerating(false);
  };

  const selectedCount = selectedIds.size;
  const allFilteredSelected = filteredLabs.length > 0 && filteredLabs.every(l => selectedIds.has(l.id));

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-20 lg:py-24 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Admin</span>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Outreach letters</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate personalised letters with QR codes to bring to lab visits.
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
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">1. Select labs</p>
              {!labsLoading && filteredLabs.length > 0 && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={allFilteredSelected ? clearAll : selectAll}
                    className="text-xs text-muted-foreground hover:text-primary transition"
                  >
                    {allFilteredSelected ? "Deselect all" : "Select all"}
                  </button>
                  {selectedCount > 0 && !allFilteredSelected && (
                    <button type="button" onClick={clearAll} className="text-xs text-muted-foreground hover:text-destructive transition">
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

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
                {filteredLabs.map(lab => {
                  const checked = selectedIds.has(lab.id);
                  return (
                    <li key={lab.id}>
                      <button
                        type="button"
                        onClick={() => toggleLab(lab.id)}
                        className={`w-full text-left rounded-2xl border px-4 py-3 text-sm transition flex items-center gap-3 ${
                          checked
                            ? "border-primary/50 bg-primary/5 text-primary"
                            : "border-border text-foreground hover:border-primary/30 hover:bg-muted/30"
                        }`}
                      >
                        {checked
                          ? <CheckSquare className="h-4 w-4 shrink-0" />
                          : <Square className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        {lab.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {selectedCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedCount} lab{selectedCount !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {/* Step 2 — Template & generate */}
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">2. Choose template & generate</p>

            <div className="space-y-3">
              {/* Template picker */}
              <div className="flex gap-2 flex-wrap items-center">
                {allTemplates.map(tpl => (
                  <div key={tpl.id} className="relative flex items-center">
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
                    rows={8}
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

              {/* Body preview/edit */}
              <textarea
                value={bodyTemplate}
                onChange={e => setBodyTemplate(e.target.value)}
                rows={12}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{"{labName}"}</code> — replaced per lab when generating.
              </p>

              {error && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || selectedCount === 0 || !bodyTemplate.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {generating
                  ? "Generating…"
                  : selectedCount === 0
                  ? "Select labs to generate"
                  : `Generate ${selectedCount} letter${selectedCount !== 1 ? "s" : ""}`}
              </button>
              <p className="text-xs text-muted-foreground text-center">
                Generating a new letter invalidates any previous QR for that lab.
              </p>
            </div>
          </div>
        </div>

        {/* Generated letters results */}
        {generatedLetters.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Generated letters</p>
            <ul className="space-y-2">
              {generatedLetters.map(({ lab, url, error: err }) => (
                <li key={lab.id} className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 ${
                  err ? "border-destructive/30 bg-destructive/5" : "border-border bg-card/90"
                }`}>
                  <span className="text-sm text-foreground">{lab.name}</span>
                  {err
                    ? <span className="text-xs text-destructive">{err}</span>
                    : <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition shrink-0"
                      >
                        Open letter <ExternalLink className="h-3 w-3" />
                      </a>
                  }
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
