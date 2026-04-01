// server/routes/verification.ts
import { type Express } from "express";
import { ZodError, z } from "zod";
import { supabase } from "../supabaseClient.js";
import { supabasePublic } from "../supabasePublicClient.js";
import { labStore } from "../labs-store.js";
import { sendMail } from "../mailer.js";
import {
  authenticate,
  fetchProfileCapabilities,
  isMissingRelationError,
  ACTIVE_AUDIT_BOOKING_STATUSES,
} from "./shared/helpers.js";
import {
  formatAuditSlotLabel,
  sendAuditBookingUserMail,
} from "./shared/audit-helpers.js";
import { computeAuditPricingQuote } from "./shared/certificate.js";

const insertVerificationRequestSchema = z.object({
  labId: z.number(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  availability: z.string().trim().min(3, "Availability is required").optional(),
  payment: z.string().trim().min(3, "Payment details are required"),
  preferredSlotId: z.coerce.number().int().positive().optional(),
});

export function registerVerificationRoutes(app: Express): void {
  // --------- Verification Requests ----------
  app.get("/api/verification/audit-slots", authenticate, async (_req, res) => {
    try {
      const nowIso = new Date().toISOString();
      const { data: slots, error: slotsError } = await supabase
        .from("audit_slots")
        .select("id, starts_at, ends_at, timezone, capacity, is_active, notes")
        .eq("is_active", true)
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(200);
      if (slotsError) {
        if (isMissingRelationError(slotsError)) {
          return res.status(503).json({
            message: "Audit scheduling tables not found. Run server/sql/audit_scheduling.sql first.",
          });
        }
        throw slotsError;
      }

      const slotRows = slots ?? [];
      const slotIds = slotRows.map((row: any) => Number(row.id)).filter((id: number) => Number.isInteger(id) && id > 0);
      let bookingRows: any[] = [];
      if (slotIds.length > 0) {
        const { data: bookings, error: bookingsError } = await supabase
          .from("audit_bookings")
          .select("slot_id, status")
          .in("slot_id", slotIds)
          .in("status", [...ACTIVE_AUDIT_BOOKING_STATUSES]);
        if (bookingsError && !isMissingRelationError(bookingsError)) throw bookingsError;
        bookingRows = bookings ?? [];
      }

      const bookedBySlot = new Map<number, number>();
      bookingRows.forEach((row: any) => {
        const slotId = Number(row?.slot_id);
        if (!Number.isInteger(slotId) || slotId <= 0) return;
        bookedBySlot.set(slotId, (bookedBySlot.get(slotId) ?? 0) + 1);
      });

      const items = slotRows
        .map((row: any) => {
          const id = Number(row?.id);
          if (!Number.isInteger(id) || id <= 0) return null;
          const capacityRaw = Number(row?.capacity);
          const capacity = Number.isInteger(capacityRaw) && capacityRaw > 0 ? capacityRaw : 1;
          const bookedCount = bookedBySlot.get(id) ?? 0;
          const remainingCapacity = Math.max(0, capacity - bookedCount);
          return {
            id,
            startsAt: row?.starts_at ?? null,
            endsAt: row?.ends_at ?? null,
            timezone: row?.timezone || "Europe/Paris",
            notes: row?.notes || null,
            capacity,
            bookedCount,
            remainingCapacity,
            label: formatAuditSlotLabel(row),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .filter(item => item.remainingCapacity > 0);

      return res.json({ slots: items });
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load audit slots" });
    }
  });

  app.get("/api/admin/audit/slots", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAdmin) {
        return res.status(403).json({ message: "Only admins can manage audit slots." });
      }

      const { data: slots, error: slotsError } = await supabase
        .from("audit_slots")
        .select("id, starts_at, ends_at, timezone, capacity, is_active, notes, created_at, updated_at")
        .order("starts_at", { ascending: true })
        .limit(500);
      if (slotsError) {
        if (isMissingRelationError(slotsError)) {
          return res.status(503).json({
            message: "Audit scheduling tables not found. Run server/sql/audit_scheduling.sql first.",
          });
        }
        throw slotsError;
      }

      const slotRows = slots ?? [];
      const slotIds = slotRows.map((row: any) => Number(row.id)).filter((id: number) => Number.isInteger(id) && id > 0);
      let bookingRows: any[] = [];
      if (slotIds.length > 0) {
        const { data: bookings, error: bookingsError } = await supabase
          .from("audit_bookings")
          .select("slot_id, status")
          .in("slot_id", slotIds)
          .in("status", [...ACTIVE_AUDIT_BOOKING_STATUSES]);
        if (bookingsError && !isMissingRelationError(bookingsError)) throw bookingsError;
        bookingRows = bookings ?? [];
      }

      const bookedBySlot = new Map<number, number>();
      bookingRows.forEach((row: any) => {
        const slotId = Number(row?.slot_id);
        if (!Number.isInteger(slotId) || slotId <= 0) return;
        bookedBySlot.set(slotId, (bookedBySlot.get(slotId) ?? 0) + 1);
      });

      const items = slotRows
        .map((row: any) => {
          const id = Number(row?.id);
          if (!Number.isInteger(id) || id <= 0) return null;
          const capacityRaw = Number(row?.capacity);
          const capacity = Number.isInteger(capacityRaw) && capacityRaw > 0 ? capacityRaw : 1;
          const bookedCount = bookedBySlot.get(id) ?? 0;
          return {
            id,
            startsAt: row?.starts_at ?? null,
            endsAt: row?.ends_at ?? null,
            timezone: row?.timezone || "Europe/Paris",
            notes: row?.notes || null,
            capacity,
            bookedCount,
            remainingCapacity: Math.max(0, capacity - bookedCount),
            isActive: Boolean(row?.is_active),
            createdAt: row?.created_at ?? null,
            updatedAt: row?.updated_at ?? null,
            label: formatAuditSlotLabel(row),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      return res.json({ slots: items });
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load audit slots" });
    }
  });

  app.post("/api/admin/audit/slots", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAdmin) {
        return res.status(403).json({ message: "Only admins can create audit slots." });
      }

      const schema = z.object({
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
        timezone: z.string().trim().min(2).max(80).default("Europe/Paris"),
        capacity: z.coerce.number().int().min(1).max(20).default(1),
        notes: z.string().trim().max(500).optional(),
        isActive: z.boolean().optional(),
      });
      const payload = schema.parse(req.body ?? {});
      const startsAt = new Date(payload.startsAt);
      const endsAt = new Date(payload.endsAt);
      if (!(startsAt.getTime() < endsAt.getTime())) {
        return res.status(400).json({ message: "Slot end time must be after start time." });
      }

      const insertPayload = {
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        timezone: payload.timezone,
        capacity: payload.capacity,
        notes: payload.notes || null,
        is_active: payload.isActive ?? true,
        created_by_user_id: userId,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("audit_slots").insert(insertPayload).select("*").maybeSingle();
      if (error) {
        if (isMissingRelationError(error)) {
          return res.status(503).json({
            message: "Audit scheduling tables not found. Run server/sql/audit_scheduling.sql first.",
          });
        }
        throw error;
      }
      return res.status(201).json({ slot: data });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid slot payload" });
      }
      return res.status(500).json({ message: error instanceof Error ? error.message : "Unable to create audit slot" });
    }
  });

  app.patch("/api/admin/audit/slots/:id", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAdmin) {
        return res.status(403).json({ message: "Only admins can update audit slots." });
      }
      const slotId = Number(req.params.id);
      if (!Number.isInteger(slotId) || slotId <= 0) return res.status(400).json({ message: "Invalid slot id" });

      const schema = z.object({
        startsAt: z.string().datetime().optional(),
        endsAt: z.string().datetime().optional(),
        timezone: z.string().trim().min(2).max(80).optional(),
        capacity: z.coerce.number().int().min(1).max(20).optional(),
        notes: z.string().trim().max(500).nullable().optional(),
        isActive: z.boolean().optional(),
      });
      const payload = schema.parse(req.body ?? {});

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (payload.startsAt) updates.starts_at = new Date(payload.startsAt).toISOString();
      if (payload.endsAt) updates.ends_at = new Date(payload.endsAt).toISOString();
      if (payload.timezone) updates.timezone = payload.timezone;
      if (typeof payload.capacity === "number") updates.capacity = payload.capacity;
      if (payload.notes !== undefined) updates.notes = payload.notes;
      if (typeof payload.isActive === "boolean") updates.is_active = payload.isActive;

      if (payload.startsAt && payload.endsAt) {
        const startsAt = new Date(payload.startsAt);
        const endsAt = new Date(payload.endsAt);
        if (!(startsAt.getTime() < endsAt.getTime())) {
          return res.status(400).json({ message: "Slot end time must be after start time." });
        }
      }

      const { data, error } = await supabase
        .from("audit_slots")
        .update(updates)
        .eq("id", slotId)
        .select("*")
        .maybeSingle();
      if (error) {
        if (isMissingRelationError(error)) {
          return res.status(503).json({
            message: "Audit scheduling tables not found. Run server/sql/audit_scheduling.sql first.",
          });
        }
        throw error;
      }
      return res.json({ slot: data });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid slot update payload" });
      }
      return res.status(500).json({ message: error instanceof Error ? error.message : "Unable to update audit slot" });
    }
  });

  app.get("/api/admin/audit/bookings", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAdmin) {
        return res.status(403).json({ message: "Only admins can view audit bookings." });
      }

      const { data: bookings, error: bookingsError } = await supabase
        .from("audit_bookings")
        .select(
          "id, slot_id, lab_id, requester_user_id, requester_email, status, availability, payment, address_line1, address_line2, city, state, postal_code, country, created_at, updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (bookingsError) {
        if (isMissingRelationError(bookingsError)) {
          return res.status(503).json({
            message: "Audit scheduling tables not found. Run server/sql/audit_scheduling.sql first.",
          });
        }
        throw bookingsError;
      }

      const bookingRows = bookings ?? [];
      const slotIds = Array.from(
        new Set(bookingRows.map((row: any) => Number(row.slot_id)).filter((id: number) => Number.isInteger(id) && id > 0)),
      );
      const labIds = Array.from(
        new Set(bookingRows.map((row: any) => Number(row.lab_id)).filter((id: number) => Number.isInteger(id) && id > 0)),
      );

      const [slotsResult, labsResult] = await Promise.all([
        slotIds.length
          ? supabase
              .from("audit_slots")
              .select("id, starts_at, ends_at, timezone, capacity, is_active")
              .in("id", slotIds)
          : Promise.resolve({ data: [], error: null as any }),
        labIds.length
          ? supabase.from("labs").select("id, name").in("id", labIds)
          : Promise.resolve({ data: [], error: null as any }),
      ]);
      if (slotsResult.error && !isMissingRelationError(slotsResult.error)) throw slotsResult.error;
      if (labsResult.error) throw labsResult.error;

      const slotsById = new Map<number, any>();
      (slotsResult.data ?? []).forEach((row: any) => {
        const id = Number(row?.id);
        if (Number.isInteger(id) && id > 0) slotsById.set(id, row);
      });
      const labsById = new Map<number, string>();
      (labsResult.data ?? []).forEach((row: any) => {
        const id = Number(row?.id);
        if (Number.isInteger(id) && id > 0) labsById.set(id, String(row?.name || `Lab #${id}`));
      });

      const items = bookingRows.map((row: any) => {
        const slotId = Number(row?.slot_id);
        const labId = Number(row?.lab_id);
        const slot = slotsById.get(slotId) ?? null;
        return {
          id: Number(row?.id),
          slotId: Number.isInteger(slotId) ? slotId : null,
          slotLabel: slot ? formatAuditSlotLabel(slot) : "N/A",
          slotStartsAt: slot?.starts_at ?? null,
          slotEndsAt: slot?.ends_at ?? null,
          slotTimezone: slot?.timezone ?? null,
          slotIsActive: slot ? Boolean(slot?.is_active) : null,
          labId: Number.isInteger(labId) ? labId : null,
          labName: Number.isInteger(labId) ? labsById.get(labId) ?? `Lab #${labId}` : "Unknown lab",
          requesterUserId: row?.requester_user_id ?? null,
          requesterEmail: row?.requester_email ?? null,
          status: row?.status ?? "pending",
          availability: row?.availability ?? null,
          payment: row?.payment ?? null,
          addressLine1: row?.address_line1 ?? null,
          addressLine2: row?.address_line2 ?? null,
          city: row?.city ?? null,
          state: row?.state ?? null,
          postalCode: row?.postal_code ?? null,
          country: row?.country ?? null,
          createdAt: row?.created_at ?? null,
          updatedAt: row?.updated_at ?? null,
        };
      });
      return res.json({ bookings: items });
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : "Unable to load audit bookings" });
    }
  });

  app.patch("/api/admin/audit/bookings/:id/status", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAdmin) {
        return res.status(403).json({ message: "Only admins can update audit bookings." });
      }

      const bookingId = Number(req.params.id);
      if (!Number.isInteger(bookingId) || bookingId <= 0) return res.status(400).json({ message: "Invalid booking id" });
      const schema = z.object({ status: z.enum(["pending", "confirmed", "rejected", "cancelled"]) });
      const payload = schema.parse(req.body ?? {});

      const { data: booking, error: bookingError } = await supabase
        .from("audit_bookings")
        .select("id, slot_id, status")
        .eq("id", bookingId)
        .maybeSingle();
      if (bookingError) {
        if (isMissingRelationError(bookingError)) {
          return res.status(503).json({
            message: "Audit scheduling tables not found. Run server/sql/audit_scheduling.sql first.",
          });
        }
        throw bookingError;
      }
      if (!booking) return res.status(404).json({ message: "Booking not found" });

      const slotId = Number((booking as any).slot_id);
      const previousStatus = String((booking as any)?.status || "");
      if (payload.status === "confirmed" && Number.isInteger(slotId) && slotId > 0) {
        const [{ data: slot, error: slotError }, { data: confirmedRows, error: countError }] = await Promise.all([
          supabase.from("audit_slots").select("id, capacity").eq("id", slotId).maybeSingle(),
          supabase
            .from("audit_bookings")
            .select("id")
            .eq("slot_id", slotId)
            .eq("status", "confirmed"),
        ]);
        if (slotError && !isMissingRelationError(slotError)) throw slotError;
        if (countError && !isMissingRelationError(countError)) throw countError;
        const capacityRaw = Number((slot as any)?.capacity);
        const capacity = Number.isInteger(capacityRaw) && capacityRaw > 0 ? capacityRaw : 1;
        const confirmedCount = (confirmedRows ?? []).filter((row: any) => Number(row?.id) !== bookingId).length;
        if (confirmedCount >= capacity) {
          return res.status(409).json({ message: "This slot is already full." });
        }
      }

      const { data, error } = await supabase
        .from("audit_bookings")
        .update({ status: payload.status, updated_at: new Date().toISOString() })
        .eq("id", bookingId)
        .select("*")
        .maybeSingle();
      if (error) {
        if (isMissingRelationError(error)) {
          return res.status(503).json({
            message: "Audit scheduling tables not found. Run server/sql/audit_scheduling.sql first.",
          });
        }
        throw error;
      }

      const updatedBooking = data as any;
      if (payload.status !== "confirmed") {
        const { error: reminderDeleteError } = await supabase
          .from("audit_booking_reminders")
          .delete()
          .eq("booking_id", bookingId);
        if (reminderDeleteError && !isMissingRelationError(reminderDeleteError)) {
          console.warn("[audit-bookings] reminder cleanup failed", {
            bookingId,
            message: reminderDeleteError.message,
          });
        }
      }

      if (previousStatus !== payload.status) {
        const requesterEmail = String(updatedBooking?.requester_email || "").trim();
        if (requesterEmail.includes("@")) {
          const bookingLabId = Number(updatedBooking?.lab_id);
          const bookingSlotId = Number(updatedBooking?.slot_id);
          const [{ data: slotRow, error: slotRowError }, { data: labRow, error: labRowError }] = await Promise.all([
            Number.isInteger(bookingSlotId) && bookingSlotId > 0
              ? supabase
                  .from("audit_slots")
                  .select("id, starts_at, ends_at, timezone")
                  .eq("id", bookingSlotId)
                  .maybeSingle()
              : Promise.resolve({ data: null as any, error: null as any }),
            Number.isInteger(bookingLabId) && bookingLabId > 0
              ? supabase.from("labs").select("id, name").eq("id", bookingLabId).maybeSingle()
              : Promise.resolve({ data: null as any, error: null as any }),
          ]);
          if (slotRowError && !isMissingRelationError(slotRowError)) throw slotRowError;
          if (labRowError) throw labRowError;

          const slotLabel = slotRow ? formatAuditSlotLabel(slotRow as any) : "N/A";
          const addressLine = [
            updatedBooking?.address_line1 || null,
            updatedBooking?.address_line2 || null,
            updatedBooking?.city || null,
            updatedBooking?.state || null,
            updatedBooking?.postal_code || null,
            updatedBooking?.country || null,
          ]
            .filter(Boolean)
            .join(", ");
          const labName = String((labRow as any)?.name || `Lab #${bookingLabId || "?"}`);
          if (payload.status === "confirmed") {
            await sendAuditBookingUserMail({
              mode: "confirmed",
              to: requesterEmail,
              labName,
              bookingId,
              slotLabel,
              startsAt: (slotRow as any)?.starts_at ?? null,
              endsAt: (slotRow as any)?.ends_at ?? null,
              timezone: (slotRow as any)?.timezone ?? "Europe/Paris",
              address: addressLine || null,
              availability: updatedBooking?.availability || null,
              payment: updatedBooking?.payment || null,
            });
          } else if (payload.status === "cancelled" || payload.status === "rejected") {
            await sendAuditBookingUserMail({
              mode: payload.status,
              to: requesterEmail,
              labName,
              bookingId,
              slotLabel,
              startsAt: (slotRow as any)?.starts_at ?? null,
              endsAt: (slotRow as any)?.ends_at ?? null,
              timezone: (slotRow as any)?.timezone ?? "Europe/Paris",
              address: addressLine || null,
              availability: updatedBooking?.availability || null,
              payment: updatedBooking?.payment || null,
            });
          }
        }
      }
      return res.json({ booking: data });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid booking status payload" });
      }
      return res.status(500).json({ message: error instanceof Error ? error.message : "Unable to update audit booking" });
    }
  });

  const dispatchAuditReminders = async (windowMinutesRaw?: number) => {
    const windowMinutes = Math.max(5, Math.min(180, Number(windowMinutesRaw) || 20));
    const windowMs = windowMinutes * 60 * 1000;
    const nowMs = Date.now();

    const { data: bookings, error: bookingsError } = await supabase
      .from("audit_bookings")
      .select("id, slot_id, lab_id, requester_email, availability, payment, address_line1, address_line2, city, state, postal_code, country")
      .eq("status", "confirmed")
      .not("requester_email", "is", null)
      .limit(1000);
    if (bookingsError) {
      if (isMissingRelationError(bookingsError)) {
        const error = new Error("Audit scheduling tables not found. Run server/sql/audit_scheduling.sql first.") as Error & {
          status?: number;
        };
        error.status = 503;
        throw error;
      }
      throw bookingsError;
    }
    const bookingRows = bookings ?? [];
    const bookingIds = bookingRows
      .map((row: any) => Number(row?.id))
      .filter((id: number) => Number.isInteger(id) && id > 0);
    const slotIds = Array.from(
      new Set(bookingRows.map((row: any) => Number(row?.slot_id)).filter((id: number) => Number.isInteger(id) && id > 0)),
    );
    const labIds = Array.from(
      new Set(bookingRows.map((row: any) => Number(row?.lab_id)).filter((id: number) => Number.isInteger(id) && id > 0)),
    );

    const [slotsResult, labsResult, remindersResult] = await Promise.all([
      slotIds.length
        ? supabase
            .from("audit_slots")
            .select("id, starts_at, ends_at, timezone")
            .in("id", slotIds)
        : Promise.resolve({ data: [], error: null as any }),
      labIds.length
        ? supabase.from("labs").select("id, name").in("id", labIds)
        : Promise.resolve({ data: [], error: null as any }),
      bookingIds.length
        ? supabase
            .from("audit_booking_reminders")
            .select("booking_id, reminder_type")
            .in("booking_id", bookingIds)
        : Promise.resolve({ data: [], error: null as any }),
    ]);
    if (slotsResult.error && !isMissingRelationError(slotsResult.error)) throw slotsResult.error;
    if (labsResult.error) throw labsResult.error;
    if (remindersResult.error) {
      if (isMissingRelationError(remindersResult.error)) {
        const error = new Error(
          "Reminder table not found. Re-run server/sql/audit_scheduling.sql to add audit_booking_reminders.",
        ) as Error & { status?: number };
        error.status = 503;
        throw error;
      }
      throw remindersResult.error;
    }

    const slotsById = new Map<number, any>();
    (slotsResult.data ?? []).forEach((row: any) => {
      const id = Number(row?.id);
      if (Number.isInteger(id) && id > 0) slotsById.set(id, row);
    });
    const labsById = new Map<number, string>();
    (labsResult.data ?? []).forEach((row: any) => {
      const id = Number(row?.id);
      if (Number.isInteger(id) && id > 0) labsById.set(id, String(row?.name || `Lab #${id}`));
    });
    const sentSet = new Set<string>();
    (remindersResult.data ?? []).forEach((row: any) => {
      const bookingId = Number(row?.booking_id);
      const type = String(row?.reminder_type || "").trim();
      if (!Number.isInteger(bookingId) || !type) return;
      sentSet.add(`${bookingId}:${type}`);
    });

    const sentRows: Array<{ booking_id: number; reminder_type: "24h" | "2h"; sent_at: string }> = [];
    let sent24h = 0;
    let sent2h = 0;
    for (const bookingRow of bookingRows) {
      const bookingId = Number((bookingRow as any)?.id);
      const slotId = Number((bookingRow as any)?.slot_id);
      const labId = Number((bookingRow as any)?.lab_id);
      const requesterEmail = String((bookingRow as any)?.requester_email || "").trim();
      if (!Number.isInteger(bookingId) || bookingId <= 0) continue;
      if (!requesterEmail.includes("@")) continue;
      const slot = slotsById.get(slotId);
      if (!slot?.starts_at) continue;
      const startsAtMs = new Date(slot.starts_at).getTime();
      if (!Number.isFinite(startsAtMs) || startsAtMs <= nowMs) continue;
      const diffMs = startsAtMs - nowMs;

      const shouldSend24h =
        diffMs >= 24 * 60 * 60 * 1000 - windowMs &&
        diffMs <= 24 * 60 * 60 * 1000 + windowMs &&
        !sentSet.has(`${bookingId}:24h`);
      const shouldSend2h =
        diffMs >= 2 * 60 * 60 * 1000 - windowMs &&
        diffMs <= 2 * 60 * 60 * 1000 + windowMs &&
        !sentSet.has(`${bookingId}:2h`);
      if (!shouldSend24h && !shouldSend2h) continue;

      const address = [
        (bookingRow as any)?.address_line1 || null,
        (bookingRow as any)?.address_line2 || null,
        (bookingRow as any)?.city || null,
        (bookingRow as any)?.state || null,
        (bookingRow as any)?.postal_code || null,
        (bookingRow as any)?.country || null,
      ]
        .filter(Boolean)
        .join(", ");
      const labName = labsById.get(labId) ?? `Lab #${labId || "?"}`;
      const slotLabel = formatAuditSlotLabel(slot);

      if (shouldSend24h) {
        await sendAuditBookingUserMail({
          mode: "reminder_24h",
          to: requesterEmail,
          labName,
          bookingId,
          slotLabel,
          startsAt: slot?.starts_at ?? null,
          endsAt: slot?.ends_at ?? null,
          timezone: slot?.timezone ?? "Europe/Paris",
          address: address || null,
          availability: (bookingRow as any)?.availability || null,
          payment: (bookingRow as any)?.payment || null,
        });
        sentRows.push({ booking_id: bookingId, reminder_type: "24h", sent_at: new Date().toISOString() });
        sentSet.add(`${bookingId}:24h`);
        sent24h += 1;
      }
      if (shouldSend2h) {
        await sendAuditBookingUserMail({
          mode: "reminder_2h",
          to: requesterEmail,
          labName,
          bookingId,
          slotLabel,
          startsAt: slot?.starts_at ?? null,
          endsAt: slot?.ends_at ?? null,
          timezone: slot?.timezone ?? "Europe/Paris",
          address: address || null,
          availability: (bookingRow as any)?.availability || null,
          payment: (bookingRow as any)?.payment || null,
        });
        sentRows.push({ booking_id: bookingId, reminder_type: "2h", sent_at: new Date().toISOString() });
        sentSet.add(`${bookingId}:2h`);
        sent2h += 1;
      }
    }

    if (sentRows.length > 0) {
      const { error: insertReminderError } = await supabase
        .from("audit_booking_reminders")
        .upsert(sentRows, { onConflict: "booking_id,reminder_type" });
      if (insertReminderError) {
        if (isMissingRelationError(insertReminderError)) {
          const error = new Error(
            "Reminder table not found. Re-run server/sql/audit_scheduling.sql to add audit_booking_reminders.",
          ) as Error & { status?: number };
          error.status = 503;
          throw error;
        }
        throw insertReminderError;
      }
    }

    return {
      windowMinutes,
      considered: bookingRows.length,
      sent24h,
      sent2h,
      sentTotal: sentRows.length,
    };
  };

  app.post("/api/admin/audit/bookings/reminders/send", authenticate, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(400).json({ message: "No user on request" });
      const profile = await fetchProfileCapabilities(userId);
      if (!profile?.isAdmin) {
        return res.status(403).json({ message: "Only admins can send audit reminders." });
      }

      const schema = z
        .object({
          windowMinutes: z.coerce.number().int().min(5).max(180).optional(),
        })
        .default({});
      const payload = schema.parse(req.body ?? {});
      const result = await dispatchAuditReminders(payload.windowMinutes);
      return res.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid reminder payload" });
      }
      const status = typeof (error as any)?.status === "number" ? Number((error as any).status) : 500;
      return res.status(status).json({ message: error instanceof Error ? error.message : "Unable to send reminders" });
    }
  });

  app.post("/api/internal/audit/bookings/reminders/send", async (req, res) => {
    try {
      const configuredSecret = process.env.AUDIT_REMINDER_CRON_SECRET?.trim();
      if (!configuredSecret) {
        return res.status(503).json({
          message: "AUDIT_REMINDER_CRON_SECRET is not configured.",
        });
      }
      const providedSecret =
        req.get("x-audit-cron-secret") ||
        req.get("x-cron-secret") ||
        (typeof req.body?.secret === "string" ? String(req.body.secret) : "");
      if (!providedSecret || providedSecret !== configuredSecret) {
        return res.status(401).json({ message: "Invalid reminder secret." });
      }

      const schema = z
        .object({
          windowMinutes: z.coerce.number().int().min(5).max(180).optional(),
        })
        .default({});
      const payload = schema.parse(req.body ?? {});
      const result = await dispatchAuditReminders(payload.windowMinutes);
      return res.json({ ok: true, triggeredBy: "cron", ...result });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid reminder payload" });
      }
      const status = typeof (error as any)?.status === "number" ? Number((error as any).status) : 500;
      return res.status(status).json({ message: error instanceof Error ? error.message : "Unable to send reminders" });
    }
  });

  app.post("/api/verification-requests", authenticate, async (req, res) => {
    try {
      const payload = insertVerificationRequestSchema.parse(req.body);
      const lab = await labStore.findById(payload.labId);
      if (!lab) return res.status(404).json({ message: "Lab not found" });
      const ownerId = (lab as any).ownerUserId || (lab as any).owner_user_id;
      if (ownerId && ownerId !== req.user.id) {
        return res.status(403).json({ message: "You cannot request verification for this lab" });
      }

      const resolvedAddress = {
        addressLine1: payload.addressLine1 || lab.addressLine1 || null,
        addressLine2: payload.addressLine2 || lab.addressLine2 || null,
        city: payload.city || lab.city || null,
        state: payload.state || lab.state || null,
        postalCode: payload.postalCode || lab.postalCode || null,
        country: payload.country || lab.country || null,
      };
      const quote = await computeAuditPricingQuote(resolvedAddress);
      const quoteText = `Estimated audit fee: €${quote.amountEur} (${quote.tier} - ${quote.label})`;
      const selectedSlotId =
        typeof payload.preferredSlotId === "number" && Number.isInteger(payload.preferredSlotId)
          ? payload.preferredSlotId
          : null;
      const availabilityNote = (payload.availability || "").trim();
      let selectedSlot: any = null;
      let selectedSlotLabel: string | null = null;
      if (selectedSlotId && selectedSlotId > 0) {
        const { data: slot, error: slotError } = await supabase
          .from("audit_slots")
          .select("id, starts_at, ends_at, timezone, capacity, is_active")
          .eq("id", selectedSlotId)
          .maybeSingle();
        if (slotError) {
          if (isMissingRelationError(slotError)) {
            return res.status(503).json({
              message: "Audit scheduling tables not found. Run server/sql/audit_scheduling.sql first.",
            });
          }
          throw slotError;
        }
        if (!slot || !slot.is_active) {
          return res.status(409).json({ message: "Selected audit slot is no longer available." });
        }
        const startsAt = new Date((slot as any).starts_at);
        if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
          return res.status(409).json({ message: "Selected audit slot is no longer available." });
        }
        const { data: bookingRows, error: bookingCountError } = await supabase
          .from("audit_bookings")
          .select("id, status")
          .eq("slot_id", selectedSlotId)
          .in("status", [...ACTIVE_AUDIT_BOOKING_STATUSES]);
        if (bookingCountError) {
          if (isMissingRelationError(bookingCountError)) {
            return res.status(503).json({
              message: "Audit scheduling tables not found. Run server/sql/audit_scheduling.sql first.",
            });
          }
          throw bookingCountError;
        }
        const capacityRaw = Number((slot as any).capacity);
        const capacity = Number.isInteger(capacityRaw) && capacityRaw > 0 ? capacityRaw : 1;
        const bookedCount = (bookingRows ?? []).length;
        if (bookedCount >= capacity) {
          return res.status(409).json({ message: "Selected audit slot is fully booked. Please choose another slot." });
        }
        selectedSlot = slot;
        selectedSlotLabel = formatAuditSlotLabel(slot as any);
      }
      const availabilityValue =
        selectedSlotLabel && availabilityNote
          ? `${selectedSlotLabel} | Note: ${availabilityNote}`
          : selectedSlotLabel || availabilityNote;
      if (!availabilityValue) {
        return res.status(400).json({ message: "Please select an audit slot or provide availability." });
      }

      // Update address if provided
      const addressUpdate = {
        address_line1: payload.addressLine1 || null,
        address_line2: payload.addressLine2 || null,
        city: payload.city || null,
        state: payload.state || null,
        postal_code: payload.postalCode || null,
        country: payload.country || null,
      };
      const hasAddress = Object.values(addressUpdate).some(v => v && String(v).trim().length > 0);
      if (hasAddress) {
        await supabase
          .from("lab_location")
          .upsert({ lab_id: payload.labId, ...addressUpdate }, { onConflict: "lab_id" });
      }

      // Store request (requires table to exist). Try storing audit details when columns exist,
      // otherwise gracefully fall back to the legacy column set.
      const verificationRequestBaseInsert = {
        lab_id: payload.labId,
        requested_by: req.user.id,
        address_line1: payload.addressLine1 || null,
        address_line2: payload.addressLine2 || null,
        city: payload.city || null,
        state: payload.state || null,
        postal_code: payload.postalCode || null,
        country: payload.country || null,
        status: "received",
      };
      const verificationInsertAttempts: Array<Record<string, unknown>> = [
        {
          ...verificationRequestBaseInsert,
          availability: availabilityValue,
          payment: payload.payment,
          audit_price_tier: quote.tier,
          audit_price_eur: quote.amountEur,
          audit_price_currency: quote.currency,
          audit_price_basis: quote.basis,
          audit_distance_km: quote.distanceKm !== null ? Number(quote.distanceKm.toFixed(2)) : null,
          preferred_slot_id: selectedSlotId,
        },
        {
          ...verificationRequestBaseInsert,
          availability: availabilityValue,
          payment: payload.payment,
          preferred_slot_id: selectedSlotId,
        },
        verificationRequestBaseInsert,
      ];
      let inserted = false;
      let lastInsertError: any = null;
      let skippedPersistence = false;
      for (const candidate of verificationInsertAttempts) {
        const { error: insertError } = await supabase.from("lab_verification_requests").insert(candidate);
        if (!insertError) {
          inserted = true;
          break;
        }
        if (isMissingRelationError(insertError)) {
          skippedPersistence = true;
          lastInsertError = null;
          console.warn("[verification-requests] table missing, skipping persistence and continuing with email flow", {
            labId: payload.labId,
            message: insertError.message,
            code: (insertError as any)?.code,
          });
          break;
        }
        lastInsertError = insertError;
        console.warn("[verification-requests] insert attempt failed; trying fallback payload", {
          labId: payload.labId,
          keys: Object.keys(candidate),
          message: insertError.message,
          code: (insertError as any)?.code,
        });
      }
      if (!inserted && !skippedPersistence && lastInsertError) {
        throw lastInsertError;
      }

      if (selectedSlotId && selectedSlot && req.user.id) {
        const bookingInsertPayload = {
          slot_id: selectedSlotId,
          lab_id: payload.labId,
          requester_user_id: req.user.id,
          requester_email: req.user.email || null,
          availability: availabilityValue,
          payment: payload.payment,
          address_line1: resolvedAddress.addressLine1 || null,
          address_line2: resolvedAddress.addressLine2 || null,
          city: resolvedAddress.city || null,
          state: resolvedAddress.state || null,
          postal_code: resolvedAddress.postalCode || null,
          country: resolvedAddress.country || null,
          status: "pending",
          updated_at: new Date().toISOString(),
        };
        const bookingInsertAttempts: Array<Record<string, unknown>> = [
          bookingInsertPayload,
          {
            slot_id: selectedSlotId,
            lab_id: payload.labId,
            requester_user_id: req.user.id,
            status: "pending",
          },
        ];
        let bookingInserted = false;
        let bookingInsertError: any = null;
        for (const candidate of bookingInsertAttempts) {
          const { error } = await supabase.from("audit_bookings").insert(candidate);
          if (!error) {
            bookingInserted = true;
            break;
          }
          if (isMissingRelationError(error)) {
            return res.status(503).json({
              message: "Audit scheduling tables not found. Run server/sql/audit_scheduling.sql first.",
            });
          }
          bookingInsertError = error;
          console.warn("[verification-requests] booking insert attempt failed", {
            labId: payload.labId,
            slotId: selectedSlotId,
            keys: Object.keys(candidate),
            message: error.message,
            code: (error as any)?.code,
          });
        }
        if (!bookingInserted && bookingInsertError) {
          throw bookingInsertError;
        }
      }

      const adminInbox = process.env.ADMIN_INBOX ?? "contact@glass-funding.com";
      const userEmail = req.user.email || lab.contactEmail || null;

      // Notify admin
      await sendMail({
        to: adminInbox,
        from: process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
        subject: `Verification request for ${lab.name}`,
        text: [
          `Lab: ${lab.name} (id: ${payload.labId})`,
          `Requested by user: ${req.user.id}`,
          `Address line1: ${resolvedAddress.addressLine1 || "N/A"}`,
          `Address line2: ${resolvedAddress.addressLine2 || "N/A"}`,
          `City: ${resolvedAddress.city || "N/A"}`,
          `State: ${resolvedAddress.state || "N/A"}`,
          `Postal code: ${resolvedAddress.postalCode || "N/A"}`,
          `Country: ${resolvedAddress.country || "N/A"}`,
          `Preferred slot: ${selectedSlotLabel || "N/A"}`,
          `Availability: ${availabilityValue || "N/A"}`,
          `Payment details: ${payload.payment || "N/A"}`,
          `${quoteText}${quote.distanceKm !== null ? `, distance ${quote.distanceKm.toFixed(1)} km` : ""}`,
          `Note: On-site verification requested; please follow up for scheduling and costs.`,
        ].join("\n"),
        templateId: process.env.BREVO_TEMPLATE_VERIFY_ADMIN
          ? Number(process.env.BREVO_TEMPLATE_VERIFY_ADMIN)
          : undefined,
        params: {
          labName: lab.name,
          requester: req.user.id,
          address: [
            resolvedAddress.addressLine1 || "",
            resolvedAddress.addressLine2 || "",
            resolvedAddress.city || "",
            resolvedAddress.state || "",
            resolvedAddress.postalCode || "",
            resolvedAddress.country || "",
          ]
            .filter(Boolean)
            .join(", "),
          preferredSlot: selectedSlotLabel,
          availability: availabilityValue,
          payment: payload.payment,
          quoteTier: quote.tier,
          quoteAmountEur: quote.amountEur,
          quoteLabel: quote.label,
          quoteBasis: quote.basis,
          quoteDistanceKm: quote.distanceKm !== null ? Number(quote.distanceKm.toFixed(1)) : null,
          logoUrl: process.env.MAIL_LOGO_URL || undefined,
        },
      });

      // Notify user
      if (userEmail) {
        await sendMail({
          to: userEmail,
          from: process.env.MAIL_FROM_USER || process.env.MAIL_FROM,
          subject: `We received your verification request for ${lab.name}`,
          text: `Thanks! We received your request to verify ${lab.name}. Our team will reach out to schedule an on-site visit (additional cost applies).\nAddress: ${
            resolvedAddress.addressLine1 || ""
          } ${resolvedAddress.city || ""} ${resolvedAddress.country || ""}\nAvailability: ${
            availabilityValue || "N/A"
          }\nPayment details: ${payload.payment || "N/A"}\n${quoteText}${
            quote.distanceKm !== null ? `, distance ${quote.distanceKm.toFixed(1)} km` : ""
          }`.trim(),
          templateId: process.env.BREVO_TEMPLATE_VERIFY_USER
            ? Number(process.env.BREVO_TEMPLATE_VERIFY_USER)
            : 9,
          params: {
            labName: lab.name,
            address: [
              resolvedAddress.addressLine1 || "",
              resolvedAddress.addressLine2 || "",
              resolvedAddress.city || "",
              resolvedAddress.state || "",
              resolvedAddress.postalCode || "",
              resolvedAddress.country || "",
            ]
              .filter(Boolean)
              .join(", "),
            preferredSlot: selectedSlotLabel,
            availability: availabilityValue,
            payment: payload.payment,
            quoteTier: quote.tier,
            quoteAmountEur: quote.amountEur,
            quoteLabel: quote.label,
            quoteBasis: quote.basis,
            quoteDistanceKm: quote.distanceKm !== null ? Number(quote.distanceKm.toFixed(1)) : null,
            logoUrl: process.env.MAIL_LOGO_URL || undefined,
          },
        });
      }

      res.status(201).json({ ok: true, quote, persisted: inserted, selectedSlot: selectedSlotLabel });
    } catch (error) {
      console.error("[verification-requests] failed", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return res.status(400).json({ message: issue?.message ?? "Invalid verification request" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "Unable to submit verification request" });
    }
  });
}
