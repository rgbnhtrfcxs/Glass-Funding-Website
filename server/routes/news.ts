// server/routes/news.ts
import { type Express } from "express";
import { ZodError, z } from "zod";
import { supabase } from "../supabaseClient.js";
import { labStore } from "../labs-store.js";
import { authenticate, fetchProfileCapabilities } from "./shared/helpers.js";

const insertNewsSchema = z.object({
  labId: z.number(),
  title: z.string().min(1, "Title is required"),
  summary: z.string().min(1, "Summary is required"),
  category: z.string().default("update"),
  images: z
    .array(
      z.object({
        url: z.string().url("Image URL must be valid"),
        name: z.string().min(1),
      }),
    )
    .max(4)
    .optional()
    .default([]),
  authorId: z.string().uuid().nullable().optional(),
});

export function registerNewsRoutes(app: Express): void {
  // --------- Lab News (premier) ----------
  app.post("/api/news", authenticate, async (req, res) => {
    try {
      const payload = insertNewsSchema.parse(req.body);
      const requesterUserId = req.user?.id;
      if (!requesterUserId) return res.status(400).json({ message: "No user on request" });
      const requesterProfile = await fetchProfileCapabilities(requesterUserId);
      if (!requesterProfile) {
        return res.status(403).json({ message: "Profile permissions not found for this account." });
      }

      const lab = await labStore.findById(payload.labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const ownerUserId = lab.ownerUserId ?? null;
      if (!ownerUserId) {
        return res.status(403).json({ message: "Only claimed labs can post news right now." });
      }
      const ownerProfile = await fetchProfileCapabilities(ownerUserId);
      if (!ownerProfile?.canCreateLab) {
        return res.status(403).json({ message: "News is available to lab owners only." });
      }
      if (lab.labStatus !== "premier") {
        return res.status(403).json({ message: "News is available for premier labs only." });
      }
      const isOwner = ownerUserId === requesterUserId;
      if (!isOwner && !requesterProfile.isAdmin) {
        return res.status(403).json({ message: "Not allowed to post for this lab" });
      }
      if (!requesterProfile.isAdmin && payload.authorId && payload.authorId !== requesterUserId) {
        return res.status(403).json({ message: "Not allowed to post for this lab" });
      }

      const { data, error } = await supabase
        .from("lab_news")
        .insert({
          lab_id: payload.labId,
          title: payload.title,
          summary: payload.summary,
          category: payload.category ?? "update",
          images: payload.images ?? [],
          created_by: requesterProfile.isAdmin ? (payload.authorId ?? requesterUserId) : requesterUserId,
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;
      res.status(201).json(data);
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid news payload" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to post news" });
    }
  });

  app.get("/api/news/mine", authenticate, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("lab_news")
        .select("id, lab_id, title, summary, category, images, status, created_at, labs!inner(name, lab_status, owner_user_id)")
        .eq("labs.owner_user_id", req.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json({ news: data ?? [] });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load news" });
    }
  });

  app.get("/api/news/public", async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from("lab_news")
        .select("id, lab_id, title, summary, category, images, status, created_at, labs:lab_id (name, lab_status)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      res.json({ news: data ?? [] });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load news" });
    }
  });
}
