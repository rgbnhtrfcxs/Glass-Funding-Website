// server/routes/teams.ts
import { type Express } from "express";
import { ZodError } from "zod";
import { supabase } from "../supabaseClient.js";
import { labStore } from "../labs-store.js";
import { teamStore } from "../teams-store.js";
import { insertTeamSchema, updateTeamSchema } from "@shared/teams";
import {
  authenticate,
  getOptionalUserIdFromAuthHeader,
  fetchProfileCapabilities,
  sanitizePublicTeam,
} from "./shared/helpers.js";

export function registerTeamRoutes(app: Express): void {
  // --------- Teams ----------
  app.get("/api/teams", async (req, res) => {
    const includeHiddenRequested = req.query.includeHidden === "true" || req.query.includeHidden === "1";
    let includeHidden = false;
    if (includeHiddenRequested) {
      const userId = await getOptionalUserIdFromAuthHeader(req);
      if (userId) {
        const profile = await fetchProfileCapabilities(userId);
        includeHidden = Boolean(profile?.isAdmin);
      }
    }
    const teams = includeHidden ? await teamStore.list() : await teamStore.listVisible();
    res.json(includeHidden ? teams : teams.map(sanitizePublicTeam));
  });

  app.get("/api/teams/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid team id" });
    }
    try {
      const team = await teamStore.findById(id);
      if (!team) return res.status(404).json({ message: "Team not found" });
      res.json(sanitizePublicTeam(team));
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load team" });
    }
  });

  app.post("/api/teams", authenticate, async (req, res) => {
    try {
      const ownerUserId = req.user?.id ?? null;
      const profile = await fetchProfileCapabilities(req.user?.id);
      if (!profile) {
        return res.status(403).json({ message: "Profile permissions not found for this account." });
      }
      if (!profile.canManageTeams) {
        return res.status(403).json({ message: "This account is not allowed to manage teams yet." });
      }
      if (!profile.canManageMultipleTeams) {
        const { count, error: countErr } = await supabase
          .from("teams")
          .select("id", { count: "exact", head: true })
          .eq("owner_user_id", ownerUserId);
        if (countErr) throw countErr;
        if ((count ?? 0) >= 1) {
          return res
            .status(403)
            .json({ message: "This account can manage only one team right now. Contact Glass to add more." });
        }
      }
      const payload = insertTeamSchema.parse({
        ...req.body,
        ownerUserId,
        labIds: [],
      });
      const team = await teamStore.create(payload);
      res.status(201).json(team);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid team payload" });
      }
      res.status(500).json({ message: "Unable to create team" });
    }
  });

  app.put("/api/teams/:id", authenticate, async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid team id" });
    }
    try {
      const existing = await teamStore.findById(id);
      if (!existing) return res.status(404).json({ message: "Team not found" });
      const profile = await fetchProfileCapabilities(req.user?.id);
      if (!profile) {
        return res.status(403).json({ message: "Profile permissions not found for this account." });
      }
      if (existing.ownerUserId !== req.user?.id) {
        return res.status(403).json({ message: "Not authorized to update this team" });
      }
      if (!profile.canManageTeams) {
        return res.status(403).json({ message: "This account is not allowed to manage teams yet." });
      }
      const sanitized = { ...req.body };
      delete sanitized.labIds;
      const updates = updateTeamSchema.parse(sanitized);
      const updated = await teamStore.update(id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid team update" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to update team" });
    }
  });

  app.delete("/api/teams/:id", authenticate, async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid team id" });
    }
    try {
      const existing = await teamStore.findById(id);
      if (!existing) return res.status(404).json({ message: "Team not found" });
      const profile = await fetchProfileCapabilities(req.user?.id);
      if (!profile) {
        return res.status(403).json({ message: "Profile permissions not found for this account." });
      }
      if (existing.ownerUserId !== req.user?.id) {
        return res.status(403).json({ message: "Not authorized to delete this team" });
      }
      if (!profile.canManageTeams) {
        return res.status(403).json({ message: "This account is not allowed to manage teams yet." });
      }
      await teamStore.delete(id);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to delete team" });
    }
  });

  app.get("/api/my-teams", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canManageTeams) {
        return res.status(403).json({ message: "This account is not enabled to manage teams yet." });
      }
      const teams = await teamStore.listByOwner(userId);
      res.json(teams);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load teams" });
    }
  });

  app.get("/api/my-team/:id", authenticate, async (req, res) => {
    try {
      const teamId = Number(req.params.id);
      if (Number.isNaN(teamId)) return res.status(400).json({ message: "Invalid team id" });
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canManageTeams) {
        return res.status(403).json({ message: "This account is not enabled to manage teams yet." });
      }
      const team = await teamStore.findById(teamId);
      if (!team || team.ownerUserId !== userId) return res.status(404).json({ message: "No team linked to this account" });
      res.json(team);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load team" });
    }
  });

  app.put("/api/my-team/:id", authenticate, async (req, res) => {
    try {
      const teamId = Number(req.params.id);
      if (Number.isNaN(teamId)) return res.status(400).json({ message: "Invalid team id" });
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canManageTeams) {
        return res.status(403).json({ message: "This account is not enabled to manage teams yet." });
      }
      const team = await teamStore.findById(teamId);
      if (!team || team.ownerUserId !== userId) return res.status(404).json({ message: "No team linked to this account" });
      const sanitized = { ...req.body };
      delete sanitized.labIds;
      const updates = updateTeamSchema.parse(sanitized);
      const updated = await teamStore.update(teamId, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid team update" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to update team" });
    }
  });

  app.delete("/api/my-team/:id", authenticate, async (req, res) => {
    try {
      const teamId = Number(req.params.id);
      if (Number.isNaN(teamId)) return res.status(400).json({ message: "Invalid team id" });
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const team = await teamStore.findById(teamId);
      if (!team || team.ownerUserId !== userId) return res.status(404).json({ message: "No team linked to this account" });
      await teamStore.delete(teamId);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to delete team" });
    }
  });

  app.get("/api/labs/:id/teams", async (req, res) => {
    const labId = Number(req.params.id);
    if (Number.isNaN(labId)) {
      return res.status(400).json({ message: "Invalid lab id" });
    }
    try {
      const teams = await teamStore.listByLabId(labId);
      res.json(teams.map(sanitizePublicTeam));
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load teams" });
    }
  });

  app.post("/api/teams/:id/link-requests", authenticate, async (req, res) => {
    const teamId = Number(req.params.id);
    if (Number.isNaN(teamId)) return res.status(400).json({ message: "Invalid team id" });
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const team = await teamStore.findById(teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });
      const profile = await fetchProfileCapabilities(userId);
      if (team.ownerUserId !== userId) {
        return res.status(403).json({ message: "Not authorized to request lab links" });
      }
      if (!profile?.canManageTeams) {
        return res.status(403).json({ message: "This account cannot manage teams." });
      }
      const labId = Number(req.body?.labId);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });

      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });

      const { data: existingLink } = await supabase
        .from("lab_team_links")
        .select("lab_id")
        .eq("lab_id", labId)
        .eq("team_id", teamId)
        .maybeSingle();
      if (existingLink) {
        return res.status(409).json({ message: "Team is already linked to this lab" });
      }

      const { data: existingRequest } = await supabase
        .from("lab_team_link_requests")
        .select("id, status")
        .eq("lab_id", labId)
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (existingRequest && existingRequest.status === "pending") {
        return res.status(409).json({ message: "A pending request already exists for this lab" });
      }

      const { data: inserted, error } = await supabase
        .from("lab_team_link_requests")
        .insert({
          lab_id: labId,
          team_id: teamId,
          requested_by_user_id: userId,
          status: "pending",
        })
        .select("id")
        .single();
      if (error || !inserted) throw error ?? new Error("Unable to create request");
      res.status(201).json({ id: inserted.id });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to create request" });
    }
  });

  app.get("/api/teams/:id/link-requests", authenticate, async (req, res) => {
    const teamId = Number(req.params.id);
    if (Number.isNaN(teamId)) return res.status(400).json({ message: "Invalid team id" });
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const team = await teamStore.findById(teamId);
      if (!team) return res.status(404).json({ message: "Team not found" });
      const profile = await fetchProfileCapabilities(userId);
      if (team.ownerUserId !== userId) {
        return res.status(403).json({ message: "Not authorized to view requests" });
      }
      if (!profile?.canManageTeams) {
        return res.status(403).json({ message: "This account cannot manage teams." });
      }
      const { data, error } = await supabase
        .from("lab_team_link_requests")
        .select("id, lab_id, status, created_at, responded_at, labs (id, name, lab_location (city, country))")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const mapped = (data ?? []).map(row => {
        const lab = (row as any).labs ?? null;
        const location = (Array.isArray(lab?.lab_location) ? lab.lab_location[0] : lab?.lab_location) ?? null;
        return {
          ...row,
          labs: lab
            ? {
                id: lab.id,
                name: lab.name,
                city: location?.city ?? null,
                country: location?.country ?? null,
              }
            : null,
        };
      });
      res.json(mapped);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load requests" });
    }
  });

  app.get("/api/labs/:id/team-link-requests", authenticate, async (req, res) => {
    const labId = Number(req.params.id);
    if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const profile = await fetchProfileCapabilities(userId);
      if (lab.ownerUserId !== userId) {
        return res.status(403).json({ message: "Not authorized to view requests" });
      }
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account cannot manage labs." });
      }
      const { data, error } = await supabase
        .from("lab_team_link_requests")
        .select("id, team_id, status, created_at, requested_by_user_id, teams (id, name, description_short, logo_url)")
        .eq("lab_id", labId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json(data ?? []);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load requests" });
    }
  });

  app.post("/api/labs/:id/team-link-requests/:requestId", authenticate, async (req, res) => {
    const labId = Number(req.params.id);
    const requestId = Number(req.params.requestId);
    if (Number.isNaN(labId) || Number.isNaN(requestId)) {
      return res.status(400).json({ message: "Invalid request" });
    }
    const status = (req.body?.status as string)?.toLowerCase();
    if (status !== "approved" && status !== "declined") {
      return res.status(400).json({ message: "Status must be approved or declined" });
    }
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const profile = await fetchProfileCapabilities(userId);
      if (lab.ownerUserId !== userId) {
        return res.status(403).json({ message: "Not authorized to update requests" });
      }
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account cannot manage labs." });
      }
      const { data: requestRow, error: reqError } = await supabase
        .from("lab_team_link_requests")
        .select("id, team_id, status")
        .eq("id", requestId)
        .eq("lab_id", labId)
        .maybeSingle();
      if (reqError) throw reqError;
      if (!requestRow) return res.status(404).json({ message: "Request not found" });
      if (requestRow.status !== "pending") {
        return res.status(409).json({ message: "Request already resolved" });
      }

      const { error: updateError } = await supabase
        .from("lab_team_link_requests")
        .update({ status, responded_at: new Date().toISOString() })
        .eq("id", requestId);
      if (updateError) throw updateError;

      if (status === "approved") {
        const { error: linkError } = await supabase
          .from("lab_team_links")
          .insert({ lab_id: labId, team_id: requestRow.team_id });
        if (linkError) throw linkError;
      }

      res.json({ status });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to update request" });
    }
  });
}
