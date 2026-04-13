import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { LabPartner } from "@shared/labs";

type ProofType = "photo" | "document";

type EvidenceItem = {
  equipment: string;
  verified: boolean;
  proofUrl: string | null;
  proofType: ProofType | null;
  proofName: string | null;
  uploading: boolean;
};

type SavedEvidence = {
  equipment_name: string;
  verified: boolean;
  proof_url: string | null;
  proof_type: string | null;
  proof_name: string | null;
};

interface Props {
  lab: LabPartner;
  onClose: () => void;
  onComplete: () => void;
  fetchAuthed: (url: string, init?: RequestInit) => Promise<Response>;
}

export default function AdminAuditModal({ lab, onClose, onComplete, fetchAuthed }: Props) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUnverifiedDialog, setShowUnverifiedDialog] = useState(false);

  const cameraRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const photoRefs  = useRef<Map<string, HTMLInputElement>>(new Map());
  const docRefs    = useRef<Map<string, HTMLInputElement>>(new Map());

  const equipment   = lab.equipment ?? [];
  const checkedCount = items.filter(i => i.verified).length;
  const allChecked  = equipment.length > 0 && checkedCount === equipment.length;

  // ── Load existing evidence ─────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchAuthed(`/api/admin/labs/${lab.id}/audit-evidence`);
        let existing: SavedEvidence[] = [];
        if (res.ok) existing = await res.json();
        if (!active) return;
        const map = new Map(existing.map(e => [e.equipment_name, e]));
        setItems(
          equipment.map(eq => {
            const saved = map.get(eq);
            return {
              equipment: eq,
              verified:  saved?.verified  ?? false,
              proofUrl:  saved?.proof_url  ?? null,
              proofType: (saved?.proof_type as ProofType | null) ?? null,
              proofName: saved?.proof_name ?? null,
              uploading: false,
            };
          }),
        );
      } catch {
        if (!active) return;
        setItems(
          equipment.map(eq => ({
            equipment: eq, verified: false,
            proofUrl: null, proofType: null, proofName: null, uploading: false,
          })),
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [lab.id]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const patch = (eq: string, updates: Partial<EvidenceItem>) =>
    setItems(prev => prev.map(i => i.equipment === eq ? { ...i, ...updates } : i));

  const buildPayload = (current: EvidenceItem[]) =>
    current.map(i => ({
      equipment_name: i.equipment,
      verified:   i.verified,
      proof_url:  i.proofUrl,
      proof_type: i.proofType,
      proof_name: i.proofName,
    }));

  const persist = async (current: EvidenceItem[]) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetchAuthed(`/api/admin/labs/${lab.id}/audit-evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(current)),
      });
      if (!res.ok) throw new Error("Save failed");
    } catch {
      setError("Failed to save progress. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle a single item and autosave ──────────────────────────────────────
  const handleToggle = (eq: string) => {
    let next: EvidenceItem[] = [];
    setItems(prev => {
      next = prev.map(i => i.equipment === eq ? { ...i, verified: !i.verified } : i);
      return next;
    });
    // Defer so React commits the state update before we read it
    setTimeout(() => void persist(next), 0);
  };

  // ── File upload ───────────────────────────────────────────────────────────
  const handleUpload = async (eq: string, file: File, type: ProofType) => {
    patch(eq, { uploading: true });
    setError(null);
    try {
      const slug    = eq.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      const ext     = file.name.split(".").pop() ?? "bin";
      const bucket  = type === "photo" ? "lab-photos" : "lab-pdfs";
      const path    = `audit-evidence/lab-${lab.id}/${slug}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      patch(eq, { proofUrl: data.publicUrl, proofType: type, proofName: file.name, uploading: false });
    } catch {
      patch(eq, { uploading: false });
      setError(`Failed to upload proof for "${eq}".`);
    }
  };

  const removeProof = (eq: string) =>
    patch(eq, { proofUrl: null, proofType: null, proofName: null });

  // ── Complete audit → open certificate modal ───────────────────────────────
  const unverifiedItems = items.filter(i => !i.verified);

  const handleComplete = () => {
    if (unverifiedItems.length > 0) {
      setShowUnverifiedDialog(true);
      return;
    }
    void finishAudit(items);
  };

  // Delete unverified items from the list then proceed
  const handleDeleteUnverified = async () => {
    const next = items.filter(i => i.verified);
    setItems(next);
    setShowUnverifiedDialog(false);
    await persist(next);
    onComplete();
  };

  // Proceed as-is, keeping unverified items
  const handleOverride = async () => {
    setShowUnverifiedDialog(false);
    await finishAudit(items);
  };

  const finishAudit = async (current: EvidenceItem[]) => {
    await persist(current);
    onComplete();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Equipment audit</p>
          <h2 className="mt-0.5 text-lg font-semibold text-foreground">{lab.name}</h2>
        </div>
        <div className="flex items-center gap-3">
          {equipment.length > 0 && !loading && (
            <span className="text-sm text-muted-foreground">
              {checkedCount} / {equipment.length} verified
            </span>
          )}
          <button
            type="button"
            onClick={() => { void persist(items); onClose(); }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition"
            title="Close (progress is saved)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading equipment list…
          </div>
        ) : equipment.length === 0 ? (
          <div className="max-w-lg mx-auto rounded-2xl border border-border bg-muted/20 p-8 text-center space-y-2">
            <p className="text-sm font-medium text-foreground">No equipment listed for this lab.</p>
            <p className="text-xs text-muted-foreground">
              You can still proceed to issue the verification certificate.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {items.map(item => (
              <div
                key={item.equipment}
                className={`rounded-2xl border p-4 transition-colors ${
                  item.verified
                    ? "border-emerald-300 bg-emerald-50/60"
                    : "border-border bg-card/80"
                }`}
              >
                <div className="flex items-start gap-3">

                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggle(item.equipment)}
                    className="mt-0.5 shrink-0"
                    aria-label={item.verified ? "Unverify" : "Mark as verified"}
                  >
                    {item.verified
                      ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      : <div className="h-5 w-5 rounded-full border-2 border-border" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.verified ? "text-emerald-800" : "text-foreground"}`}>
                      {item.equipment}
                    </p>

                    {/* Proof preview */}
                    {item.proofUrl && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {item.proofType === "photo" ? (
                          <img
                            src={item.proofUrl}
                            alt="Proof photo"
                            className="h-20 w-20 rounded-xl object-cover border border-border"
                          />
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground max-w-xs truncate">
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{item.proofName}</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeProof(item.equipment)}
                          className="text-muted-foreground hover:text-destructive transition"
                          title="Remove proof"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {/* Upload buttons — only shown when no proof yet */}
                    {!item.proofUrl && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.uploading ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
                          </span>
                        ) : (
                          <>
                            {/* Camera capture (mobile) */}
                            <button
                              type="button"
                              onClick={() => cameraRefs.current.get(item.equipment)?.click()}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition"
                            >
                              <Camera className="h-3.5 w-3.5" /> Take photo
                            </button>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              ref={el => { if (el) cameraRefs.current.set(item.equipment, el); }}
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) void handleUpload(item.equipment, f, "photo");
                                e.target.value = "";
                              }}
                            />

                            {/* Photo file picker */}
                            <button
                              type="button"
                              onClick={() => photoRefs.current.get(item.equipment)?.click()}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition"
                            >
                              <Upload className="h-3.5 w-3.5" /> Upload photo
                            </button>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              ref={el => { if (el) photoRefs.current.set(item.equipment, el); }}
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) void handleUpload(item.equipment, f, "photo");
                                e.target.value = "";
                              }}
                            />

                            {/* Document file picker */}
                            <button
                              type="button"
                              onClick={() => docRefs.current.get(item.equipment)?.click()}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition"
                            >
                              <FileText className="h-3.5 w-3.5" /> Upload doc
                            </button>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              className="hidden"
                              ref={el => { if (el) docRefs.current.set(item.equipment, el); }}
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) void handleUpload(item.equipment, f, "document");
                                e.target.value = "";
                              }}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-4 max-w-2xl mx-auto rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-border bg-background px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <button
          type="button"
          onClick={() => void persist(items)}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? "Saving…" : "Save progress"}
        </button>

        <button
          type="button"
          onClick={handleComplete}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
        >
          {!allChecked && equipment.length > 0 && (
            <span className="text-primary-foreground/70 text-xs">
              {checkedCount}/{equipment.length}
            </span>
          )}
          Complete audit — issue certificate
        </button>
      </div>

      {/* ── Unverified items dialog ── */}
      {showUnverifiedDialog && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowUnverifiedDialog(false)}
        >
          <div
            className="mx-4 w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {unverifiedItems.length} item{unverifiedItems.length !== 1 ? "s" : ""} not verified
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  What would you like to do with the following unverified equipment?
                </p>
                <ul className="mt-2 space-y-0.5">
                  {unverifiedItems.map(i => (
                    <li key={i.equipment} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                      {i.equipment}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => void handleDeleteUnverified()}
                disabled={saving}
                className="inline-flex flex-col items-center gap-1 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-center transition hover:bg-destructive/10 disabled:opacity-50"
              >
                <span className="text-sm font-medium text-destructive">Delete</span>
                <span className="text-xs text-muted-foreground leading-tight">
                  Remove unverified items from this lab's equipment list
                </span>
              </button>
              <button
                type="button"
                onClick={() => void handleOverride()}
                disabled={saving}
                className="inline-flex flex-col items-center gap-1 rounded-2xl border border-border bg-muted/20 px-4 py-3 text-center transition hover:border-primary hover:bg-primary/5 disabled:opacity-50"
              >
                <span className="text-sm font-medium text-foreground">Override</span>
                <span className="text-xs text-muted-foreground leading-tight">
                  Proceed to certificate anyway, keeping items as-is
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowUnverifiedDialog(false)}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition"
            >
              Cancel — go back to audit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
