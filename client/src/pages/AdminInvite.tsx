import { useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import { Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type EmailResult = { email: string; status: "pending" | "sending" | "ok" | "error"; error?: string };

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.includes("@") && s.includes("."));
}

async function sendInvite(email: string, token: string): Promise<void> {
  const res = await fetch("/api/admin/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed");
}

export default function AdminInvite() {
  const [raw, setRaw] = useState("");
  const [results, setResults] = useState<EmailResult[]>([]);
  const [running, setRunning] = useState(false);

  const parsed = parseEmails(raw);
  const hasInput = parsed.length > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasInput || running) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setResults([{ email: "", status: "error", error: "Not authenticated." }]);
      return;
    }

    const initial: EmailResult[] = parsed.map(email => ({ email, status: "pending" }));
    setResults(initial);
    setRunning(true);

    for (let i = 0; i < parsed.length; i++) {
      const email = parsed[i];
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "sending" } : r));
      try {
        await sendInvite(email, token);
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
    <section className="bg-background min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-20 lg:py-24 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Admin</span>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Invite users</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste one or more emails — one per line, or comma-separated. Invites are sent directly via Brevo.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/labs">
              <a className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition">
                Labs
              </a>
            </Link>
            <Link href="/admin/audit">
              <a className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition">
                Audit
              </a>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/90 p-6 space-y-4 max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">Email addresses</label>
              <textarea
                value={raw}
                onChange={e => { setRaw(e.target.value); setResults([]); }}
                placeholder={"alice@example.com\nbob@example.com\ncarol@example.com"}
                rows={5}
                disabled={running}
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-50"
              />
              {hasInput && !running && results.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{parsed.length} email{parsed.length !== 1 ? "s" : ""} detected</p>
              )}
            </div>
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
      </div>
    </section>
  );
}
