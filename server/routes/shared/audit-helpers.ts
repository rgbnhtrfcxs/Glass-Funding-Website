// server/routes/shared/audit-helpers.ts
import { Buffer } from "node:buffer";
import { sendMail } from "../../mailer.js";
import { supabase } from "../../supabaseClient.js";
import { isMissingRelationError } from "./helpers.js";

export const formatAuditSlotLabel = (slot: {
  starts_at?: string | null;
  ends_at?: string | null;
  timezone?: string | null;
}) => {
  const startsAtRaw = slot.starts_at;
  if (!startsAtRaw) return "N/A";
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) return startsAtRaw;
  const timezone = slot.timezone || "Europe/Paris";
  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });
  const end = slot.ends_at ? new Date(slot.ends_at) : null;
  const startLabel = formatter.format(startsAt);
  if (end && !Number.isNaN(end.getTime())) {
    return `${startLabel} - ${formatter.format(end)} (${timezone})`;
  }
  return `${startLabel} (${timezone})`;
};

export const resolveWebsiteBaseUrl = () =>
  (process.env.WEBSITE_URL || process.env.APP_BASE_URL || "https://glass-funding.com").replace(/\/+$/, "");

export const formatUtcIcsTimestamp = (date: Date) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export const escapeIcsText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

export const buildAuditCalendarPackage = (input: {
  bookingId: number;
  labName: string;
  startsAt?: string | null;
  endsAt?: string | null;
  timezone?: string | null;
  location?: string | null;
  manageUrl?: string | null;
}) => {
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) return null;
  const endCandidate = input.endsAt ? new Date(input.endsAt) : null;
  const endsAt =
    endCandidate && !Number.isNaN(endCandidate.getTime()) && endCandidate.getTime() > startsAt.getTime()
      ? endCandidate
      : new Date(startsAt.getTime() + 90 * 60 * 1000);
  const title = `GLASS audit - ${input.labName}`;
  const description = [
    `On-site verification audit for ${input.labName}.`,
    input.manageUrl ? `Manage booking: ${input.manageUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const location = input.location || "GLASS lab location";
  const googleDates = `${formatUtcIcsTimestamp(startsAt)}/${formatUtcIcsTimestamp(endsAt)}`;
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title,
  )}&dates=${encodeURIComponent(googleDates)}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(
    location,
  )}`;
  const outlookCalendarUrl = `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(
    title,
  )}&body=${encodeURIComponent(description)}&startdt=${encodeURIComponent(startsAt.toISOString())}&enddt=${encodeURIComponent(
    endsAt.toISOString(),
  )}&location=${encodeURIComponent(location)}`;

  const uid = `glass-audit-${input.bookingId}@glass-funding.com`;
  const dtStamp = formatUtcIcsTimestamp(new Date());
  const dtStart = formatUtcIcsTimestamp(startsAt);
  const dtEnd = formatUtcIcsTimestamp(endsAt);
  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "PRODID:-//GLASS//Audit Scheduler//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(location)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];
  const icsText = icsLines.join("\r\n");
  const icsBase64 = Buffer.from(icsText, "utf8").toString("base64");

  return {
    title,
    startsAtIso: startsAt.toISOString(),
    endsAtIso: endsAt.toISOString(),
    googleCalendarUrl,
    outlookCalendarUrl,
    icsAttachment: {
      filename: `glass-audit-${input.bookingId}.ics`,
      contentBase64: icsBase64,
      contentType: "text/calendar; charset=utf-8; method=REQUEST",
    },
  };
};

export const sendAuditBookingUserMail = async (input: {
  mode: "confirmed" | "reminder_24h" | "reminder_2h" | "cancelled" | "rejected";
  to: string;
  labName: string;
  bookingId: number;
  slotLabel: string;
  startsAt?: string | null;
  endsAt?: string | null;
  timezone?: string | null;
  address?: string | null;
  availability?: string | null;
  payment?: string | null;
}) => {
  const websiteUrl = resolveWebsiteBaseUrl();
  const manageUrl = `${websiteUrl}/account?auditBooking=${input.bookingId}`;
  const calendar = buildAuditCalendarPackage({
    bookingId: input.bookingId,
    labName: input.labName,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timezone: input.timezone,
    location: input.address || undefined,
    manageUrl,
  });

  const statusLabel =
    input.mode === "confirmed"
      ? "confirmed"
      : input.mode === "cancelled"
        ? "cancelled"
        : input.mode === "rejected"
          ? "not approved"
          : "upcoming";
  const reminderLabel =
    input.mode === "reminder_24h"
      ? "Reminder: your audit is in about 24 hours."
      : input.mode === "reminder_2h"
        ? "Reminder: your audit is in about 2 hours."
        : null;

  const subject =
    input.mode === "confirmed"
      ? `Audit confirmed for ${input.labName}`
      : input.mode === "cancelled"
        ? `Audit update for ${input.labName}: cancelled`
        : input.mode === "rejected"
          ? `Audit update for ${input.labName}`
          : `Reminder: audit for ${input.labName}`;

  const textLines = [
    reminderLabel,
    `Your audit request for ${input.labName} is ${statusLabel}.`,
    `Slot: ${input.slotLabel || "N/A"}`,
    `Address: ${input.address || "N/A"}`,
    `Availability details: ${input.availability || "N/A"}`,
    `Payment details: ${input.payment || "N/A"}`,
    calendar ? `Google Calendar: ${calendar.googleCalendarUrl}` : null,
    calendar ? `Outlook Calendar: ${calendar.outlookCalendarUrl}` : null,
    `Manage booking: ${manageUrl}`,
  ].filter(Boolean);

  await sendMail({
    to: input.to,
    from: process.env.MAIL_FROM_USER || process.env.MAIL_FROM_ADMIN || process.env.MAIL_FROM,
    subject,
    text: textLines.join("\n"),
    templateId:
      input.mode === "confirmed"
        ? process.env.BREVO_TEMPLATE_AUDIT_CONFIRMED_USER
          ? Number(process.env.BREVO_TEMPLATE_AUDIT_CONFIRMED_USER)
          : undefined
        : input.mode === "reminder_24h"
          ? process.env.BREVO_TEMPLATE_AUDIT_REMINDER_24H_USER
            ? Number(process.env.BREVO_TEMPLATE_AUDIT_REMINDER_24H_USER)
            : process.env.BREVO_TEMPLATE_AUDIT_REMINDER_USER
              ? Number(process.env.BREVO_TEMPLATE_AUDIT_REMINDER_USER)
              : undefined
          : input.mode === "reminder_2h"
            ? process.env.BREVO_TEMPLATE_AUDIT_REMINDER_2H_USER
              ? Number(process.env.BREVO_TEMPLATE_AUDIT_REMINDER_2H_USER)
              : process.env.BREVO_TEMPLATE_AUDIT_REMINDER_USER
                ? Number(process.env.BREVO_TEMPLATE_AUDIT_REMINDER_USER)
                : undefined
            : process.env.BREVO_TEMPLATE_AUDIT_STATUS_USER
              ? Number(process.env.BREVO_TEMPLATE_AUDIT_STATUS_USER)
              : undefined,
    params: {
      labName: input.labName,
      bookingId: input.bookingId,
      slotLabel: input.slotLabel,
      slotStartIso: calendar?.startsAtIso || null,
      slotEndIso: calendar?.endsAtIso || null,
      timezone: input.timezone || "Europe/Paris",
      address: input.address || null,
      availability: input.availability || null,
      payment: input.payment || null,
      googleCalendarUrl: calendar?.googleCalendarUrl || null,
      outlookCalendarUrl: calendar?.outlookCalendarUrl || null,
      manageUrl,
      reminderType:
        input.mode === "reminder_24h" ? "24h" : input.mode === "reminder_2h" ? "2h" : null,
      logoUrl: process.env.MAIL_LOGO_URL || null,
    },
    attachments:
      input.mode === "confirmed" && calendar
        ? [calendar.icsAttachment]
        : input.mode === "reminder_24h" && calendar
          ? [calendar.icsAttachment]
          : input.mode === "reminder_2h" && calendar
            ? [calendar.icsAttachment]
            : undefined,
  });
};

export const dispatchAuditReminders = async (windowMinutesRaw?: number) => {
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
