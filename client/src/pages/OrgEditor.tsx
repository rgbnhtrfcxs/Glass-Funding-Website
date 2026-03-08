import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Building2, Beaker, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";

type OrgMember = {
  id: number;
  user_id: string;
  org_role: "member" | "manager" | "owner";
  created_at: string;
};

type OrgLab = {
  id: number;
  name: string;
  lab_status: string | null;
  lab_location: { city?: string; country?: string } | null;
};

type Organization = {
  id: number;
  slug: string;
  name: string;
  short_description: string | null;
  long_description: string | null;
  logo_url: string | null;
  website: string | null;
  linkedin: string | null;
  org_type: string;
  owner_user_id: string;
  is_visible: boolean;
  org_members: OrgMember[];
};

const ORG_TYPES = [
  { value: "research_org", label: "Research Organization" },
  { value: "university", label: "University" },
  { value: "hospital_network", label: "Hospital Network" },
  { value: "industry", label: "Industry" },
  { value: "other", label: "Other" },
];

type Tab = "details" | "labs" | "members";

interface OrgEditorProps {
  params?: { id?: string };
}

export default function OrgEditor({ params }: OrgEditorProps) {
  const [location] = useLocation();
  const isCreateNew = location === "/org/manage/new";
  const orgId = params?.id ? Number(params.id) : null;
  // isNew = true only when explicitly creating (/org/manage/new) or bare /org/manage with no orgs
  const isNew = !orgId;
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [tab, setTab] = useState<Tab>("details");
  const [org, setOrg] = useState<Organization | null>(null);
  const [labs, setLabs] = useState<OrgLab[]>([]);
  const [myOrgs, setMyOrgs] = useState<Organization[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    slug: "",
    name: "",
    shortDescription: "",
    longDescription: "",
    logoUrl: "",
    website: "",
    linkedin: "",
    orgType: "research_org",
    isVisible: true,
  });

  // Member management
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<"member" | "manager">("member");
  const [memberLoading, setMemberLoading] = useState(false);

  const authHeader = async () => {
    const { data } = await import("@/lib/supabaseClient").then((m) => m.supabase.auth.getSession());
    return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
  };

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const headers = await authHeader();

        // Bare /org/manage — redirect to existing org or show create form
        if (!orgId && !isCreateNew) {
          const res = await fetch("/api/my-organizations", { headers: headers as any });
          if (res.ok && active) {
            const data: Organization[] = await res.json();
            if (data.length === 1) {
              navigate(`/org/manage/${data[0].id}`);
              return;
            }
            setMyOrgs(data);
          } else {
            setMyOrgs([]);
          }
          setLoading(false);
          return;
        }

        // /org/manage/new — just show empty create form
        if (!orgId) {
          setLoading(false);
          return;
        }

        // /org/manage/:id — load existing org
        const res = await fetch(`/api/organizations/${orgId}`, { headers: headers as any });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Not found");
        const data: Organization = await res.json();
        if (!active) return;
        setOrg(data);
        setForm({
          slug: data.slug,
          name: data.name,
          shortDescription: data.short_description ?? "",
          longDescription: data.long_description ?? "",
          logoUrl: data.logo_url ?? "",
          website: data.website ?? "",
          linkedin: data.linkedin ?? "",
          orgType: data.org_type,
          isVisible: data.is_visible,
        });

        const labsRes = await fetch(`/api/organizations/${data.id}/labs`, { headers: headers as any });
        if (labsRes.ok && active) setLabs(await labsRes.json());
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load organization");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [orgId, isCreateNew]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const headers = { ...(await authHeader()), "Content-Type": "application/json" };
      const url = isNew ? "/api/organizations" : `/api/organizations/${orgId}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, { method, headers: headers as any, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Failed to save");
      if (isNew) navigate(`/org/manage/${data.id}`);
      else setOrg((prev) => ({ ...(prev ?? ({} as Organization)), ...data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!orgId || !memberUserId.trim()) return;
    setMemberLoading(true);
    try {
      const headers = { ...(await authHeader()), "Content-Type": "application/json" };
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: "POST",
        headers: headers as any,
        body: JSON.stringify({ userId: memberUserId.trim(), orgRole: memberRole }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Failed to add member");
      const newMember = await res.json();
      setOrg((prev) =>
        prev ? { ...prev, org_members: [...prev.org_members, newMember] } : prev,
      );
      setMemberUserId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setMemberLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!orgId) return;
    try {
      const headers = await authHeader();
      const res = await fetch(`/api/organizations/${orgId}/members/${memberId}`, {
        method: "DELETE",
        headers: headers as any,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Failed to remove member");
      setOrg((prev) =>
        prev ? { ...prev, org_members: prev.org_members.filter((m) => m.user_id !== memberId) } : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  if (loading) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-20">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </section>
    );
  }

  // Bare /org/manage with multiple orgs — show picker
  if (!orgId && !isCreateNew && myOrgs !== null) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-12 lg:py-16 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-xl font-semibold">My Organizations</h1>
              <Link href="/org/manage/new">
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity">
                  <Plus className="h-4 w-4" /> New Organization
                </button>
              </Link>
            </div>
            {error && (
              <div className="mb-6 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
            )}
            {myOrgs.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/70 p-10 text-center text-muted-foreground">
                <p className="mb-4">You don't manage any organizations yet.</p>
                <Link href="/org/manage/new">
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity">
                    <Plus className="h-4 w-4" /> Create your first organization
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {myOrgs.map(o => (
                  <Link key={o.id} href={`/org/manage/${o.id}`}>
                    <div className="flex items-center gap-4 p-4 border border-border rounded-xl hover:border-foreground/30 cursor-pointer transition-colors">
                      <div className="h-10 w-10 rounded-lg border border-border bg-muted flex items-center justify-center flex-shrink-0">
                        {o.logo_url ? (
                          <img src={o.logo_url} alt={o.name} className="h-full w-full rounded-lg object-cover" />
                        ) : (
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{o.name}</p>
                        <p className="text-xs text-muted-foreground truncate">/orgs/{o.slug}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </section>
    );
  }

  const isOwner = !org || org.owner_user_id === user?.id;

  // If a non-owner somehow lands on the details tab, switch to labs
  if (!isOwner && tab === "details") setTab("labs");

  const tabs: { key: Tab; label: string }[] = [
    ...(isOwner ? [{ key: "details" as Tab, label: "Details" }] : []),
    { key: "labs", label: `Labs (${labs.length})` },
    { key: "members", label: `Members (${org?.org_members.length ?? 0})` },
  ];

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12 lg:py-16 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Link href="/org/manage" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8" onClick={() => setMyOrgs(null)}>
            <ArrowLeft className="h-4 w-4" /> My Organizations
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-lg border border-border bg-muted flex items-center justify-center">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold">{isNew ? "New Organization" : (org?.name ?? "Organization")}</h1>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
          )}

          {/* Tab nav */}
          {!isNew && (
            <div className="flex gap-1 mb-8 border-b border-border">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.key
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Details tab */}
          {(isNew || tab === "details") && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Organization Name *</label>
                  <input
                    className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Biovalley"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Slug (URL) *</label>
                  <input
                    className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
                    placeholder="biovalley"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Organization Type</label>
                <select
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
                  value={form.orgType}
                  onChange={(e) => setForm((f) => ({ ...f, orgType: e.target.value }))}
                >
                  {ORG_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Short Description</label>
                <textarea
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30 resize-none"
                  rows={2}
                  maxLength={300}
                  value={form.shortDescription}
                  onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
                  placeholder="One-liner describing the organization"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Long Description</label>
                <textarea
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30 resize-none"
                  rows={6}
                  value={form.longDescription}
                  onChange={(e) => setForm((f) => ({ ...f, longDescription: e.target.value }))}
                  placeholder="Full description..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Logo URL</label>
                  <input
                    className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    value={form.logoUrl}
                    onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Website</label>
                  <input
                    className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    value={form.website}
                    onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">LinkedIn</label>
                  <input
                    className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    value={form.linkedin}
                    onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
                    placeholder="https://linkedin.com/company/..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="is-visible"
                  type="checkbox"
                  className="rounded border-border"
                  checked={form.isVisible}
                  onChange={(e) => setForm((f) => ({ ...f, isVisible: e.target.checked }))}
                />
                <label htmlFor="is-visible" className="text-sm text-muted-foreground cursor-pointer">
                  Visible to the public
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name || !form.slug}
                  className="px-5 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {saving ? "Saving..." : isNew ? "Create Organization" : "Save Changes"}
                </button>
                {!isNew && org && (
                  <Link href={`/orgs/${org.slug}`}>
                    <button className="px-5 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">
                      View Public Profile
                    </button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Labs tab */}
          {!isNew && tab === "labs" && (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Labs are linked by their owners. To add a lab, have the lab owner link it from their lab management page, or use the API.
              </p>
              {labs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No labs affiliated yet.</p>
              ) : (
                <div className="space-y-2">
                  {labs.map((lab) => (
                    <div key={lab.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                      <Beaker className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lab.name}</p>
                        {lab.lab_location && (
                          <p className="text-xs text-muted-foreground">
                            {[lab.lab_location.city, lab.lab_location.country].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">{lab.lab_status ?? "listed"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Members tab */}
          {!isNew && tab === "members" && (
            <div>
              <div className="space-y-2 mb-6">
                {(org?.org_members ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members yet.</p>
                ) : (
                  (org?.org_members ?? []).map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                      <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-muted-foreground truncate">{m.user_id}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground capitalize">{m.org_role}</span>
                      {m.user_id !== org?.owner_user_id && m.user_id !== user?.id && (
                        <button
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="border border-border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-3">Add Member</h3>
                <div className="flex gap-2">
                  <input
                    className="flex-1 text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    placeholder="User ID (UUID)"
                    value={memberUserId}
                    onChange={(e) => setMemberUserId(e.target.value)}
                  />
                  <select
                    className="text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value as "member" | "manager")}
                  >
                    <option value="member">Member</option>
                    <option value="manager">Manager</option>
                  </select>
                  <button
                    onClick={handleAddMember}
                    disabled={memberLoading || !memberUserId.trim()}
                    className="px-3 py-2 rounded-md bg-foreground text-background text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
