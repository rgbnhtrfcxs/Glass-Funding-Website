// server/routes/admin.ts
import { type Express, type Request, type Response } from "express";
import { supabase } from "../supabaseClient.js";
import { setUserRoleSchema } from "@shared/organizations";
import { requireUserId, fetchProfileCapabilities } from "./shared/helpers.js";

export function registerAdminRoutes(app: Express): void {
  // =========================================================
  // ADMIN: Role management
  // =========================================================

  app.get("/api/admin/users/:userId/role", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAdmin) return res.status(403).json({ message: "Admin access required." });

      const { data, error } = await supabase
        .from("profiles")
        .select("role, is_admin")
        .eq("user_id", req.params.userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return res.status(404).json({ message: "User not found." });
      res.json({ role: (data as any).role ?? "user", isAdmin: (data as any).is_admin ?? false });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to get role." });
    }
  });

  app.put("/api/admin/users/:userId/role", async (req: Request, res: Response) => {
    try {
      const userId = await requireUserId(req, res);
      if (!userId) return;
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAdmin) return res.status(403).json({ message: "Admin access required." });

      const parsed = setUserRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid role." });
      }

      const newRole = parsed.data.role;
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole, is_admin: newRole === "admin" })
        .eq("user_id", req.params.userId);
      if (error) throw new Error(error.message);
      res.json({ role: newRole });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Failed to set role." });
    }
  });
}
