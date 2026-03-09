// server/routes/auth.ts
import { type Express, type Request, type Response } from "express";
import { ZodError, z } from "zod";
import { supabase } from "../supabaseClient.js";
import { supabasePublic } from "../supabasePublicClient.js";
import {
  authenticate,
  getPasswordPolicyError,
  resolvePublicSiteOrigin,
  isMissingRelationError,
  errorToMessage,
  createRateLimiter,
} from "./shared/helpers.js";

export function registerAuthRoutes(app: Express): void {
  const signupRateLimit = createRateLimiter("signup", 8, 15 * 60 * 1000);
  const loginRateLimit = createRateLimiter("login", 20, 15 * 60 * 1000);

  // Legacy profile endpoints (archived for security hardening)
  const profileLegacyArchived = (_req: Request, res: Response) =>
    res.status(410).json({
      message: "This legacy profile endpoint is archived. Use /api/me/profile instead.",
    });

  app.get("/api/profile/:id", profileLegacyArchived);
  app.post("/api/profile/:id", profileLegacyArchived);

  // Signup
  app.post("/api/signup", signupRateLimit, async (req, res) => {
    try {
      const { email, password, display_name } = req.body;
      const normalizedEmail = typeof email === "string" ? email.trim() : "";
      const normalizedPassword = typeof password === "string" ? password : "";

      if (!normalizedEmail || !normalizedEmail.includes("@")) {
        return res.status(400).json({ message: "Use a valid email address." });
      }
      const passwordPolicyError = getPasswordPolicyError(normalizedPassword);
      if (passwordPolicyError) {
        return res.status(400).json({ message: passwordPolicyError });
      }

      const origin = resolvePublicSiteOrigin(req);

      const { data, error } = await supabasePublic.auth.signUp({
        email: normalizedEmail,
        password: normalizedPassword,
        options: {
          data: { display_name },
          emailRedirectTo: `${origin}/confirm-email`,
        },
      });

      if (error) throw error;

      res.status(201).json({ message: "Signup successful, check your email", user: data.user });
    } catch (err) {
      res.status(400).json({ message: err instanceof Error ? err.message : "Signup failed" });
    }
  });

  // Login
  app.post("/api/login", loginRateLimit, async (req, res) => {
    try {
      const { email, password } = req.body;
      const { data, error } = await supabasePublic.auth.signInWithPassword({ email, password });

      if (error) throw error;

      // Return the session/token
      res.json({
        message: "Login successful",
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        user: data.user,
      });
    } catch (err) {
      res.status(401).json({ message: err instanceof Error ? err.message : "Login failed" });
    }
  });

  // Legacy debug route archived
  app.get("/api/profile", (_req, res) => {
    res.status(410).json({ message: "This endpoint is archived. Use /api/me/profile instead." });
  });

  app.get("/api/me/profile", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,email,name,subscription_status,avatar_url")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;

      res.json({ profile: data ?? null });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load profile" });
    }
  });

  app.put("/api/me/profile", authenticate, async (req, res) => {
    const schema = z.object({
      name: z.string().optional().nullable(),
      avatarUrl: z.string().optional().nullable(),
    });
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const payload = schema.parse(req.body ?? {});

      const updates: Record<string, unknown> = {};
      if ("name" in payload) {
        const nextName = typeof payload.name === "string" ? payload.name.trim() : "";
        updates.name = nextName || null;
      }
      if ("avatarUrl" in payload) {
        const nextAvatar = typeof payload.avatarUrl === "string" ? payload.avatarUrl.trim() : "";
        updates.avatar_url = nextAvatar || null;
      }

      const { data: existing, error: existingError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existingError) throw existingError;

      if (existing?.user_id) {
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from("profiles")
            .update(updates)
            .eq("user_id", userId);
          if (updateError) throw updateError;
        }
      } else {
        const email = typeof req.user?.email === "string" ? req.user.email : null;
        if (!email) {
          return res.status(400).json({ message: "No email on authenticated user" });
        }
        const insertPayload: Record<string, unknown> = {
          user_id: userId,
          email,
          ...updates,
        };
        const { error: insertError } = await supabase.from("profiles").insert(insertPayload);
        if (insertError) throw insertError;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,email,name,subscription_status,avatar_url")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;

      res.json({ profile: data ?? null });
    } catch (err) {
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid profile payload" });
      }
      res.status(500).json({ message: errorToMessage(err, "Unable to save profile") });
    }
  });

  // --------- Account Deletion (GDPR) ----------
  app.delete("/api/account", authenticate, async (req, res) => {
    const userId = req.user?.id;
    const userEmail = typeof req.user?.email === "string" ? req.user.email.trim() : "";
    if (!userId) return res.status(400).json({ message: "No user on request" });

    const runCleanup = async (
      label: string,
      task: () => Promise<{ error: any } | void>,
    ) => {
      try {
        const result = await task();
        const maybeError = (result as any)?.error;
        if (maybeError) throw maybeError;
      } catch (error: any) {
        if (isMissingRelationError(error)) {
          console.info(`[account-delete] skipping ${label}: table missing`);
          return;
        }
        throw error;
      }
    };

    try {
      // Remove user-linked rows and detach ownership from shared/public entities.
      await runCleanup("lab_favorites", async () =>
        supabase.from("lab_favorites").delete().eq("user_id", userId),
      );
      await runCleanup("lab_views", async () =>
        supabase.from("lab_views").delete().eq("user_id", userId),
      );
      await runCleanup("lab_news", async () =>
        supabase.from("lab_news").update({ created_by: null }).eq("created_by", userId),
      );
      await runCleanup("labs ownership", async () =>
        supabase.from("labs").update({ owner_user_id: null }).eq("owner_user_id", userId),
      );
      await runCleanup("teams ownership", async () =>
        supabase.from("teams").update({ owner_user_id: null }).eq("owner_user_id", userId),
      );
      await runCleanup("team link requests", async () =>
        supabase.from("lab_team_link_requests").delete().eq("requested_by_user_id", userId),
      );
      if (userEmail) {
        await runCleanup("lab contact requests", async () =>
          supabase.from("lab_contact_requests").delete().ilike("requester_email", userEmail),
        );
        await runCleanup("lab collaborations", async () =>
          supabase.from("lab_collaborations").delete().ilike("contact_email", userEmail),
        );
      }
      await runCleanup("profile", async () =>
        supabase.from("profiles").delete().eq("user_id", userId),
      );

      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) throw authError;

      return res.status(204).end();
    } catch (error) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Unable to delete account",
      });
    }
  });
}
