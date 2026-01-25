import {
  insertTeamSchema,
  teamListSchema,
  teamSchema,
  updateTeamSchema,
  type InsertTeam,
  type Team,
  type TeamLab,
  type TeamMediaAsset,
  type UpdateTeam,
} from "@shared/teams";
import { supabase } from "./supabaseClient";

const TEAM_SELECT = `
  id,
  name,
  description_short,
  description_long,
  owner_user_id,
  logo_url,
  website,
  linkedin,
  field,
  is_visible,
  created_at,
  team_members (id, name, role, email, linkedin, website, is_lead),
  team_photos (name, url),
  team_equipment (item, is_priority),
  team_techniques (name, description),
  team_focus_areas (focus_area),
  lab_team_links (lab_id, labs (id, name, city, country, logo_url, subscription_tier))
`;

const TEAM_SELECT_BY_LAB = `
  id,
  name,
  description_short,
  description_long,
  owner_user_id,
  logo_url,
  website,
  linkedin,
  field,
  is_visible,
  created_at,
  team_members (id, name, role, email, linkedin, website, is_lead),
  team_photos (name, url),
  team_equipment (item, is_priority),
  team_techniques (name, description),
  team_focus_areas (focus_area),
  lab_team_links!inner (lab_id, labs (id, name, city, country, logo_url, subscription_tier))
`;

type TeamRow = {
  id: number;
  name: string;
  description_short: string | null;
  description_long: string | null;
  owner_user_id: string | null;
  logo_url: string | null;
  website: string | null;
  linkedin: string | null;
  field: string | null;
  is_visible: boolean | string | null;
  created_at: string;
  team_members: Array<{
    id: number;
    name: string;
    role: string;
    email: string | null;
    linkedin: string | null;
    website: string | null;
    is_lead: boolean | string | null;
  }> | null;
  team_photos: Array<{ name: string; url: string }> | null;
  team_equipment: Array<{ item: string; is_priority: boolean | string | null }> | null;
  team_techniques: Array<{ name: string; description: string | null }> | null;
  team_focus_areas: Array<{ focus_area: string }> | null;
  lab_team_links: Array<{
    lab_id: number | string;
    labs: {
      id: number;
      name: string;
      city: string | null;
      country: string | null;
      logo_url: string | null;
      subscription_tier: string | null;
    } | null;
  }> | null;
};

function parseBoolean(value: boolean | string | null | undefined, fallback = false): boolean {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = value.toString().toLowerCase();
  return normalized === "true" || normalized === "t" || normalized === "1";
}

function mapTeamRow(row: TeamRow): Team {
  const equipmentRows = row.team_equipment ?? [];
  const equipment = equipmentRows.map(item => item.item).filter(Boolean);
  const priorityEquipment = equipmentRows
    .filter(item => parseBoolean(item.is_priority, false))
    .map(item => item.item)
    .filter(Boolean);
  const labs: TeamLab[] = (row.lab_team_links ?? [])
    .map(link => link.labs)
    .filter((lab): lab is NonNullable<typeof lab> => Boolean(lab))
    .map(lab => ({
      id: Number(lab.id),
      name: lab.name,
      city: lab.city ?? null,
      country: lab.country ?? null,
      logoUrl: lab.logo_url ?? null,
      subscriptionTier: lab.subscription_tier ?? null,
    }));
  const labIds = (row.lab_team_links ?? [])
    .map(link => Number(link.lab_id))
    .filter(id => Number.isFinite(id));

  const mapped = {
    id: Number(row.id),
    name: row.name,
    descriptionShort: row.description_short ?? null,
    descriptionLong: row.description_long ?? null,
    ownerUserId: row.owner_user_id ?? null,
    logoUrl: row.logo_url ?? null,
    website: row.website ?? null,
    linkedin: row.linkedin ?? null,
    field: row.field ?? null,
    isVisible: parseBoolean(row.is_visible, true),
    equipment,
    priorityEquipment,
    techniques: (row.team_techniques ?? []).map(item => ({
      name: item.name,
      description: item.description ?? null,
    })),
    focusAreas: (row.team_focus_areas ?? []).map(item => item.focus_area),
    members: (row.team_members ?? [])
      .map(member => ({
        id: member.id,
        name: member.name,
        role: member.role,
        email: member.email ?? null,
        linkedin: member.linkedin ?? null,
        website: member.website ?? null,
        isLead: parseBoolean(member.is_lead, false),
      }))
      .sort((a, b) => Number(b.isLead) - Number(a.isLead) || a.name.localeCompare(b.name)),
    labIds,
    labs,
    photos: (row.team_photos ?? []).filter(photo => (photo?.url || "").trim().length > 0),
  };

  return teamSchema.parse(mapped);
}

async function replaceTeamMembers(teamId: number, members: InsertTeam["members"]) {
  const del = await supabase.from("team_members").delete().eq("team_id", teamId);
  if (del.error) throw del.error;
  if (!members.length) return;
  const ins = await supabase.from("team_members").insert(
    members.map(member => ({
      team_id: teamId,
      name: member.name,
      role: member.role,
      email: member.email ?? null,
      linkedin: member.linkedin ?? null,
      website: member.website ?? null,
      is_lead: member.isLead ?? false,
    })),
  );
  if (ins.error) throw ins.error;
}

async function replaceTeamPhotos(teamId: number, photos: TeamMediaAsset[]) {
  const del = await supabase.from("team_photos").delete().eq("team_id", teamId);
  if (del.error) throw del.error;
  if (!photos.length) return;
  const ins = await supabase
    .from("team_photos")
    .insert(photos.map(photo => ({ team_id: teamId, name: photo.name, url: photo.url })));
  if (ins.error) throw ins.error;
}

async function replaceTeamEquipment(teamId: number, equipment: string[], priorityEquipment: string[] = []) {
  const del = await supabase.from("team_equipment").delete().eq("team_id", teamId);
  if (del.error) throw del.error;
  if (!equipment.length) return;
  const prioritySet = new Set(priorityEquipment);
  const ins = await supabase
    .from("team_equipment")
    .insert(equipment.map(item => ({ team_id: teamId, item, is_priority: prioritySet.has(item) })));
  if (ins.error) throw ins.error;
}

async function replaceTeamTechniques(teamId: number, techniques: InsertTeam["techniques"]) {
  const del = await supabase.from("team_techniques").delete().eq("team_id", teamId);
  if (del.error) throw del.error;
  if (!techniques.length) return;
  const ins = await supabase
    .from("team_techniques")
    .insert(
      techniques.map(technique => ({
        team_id: teamId,
        name: technique.name,
        description: technique.description ?? null,
      })),
    );
  if (ins.error) throw ins.error;
}

async function replaceTeamFocusAreas(teamId: number, focusAreas: InsertTeam["focusAreas"]) {
  const del = await supabase.from("team_focus_areas").delete().eq("team_id", teamId);
  if (del.error) throw del.error;
  if (!focusAreas.length) return;
  const ins = await supabase
    .from("team_focus_areas")
    .insert(focusAreas.map(area => ({ team_id: teamId, focus_area: area })));
  if (ins.error) throw ins.error;
}

async function replaceTeamLabLinks(teamId: number, labIds: number[]) {
  const del = await supabase.from("lab_team_links").delete().eq("team_id", teamId);
  if (del.error) throw del.error;
  if (!labIds.length) return;
  const ins = await supabase.from("lab_team_links").insert(
    labIds.map(labId => ({ team_id: teamId, lab_id: labId })),
  );
  if (ins.error) throw ins.error;
}

async function writeTeamRelations(teamId: number, team: InsertTeam | Team) {
  await replaceTeamMembers(teamId, team.members ?? []);
  await replaceTeamPhotos(teamId, team.photos ?? []);
  await replaceTeamEquipment(teamId, team.equipment ?? [], team.priorityEquipment ?? []);
  await replaceTeamTechniques(teamId, team.techniques ?? []);
  await replaceTeamFocusAreas(teamId, team.focusAreas ?? []);
  await replaceTeamLabLinks(teamId, team.labIds ?? []);
}

export class TeamStore {
  async list(): Promise<Team[]> {
    const { data, error } = await supabase.from("teams").select(TEAM_SELECT).order("id", { ascending: true });
    if (error) throw error;
    const teams = (data as TeamRow[] | null) ?? [];
    return teamListSchema.parse(teams.map(mapTeamRow));
  }

  async listVisible(): Promise<Team[]> {
    const { data, error } = await supabase
      .from("teams")
      .select(TEAM_SELECT)
      .eq("is_visible", true)
      .order("id", { ascending: true });
    if (error) throw error;
    const teams = (data as TeamRow[] | null) ?? [];
    return teamListSchema.parse(teams.map(mapTeamRow));
  }

  async findById(id: number): Promise<Team | undefined> {
    const { data, error } = await supabase.from("teams").select(TEAM_SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return mapTeamRow(data as TeamRow);
  }

  async listByOwner(ownerUserId: string): Promise<Team[]> {
    const { data, error } = await supabase
      .from("teams")
      .select(TEAM_SELECT)
      .eq("owner_user_id", ownerUserId)
      .order("id", { ascending: true });
    if (error) throw error;
    const teams = (data as TeamRow[] | null) ?? [];
    return teamListSchema.parse(teams.map(mapTeamRow));
  }

  async listByLabId(labId: number): Promise<Team[]> {
    const { data, error } = await supabase
      .from("teams")
      .select(TEAM_SELECT_BY_LAB)
      .eq("lab_team_links.lab_id", labId)
      .order("id", { ascending: true });
    if (error) throw error;
    const teams = (data as TeamRow[] | null) ?? [];
    return teamListSchema.parse(teams.map(mapTeamRow));
  }

  async create(payload: InsertTeam): Promise<Team> {
    const data = insertTeamSchema.parse(payload);
    const { data: inserted, error } = await supabase
      .from("teams")
      .insert({
        name: data.name,
        description_short: data.descriptionShort ?? null,
        description_long: data.descriptionLong ?? null,
        owner_user_id: data.ownerUserId ?? null,
        logo_url: data.logoUrl ?? null,
        website: data.website ?? null,
        linkedin: data.linkedin ?? null,
        field: data.field ?? null,
        is_visible: data.isVisible,
      })
      .select("id")
      .single();
    if (error || !inserted) throw error ?? new Error("Failed to insert team");

    const teamId = Number(inserted.id);
    await writeTeamRelations(teamId, data);
    const team = await this.findById(teamId);
    if (!team) throw new Error("Team not found after creation");
    return team;
  }

  async update(id: number, updates: UpdateTeam): Promise<Team> {
    const existing = await this.findById(id);
    if (!existing) throw new Error("Team not found");
    const parsed = updateTeamSchema.parse(updates);

    const baseUpdates: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(updates, "name")) baseUpdates.name = parsed.name;
    if (Object.prototype.hasOwnProperty.call(updates, "descriptionShort")) baseUpdates.description_short = parsed.descriptionShort ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "descriptionLong")) baseUpdates.description_long = parsed.descriptionLong ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "ownerUserId")) baseUpdates.owner_user_id = parsed.ownerUserId ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "logoUrl")) baseUpdates.logo_url = parsed.logoUrl ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "website")) baseUpdates.website = parsed.website ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "linkedin")) baseUpdates.linkedin = parsed.linkedin ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "field")) baseUpdates.field = parsed.field ?? null;
    if (Object.prototype.hasOwnProperty.call(updates, "isVisible")) baseUpdates.is_visible = parsed.isVisible;

    if (Object.keys(baseUpdates).length) {
      const { error } = await supabase.from("teams").update(baseUpdates).eq("id", id);
      if (error) throw error;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "members")) {
      await replaceTeamMembers(id, parsed.members ?? []);
    }
    if (Object.prototype.hasOwnProperty.call(updates, "equipment") ||
        Object.prototype.hasOwnProperty.call(updates, "priorityEquipment")) {
      const equipment = Object.prototype.hasOwnProperty.call(updates, "equipment")
        ? parsed.equipment ?? []
        : existing.equipment ?? [];
      const priority = Object.prototype.hasOwnProperty.call(updates, "priorityEquipment")
        ? parsed.priorityEquipment ?? []
        : existing.priorityEquipment ?? [];
      await replaceTeamEquipment(id, equipment, priority);
    }
    if (Object.prototype.hasOwnProperty.call(updates, "techniques")) {
      await replaceTeamTechniques(id, parsed.techniques ?? []);
    }
    if (Object.prototype.hasOwnProperty.call(updates, "focusAreas")) {
      await replaceTeamFocusAreas(id, parsed.focusAreas ?? []);
    }
    if (Object.prototype.hasOwnProperty.call(updates, "labIds")) {
      await replaceTeamLabLinks(id, parsed.labIds ?? []);
    }

    const team = await this.findById(id);
    if (!team) throw new Error("Team not found after update");
    return team;
  }

  async delete(id: number): Promise<void> {
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) throw error;
  }
}

export const teamStore = new TeamStore();
