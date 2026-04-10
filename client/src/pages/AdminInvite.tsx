import { useEffect, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import { Send, CheckCircle2, AlertCircle, Loader2, Search } from "lucide-react";

type EmailResult = { email: string; status: "pending" | "sending" | "ok" | "error"; error?: string };
type LabStub = { id: number; name: string; owner_user_id: string | null };
type Tab = "standard" | "claim";

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.includes("@") && s.includes("."));
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiFetch(url: string, body: object) {
  const token = await getToken();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Request failed.");
  return json;
}

// ─── Standard bulk invite ─────────────────────────────────────────────────────

function StandardInvite() {
  const [raw, setRaw] = useState("");
  const [results, setResults] = useState<EmailResult[]>([]);
  const [running, setRunning] = useState(false);

  const parsed = parseEmails(raw);
  const hasInput = parsed.length > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasInput || running) return;

    const initial: EmailResult[] = parsed.map(email => ({ email, status: "pending" }));
    setResults(initial);
    setRunning(true);

    for (let i = 0; i < parsed.length; i++) {
      const email = parsed[i];
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "sending" } : r));
      try {
        await apiFetch("/api/admin/invite", { email });
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "ok" } : r));
      } catch (err: any) {
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "error", error: err?.message } : r));
      }
    }

    setRunning(false);
    setRaw("");
  };

  const doneCount = results.filter(r => r.status === "ok").length;
  const errorCount = results.filter(r => r.status === "error").length;

  return (
    <div className="rounded-2xl border border-border bg-card/90 p-6 space-y-4 max-w-lg">
      <div>
        <p className="text-sm font-medium text-foreground">Standard invite</p>
        <p className="text-xs text-muted-foreground mt-0.5">Paste one or more emails — one per line or comma-separated.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={raw}
          onChange={e => { setRaw(e.target.value); setResults([]); }}
          placeholder={"alice@example.com\nbob@example.com"}
          rows={5}
          disabled={running}
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-50"
        />
        {hasInput && !running && results.length === 0 && (
          <p className="text-xs text-muted-foreground">{parsed.length} email{parsed.length !== 1 ? "s" : ""} detected</p>
        )}
        <button
          type="submit"
          disabled={!hasInput || running}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {running ? "Sending…" : `Send ${hasInput ? parsed.length : ""} invite${parsed.length !== 1 ? "s" : ""}`}
        </button>
      </form>

      {results.length > 0 && (
        <div className="space-y-1.5">
          {!running && (
            <p className="text-xs text-muted-foreground">
              {doneCount} sent{errorCount > 0 ? `, ${errorCount} failed` : ""}
            </p>
          )}
          {results.map(r => (
            <div key={r.email} className="flex items-center gap-2 text-sm">
              {r.status === "pending" && <span className="h-4 w-4 shrink-0 rounded-full border border-border" />}
              {r.status === "sending" && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
              {r.status === "ok" && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
              {r.status === "error" && <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />}
              <span className={r.status === "error" ? "text-destructive" : "text-foreground"}>{r.email}</span>
              {r.status === "error" && r.error && (
                <span className="text-xs text-muted-foreground truncate">— {r.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Claim invite ─────────────────────────────────────────────────────────────

function ClaimInvite() {
  const [email, setEmail] = useState("");
  const [labs, setLabs] = useState<LabStub[]>([]);
  const [labSearch, setLabSearch] = useState("");
  const [selectedLab, setSelectedLab] = useState<LabStub | null>(null);
  const [labsLoading, setLabsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
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
    l.name.toLowerCase().includes(labSearch.toLowerCase())
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !selectedLab) return;
    setSending(true);
    setResult(null);
    try {
      const json = await apiFetch("/api/admin/claim-invite", {
        email: email.trim().toLowerCase(),
        lab_id: selectedLab.id,
      });
      setResult({ type: "success", message: `Claim invite sent to ${email.trim().toLowerCase()} for ${json.lab?.name ?? selectedLab.name}.` });
      setEmail("");
      setSelectedLab(null);
      setLabSearch("");
      // Remove from unassigned list since it's now reserved
      setLabs(prev => prev.filter(l => l.id !== selectedLab.id));
    } catch (err: any) {
      setResult({ type: "error", message: err?.message || "Failed to send." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/90 p-6 space-y-4 max-w-lg">
      <div>
        <p className="text-sm font-medium text-foreground">Claim invite</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Invite a lab manager and pre-assign their lab. When they accept, the lab is automatically theirs.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="manager@example.com"
            required
            className="mt-1.5 w-full rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lab to assign</label>
          {selectedLab ? (
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2">
              <span className="text-sm text-foreground">{selectedLab.name}</span>
              <button
                type="button"
                onClick={() => setSelectedLab(null)}
                className="text-xs text-muted-foreground hover:text-destructive transition"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="mt-1.5 rounded-2xl border border-border bg-background p-2 space-y-1.5">
              <div className="flex items-center gap-2 rounded-xl border border-border px-3">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  value={labSearch}
                  onChange={e => setLabSearch(e.target.value)}
                  placeholder="Search unassigned labs…"
                  className="w-full bg-transparent py-2 text-sm focus:outline-none"
                />
              </div>
              {labsLoading ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">Loading labs…</p>
              ) : filteredLabs.length === 0 ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">No unassigned labs found.</p>
              ) : (
                <ul className="max-h-48 overflow-y-auto space-y-0.5">
                  {filteredLabs.map(lab => (
                    <li key={lab.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedLab(lab)}
                        className="w-full rounded-xl px-3 py-2 text-sm text-left hover:bg-muted/50 transition"
                      >
                        {lab.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!email.trim() || !selectedLab || sending}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {sending ? "Sending…" : "Send claim invite"}
        </button>
      </form>

      {result && (
        <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
          result.type === "success"
            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
            : "border-destructive/40 bg-destructive/5 text-destructive"
        }`}>
          {result.type === "success"
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          {result.message}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminInvite() {
  const [tab, setTab] = useState<Tab>("standard");

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-20 lg:py-24 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Admin</span>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Invite users</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Send account invites directly via Supabase.
            </p>
          </div>
          <Link href="/admin">
            <a className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition">
              ← Admin
            </a>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-full border border-border bg-muted/30 p-1 w-fit">
          {(["standard", "claim"] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "standard" ? "Standard invite" : "Claim invite"}
            </button>
          ))}
        </div>

        {tab === "standard" ? <StandardInvite /> : <ClaimInvite />}
      </div>
    </section>
  );
}
