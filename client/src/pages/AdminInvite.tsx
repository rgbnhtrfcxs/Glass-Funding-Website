import { useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import { Send, CheckCircle2, AlertCircle } from "lucide-react";

type Status = { type: "success" | "error"; message: string } | null;

export default function AdminInvite() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [history, setHistory] = useState<string[]>([]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    setStatus(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated.");

      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: trimmed }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to send invite.");

      setStatus({ type: "success", message: `Invite sent to ${trimmed}.` });
      setHistory(prev => [trimmed, ...prev]);
      setEmail("");
    } catch (err: any) {
      setStatus({ type: "error", message: err?.message || "Something went wrong." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-20 lg:py-24 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Admin</span>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Invite user</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Send an account invite via Brevo. The recipient receives a link to set their password — no Supabase email queue involved.
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
              <label className="text-sm font-medium text-foreground">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="client@example.com"
                required
                className="mt-2 w-full rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
              {loading ? "Sending…" : "Send invite"}
            </button>
          </form>

          {status && (
            <div
              className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                status.type === "success"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-destructive/40 bg-destructive/5 text-destructive"
              }`}
            >
              {status.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              {status.message}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="max-w-lg space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Sent this session</p>
            <ul className="space-y-1">
              {history.map(addr => (
                <li key={addr} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  {addr}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
