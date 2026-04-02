import { useEffect, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown, ChevronUp, X, Plus, Loader2, Search } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type LabStub = { id: number; name: string };

type UserRow = {
  user_id: string;
  email: string | null;
  name: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  can_create_lab: boolean;
  can_manage_multiple_labs: boolean;
  can_manage_teams: boolean;
  can_manage_multiple_teams: boolean;
  can_post_news: boolean;
  can_broker_requests: boolean;
  can_receive_investor: boolean;
  is_admin: boolean;
  labs: LabStub[];
};

type AllLab = { id: number; name: string; owner_user_id: string | null };

// ─── Permission flag config ───────────────────────────────────────────────────

const FLAGS: { key: keyof UserRow; label: string }[] = [
  { key: "is_admin",                  label: "Admin" },
  { key: "can_create_lab",            label: "Create labs" },
  { key: "can_manage_multiple_labs",  label: "Manage multiple labs" },
  { key: "can_manage_teams",          label: "Manage teams" },
  { key: "can_manage_multiple_teams", label: "Manage multiple teams" },
  { key: "can_post_news",             label: "Post news" },
  { key: "can_broker_requests",       label: "Broker requests" },
  { key: "can_receive_investor",      label: "Receive investor inquiries" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiFetch(url: string, options?: RequestInit) {
  const token = await getToken();
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Request failed.");
  return json;
}

// ─── UserCard ─────────────────────────────────────────────────────────────────

function UserCard({ user, allLabs, onUpdate }: { user: UserRow; allLabs: AllLab[]; onUpdate: (u: UserRow) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null); // key being saved
  const [labSearch, setLabSearch] = useState("");
  const [labPickerOpen, setLabPickerOpen] = useState(false);

  const availableLabs = allLabs.filter(
    l => l.owner_user_id === null && !user.labs.find(ul => ul.id === l.id) &&
      l.name.toLowerCase().includes(labSearch.toLowerCase())
  );

  const toggleFlag = async (key: keyof UserRow) => {
    const newVal = !user[key];
    setSaving(key);
    try {
      await apiFetch(`/api/admin/users/${user.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({ [key]: newVal }),
      });
      onUpdate({ ...user, [key]: newVal });
    } catch {
      // silently revert — no toast needed for a toggle
    } finally {
      setSaving(null);
    }
  };

  const assignLab = async (lab: AllLab) => {
    setSaving(`lab-add-${lab.id}`);
    try {
      await apiFetch(`/api/admin/labs/${lab.id}/owner`, {
        method: "PATCH",
        body: JSON.stringify({ owner_user_id: user.user_id }),
      });
      onUpdate({ ...user, labs: [...user.labs, { id: lab.id, name: lab.name }] });
      setLabSearch("");
      setLabPickerOpen(false);
    } finally {
      setSaving(null);
    }
  };

  const removeLab = async (lab: LabStub) => {
    setSaving(`lab-rm-${lab.id}`);
    try {
      await apiFetch(`/api/admin/labs/${lab.id}/owner`, {
        method: "PATCH",
        body: JSON.stringify({ owner_user_id: null }),
      });
      onUpdate({ ...user, labs: user.labs.filter(l => l.id !== lab.id) });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/90 overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary uppercase">
            {(user.name || user.email || "?")[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user.name || <span className="text-muted-foreground italic">No name</span>}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user.subscription_status && (
            <span className="hidden sm:inline rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {user.subscription_status}
            </span>
          )}
          {user.is_admin && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Admin</span>
          )}
          {user.labs.length > 0 && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {user.labs.length} lab{user.labs.length !== 1 ? "s" : ""}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-border px-5 py-4 space-y-5">

          {/* Permission flags */}
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">Permissions</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FLAGS.map(({ key, label }) => {
                const active = Boolean(user[key]);
                const isSaving = saving === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!!saving}
                    onClick={() => toggleFlag(key)}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                      active
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    } disabled:opacity-60`}
                  >
                    <span>{label}</span>
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    ) : (
                      <div className={`h-4 w-7 rounded-full transition ${active ? "bg-primary" : "bg-muted"}`}>
                        <div className={`h-3 w-3 rounded-full bg-white mt-0.5 transition-all ${active ? "ml-3.5" : "ml-0.5"}`} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Labs */}
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">Managed labs</p>
            <div className="space-y-1.5">
              {user.labs.length === 0 && (
                <p className="text-xs text-muted-foreground">No labs assigned.</p>
              )}
              {user.labs.map(lab => (
                <div key={lab.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                  <span className="text-sm text-foreground">{lab.name}</span>
                  <button
                    type="button"
                    disabled={saving === `lab-rm-${lab.id}`}
                    onClick={() => removeLab(lab)}
                    className="text-muted-foreground hover:text-destructive transition disabled:opacity-50"
                  >
                    {saving === `lab-rm-${lab.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}

              {/* Add lab */}
              {!labPickerOpen ? (
                <button
                  type="button"
                  onClick={() => setLabPickerOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition"
                >
                  <Plus className="h-3.5 w-3.5" /> Assign lab
                </button>
              ) : (
                <div className="rounded-xl border border-border bg-background p-2 space-y-1.5">
                  <div className="flex items-center gap-2 rounded-lg border border-border px-2">
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <input
                      autoFocus
                      value={labSearch}
                      onChange={e => setLabSearch(e.target.value)}
                      placeholder="Search unassigned labs…"
                      className="w-full bg-transparent py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                  {availableLabs.length === 0 ? (
                    <p className="px-1 py-1 text-xs text-muted-foreground">No unassigned labs found.</p>
                  ) : (
                    <ul className="max-h-40 overflow-y-auto space-y-0.5">
                      {availableLabs.map(lab => (
                        <li key={lab.id}>
                          <button
                            type="button"
                            disabled={saving === `lab-add-${lab.id}`}
                            onClick={() => assignLab(lab)}
                            className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left hover:bg-muted/50 transition disabled:opacity-50"
                          >
                            {saving === `lab-add-${lab.id}` && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                            {lab.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => { setLabPickerOpen(false); setLabSearch(""); }}
                    className="w-full rounded-lg py-1 text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [allLabs, setAllLabs] = useState<AllLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [usersData, labsData] = await Promise.all([
          apiFetch("/api/admin/users"),
          apiFetch("/api/admin/all-labs"),
        ]);
        setUsers(usersData);
        setAllLabs(labsData);
      } catch (err: any) {
        setError(err?.message || "Failed to load.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateUser = (updated: UserRow) =>
    setUsers(prev => prev.map(u => u.user_id === updated.user_id ? updated : u));

  const filtered = users.filter(u =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-20 lg:py-24 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Admin</span>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Users</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage permissions and lab assignments for all accounts.
            </p>
          </div>
          <Link href="/admin">
            <a className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition">
              ← Admin
            </a>
          </Link>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 max-w-sm rounded-full border border-border bg-background px-4 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full bg-transparent text-sm focus:outline-none"
          />
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {!loading && !error && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</p>
            {filtered.map(user => (
              <UserCard key={user.user_id} user={user} allLabs={allLabs} onUpdate={updateUser} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
