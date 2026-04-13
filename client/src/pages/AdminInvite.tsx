import { useEffect, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import { Send, CheckCircle2, AlertCircle, Loader2, Search, ChevronDown, ChevronUp } from "lucide-react";

type EmailResult = { email: string; status: "pending" | "sending" | "ok" | "error"; error?: string };
type LabStub = { id: number; name: string; owner_user_id: string | null };
type SimpleStub = { id: number; name: string };
type Tab = "standard" | "claim";
type ClaimType = "lab" | "org" | "team";

type Permissions = {
  can_create_lab: boolean;
  can_manage_multiple_labs: boolean;
  can_manage_teams: boolean;
  can_manage_multiple_teams: boolean;
  can_manage_orgs: boolean;
  can_post_news: boolean;
  can_broker_requests: boolean;
  can_receive_investor: boolean;
};

const PERM_LABELS: { key: keyof Permissions; label: string }[] = [
  { key: "can_create_lab",            label: "Create lab" },
  { key: "can_manage_multiple_labs",  label: "Manage multiple labs" },
  { key: "can_manage_teams",          label: "Manage teams" },
  { key: "can_manage_multiple_teams", label: "Manage multiple teams" },
  { key: "can_manage_orgs",           label: "Manage organizations" },
  { key: "can_post_news",             label: "Post news" },
  { key: "can_broker_requests",       label: "Broker requests" },
  { key: "can_receive_investor",      label: "Receive investor inquiries" },
];

const DEFAULT_PERMISSIONS: Permissions = {
  can_create_lab: false,
  can_manage_multiple_labs: false,
  can_manage_teams: false,
  can_manage_multiple_teams: false,
  can_manage_orgs: false,
  can_post_news: false,
  can_broker_requests: false,
  can_receive_investor: false,
};

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

async function apiGet(url: string) {
  const token = await getToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Request failed.");
  return json;
}

// ─── Standard bulk invite ─────────────────────────────────────────────────────

function StandardInvite() {
  const [raw, setRaw] = useState("");
  const [results, setResults] = useState<EmailResult[]>([]);
  const [running, setRunning] = useState(false);
  const [permissions, setPermissions] = useState<Permissions>({ ...DEFAULT_PERMISSIONS });
  const [showPerms, setShowPerms] = useState(false);

  const parsed = parseEmails(raw);
  const hasInput = parsed.length > 0;
  const activePermCount = Object.values(permissions).filter(Boolean).length;

  const togglePerm = (key: keyof Permissions) =>
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));

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
        await apiFetch("/api/admin/invite", { email, permissions });
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

        {/* Permissions section */}
        <div className="rounded-xl border border-border bg-muted/20">
          <button
            type="button"
            onClick={() => setShowPerms(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
          >
            <span>
              Permissions
              {activePermCount > 0 && (
                <span className="ml-2 rounded-full bg-primary/15 text-primary px-2 py-0.5">
                  {activePermCount} set
                </span>
              )}
            </span>
            {showPerms ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showPerms && (
            <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {PERM_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={permissions[key]}
                    onChange={() => togglePerm(key)}
                    className="rounded border-border accent-primary"
                  />
                  <span className="text-xs text-foreground">{label}</span>
                </label>
              ))}
            </div>
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
  );
}

// ─── Domain → lab suggestion ──────────────────────────────────────────────────

const DOMAIN_STOP_WORDS = new Set([
  "lab", "labs", "research", "center", "centre", "institute", "university",
  "tech", "technologies", "science", "sciences", "group", "team", "the",
]);

function suggestLabsForEmail(email: string, labs: LabStub[]): LabStub[] {
  const atIdx = email.indexOf("@");
  if (atIdx === -1) return [];
  const domain = email.slice(atIdx + 1).toLowerCase();
  const domainBase = domain.split(".").slice(0, -1).join(" ");
  const tokens = domainBase
    .split(/[-._\s]+/)
    .map(t => t.trim())
    .filter(t => t.length > 2 && !DOMAIN_STOP_WORDS.has(t));
  if (tokens.length === 0) return [];

  return labs
    .filter(lab => {
      const labTokens = lab.name.toLowerCase().split(/[\s\-_]+/);
      return tokens.some(dt =>
        labTokens.some(lt => lt.includes(dt) || dt.includes(lt))
      );
    })
    .slice(0, 3);
}

// ─── Reusable entity picker ───────────────────────────────────────────────────

function EntityPicker({
  items,
  loading,
  selected,
  onSelect,
  onClear,
  placeholder,
}: {
  items: SimpleStub[];
  loading: boolean;
  selected: SimpleStub | null;
  onSelect: (item: SimpleStub) => void;
  onClear: () => void;
  placeholder: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2">
        <span className="text-sm text-foreground">{selected.name}</span>
        <button type="button" onClick={onClear} className="text-xs text-muted-foreground hover:text-destructive transition">
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-2 space-y-1.5">
      <div className="flex items-center gap-2 rounded-xl border border-border px-3">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-2 text-sm focus:outline-none"
        />
      </div>
      {loading ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">None found.</p>
      ) : (
        <ul className="max-h-48 overflow-y-auto space-y-0.5">
          {filtered.map(item => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="w-full rounded-xl px-3 py-2 text-sm text-left hover:bg-muted/50 transition"
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Claim invite ─────────────────────────────────────────────────────────────

function ClaimInvite() {
  const [email, setEmail] = useState("");
  const [claimType, setClaimType] = useState<ClaimType>("lab");

  // Labs
  const [labs, setLabs] = useState<LabStub[]>([]);
  const [selectedLab, setSelectedLab] = useState<LabStub | null>(null);
  const [labsLoading, setLabsLoading] = useState(true);

  // Orgs
  const [orgs, setOrgs] = useState<SimpleStub[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<SimpleStub | null>(null);
  const [orgsLoading, setOrgsLoading] = useState(true);

  // Teams
  const [teams, setTeams] = useState<SimpleStub[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<SimpleStub | null>(null);
  const [teamsLoading, setTeamsLoading] = useState(true);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const labSuggestions = selectedLab ? [] : suggestLabsForEmail(email, labs);

  useEffect(() => {
    (async () => {
      try {
        const json = await apiGet("/api/admin/all-labs");
        setLabs((json as LabStub[]).filter(l => !l.owner_user_id));
      } finally { setLabsLoading(false); }
    })();
    (async () => {
      try {
        const json = await apiGet("/api/admin/all-orgs");
        setOrgs(json as SimpleStub[]);
      } finally { setOrgsLoading(false); }
    })();
    (async () => {
      try {
        const json = await apiGet("/api/admin/all-teams");
        setTeams(json as SimpleStub[]);
      } finally { setTeamsLoading(false); }
    })();
  }, []);

  const selectedEntity = claimType === "lab" ? selectedLab : claimType === "org" ? selectedOrg : selectedTeam;
  const isDisabled = !email.trim() || !selectedEntity || sending;

  const handleTypeChange = (t: ClaimType) => {
    setClaimType(t);
    setResult(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isDisabled) return;
    setSending(true);
    setResult(null);
    try {
      const payload =
        claimType === "lab"
          ? { email: email.trim().toLowerCase(), type: "lab", lab_id: selectedLab!.id }
          : claimType === "org"
          ? { email: email.trim().toLowerCase(), type: "org", org_id: selectedOrg!.id }
          : { email: email.trim().toLowerCase(), type: "team", team_id: selectedTeam!.id };

      const json = await apiFetch("/api/admin/claim-invite", payload);

      const entityName =
        claimType === "lab" ? json.lab?.name ?? selectedLab!.name
        : claimType === "org" ? json.org?.name ?? selectedOrg!.name
        : json.team?.name ?? selectedTeam!.name;

      const typeLabel = claimType === "lab" ? "lab" : claimType === "org" ? "organization" : "team";
      setResult({ type: "success", message: `Claim invite sent to ${email.trim().toLowerCase()} for ${typeLabel} "${entityName}".` });

      setEmail("");
      setSelectedLab(null);
      setSelectedOrg(null);
      setSelectedTeam(null);

      // Remove claimed entity from the list
      if (claimType === "lab") setLabs(prev => prev.filter(l => l.id !== selectedLab!.id));
      if (claimType === "org") setOrgs(prev => prev.filter(o => o.id !== selectedOrg!.id));
      if (claimType === "team") setTeams(prev => prev.filter(t => t.id !== selectedTeam!.id));
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
          Invite a user and pre-assign them a lab, org, or team. Ownership is granted when they accept.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Claim type selector */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Claim type</label>
          <div className="mt-1.5 flex gap-1 rounded-full border border-border bg-muted/30 p-1 w-fit">
            {(["lab", "org", "team"] as ClaimType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={`rounded-full px-4 py-1 text-xs font-medium transition ${
                  claimType === t
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "lab" ? "Lab" : t === "org" ? "Organization" : "Team"}
              </button>
            ))}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setSelectedLab(null); }}
            placeholder="manager@example.com"
            required
            className="mt-1.5 w-full rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Lab picker */}
        {claimType === "lab" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Lab to assign</label>
            {labSuggestions.length > 0 && !selectedLab && (
              <div className="mt-1.5 mb-1.5 space-y-1">
                <p className="text-xs text-muted-foreground">Suggested based on domain</p>
                <div className="flex flex-wrap gap-2">
                  {labSuggestions.map(lab => (
                    <button
                      key={lab.id}
                      type="button"
                      onClick={() => setSelectedLab(lab)}
                      className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-foreground hover:border-primary hover:bg-primary/5 hover:text-primary transition"
                    >
                      {lab.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-1.5">
              <EntityPicker
                items={labs}
                loading={labsLoading}
                selected={selectedLab}
                onSelect={setSelectedLab}
                onClear={() => setSelectedLab(null)}
                placeholder="Search unassigned labs…"
              />
            </div>
          </div>
        )}

        {/* Org picker */}
        {claimType === "org" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Organization to assign</label>
            <div className="mt-1.5">
              <EntityPicker
                items={orgs}
                loading={orgsLoading}
                selected={selectedOrg}
                onSelect={setSelectedOrg}
                onClear={() => setSelectedOrg(null)}
                placeholder="Search unassigned organizations…"
              />
            </div>
          </div>
        )}

        {/* Team picker */}
        {claimType === "team" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Team to assign</label>
            <div className="mt-1.5">
              <EntityPicker
                items={teams}
                loading={teamsLoading}
                selected={selectedTeam}
                onSelect={setSelectedTeam}
                onClear={() => setSelectedTeam(null)}
                placeholder="Search unassigned teams…"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isDisabled}
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
