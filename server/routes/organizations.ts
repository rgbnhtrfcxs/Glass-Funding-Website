// server/routes/organizations.ts
import { type Express, type Request, type Response } from "express";
import { labStore } from "../labs-store.js";
import { organizationStore } from "../organizations-store.js";
import {
  insertOrganizationSchema,
  updateOrganizationSchema,
  addOrgMemberSchema,
} from "@shared/organizations";
import { requireUserId, fetchProfileCapabilities } from "./shared/helpers.js";

export function registerOrganizationRoutes(app: Express): void {
  // =========================================================
  // ORGANIZATIONS
  // =========================================================

  app.get("/api/organizations", async (_req: Request, res: Response) => {
    try {
      const orgs = await organizationStore.list();
      res.json(orgs);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to list organizations." });
    }
  });

  app.get("/api/my-organizations", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const orgs = await organizationStore.listForUser(userId);
      res.json(orgs);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to list your organizations." });
    }
  });

  app.post("/api/organizations", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canManageTeams && !profile?.isAdmin) {
        return res.status(403).json({ message: "You do not have permission to create organizations." });
      }
      const parsed = insertOrganizationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid organization data." });
      }
      const org = await organizationStore.create(parsed.data, userId);
      res.status(201).json(org);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to create organization." });
    }
  });

  app.get("/api/organizations/:slug", async (req: Request, res: Response) => {
    try {
      const org = await organizationStore.findBySlug(req.params.slug);
      if (!org) return res.status(404).json({ message: "Organization not found." });
      res.json(org);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to get organization." });
    }
  });

  app.put("/api/organizations/:id", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const orgId = Number(req.params.id);
      if (isNaN(orgId)) return res.status(400).json({ message: "Invalid organization ID." });

      const profile = await fetchProfileCapabilities(userId);
      const canEdit = profile?.isAdmin || (await organizationStore.isOwner(orgId, userId));
      if (!canEdit) return res.status(403).json({ message: "Not authorized to edit this organization." });

      const parsed = updateOrganizationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid organization data." });
      }
      const org = await organizationStore.update(orgId, parsed.data);
      res.json(org);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to update organization." });
    }
  });

  app.delete("/api/organizations/:id", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const orgId = Number(req.params.id);
      if (isNaN(orgId)) return res.status(400).json({ message: "Invalid organization ID." });

      const profile = await fetchProfileCapabilities(userId);
      const org = await organizationStore.findById(orgId);
      if (!org) return res.status(404).json({ message: "Organization not found." });
      const isOwner = (org as any).owner_user_id === userId;
      if (!profile?.isAdmin && !isOwner) {
        return res.status(403).json({ message: "Not authorized to delete this organization." });
      }
      await organizationStore.delete(orgId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to delete organization." });
    }
  });

  app.get("/api/organizations/:id/labs", async (req: Request, res: Response) => {
    try {
      const orgId = Number(req.params.id);
      if (isNaN(orgId)) return res.status(400).json({ message: "Invalid organization ID." });
      const labs = await organizationStore.listLabsByOrg(orgId);
      res.json(labs);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to list org labs." });
    }
  });

  app.post("/api/organizations/:id/members", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const orgId = Number(req.params.id);
      if (isNaN(orgId)) return res.status(400).json({ message: "Invalid organization ID." });

      const profile = await fetchProfileCapabilities(userId);
      const canManage = profile?.isAdmin || (await organizationStore.isManagerOrOwner(orgId, userId));
      if (!canManage) return res.status(403).json({ message: "Not authorized to manage members." });

      const parsed = addOrgMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid member data." });
      }
      const member = await organizationStore.addMember(orgId, parsed.data.userId, parsed.data.orgRole);
      res.status(201).json(member);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to add member." });
    }
  });

  app.delete("/api/organizations/:id/members/:memberId", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const orgId = Number(req.params.id);
      if (isNaN(orgId)) return res.status(400).json({ message: "Invalid organization ID." });

      const profile = await fetchProfileCapabilities(userId);
      const canManage =
        profile?.isAdmin ||
        req.params.memberId === userId ||
        (await organizationStore.isManagerOrOwner(orgId, userId));
      if (!canManage) return res.status(403).json({ message: "Not authorized to remove members." });

      await organizationStore.removeMember(orgId, req.params.memberId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to remove member." });
    }
  });

  // Link/unlink a lab to an organization (org manager, lab owner, or admin)
  app.put("/api/organizations/:id/labs/:labId", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const orgId = Number(req.params.id);
      const labId = Number(req.params.labId);
      if (isNaN(orgId) || isNaN(labId)) return res.status(400).json({ message: "Invalid ID." });

      const profile = await fetchProfileCapabilities(userId);
      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found." });

      const isLabOwner = (lab as any).owner_user_id === userId || (lab as any).ownerUserId === userId;
      const canManage = profile?.isAdmin || isLabOwner || (await organizationStore.isManagerOrOwner(orgId, userId));
      if (!canManage) return res.status(403).json({ message: "Not authorized to link this lab." });

      await organizationStore.setLabOrg(labId, orgId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to link lab." });
    }
  });

  app.delete("/api/organizations/:id/labs/:labId", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const orgId = Number(req.params.id);
      const labId = Number(req.params.labId);
      if (isNaN(orgId) || isNaN(labId)) return res.status(400).json({ message: "Invalid ID." });

      const profile = await fetchProfileCapabilities(userId);
      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found." });

      const isLabOwner = (lab as any).owner_user_id === userId || (lab as any).ownerUserId === userId;
      const canManage = profile?.isAdmin || isLabOwner || (await organizationStore.isManagerOrOwner(orgId, userId));
      if (!canManage) return res.status(403).json({ message: "Not authorized to unlink this lab." });

      await organizationStore.setLabOrg(labId, null);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to unlink lab." });
    }
  });
}
