import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList,
  MapPin,
  CheckCircle2,
  Circle,
  SkipForward,
  Users,
  BarChart2,
  Calendar,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Link } from "wouter";

// ─── Types ──────────────────────────────────────────────────────────────────

type UserRole = "user" | "auditor" | "audit_manager" | "admin";

type OnlineBooking = {
  id: number;
  status: string;
  phase1_completed_at: string | null;
  auditor_notes: string | null;
  audit_slots: { starts_at: string; ends_at: string; timezone: string } | null;
  labs: { id: number; name: string; lab_location: { city?: string; country?: string } | null } | null;
};

type IrlAssignmentLab = {
  id: number;
  lab_id: number;
  visit_status: "pending" | "visited" | "skipped";
  visited_at: string | null;
  labs: { id: number; name: string; lab_location: { city?: string; country?: string; address_line1?: string } | null } | null;
};

type IrlAssignment = {
  id: number;
  scheduled_date: string;
  area_label: string | null;
  notes: string | null;
  status: string;
  assigned_auditor_user_id?: string;
  irl_assignment_labs: IrlAssignmentLab[];
};

type LabReadiness = {
  id: number;
  name: string;
  labStatus: string | null;
  city: string | null;
  country: string | null;
  equipmentCount: number;
  completenessScore: number;
  checks: Record<string, boolean>;
  phase1Completed: boolean;
  irlReady: boolean;
};

type Tab = "my-bookings" | "my-irl" | "lab-readiness" | "dispatch-irl" | "all-bookings";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const getAuthHeader = async () => {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
};

const visitStatusIcon = (status: string) => {
  if (status === "visited") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "skipped") return <SkipForward className="h-4 w-4 text-muted-foreground" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
};

// ─── Sub-panels ──────────────────────────────────────────────────────────────

function MyBookingsPanel() {
  const [bookings, setBookings] = useState<OnlineBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      const headers = await getAuthHeader();
      const res = await fetch("/api/auditor/my-bookings", { headers: headers as any });
      if (res.ok && active) setBookings(await res.json());
      if (active) setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const markPhase1Complete = async (bookingId: number) => {
    setCompleting(bookingId);
    const headers = { ...(await getAuthHeader()), "Content-Type": "application/json" };
    const res = await fetch(`/api/auditor/booking/${bookingId}/phase1-complete`, {
      method: "PUT",
      headers: headers as any,
      body: JSON.stringify({ auditorNotes: notes[bookingId] ?? null }),
    });
    if (res.ok) {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, phase1_completed_at: new Date().toISOString() } : b)),
      );
    }
    setCompleting(null);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading bookings...</p>;
  if (bookings.length === 0) return <p className="text-sm text-muted-foreground">No online audit bookings assigned to you.</p>;

  return (
    <div className="space-y-4">
      {bookings.map((b) => (
        <div key={b.id} className="border border-border rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{b.labs?.name ?? "Unknown Lab"}</p>
              {b.labs?.lab_location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {[b.labs.lab_location.city, b.labs.lab_location.country].filter(Boolean).join(", ")}
                </p>
              )}
              {b.audit_slots?.starts_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Slot: {formatDate(b.audit_slots.starts_at)}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${b.phase1_completed_at ? "border-green-500/30 text-green-600 bg-green-50" : "border-border text-muted-foreground"}`}>
                {b.phase1_completed_at ? "Phase 1 complete" : b.status}
              </span>
            </div>
          </div>
          {!b.phase1_completed_at && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              <textarea
                className="w-full text-sm border border-border rounded px-2 py-1.5 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-foreground/20"
                rows={2}
                placeholder="Audit notes (optional)"
                value={notes[b.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [b.id]: e.target.value }))}
              />
              <button
                onClick={() => markPhase1Complete(b.id)}
                disabled={completing === b.id}
                className="px-3 py-1.5 rounded bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {completing === b.id ? "Saving..." : "Mark Phase 1 Complete"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MyIrlPanel() {
  const [assignments, setAssignments] = useState<IrlAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const headers = await getAuthHeader();
      const res = await fetch("/api/auditor/my-irl-assignments", { headers: headers as any });
      if (res.ok && active) setAssignments(await res.json());
      if (active) setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const updateVisitStatus = async (
    assignmentId: number,
    labId: number,
    visitStatus: "pending" | "visited" | "skipped",
  ) => {
    const key = `${assignmentId}-${labId}`;
    setUpdatingStatus(key);
    const headers = { ...(await getAuthHeader()), "Content-Type": "application/json" };
    const res = await fetch(`/api/auditor/irl/${assignmentId}/labs/${labId}/status`, {
      method: "PUT",
      headers: headers as any,
      body: JSON.stringify({ visitStatus }),
    });
    if (res.ok) {
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignmentId
            ? {
                ...a,
                irl_assignment_labs: a.irl_assignment_labs.map((al) =>
                  al.lab_id === labId ? { ...al, visit_status: visitStatus } : al,
                ),
              }
            : a,
        ),
      );
    }
    setUpdatingStatus(null);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading IRL assignments...</p>;
  if (assignments.length === 0) return <p className="text-sm text-muted-foreground">No IRL assignments yet.</p>;

  return (
    <div className="space-y-6">
      {assignments.map((a) => (
        <div key={a.id} className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {a.area_label ?? "IRL Assignment"} — {formatDate(a.scheduled_date)}
              </p>
              {a.notes && <p className="text-xs text-muted-foreground mt-0.5">{a.notes}</p>}
            </div>
            <span className="text-xs text-muted-foreground capitalize">{a.status}</span>
          </div>
          <div className="divide-y divide-border">
            {a.irl_assignment_labs.map((al) => {
              const key = `${a.id}-${al.lab_id}`;
              return (
                <div key={al.id} className="px-4 py-3 flex items-center gap-3">
                  {visitStatusIcon(al.visit_status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{al.labs?.name ?? `Lab ${al.lab_id}`}</p>
                    {al.labs?.lab_location && (
                      <p className="text-xs text-muted-foreground truncate">
                        {[al.labs.lab_location.address_line1, al.labs.lab_location.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {(["pending", "visited", "skipped"] as const).map((s) => (
                      <button
                        key={s}
                        disabled={updatingStatus === key}
                        onClick={() => updateVisitStatus(a.id, al.lab_id, s)}
                        className={`px-2 py-1 rounded text-xs border transition-colors ${
                          al.visit_status === s
                            ? "bg-foreground text-background border-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function LabReadinessPanel() {
  const [labs, setLabs] = useState<LabReadiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "irl-ready">("all");

  useEffect(() => {
    let active = true;
    async function load() {
      const headers = await getAuthHeader();
      const res = await fetch("/api/audit-manager/lab-readiness", { headers: headers as any });
      if (res.ok && active) setLabs(await res.json());
      if (active) setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading lab readiness data...</p>;

  const displayed = filter === "irl-ready" ? labs.filter((l) => l.irlReady) : labs;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["all", "irl-ready"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
              filter === f ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? `All Labs (${labs.length})` : `IRL Ready (${labs.filter((l) => l.irlReady).length})`}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <p className="text-sm text-muted-foreground">No labs match the filter.</p>
      ) : (
        <div className="space-y-2">
          {displayed.map((lab) => (
            <div key={lab.id} className="border border-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{lab.name}</p>
                    {lab.irlReady && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                        IRL Ready
                      </span>
                    )}
                  </div>
                  {(lab.city || lab.country) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[lab.city, lab.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-foreground transition-all"
                        style={{ width: `${lab.completenessScore}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{lab.completenessScore}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{lab.equipmentCount} equipment items</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(lab.checks).map(([key, passed]) => (
                  <span
                    key={key}
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      passed ? "border-green-500/30 text-green-600" : "border-border text-muted-foreground"
                    }`}
                  >
                    {key.replace(/^has/, "").replace(/([A-Z])/g, " $1").trim()}
                  </span>
                ))}
                {lab.phase1Completed && (
                  <span className="text-xs px-2 py-0.5 rounded-full border border-green-500/30 text-green-600">
                    Phase 1 done
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DispatchIrlPanel() {
  const [readiness, setReadiness] = useState<LabReadiness[]>([]);
  const [loadingReadiness, setLoadingReadiness] = useState(true);
  const [selectedLabs, setSelectedLabs] = useState<Set<number>>(new Set());
  const [auditorUserId, setAuditorUserId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [areaLabel, setAreaLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const headers = await getAuthHeader();
      const res = await fetch("/api/audit-manager/lab-readiness", { headers: headers as any });
      if (res.ok && active) setReadiness(await res.json());
      if (active) setLoadingReadiness(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const toggleLab = (id: number) => {
    setSelectedLabs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDispatch = async () => {
    if (!auditorUserId || !scheduledDate || selectedLabs.size === 0) return;
    setSaving(true);
    setError(null);
    const headers = { ...(await getAuthHeader()), "Content-Type": "application/json" };
    const res = await fetch("/api/audit-manager/irl-assignments", {
      method: "POST",
      headers: headers as any,
      body: JSON.stringify({
        auditorUserId,
        scheduledDate,
        areaLabel: areaLabel || null,
        notes: notes || null,
        labIds: Array.from(selectedLabs),
      }),
    });
    if (res.ok) {
      setSuccess(true);
      setSelectedLabs(new Set());
      setAuditorUserId("");
      setScheduledDate("");
      setAreaLabel("");
      setNotes("");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.message ?? "Failed to create IRL assignment");
    }
    setSaving(false);
  };

  const irlReady = readiness.filter((l) => l.irlReady);

  return (
    <div className="space-y-6">
      {success && (
        <div className="p-3 rounded-lg bg-green-500/10 text-green-600 text-sm">
          IRL assignment created and auditor notified.
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Auditor User ID *</label>
          <input
            className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/20"
            placeholder="UUID of the auditor"
            value={auditorUserId}
            onChange={(e) => setAuditorUserId(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Scheduled Date *</label>
          <input
            type="date"
            className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/20"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Area Label</label>
          <input
            className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/20"
            placeholder="e.g. Paris Nord, Strasbourg"
            value={areaLabel}
            onChange={(e) => setAreaLabel(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Notes</label>
          <input
            className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/20"
            placeholder="Internal notes for the auditor"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">
          Select Labs ({selectedLabs.size} selected)
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            — showing IRL-ready labs only
          </span>
        </h3>
        {loadingReadiness ? (
          <p className="text-sm text-muted-foreground">Loading labs...</p>
        ) : irlReady.length === 0 ? (
          <p className="text-sm text-muted-foreground">No IRL-ready labs. Labs need a completed Phase 1 audit and a full profile to qualify.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {irlReady.map((lab) => (
              <label
                key={lab.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedLabs.has(lab.id) ? "border-foreground bg-muted/30" : "border-border hover:border-foreground/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedLabs.has(lab.id)}
                  onChange={() => toggleLab(lab.id)}
                  className="rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{lab.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[lab.city, lab.country].filter(Boolean).join(", ")}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleDispatch}
        disabled={saving || !auditorUserId || !scheduledDate || selectedLabs.size === 0}
        className="px-5 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? "Creating..." : `Dispatch IRL Audit (${selectedLabs.size} labs)`}
      </button>
    </div>
  );
}

function AllBookingsPanel() {
  const [bookings, setBookings] = useState<OnlineBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [auditorInputs, setAuditorInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      const headers = await getAuthHeader();
      const res = await fetch("/api/audit-manager/all-bookings", { headers: headers as any });
      if (res.ok && active) setBookings(await res.json());
      if (active) setLoading(false);
    }
    load();
    return () => { active = false; };
  }, []);

  const assignAuditor = async (bookingId: number) => {
    const auditorUserId = auditorInputs[bookingId]?.trim();
    if (!auditorUserId) return;
    setAssigningId(bookingId);
    const headers = { ...(await getAuthHeader()), "Content-Type": "application/json" };
    await fetch(`/api/auditor/booking/${bookingId}/assign-auditor`, {
      method: "PUT",
      headers: headers as any,
      body: JSON.stringify({ auditorUserId }),
    });
    setAssigningId(null);
    setAuditorInputs((prev) => ({ ...prev, [bookingId]: "" }));
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (bookings.length === 0) return <p className="text-sm text-muted-foreground">No bookings yet.</p>;

  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <div key={b.id} className="border border-border rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{b.labs?.name ?? `Lab #${b.id}`}</p>
              {b.audit_slots?.starts_at && (
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(b.audit_slots.starts_at)}</p>
              )}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${b.phase1_completed_at ? "border-green-500/30 text-green-600" : "border-border text-muted-foreground"}`}>
              {b.phase1_completed_at ? "Phase 1 done" : b.status}
            </span>
          </div>
          {!b.phase1_completed_at && (
            <div className="mt-3 pt-3 border-t border-border flex gap-2">
              <input
                className="flex-1 text-xs border border-border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/20"
                placeholder="Assign auditor (User ID)"
                value={auditorInputs[b.id] ?? ""}
                onChange={(e) => setAuditorInputs((prev) => ({ ...prev, [b.id]: e.target.value }))}
              />
              <button
                onClick={() => assignAuditor(b.id)}
                disabled={assigningId === b.id || !auditorInputs[b.id]?.trim()}
                className="px-3 py-1.5 rounded bg-foreground text-background text-xs hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Assign
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuditorPortal() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole>("user");
  const [roleLoading, setRoleLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("my-bookings");

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    async function loadRole() {
      const { data } = await supabase
        .from("profiles")
        .select("role, is_admin")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!active) return;
      const r: string = (data as any)?.role ?? "user";
      const isAdmin: boolean = Boolean((data as any)?.is_admin);
      setRole((isAdmin ? "admin" : r) as UserRole);
      setRoleLoading(false);
    }
    loadRole();
    return () => { active = false; };
  }, [authLoading, user?.id]);

  if (authLoading || roleLoading) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-20">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </section>
    );
  }

  const isManager = role === "audit_manager" || role === "admin";

  const tabs: { key: Tab; label: string; icon: React.ReactNode; managerOnly?: boolean }[] = [
    { key: "my-bookings", label: "My Online Bookings", icon: <ClipboardList className="h-4 w-4" /> },
    { key: "my-irl", label: "My IRL Assignments", icon: <MapPin className="h-4 w-4" /> },
    { key: "lab-readiness", label: "Lab Readiness", icon: <BarChart2 className="h-4 w-4" />, managerOnly: true },
    { key: "dispatch-irl", label: "Dispatch IRL Audit", icon: <Calendar className="h-4 w-4" />, managerOnly: true },
    { key: "all-bookings", label: "All Bookings", icon: <Users className="h-4 w-4" />, managerOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.managerOnly || isManager);

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12 lg:py-16 max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div className="flex items-center gap-3 mb-8">
            <h1 className="text-xl font-semibold">Auditor Portal</h1>
            <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground capitalize">
              {role.replace("_", " ")}
            </span>
          </div>

          {/* Sidebar + content layout */}
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar tabs */}
            <nav className="lg:w-52 flex-shrink-0">
              <ul className="space-y-1">
                {visibleTabs.map((t) => (
                  <li key={t.key}>
                    <button
                      onClick={() => setTab(t.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                        tab === t.key
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {t.icon}
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {tab === "my-bookings" && <MyBookingsPanel />}
              {tab === "my-irl" && <MyIrlPanel />}
              {tab === "lab-readiness" && isManager && <LabReadinessPanel />}
              {tab === "dispatch-irl" && isManager && <DispatchIrlPanel />}
              {tab === "all-bookings" && isManager && <AllBookingsPanel />}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
