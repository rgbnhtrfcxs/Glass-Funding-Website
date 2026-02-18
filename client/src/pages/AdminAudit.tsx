import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { supabase } from "@/lib/supabaseClient";

type AuditSlot = {
  id: number;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  notes: string | null;
  capacity: number;
  bookedCount: number;
  remainingCapacity: number;
  isActive: boolean;
  label: string;
};

type AuditBooking = {
  id: number;
  slotId: number | null;
  slotLabel: string;
  slotStartsAt: string | null;
  slotEndsAt: string | null;
  slotTimezone: string | null;
  slotIsActive: boolean | null;
  labId: number | null;
  labName: string;
  requesterUserId: string | null;
  requesterEmail: string | null;
  status: "pending" | "confirmed" | "rejected" | "cancelled";
  availability: string | null;
  payment: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type AdminAuditTab = "availability" | "bookings";
type BookingFilter = "pending" | "all" | "confirmed" | "rejected" | "cancelled";

const toLocalDateTimeInputValue = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const defaultStart = (() => {
  const date = new Date();
  date.setHours(date.getHours() + 24, 10, 0, 0);
  return toLocalDateTimeInputValue(date);
})();

const defaultEnd = (() => {
  const date = new Date();
  date.setHours(date.getHours() + 24, 12, 0, 0);
  return toLocalDateTimeInputValue(date);
})();

const toDateInputValue = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
};

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

const parseTime = (value: string) => {
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
};

const toCompactUtcStamp = (date: Date) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

const buildAdminCalendarLinks = (booking: AuditBooking) => {
  if (!booking.slotStartsAt) return null;
  const startsAt = new Date(booking.slotStartsAt);
  if (Number.isNaN(startsAt.getTime())) return null;
  const endCandidate = booking.slotEndsAt ? new Date(booking.slotEndsAt) : null;
  const endsAt =
    endCandidate && !Number.isNaN(endCandidate.getTime()) && endCandidate.getTime() > startsAt.getTime()
      ? endCandidate
      : new Date(startsAt.getTime() + 90 * 60 * 1000);

  const title = `GLASS audit - ${booking.labName}`;
  const location =
    [
      booking.addressLine1,
      booking.addressLine2,
      booking.city,
      booking.state,
      booking.postalCode,
      booking.country,
    ]
      .filter(Boolean)
      .join(", ") || "GLASS lab location";
  const details = `Booking #${booking.id} • ${booking.slotLabel}`;
  const googleDates = `${toCompactUtcStamp(startsAt)}/${toCompactUtcStamp(endsAt)}`;
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title,
  )}&dates=${encodeURIComponent(googleDates)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
  const outlookUrl = `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(
    title,
  )}&body=${encodeURIComponent(details)}&startdt=${encodeURIComponent(startsAt.toISOString())}&enddt=${encodeURIComponent(
    endsAt.toISOString(),
  )}&location=${encodeURIComponent(location)}`;

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "PRODID:-//GLASS//Audit Scheduler//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:glass-admin-audit-${booking.id}@glass-funding.com`,
    `DTSTAMP:${toCompactUtcStamp(new Date())}`,
    `DTSTART:${toCompactUtcStamp(startsAt)}`,
    `DTEND:${toCompactUtcStamp(endsAt)}`,
    `SUMMARY:${title.replace(/\n/g, " ")}`,
    `DESCRIPTION:${details.replace(/\n/g, " ")}`,
    `LOCATION:${location.replace(/\n/g, " ")}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];
  const icsDataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsLines.join("\r\n"))}`;

  return { googleUrl, outlookUrl, icsDataUrl };
};

export default function AdminAudit() {
  const [slots, setSlots] = useState<AuditSlot[]>([]);
  const [bookings, setBookings] = useState<AuditBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(defaultEnd);
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [capacity, setCapacity] = useState(1);
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [weeklyStartDate, setWeeklyStartDate] = useState(toDateInputValue(new Date()));
  const [weeklyStartTime, setWeeklyStartTime] = useState("09:00");
  const [weeklyEndTime, setWeeklyEndTime] = useState("12:00");
  const [weeklyWeeksAhead, setWeeklyWeeksAhead] = useState(6);
  const [activeTab, setActiveTab] = useState<AdminAuditTab>("bookings");
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("pending");

  const pendingCount = useMemo(
    () => bookings.filter(booking => booking.status === "pending").length,
    [bookings],
  );
  const bookingCounts = useMemo(
    () => ({
      all: bookings.length,
      pending: bookings.filter(booking => booking.status === "pending").length,
      confirmed: bookings.filter(booking => booking.status === "confirmed").length,
      rejected: bookings.filter(booking => booking.status === "rejected").length,
      cancelled: bookings.filter(booking => booking.status === "cancelled").length,
    }),
    [bookings],
  );
  const filteredBookings = useMemo(() => {
    if (bookingFilter === "all") return bookings;
    return bookings.filter(booking => booking.status === bookingFilter);
  }, [bookings, bookingFilter]);

  const getAuthedHeaders = async (json = false): Promise<Record<string, string>> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Session expired. Please sign in again.");
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthedHeaders();
      const [slotsRes, bookingsRes] = await Promise.all([
        fetch("/api/admin/audit/slots", { headers }),
        fetch("/api/admin/audit/bookings", { headers }),
      ]);

      if (!slotsRes.ok) {
        const payload = await slotsRes.json().catch(() => ({ message: "Unable to load audit slots" }));
        throw new Error(payload?.message || "Unable to load audit slots");
      }
      if (!bookingsRes.ok) {
        const payload = await bookingsRes.json().catch(() => ({ message: "Unable to load audit bookings" }));
        throw new Error(payload?.message || "Unable to load audit bookings");
      }

      const slotPayload = await slotsRes.json();
      const bookingPayload = await bookingsRes.json();
      setSlots(Array.isArray(slotPayload?.slots) ? slotPayload.slots : []);
      setBookings(Array.isArray(bookingPayload?.bookings) ? bookingPayload.bookings : []);
    } catch (err: any) {
      setError(err?.message || "Unable to load audit scheduling data");
      setSlots([]);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const createSlot = async () => {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      if (!startAt || !endAt) throw new Error("Start and end times are required.");
      const startsAtIso = new Date(startAt).toISOString();
      const endsAtIso = new Date(endAt).toISOString();
      if (Number.isNaN(new Date(startsAtIso).getTime()) || Number.isNaN(new Date(endsAtIso).getTime())) {
        throw new Error("Invalid date/time.");
      }
      const headers = await getAuthedHeaders(true);
      const res = await fetch("/api/admin/audit/slots", {
        method: "POST",
        headers,
        body: JSON.stringify({
          startsAt: startsAtIso,
          endsAt: endsAtIso,
          timezone: timezone.trim() || "Europe/Paris",
          capacity,
          notes: notes.trim() || undefined,
          isActive,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: "Unable to create slot" }));
        throw new Error(payload?.message || "Unable to create slot");
      }
      setStatus("Slot created.");
      setNotes("");
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to create slot");
    } finally {
      setSaving(false);
    }
  };

  const patchSlot = async (slotId: number, payload: Record<string, unknown>) => {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const headers = await getAuthedHeaders(true);
      const res = await fetch(`/api/admin/audit/slots/${slotId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const response = await res.json().catch(() => ({ message: "Unable to update slot" }));
        throw new Error(response?.message || "Unable to update slot");
      }
      setStatus("Slot updated.");
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to update slot");
    } finally {
      setSaving(false);
    }
  };

  const updateBookingStatus = async (bookingId: number, nextStatus: AuditBooking["status"]) => {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const headers = await getAuthedHeaders(true);
      const res = await fetch(`/api/admin/audit/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: "Unable to update booking status" }));
        throw new Error(payload?.message || "Unable to update booking status");
      }
      setStatus("Booking status updated.");
      await loadAll();
      return true;
    } catch (err: any) {
      setError(err?.message || "Unable to update booking status");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const sendRemindersNow = async () => {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const headers = await getAuthedHeaders(true);
      const res = await fetch("/api/admin/audit/bookings/reminders/send", {
        method: "POST",
        headers,
        body: JSON.stringify({ windowMinutes: 20 }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: "Unable to send reminders" }));
        throw new Error(payload?.message || "Unable to send reminders");
      }
      const payload = await res.json().catch(() => null);
      setStatus(
        `Reminders sent: ${Number(payload?.sent24h || 0)} (24h), ${Number(payload?.sent2h || 0)} (2h).`,
      );
    } catch (err: any) {
      setError(err?.message || "Unable to send reminders");
    } finally {
      setSaving(false);
    }
  };

  const confirmAndOpenCalendar = async (bookingId: number, calendarUrl: string) => {
    const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
    const ok = await updateBookingStatus(bookingId, "confirmed");
    if (!ok) {
      if (popup) popup.close();
      return;
    }
    if (popup) {
      popup.location.href = calendarUrl;
      return;
    }
    window.open(calendarUrl, "_blank", "noopener,noreferrer");
  };

  const toggleWeeklyDay = (dayValue: number) => {
    setWeeklyDays(prev =>
      prev.includes(dayValue) ? prev.filter(value => value !== dayValue) : [...prev, dayValue].sort((a, b) => a - b),
    );
  };

  const createWeeklySlots = async () => {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      if (weeklyDays.length === 0) throw new Error("Select at least one weekday.");
      const startDate = new Date(`${weeklyStartDate}T00:00:00`);
      if (Number.isNaN(startDate.getTime())) throw new Error("Invalid start date.");
      const startTime = parseTime(weeklyStartTime);
      const endTime = parseTime(weeklyEndTime);
      if (!startTime || !endTime) throw new Error("Invalid time range.");
      const timeStartMinutes = startTime.hours * 60 + startTime.minutes;
      const timeEndMinutes = endTime.hours * 60 + endTime.minutes;
      if (timeEndMinutes <= timeStartMinutes) throw new Error("End time must be after start time.");

      const weeks = Math.max(1, Math.min(26, Number(weeklyWeeksAhead) || 1));
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + weeks * 7 - 1);
      endDate.setHours(23, 59, 59, 999);
      const now = Date.now();
      const existingStartTimes = new Set(
        slots
          .map(slot => (slot.startsAt ? new Date(slot.startsAt).getTime() : NaN))
          .filter(value => Number.isFinite(value)),
      );

      const candidates: Array<{ startsAt: string; endsAt: string }> = [];
      const cursor = new Date(startDate);
      while (cursor.getTime() <= endDate.getTime()) {
        if (weeklyDays.includes(cursor.getDay())) {
          const startSlot = new Date(cursor);
          startSlot.setHours(startTime.hours, startTime.minutes, 0, 0);
          const endSlot = new Date(cursor);
          endSlot.setHours(endTime.hours, endTime.minutes, 0, 0);
          if (startSlot.getTime() > now && endSlot.getTime() > startSlot.getTime()) {
            candidates.push({
              startsAt: startSlot.toISOString(),
              endsAt: endSlot.toISOString(),
            });
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      const uniqueCandidates = candidates.filter(candidate => !existingStartTimes.has(new Date(candidate.startsAt).getTime()));
      if (uniqueCandidates.length === 0) {
        setStatus("No new slots to create for this weekly period.");
        return;
      }

      const headers = await getAuthedHeaders(true);
      const creationResults = await Promise.all(
        uniqueCandidates.map(async candidate => {
          const res = await fetch("/api/admin/audit/slots", {
            method: "POST",
            headers,
            body: JSON.stringify({
              startsAt: candidate.startsAt,
              endsAt: candidate.endsAt,
              timezone: timezone.trim() || "Europe/Paris",
              capacity,
              notes: notes.trim() || undefined,
              isActive,
            }),
          });
          if (res.ok) return { ok: true };
          const payload = await res.json().catch(() => ({ message: "Unable to create slot" }));
          return { ok: false, message: payload?.message || "Unable to create slot" };
        }),
      );

      const failed = creationResults.filter(result => !result.ok);
      const createdCount = creationResults.length - failed.length;
      const skippedCount = candidates.length - uniqueCandidates.length;
      if (failed.length > 0) {
        setError(failed[0]?.message || "Some weekly slots could not be created.");
      }
      setStatus(
        `Weekly availability applied: ${createdCount} slot${createdCount === 1 ? "" : "s"} created` +
          `${skippedCount > 0 ? `, ${skippedCount} skipped (already existed)` : ""}` +
          `${failed.length > 0 ? `, ${failed.length} failed` : ""}.`,
      );
      await loadAll();
    } catch (err: any) {
      setError(err?.message || "Unable to create weekly slots");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-20 lg:py-24 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Audit scheduling</span>
            <h1 className="mt-2 text-3xl font-semibold text-foreground md:text-4xl">Admin: verification availability</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create audit slots and manage booking requests from labs.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/labs">
              <a className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
                Back to labs
              </a>
            </Link>
          </div>
        </div>

        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {status && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status}</p>}

        <div className="inline-flex rounded-xl border border-border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("bookings")}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              activeTab === "bookings"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            Bookings ({bookingCounts.pending} pending)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("availability")}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              activeTab === "availability"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            Availability ({slots.length} slots)
          </button>
        </div>

        {activeTab === "availability" && (
          <>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card/90 p-5 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Weekly availability (recommended)</h2>
              <p className="text-sm text-muted-foreground">
                Define your recurring free periods and generate upcoming audit slots in one click.
              </p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map(day => {
                  const active = weeklyDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWeeklyDay(day.value)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">Start date</span>
                  <input
                    type="date"
                    value={weeklyStartDate}
                    onChange={event => setWeeklyStartDate(event.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">Weeks ahead</span>
                  <input
                    type="number"
                    min={1}
                    max={26}
                    value={weeklyWeeksAhead}
                    onChange={event => setWeeklyWeeksAhead(Math.max(1, Math.min(26, Number(event.target.value) || 1)))}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">Start time</span>
                  <input
                    type="time"
                    value={weeklyStartTime}
                    onChange={event => setWeeklyStartTime(event.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">End time</span>
                  <input
                    type="time"
                    value={weeklyEndTime}
                    onChange={event => setWeeklyEndTime(event.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">Timezone</span>
                  <input
                    value={timezone}
                    onChange={event => setTimezone(event.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">Capacity per slot</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={capacity}
                    onChange={event => setCapacity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </label>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-foreground">Notes (optional)</span>
                <textarea
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  className="min-h-[76px] rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="Access notes, building instructions, etc."
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} />
                Active immediately
              </label>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={createWeeklySlots}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Generate weekly slots"}
                </button>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card/90 p-5 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Create audit slot</h2>
              <p className="text-sm text-muted-foreground">Add one-off exceptions outside your recurring weekly pattern.</p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">Start</span>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={event => setStartAt(event.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-foreground">End</span>
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={event => setEndAt(event.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={createSlot}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Create slot"}
                </button>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card/90 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-foreground">Slots ({slots.length})</h2>
                <button
                  type="button"
                  onClick={() => void loadAll()}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  Refresh
                </button>
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading slots...</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No slots yet.</p>
              ) : (
                <div className="space-y-2">
                  {slots.map(slot => (
                    <div key={slot.id} className="rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{slot.label}</p>
                          <p className="text-xs text-muted-foreground">
                            Capacity {slot.bookedCount}/{slot.capacity} ({slot.remainingCapacity} available)
                            {slot.notes ? ` • ${slot.notes}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${slot.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                            {slot.isActive ? "Active" : "Inactive"}
                          </span>
                          <button
                            type="button"
                            onClick={() => void patchSlot(slot.id, { isActive: !slot.isActive })}
                            disabled={saving}
                            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
                          >
                            {slot.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}

        {activeTab === "bookings" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card/90 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Bookings ({bookingCounts.all}) • Pending {pendingCount}</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void loadAll()}
                  disabled={saving}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={sendRemindersNow}
                  disabled={saving}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  Send reminders now
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["pending", "all", "confirmed", "rejected", "cancelled"] as BookingFilter[]).map(filterValue => {
                const label =
                  filterValue === "all"
                    ? `All (${bookingCounts.all})`
                    : `${filterValue.charAt(0).toUpperCase()}${filterValue.slice(1)} (${bookingCounts[filterValue]})`;
                return (
                  <button
                    key={filterValue}
                    type="button"
                    onClick={() => setBookingFilter(filterValue)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      bookingFilter === filterValue
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading bookings...</p>
            ) : filteredBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No {bookingFilter === "all" ? "" : `${bookingFilter} `}booking requests.</p>
            ) : (
              <div className="space-y-2">
              {filteredBookings.map(booking => (
                <div key={booking.id} className="rounded-xl border border-border p-3 space-y-2">
                  {(() => {
                    const calendarLinks = buildAdminCalendarLinks(booking);
                    return (
                      <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {booking.labName} • {booking.slotLabel}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          booking.status === "confirmed"
                            ? "bg-emerald-100 text-emerald-700"
                            : booking.status === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {booking.status}
                      </span>
                    </div>
                  <p className="text-xs text-muted-foreground">
                    {booking.requesterEmail || booking.requesterUserId || "Unknown requester"}
                  </p>
                  <p className="text-xs text-muted-foreground">Availability: {booking.availability || "N/A"}</p>
                  <p className="text-xs text-muted-foreground">Payment: {booking.payment || "N/A"}</p>
                  {calendarLinks && (
                    <div className="flex flex-wrap gap-2">
                      {booking.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void confirmAndOpenCalendar(booking.id, calendarLinks.googleUrl)}
                            disabled={saving}
                            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
                          >
                            Confirm + Google
                          </button>
                          <button
                            type="button"
                            onClick={() => void confirmAndOpenCalendar(booking.id, calendarLinks.outlookUrl)}
                            disabled={saving}
                            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
                          >
                            Confirm + Outlook
                          </button>
                        </>
                      ) : booking.status === "confirmed" ? (
                        <>
                          <a
                            href={calendarLinks.googleUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                          >
                            Add Google
                          </a>
                          <a
                            href={calendarLinks.outlookUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                          >
                            Add Outlook
                          </a>
                          <a
                            href={calendarLinks.icsDataUrl}
                            download={`glass-audit-${booking.id}.ics`}
                            className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                          >
                            Download ICS
                          </a>
                        </>
                      ) : null}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                        onClick={() => void updateBookingStatus(booking.id, "confirmed")}
                        disabled={saving || booking.status === "confirmed"}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateBookingStatus(booking.id, "rejected")}
                        disabled={saving || booking.status === "rejected"}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateBookingStatus(booking.id, "cancelled")}
                        disabled={saving || booking.status === "cancelled"}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
                      >
                      Cancel
                    </button>
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}
