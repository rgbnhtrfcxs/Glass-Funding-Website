import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus, Star, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import type { Team, TeamMember, TeamMediaAsset, TeamTechnique } from "@shared/teams";

type LabOption = {
  id: number;
  name: string;
  city?: string | null;
  country?: string | null;
};

type TeamLinkRequest = {
  id: number;
  lab_id: number;
  status: string;
  created_at: string;
  responded_at?: string | null;
  labs?: LabOption | null;
};

const emptyMember: TeamMember = {
  name: "",
  role: "",
  email: "",
  linkedin: "",
  website: "",
  isLead: false,
};

const emptyTechnique: TeamTechnique = {
  name: "",
  description: "",
};

const MAX_TEAM_PHOTOS = 2;

const normalizeUrl = (value: string | null | undefined) => {
  const trimmed = value?.toString().trim() ?? "";
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export default function TeamEditor({ params }: { params?: { id?: string } }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const hasId = params?.id !== undefined;
  const teamId = hasId ? Number(params.id) : null;
  const isEditing = hasId;

  const [form, setForm] = useState({
    name: "",
    descriptionShort: "",
    descriptionLong: "",
    field: "",
    website: "",
    linkedin: "",
    logoUrl: "",
    equipment: [] as string[],
    priorityEquipment: [] as string[],
    focusAreas: [] as string[],
    techniques: [] as TeamTechnique[],
    members: [] as TeamMember[],
    labIds: [] as number[],
    photos: [] as TeamMediaAsset[],
  });
  const [equipmentInput, setEquipmentInput] = useState("");
  const [focusInput, setFocusInput] = useState("");
  const [memberInput, setMemberInput] = useState<TeamMember>(emptyMember);
  const [techniqueInput, setTechniqueInput] = useState<TeamTechnique>(emptyTechnique);
  const [photoUrlInput, setPhotoUrlInput] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const draftKey = useMemo(() => `team-draft:${teamId ?? "new"}`, [teamId]);
  const [labs, setLabs] = useState<LabOption[]>([]);
  const [linkedLabs, setLinkedLabs] = useState<LabOption[]>([]);
  const [linkRequests, setLinkRequests] = useState<TeamLinkRequest[]>([]);
  const [requestLabId, setRequestLabId] = useState<number | "">("");
  const [linkRequestError, setLinkRequestError] = useState<string | null>(null);
  const [linkRequestSuccess, setLinkRequestSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadLabs() {
      try {
        const res = await fetch("/api/labs?includeHidden=true");
        if (!res.ok) return;
        const data = (await res.json()) as LabOption[];
        if (active) setLabs(data ?? []);
      } catch {
        // ignore lab list errors
      }
    }
    loadLabs();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadTeam() {
      if (!isEditing) {
        setLoading(false);
        return;
      }
      if (teamId === null || Number.isNaN(teamId)) {
        setError("Invalid team id.");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const res = await fetch(`/api/my-team/${teamId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message || "Unable to load team");
        }
        const data = (await res.json()) as Team;
        if (!active) return;
        const nextForm = {
          name: data.name,
          descriptionShort: data.descriptionShort ?? "",
          descriptionLong: data.descriptionLong ?? "",
          field: data.field ?? "",
          website: data.website ?? "",
          linkedin: data.linkedin ?? "",
          logoUrl: data.logoUrl ?? "",
          equipment: data.equipment ?? [],
          priorityEquipment: data.priorityEquipment ?? [],
          focusAreas: data.focusAreas ?? [],
          techniques: data.techniques ?? [],
          members: data.members ?? [],
          labIds: data.labIds ?? [],
          photos: data.photos ?? [],
        };
        setForm(nextForm);
        setLinkedLabs(data.labs ?? []);
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load team");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadTeam();
    return () => {
      active = false;
    };
  }, [isEditing, teamId]);

  useEffect(() => {
    if (loading || draftLoaded) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) {
        setDraftLoaded(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed?.form) {
        setForm(prev => ({ ...prev, ...parsed.form }));
      }
      if (parsed?.equipmentInput !== undefined) setEquipmentInput(parsed.equipmentInput);
      if (parsed?.focusInput !== undefined) setFocusInput(parsed.focusInput);
      if (parsed?.memberInput) setMemberInput(parsed.memberInput);
      if (parsed?.techniqueInput) setTechniqueInput(parsed.techniqueInput);
      if (parsed?.photoUrlInput !== undefined) setPhotoUrlInput(parsed.photoUrlInput);
    } catch {
      // ignore invalid drafts
    } finally {
      setDraftLoaded(true);
    }
  }, [draftKey, draftLoaded, loading]);

  useEffect(() => {
    if (!draftLoaded) return;
    const handle = window.setTimeout(() => {
      const payload = {
        form,
        equipmentInput,
        focusInput,
        memberInput,
        techniqueInput,
        photoUrlInput,
      };
      localStorage.setItem(draftKey, JSON.stringify(payload));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [draftKey, draftLoaded, form, equipmentInput, focusInput, memberInput, techniqueInput, photoUrlInput]);

  useEffect(() => {
    if (!isEditing || !teamId) return;
    let active = true;
    async function loadLinkRequests() {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const res = await fetch(`/api/teams/${teamId}/link-requests`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message || "Unable to load link requests");
        }
        const data = (await res.json()) as TeamLinkRequest[];
        if (active) setLinkRequests(data ?? []);
      } catch (err) {
        if (active) setLinkRequestError(err instanceof Error ? err.message : "Unable to load link requests");
      }
    }
    loadLinkRequests();
    return () => {
      active = false;
    };
  }, [isEditing, teamId]);

  const handleAddTag = (field: "equipment" | "focusAreas", value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setForm(prev => {
      const next = new Set(prev[field]);
      next.add(trimmed);
      return { ...prev, [field]: Array.from(next) };
    });
  };

  const handleRemoveTag = (field: "equipment" | "focusAreas", value: string) => {
    setForm(prev => {
      const next = prev[field].filter(item => item !== value);
      const updates = { ...prev, [field]: next };
      if (field === "equipment") {
        updates.priorityEquipment = prev.priorityEquipment.filter(item => item !== value);
      }
      return updates;
    });
  };

  const togglePriority = (item: string) => {
    setForm(prev => {
      const selected = new Set(prev.priorityEquipment);
      if (selected.has(item)) {
        selected.delete(item);
      } else {
        if (selected.size >= 3) return prev;
        selected.add(item);
      }
      return { ...prev, priorityEquipment: Array.from(selected) };
    });
  };

  const addMember = () => {
    if (!memberInput.name.trim() || !memberInput.role.trim()) {
      setError("Team member name and role are required.");
      return;
    }
    const cleaned = {
      ...memberInput,
      name: memberInput.name.trim(),
      role: memberInput.role.trim(),
      email: memberInput.email?.toString().trim() || null,
      linkedin: normalizeUrl(memberInput.linkedin?.toString() ?? null),
      website: normalizeUrl(memberInput.website?.toString() ?? null),
      isLead: Boolean(memberInput.isLead),
    };
    setForm(prev => ({
      ...prev,
      members: [...prev.members, cleaned],
    }));
    setMemberInput(emptyMember);
    setError(null);
  };

  const removeMember = (index: number) => {
    setForm(prev => ({
      ...prev,
      members: prev.members.filter((_, idx) => idx !== index),
    }));
  };

  const addTechnique = () => {
    if (!techniqueInput.name.trim()) {
      setError("Technique name is required.");
      return;
    }
    const cleaned = {
      name: techniqueInput.name.trim(),
      description: techniqueInput.description?.toString().trim() || null,
    };
    setForm(prev => ({
      ...prev,
      techniques: [...prev.techniques, cleaned],
    }));
    setTechniqueInput(emptyTechnique);
    setError(null);
  };

  const removeTechnique = (index: number) => {
    setForm(prev => ({
      ...prev,
      techniques: prev.techniques.filter((_, idx) => idx !== index),
    }));
  };

  const addPhotoFromUrl = () => {
    const url = photoUrlInput.trim();
    if (!url) return;
    if (form.photos.length >= MAX_TEAM_PHOTOS) {
      setPhotoError(`Limit ${MAX_TEAM_PHOTOS} photos per team.`);
      return;
    }
    const asset = { name: url.split("/").pop() ?? `Photo ${form.photos.length + 1}`, url };
    setForm(prev => ({ ...prev, photos: [...prev.photos, asset] }));
    setPhotoUrlInput("");
    setPhotoError(null);
  };

  const removePhoto = (asset: TeamMediaAsset) => {
    setForm(prev => ({ ...prev, photos: prev.photos.filter(photo => photo.url !== asset.url) }));
  };

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (form.photos.length >= MAX_TEAM_PHOTOS) {
      setPhotoError(`Limit ${MAX_TEAM_PHOTOS} photos per team.`);
      return;
    }
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filename =
        (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`) + `.${ext}`;
      const teamKey = isEditing && teamId ? teamId : "new";
      const path = `teams/${teamKey}/photos/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from("team-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("team-photos").getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const asset = { name: file.name, url: publicUrl };
      setForm(prev => ({ ...prev, photos: [...prev.photos, asset] }));
    } catch (err: any) {
      setPhotoError(err?.message || "Unable to upload photo");
    } finally {
      setPhotoUploading(false);
      if (event.target) event.target.value = "";
    }
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    setLogoUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const filename =
        (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`) + `.${ext}`;
      const teamKey = isEditing && teamId ? teamId : "new";
      const path = `teams/${teamKey}/logo/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from("team-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("team-logos").getPublicUrl(path);
      setForm(prev => ({ ...prev, logoUrl: data.publicUrl }));
      setSuccess("Logo uploaded.");
    } catch (err: any) {
      setLogoError(err?.message || "Unable to upload logo");
    } finally {
      setLogoUploading(false);
      if (event.target) event.target.value = "";
    }
  }

  const handleSave = async () => {
    if (!user) {
      setError("Sign in to save a team.");
      return;
    }
    if (!form.name.trim()) {
      setError("Team name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const payload = {
        ...form,
        name: form.name.trim(),
        descriptionShort: form.descriptionShort.trim() || null,
        descriptionLong: form.descriptionLong.trim() || null,
        field: form.field.trim() || null,
        website: normalizeUrl(form.website),
        linkedin: normalizeUrl(form.linkedin),
        logoUrl: normalizeUrl(form.logoUrl),
      };
      if (isEditing && (teamId === null || Number.isNaN(teamId))) {
        throw new Error("Invalid team id.");
      }
      const res = await fetch(isEditing ? `/api/my-team/${teamId}` : "/api/teams", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Unable to save team");
      }
      const saved = (await res.json()) as Team;
      setSuccess(isEditing ? "Team updated." : "Team created.");
      if (!isEditing) {
        setLocation(`/team/manage/${saved.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save team");
    } finally {
      setSaving(false);
    }
  };

  const labOptions = useMemo(() => {
    return labs.map(lab => ({
      ...lab,
      location: [lab.city, lab.country].filter(Boolean).join(", "),
    }));
  }, [labs]);

  const linkedLabIds = useMemo(() => new Set(linkedLabs.map(lab => lab.id)), [linkedLabs]);
  const pendingLabIds = useMemo(
    () => new Set(linkRequests.filter(req => req.status === "pending").map(req => req.lab_id)),
    [linkRequests],
  );
  const availableLabs = useMemo(
    () => labOptions.filter(lab => !linkedLabIds.has(lab.id) && !pendingLabIds.has(lab.id)),
    [labOptions, linkedLabIds, pendingLabIds],
  );

  const submitLinkRequest = async () => {
    if (!isEditing || !teamId) return;
    if (!requestLabId) {
      setLinkRequestError("Choose a lab to request.");
      return;
    }
    setLinkRequestError(null);
    setLinkRequestSuccess(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(`/api/teams/${teamId}/link-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ labId: requestLabId }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Unable to send request");
      }
      setLinkRequestSuccess("Request sent to lab owner.");
      setRequestLabId("");
      const refresh = await fetch(`/api/teams/${teamId}/link-requests`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (refresh.ok) {
        const data = (await refresh.json()) as TeamLinkRequest[];
        setLinkRequests(data ?? []);
      }
    } catch (err) {
      setLinkRequestError(err instanceof Error ? err.message : "Unable to send request");
    }
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-16 lg:py-20 max-w-5xl">
        <Link href="/team/manage" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to teams
        </Link>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">
              {isEditing ? "Edit team profile" : "Create a new team"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Highlight expertise, techniques, and linked labs.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Saving..." : isEditing ? "Save team" : "Create team"}
          </button>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading team...</p>
        ) : (
          <div className="mt-8 space-y-8">
            <div className="rounded-3xl border border-border bg-card/70 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Basics</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Team name</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                    placeholder="Team name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Field</label>
                  <input
                    value={form.field}
                    onChange={e => setForm(prev => ({ ...prev, field: e.target.value }))}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                    placeholder="Field of science"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Website</label>
                  <input
                    value={form.website}
                    onChange={e => setForm(prev => ({ ...prev, website: e.target.value }))}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                    placeholder="team-website.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">LinkedIn</label>
                  <input
                    value={form.linkedin}
                    onChange={e => setForm(prev => ({ ...prev, linkedin: e.target.value }))}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                    placeholder="linkedin.com/company/..."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-foreground">Logo URL</label>
                  <input
                    value={form.logoUrl}
                    onChange={e => setForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                    placeholder="https://"
                  />
                  <label className="inline-flex items-center gap-3">
                    <span className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground cursor-pointer transition hover:bg-primary/90">
                      Choose logo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </span>
                    {logoUploading && <span className="text-xs text-muted-foreground">Uploading logo...</span>}
                  </label>
                  {logoError && <p className="text-xs text-destructive">{logoError}</p>}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-foreground">Short description</label>
                  <textarea
                    value={form.descriptionShort}
                    onChange={e => setForm(prev => ({ ...prev, descriptionShort: e.target.value }))}
                    rows={3}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                    placeholder="One-paragraph summary used in listings."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-foreground">Long description</label>
                  <textarea
                    value={form.descriptionLong}
                    onChange={e => setForm(prev => ({ ...prev, descriptionLong: e.target.value }))}
                    rows={5}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                    placeholder="Full team narrative and specialization details."
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card/70 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Team photos</h2>
                <span className="text-xs text-muted-foreground">{form.photos.length}/{MAX_TEAM_PHOTOS}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Add up to {MAX_TEAM_PHOTOS} photos to showcase the team.
              </p>
              <div className="flex flex-wrap gap-3">
                {form.photos.map(photo => (
                  <div
                    key={photo.url}
                    className="group relative h-28 w-40 overflow-hidden rounded-2xl border border-border bg-background"
                  >
                    <img src={photo.url} alt={photo.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo)}
                      className="absolute right-2 top-2 rounded-full border border-border bg-background/80 px-2 py-1 text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={photoUploading || form.photos.length >= MAX_TEAM_PHOTOS}
                  className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex flex-1 gap-2">
                  <input
                    value={photoUrlInput}
                    onChange={e => setPhotoUrlInput(e.target.value)}
                    className="flex-1 rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                    placeholder="Paste photo URL"
                  />
                  <button
                    type="button"
                    onClick={addPhotoFromUrl}
                    disabled={form.photos.length >= MAX_TEAM_PHOTOS}
                    className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                  >
                    Add
                  </button>
                </div>
              </div>
              {photoError && <p className="text-sm text-destructive">{photoError}</p>}
            </div>

            <div className="rounded-3xl border border-border bg-card/70 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Equipment</h2>
              <div className="flex flex-wrap gap-2">
                {form.equipment.map(item => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                    {item}
                    <button type="button" onClick={() => handleRemoveTag("equipment", item)} className="text-muted-foreground hover:text-primary">
                      x
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={equipmentInput}
                  onChange={e => setEquipmentInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag("equipment", equipmentInput);
                      setEquipmentInput("");
                    }
                  }}
                  className="flex-1 rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                  placeholder="Add equipment and press Enter"
                />
                <button
                  type="button"
                  onClick={() => {
                    handleAddTag("equipment", equipmentInput);
                    setEquipmentInput("");
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                >
                  Add
                </button>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Select up to three priority items.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.equipment.map(item => {
                    const isPriority = form.priorityEquipment.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => togglePriority(item)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                          isPriority
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary"
                        }`}
                      >
                        <Star className="h-3.5 w-3.5" />
                        {item}
                      </button>
                    );
                  })}
                  {form.equipment.length === 0 && (
                    <span className="text-xs text-muted-foreground">Add equipment to enable prioritization.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card/70 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Techniques</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {form.techniques.map((technique, index) => (
                  <div key={`${technique.name}-${index}`} className="rounded-2xl border border-border px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{technique.name}</p>
                        {technique.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{technique.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTechnique(index)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={techniqueInput.name}
                  onChange={e => setTechniqueInput(prev => ({ ...prev, name: e.target.value }))}
                  className="rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                  placeholder="Technique name"
                />
                <input
                  value={techniqueInput.description ?? ""}
                  onChange={e => setTechniqueInput(prev => ({ ...prev, description: e.target.value }))}
                  className="rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                  placeholder="Short description"
                />
                <button
                  type="button"
                  onClick={addTechnique}
                  className="md:col-span-2 inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Save technique
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card/70 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Focus areas</h2>
              <div className="flex flex-wrap gap-2">
                {form.focusAreas.map(item => (
                  <span key={item} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                    {item}
                    <button type="button" onClick={() => handleRemoveTag("focusAreas", item)} className="text-muted-foreground hover:text-primary">
                      x
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={focusInput}
                  onChange={e => setFocusInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag("focusAreas", focusInput);
                      setFocusInput("");
                    }
                  }}
                  className="flex-1 rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                  placeholder="Add focus area and press Enter"
                />
                <button
                  type="button"
                  onClick={() => {
                    handleAddTag("focusAreas", focusInput);
                    setFocusInput("");
                  }}
                  className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card/70 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Team members</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {form.members.map((member, index) => (
                  <div key={`${member.name}-${index}`} className="rounded-2xl border border-border px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                        {(member.linkedin || member.website) && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {[member.linkedin, member.website].filter(Boolean).join(" - ")}
                          </p>
                        )}
                        {member.isLead && (
                          <span className="mt-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                            Lead
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMember(index)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={memberInput.name}
                  onChange={e => setMemberInput(prev => ({ ...prev, name: e.target.value }))}
                  className="rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                  placeholder="Member name"
                />
                <input
                  value={memberInput.role}
                  onChange={e => setMemberInput(prev => ({ ...prev, role: e.target.value }))}
                  className="rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                  placeholder="Role or title"
                />
                <input
                  value={memberInput.email ?? ""}
                  onChange={e => setMemberInput(prev => ({ ...prev, email: e.target.value }))}
                  className="rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                  placeholder="Email (optional)"
                />
                <input
                  value={memberInput.linkedin ?? ""}
                  onChange={e => setMemberInput(prev => ({ ...prev, linkedin: e.target.value }))}
                  className="rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                  placeholder="LinkedIn (optional)"
                />
                <input
                  value={memberInput.website ?? ""}
                  onChange={e => setMemberInput(prev => ({ ...prev, website: e.target.value }))}
                  className="rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                  placeholder="Website (optional)"
                />
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={memberInput.isLead ?? false}
                    onChange={e => setMemberInput(prev => ({ ...prev, isLead: e.target.checked }))}
                  />
                  Mark as team lead
                </label>
                <button
                  type="button"
                  onClick={addMember}
                  className="md:col-span-2 inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Save team member
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card/70 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Linked labs</h2>
              <p className="text-sm text-muted-foreground">
                Link requests require approval from the lab owner.
              </p>

              {linkedLabs.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {linkedLabs.map(lab => (
                    <div key={lab.id} className="rounded-2xl border border-border px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">{lab.name}</p>
                      {lab.city || lab.country ? (
                        <p className="text-xs text-muted-foreground">
                          {[lab.city, lab.country].filter(Boolean).join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {linkRequests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Pending & recent requests
                  </p>
                  {linkRequests.map(request => (
                    <div key={request.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-sm">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {request.labs?.name ?? `Lab #${request.lab_id}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Status: {request.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
                <div>
                  <label className="text-sm font-medium text-foreground">Request a lab link</label>
                  <select
                    value={requestLabId}
                    onChange={e => setRequestLabId(e.target.value ? Number(e.target.value) : "")}
                    className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm text-foreground"
                  >
                    <option value="">Choose a lab</option>
                    {availableLabs.map(lab => (
                      <option key={lab.id} value={lab.id}>
                        {lab.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={submitLinkRequest}
                  className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                  disabled={!isEditing}
                >
                  Send request
                </button>
              </div>
              {availableLabs.length === 0 && (
                <p className="text-sm text-muted-foreground">No new labs available to request.</p>
              )}
              {linkRequestError && <p className="text-sm text-destructive">{linkRequestError}</p>}
              {linkRequestSuccess && <p className="text-sm text-primary">{linkRequestSuccess}</p>}
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {success && <p className="mt-4 text-sm text-primary">{success}</p>}
      </div>
    </section>
  );
}
