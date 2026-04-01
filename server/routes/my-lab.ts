// server/routes/my-lab.ts
import { type Express } from "express";
import { ZodError } from "zod";
import { supabase } from "../supabaseClient.js";
import { labStore } from "../labs-store.js";
import { sendMail } from "../mailer.js";
import {
  authenticate,
  fetchProfileCapabilities,
  isMissingRelationError,
  errorToMessage,
  normalizeLabStatus,
  parseNullableBoolean,
  viewedNotifyCache,
} from "./shared/helpers.js";
import { listLabIdsForUser } from "./shared/stripe-helpers.js";

export function registerMyLabRoutes(app: Express): void {
  // Lab manager endpoints: manage only labs tied to owner_user_id.
  app.get("/api/my-lab", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      const { data: labRow, error: labError } = await supabase.from("labs").select("id").eq("owner_user_id", userId).maybeSingle();
      if (labError) throw labError;
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      const lab = await labStore.findById(Number(labRow.id));
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      res.json(lab);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load lab" });
    }
  });

  app.get("/api/my-labs", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      const labIds = await listLabIdsForUser(userId);
      if (!labIds.length) return res.json([]);

      const { data, error } = await supabase
        .from("labs")
        .select(
          [
            "id",
            "name",
            "is_visible",
            "lab_status",
            "org_role",
            "lab_erc_disciplines (erc_code, is_primary, erc_disciplines (code, domain, title))",
            "lab_profile (logo_url, alternate_names)",
            "lab_location (city, country)",
            "lab_photos (url, name)",
            "lab_equipment (item, is_priority)",
          ].join(","),
        )
        .in("id", labIds);
      if (error) throw error;

      const mapped = ((data as unknown as any[]) ?? []).map(row => {
        const pickOne = (value: any) => (Array.isArray(value) ? value[0] : value) ?? null;
        const profileRow = pickOne((row as any).lab_profile);
        const locationRow = pickOne((row as any).lab_location);
        const ercRows = (row as any).lab_erc_disciplines ?? [];
        const ercCodes = Array.from(
          new Set(
            ercRows
              .map((item: any) => (typeof item?.erc_code === "string" ? item.erc_code.trim().toUpperCase() : ""))
              .filter((code: string) => /^(PE(1[0-1]|[1-9])|LS[1-9]|SH[1-8])$/.test(code)),
          ),
        );
        const primaryErc = ercRows.find((item: any) => item?.is_primary)?.erc_code ?? null;
        const ercDisciplines = ercRows
          .map((item: any) => {
            const rel = Array.isArray(item?.erc_disciplines) ? item.erc_disciplines[0] : item?.erc_disciplines;
            const code = typeof rel?.code === "string" ? rel.code.trim().toUpperCase() : "";
            const domain = typeof rel?.domain === "string" ? rel.domain.trim().toUpperCase() : "";
            const title = typeof rel?.title === "string" ? rel.title.trim() : "";
            if (!/^(PE(1[0-1]|[1-9])|LS[1-9]|SH[1-8])$/.test(code)) return null;
            if (!["PE", "LS", "SH"].includes(domain)) return null;
            if (!title) return null;
            return { code, domain, title };
          })
          .filter((item: any): item is { code: string; domain: string; title: string } => Boolean(item));
        return {
          id: row.id,
          name: row.name,
          lab_status: (row as any).lab_status ?? null,
          city: locationRow?.city ?? null,
          country: locationRow?.country ?? null,
          logo_url: profileRow?.logo_url ?? null,
          alternate_names: profileRow?.alternate_names ?? [],
          org_role: (row as any).org_role ?? null,
          erc_discipline_codes: ercCodes,
          primary_erc_discipline_code: typeof primaryErc === "string" ? primaryErc.toUpperCase() : null,
          erc_disciplines: ercDisciplines,
          is_visible: (row as any).is_visible ?? null,
          lab_photos: (row as any).lab_photos ?? [],
          lab_equipment: (row as any).lab_equipment ?? [],
        };
      });

      res.json(mapped);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load labs" });
    }
  });

  app.get("/api/my-labs/certificates", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const labIds = await listLabIdsForUser(userId);
      if (!labIds.length) return res.json([]);

      const { data, error } = await supabase
        .from("lab_verification_certificates")
        .select("id, lab_id, glass_id, issued_at, pdf_url, created_at, updated_at")
        .in("lab_id", labIds);
      if (error) throw error;

      res.json(data ?? []);
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.json([]);
      }
      res.status(500).json({ message: errorToMessage(error, "Unable to load verification certificates") });
    }
  });

  app.get("/api/my-lab/analytics", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const { data: labRow, error: labError } = await supabase
        .from("labs")
        .select("id, lab_status")
        .eq("owner_user_id", userId)
        .maybeSingle();
      if (labError) throw labError;
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      const labId = Number((labRow as any).id);
      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const profile = await fetchProfileCapabilities(userId);
      const canAccess = profile?.canCreateLab;
      if (!canAccess) {
        return res.status(403).json({ message: "Analytics are not enabled for this account yet." });
      }

      const now = new Date();
      const from7 = new Date(now);
      from7.setDate(from7.getDate() - 7);
      const from30 = new Date(now);
      from30.setDate(from30.getDate() - 30);

      const [{ count: views7 }, { count: views30 }, { data: favs }, { data: recentFavs, error: recentFavErr }] = await Promise.all([
        supabase.from("lab_views").select("id", { count: "exact", head: true }).eq("lab_id", labId).gte("created_at", from7.toISOString()),
        supabase.from("lab_views").select("id", { count: "exact", head: true }).eq("lab_id", labId).gte("created_at", from30.toISOString()),
        supabase.from("lab_favorites").select("id", { count: "exact", head: true }).eq("lab_id", labId),
        supabase
          .from("lab_favorites")
          .select("lab_id, user_id, created_at")
          .eq("lab_id", labId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (recentFavErr) throw recentFavErr;

      res.json({
        labId,
        views7d: views7 ?? 0,
        views30d: views30 ?? 0,
        favorites: (favs as any)?.count ?? 0,
        recentFavorites: (recentFavs ?? []).map(row => ({
          labId: labId,
          userId: row.user_id,
          createdAt: row.created_at,
        })),
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load analytics" });
    }
  });

  app.get("/api/my-lab/:id", authenticate, async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      // owner match first
      const { data: labRow, error: labError } = await supabase
        .from("labs")
        .select("id")
        .eq("id", labId)
        .eq("owner_user_id", userId)
        .maybeSingle();
      if (labError) throw labError;
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      const lab = await labStore.findById(labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      res.json(lab);
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load lab" });
    }
  });

  app.put("/api/my-lab/:id", authenticate, async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      const { data: labRow, error: labError } = await supabase
        .from("labs")
        .select("id")
        .eq("id", labId)
        .eq("owner_user_id", userId)
        .maybeSingle();
      if (labError) throw labError;
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      const updates = { ...(req.body ?? {}) } as Record<string, unknown>;
      const requestedOwnerCamel = updates.ownerUserId;
      const requestedOwnerSnake = updates.owner_user_id;
      if (requestedOwnerCamel !== undefined && requestedOwnerCamel !== userId) {
        return res.status(403).json({ message: "Not authorized to transfer lab ownership" });
      }
      if (requestedOwnerSnake !== undefined && requestedOwnerSnake !== userId) {
        return res.status(403).json({ message: "Not authorized to transfer lab ownership" });
      }
      delete updates.ownerUserId;
      delete updates.owner_user_id;

      const updated = await labStore.update(labId, updates);
      res.json(updated);
    } catch (err) {
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid lab update" });
      }
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to update lab" });
    }
  });

  app.delete("/api/my-lab/:id", authenticate, async (req, res) => {
    try {
      const labId = Number(req.params.id);
      if (Number.isNaN(labId)) return res.status(400).json({ message: "Invalid lab id" });
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      const { data: labRow, error: labError } = await supabase
        .from("labs")
        .select("id")
        .eq("id", labId)
        .eq("owner_user_id", userId)
        .maybeSingle();
      if (labError) throw labError;
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      await labStore.delete(labId);
      res.status(204).end();
    } catch (err) {
      if (err instanceof Error && err.message === "Lab not found") {
        return res.status(404).json({ message: err.message });
      }
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to delete lab" });
    }
  });

  app.get("/api/my-labs/analytics", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const labIds = await listLabIdsForUser(userId);
      if (!labIds.length) return res.json({ labs: [] });

      const { data: labs, error: labsError } = await supabase
        .from("labs")
        .select("id, name, is_visible, lab_status, owner_user_id")
        .in("id", labIds);
      if (labsError) throw labsError;
      if (!labs || labs.length === 0) return res.json({ labs: [] });

      const profile = await fetchProfileCapabilities(userId);
      const canAccess = profile?.canCreateLab;
      if (!canAccess) {
        return res.status(403).json({ message: "Analytics are not enabled for this account yet." });
      }

      const labIdList = labs.map(l => Number(l.id)).filter(id => !Number.isNaN(id));
      if (!labIdList.length) return res.json({ labs: [] });

      const now = new Date();
      const from7 = new Date(now);
      from7.setDate(from7.getDate() - 7);
      const from30 = new Date(now);
      from30.setDate(from30.getDate() - 30);

      const [view7, view30, favs] = await Promise.all([
        supabase.from("lab_views").select("lab_id").in("lab_id", labIdList).gte("created_at", from7.toISOString()),
        supabase.from("lab_views").select("lab_id").in("lab_id", labIdList).gte("created_at", from30.toISOString()),
        supabase.from("lab_favorites").select("lab_id").in("lab_id", labIdList),
      ]);

      const toMap = (rows?: { lab_id: number }[] | null) => {
        const map: Record<number, number> = {};
        (rows ?? []).forEach(row => {
          const id = Number(row.lab_id);
          if (!Number.isNaN(id)) map[id] = (map[id] || 0) + 1;
        });
        return map;
      };

      const view7Map = toMap(view7?.data as any);
      const view30Map = toMap(view30?.data as any);
      const favMap = toMap(favs?.data as any);

      res.json({
        labs: labs.map(lab => ({
          id: lab.id,
          name: lab.name,
          isVisible: lab.is_visible,
          labStatus: (lab as any).lab_status ?? null,
          views7d: view7Map[lab.id] ?? 0,
          views30d: view30Map[lab.id] ?? 0,
          favorites: favMap[lab.id] ?? 0,
        })),
      });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load analytics" });
    }
  });

  app.get("/api/inbox-notifications/preferences", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const [{ data: profileRow, error: profileError }, { data: labs, error: labsError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("inbox_email_notifications_enabled")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("labs")
          .select("lab_status")
          .eq("owner_user_id", userId),
      ]);
      if (profileError) throw profileError;
      if (labsError) throw labsError;

      const normalizedStatuses = (labs ?? []).map(row => normalizeLabStatus((row as any).lab_status));
      const allVerifiedPassive = normalizedStatuses.length > 0 && normalizedStatuses.every(status => status === "verified_passive");
      const defaultEnabled = !allVerifiedPassive;
      const storedPreference = parseNullableBoolean((profileRow as any)?.inbox_email_notifications_enabled);
      const enabled = storedPreference ?? defaultEnabled;

      res.json({
        enabled,
        storedPreference,
        defaultEnabled,
      });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load notification preferences" });
    }
  });

  app.put("/api/inbox-notifications/preferences", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const enabled = req.body?.enabled;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ message: "enabled must be a boolean" });
      }

      const { data: existing, error: existingError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (existingError) throw existingError;

      if (existing?.user_id) {
        const { error } = await supabase
          .from("profiles")
          .update({ inbox_email_notifications_enabled: enabled })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const email = typeof req.user?.email === "string" ? req.user.email : null;
        if (!email) {
          return res.status(400).json({ message: "No email on authenticated user" });
        }
        const { error } = await supabase
          .from("profiles")
          .insert({
            user_id: userId,
            email,
            inbox_email_notifications_enabled: enabled,
          });
        if (error) throw error;
      }

      res.json({
        enabled,
        storedPreference: enabled,
      });
    } catch (err) {
      res.status(500).json({ message: errorToMessage(err, "Unable to save notification preferences") });
    }
  });

  app.get("/api/my-labs/requests", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const labIds = await listLabIdsForUser(userId);
      if (!labIds.length) return res.json({ labs: [], collaborations: [], contacts: [] });

      const { data: labs, error: labsError } = await supabase
        .from("labs")
        .select("id, name, owner_user_id")
        .in("id", labIds);
      if (labsError) throw labsError;
      if (!labs || labs.length === 0) return res.json({ labs: [], collaborations: [], contacts: [] });

      const labNames = labs.map(l => l.name).filter(Boolean);
      const labIdList = labs.map(l => Number(l.id)).filter(id => !Number.isNaN(id));
      if (!labIdList.length && !labNames.length) return res.json({ labs, collaborations: [], contacts: [] });

      const collaborationColumns = [
        "id",
        "lab_id",
        "lab_name",
        "contact_name",
        "contact_email",
        "preferred_contact",
        "target_labs",
        "collaboration_focus",
        "resources_offered",
        "desired_timeline",
        "additional_notes",
        "created_at",
      ].join(",");
      const contactColumns = [
        "id",
        "lab_id",
        "lab_name",
        "contact_name",
        "contact_email",
        "requester_name",
        "requester_email",
        "preferred_contact_methods",
        "message",
        "type",
        "organization",
        "created_at",
      ].join(",");

      const { data: collabsById, error: collabsByIdError } = await supabase
        .from("lab_collaborations")
        .select(collaborationColumns)
        .in("lab_id", labIdList)
        .order("created_at", { ascending: false });
      if (collabsByIdError) throw collabsByIdError;

      const { data: contactsById, error: contactsByIdError } = await supabase
        .from("lab_contact_requests")
        .select(contactColumns)
        .in("lab_id", labIdList)
        .order("created_at", { ascending: false });
      if (contactsByIdError) throw contactsByIdError;

      let collabsByNameLegacy: any[] = [];
      let contactsByNameLegacy: any[] = [];
      if (labNames.length) {
        const { data: collabNameRows, error: collabNameError } = await supabase
          .from("lab_collaborations")
          .select(collaborationColumns)
          .is("lab_id", null)
          .in("lab_name", labNames)
          .order("created_at", { ascending: false });
        if (collabNameError) throw collabNameError;
        collabsByNameLegacy = collabNameRows ?? [];

        const { data: contactNameRows, error: contactNameError } = await supabase
          .from("lab_contact_requests")
          .select(contactColumns)
          .is("lab_id", null)
          .in("lab_name", labNames)
          .order("created_at", { ascending: false });
        if (contactNameError) throw contactNameError;
        contactsByNameLegacy = contactNameRows ?? [];
      }

      const dedupeAndSort = (rows: any[]) => {
        const seen = new Set<string>();
        return rows
          .filter(row => {
            const key =
              row?.id !== undefined && row?.id !== null
                ? String(row.id)
                : `${row?.lab_id ?? ""}|${row?.lab_name ?? ""}|${row?.contact_email ?? row?.requester_email ?? ""}|${row?.created_at ?? ""}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .sort((a, b) => {
            const aTs = a?.created_at ? new Date(a.created_at).getTime() : 0;
            const bTs = b?.created_at ? new Date(b.created_at).getTime() : 0;
            return bTs - aTs;
          });
      };

      const filteredCollabs = dedupeAndSort([...(collabsById ?? []), ...collabsByNameLegacy]);
      const filteredContacts = dedupeAndSort([...(contactsById ?? []), ...contactsByNameLegacy]).map(row => ({
        id: row?.id ?? null,
        lab_id: row?.lab_id ?? null,
        lab_name: row?.lab_name ?? null,
        contact_name: row?.contact_name ?? row?.requester_name ?? null,
        contact_email: row?.contact_email ?? row?.requester_email ?? null,
        preferred_contact: Array.isArray(row?.preferred_contact_methods)
          ? row.preferred_contact_methods[0] ?? null
          : null,
        message: row?.message ?? null,
        type: row?.type ?? null,
        organization: row?.organization ?? null,
        created_at: row?.created_at ?? null,
      }));

      res.json({
        labs,
        collaborations: filteredCollabs,
        contacts: filteredContacts,
      });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to load requests" });
    }
  });

  app.post("/api/my-labs/requests/viewed", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.canCreateLab && !profile?.isAdmin) {
        return res.status(403).json({ message: "This account is not enabled to manage labs yet." });
      }

      const contactEmail = typeof req.body?.contactEmail === "string" ? req.body.contactEmail.trim().toLowerCase() : "";
      const labName = typeof req.body?.labName === "string" ? req.body.labName.trim() : "";
      const type = typeof req.body?.type === "string" ? req.body.type.trim() : "request";
      if (!contactEmail) return res.status(400).json({ message: "Missing contact email" });
      if (!labName) return res.status(400).json({ message: "Missing lab name" });

      const labIds = await listLabIdsForUser(userId);
      if (!labIds.length) {
        return res.status(403).json({ message: "No lab linked to this account" });
      }
      const { data: ownedLabs, error: ownedLabsError } = await supabase
        .from("labs")
        .select("id, name")
        .in("id", labIds);
      if (ownedLabsError) throw ownedLabsError;
      const ownedIdSet = new Set((ownedLabs ?? []).map(row => Number(row.id)).filter(id => !Number.isNaN(id)));
      const ownedNameSet = new Set((ownedLabs ?? []).map(row => String(row.name || "").trim().toLowerCase()).filter(Boolean));
      const normalizedLabName = labName.toLowerCase();
      if (!ownedNameSet.has(normalizedLabName)) {
        return res.status(403).json({ message: "Not authorized to notify contacts for this lab" });
      }

      const [collaborationMatches, requesterMatches] = await Promise.all([
        supabase
          .from("lab_collaborations")
          .select("id, lab_id, lab_name, contact_email")
          .eq("contact_email", contactEmail)
          .limit(50),
        supabase
          .from("lab_contact_requests")
          .select("id, lab_id, lab_name, requester_email")
          .eq("requester_email", contactEmail)
          .limit(50),
      ]);
      if (collaborationMatches.error) throw collaborationMatches.error;
      if (requesterMatches.error) throw requesterMatches.error;

      let contactMatchesByContactEmail: Array<{ id: number; lab_id: number | null; lab_name: string | null; contact_email: string | null }> = [];
      const contactEmailMatchResult = await supabase
        .from("lab_contact_requests")
        .select("id, lab_id, lab_name, contact_email")
        .eq("contact_email", contactEmail)
        .limit(50);
      if (contactEmailMatchResult.error) {
        const message = String(contactEmailMatchResult.error.message ?? "").toLowerCase();
        if (!message.includes("contact_email")) {
          throw contactEmailMatchResult.error;
        }
      } else {
        contactMatchesByContactEmail = contactEmailMatchResult.data ?? [];
      }

      const belongsToOwnedLab = (row: { lab_id?: number | null; lab_name?: string | null }) => {
        const rowLabId = Number(row.lab_id);
        const rowLabName = String(row.lab_name || "").trim().toLowerCase();
        const matchesOwnedLab = (!Number.isNaN(rowLabId) && ownedIdSet.has(rowLabId)) || ownedNameSet.has(rowLabName);
        return matchesOwnedLab && rowLabName === normalizedLabName;
      };
      const canNotify = [
        ...(collaborationMatches.data ?? []),
        ...(requesterMatches.data ?? []),
        ...contactMatchesByContactEmail,
      ].some(row => belongsToOwnedLab(row));
      if (!canNotify) {
        return res.status(403).json({ message: "Not authorized to notify this contact" });
      }

      // One notification per (email + labName + type) per runtime
      const cacheKey = `${(contactEmail || "").toLowerCase()}|${(labName || "").toLowerCase()}|${type || "request"}`;
      if (viewedNotifyCache.has(cacheKey)) {
        return res.json({ ok: true, skipped: "already_notified" });
      }

      try {
        await sendMail({
          to: contactEmail,
          from: process.env.MAIL_FROM_USER || process.env.MAIL_FROM,
          subject: `Your request to ${labName ?? "the lab"} is being reviewed`,
          text: `Thanks for reaching out about ${labName ?? "our lab"}. Our team is viewing your ${type ?? "request"} now and will respond soon.`,
          templateId: process.env.BREVO_TEMPLATE_REQUEST_VIEWED ? Number(process.env.BREVO_TEMPLATE_REQUEST_VIEWED) : undefined,
          params: {
            labName: labName ?? "our lab",
            requestType: type ?? "request",
            logoUrl: process.env.MAIL_LOGO_URL || undefined,
          },
        });
        viewedNotifyCache.add(cacheKey);
      } catch (mailErr) {
        // Swallow email errors to avoid blocking the UI
        console.error("Failed to send viewed notification", mailErr);
      }

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to record request view" });
    }
  });

  app.put("/api/my-lab", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });

      const { data: labRow, error: labError } = await supabase.from("labs").select("id").eq("owner_user_id", userId).maybeSingle();
      if (labError) throw labError;
      if (!labRow) return res.status(404).json({ message: "No lab linked to this account" });

      const labId = Number(labRow.id);
      const updates = { ...(req.body ?? {}) } as Record<string, unknown>;
      const requestedOwnerCamel = updates.ownerUserId;
      const requestedOwnerSnake = updates.owner_user_id;
      if (requestedOwnerCamel !== undefined && requestedOwnerCamel !== userId) {
        return res.status(403).json({ message: "Not authorized to transfer lab ownership" });
      }
      if (requestedOwnerSnake !== undefined && requestedOwnerSnake !== userId) {
        return res.status(403).json({ message: "Not authorized to transfer lab ownership" });
      }
      delete updates.ownerUserId;
      delete updates.owner_user_id;

      const updated = await labStore.update(labId, updates);
      res.json(updated);
    } catch (err) {
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid lab update" });
      }
      res.status(500).json({ message: err instanceof Error ? err.message : "Unable to update lab" });
    }
  });
}
