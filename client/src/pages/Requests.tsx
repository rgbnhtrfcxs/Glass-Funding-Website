import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { Mail } from "lucide-react";

type RequestRecord = {
  id?: number | string;
  lab_name?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  collaboration_focus?: string | null;
  desired_timeline?: string | null;
  additional_notes?: string | null;
  target_labs?: string | null;
  resources_offered?: string | null;
  created_at?: string | null;
  // contact request fallback fields
  message?: string | null;
};

type RequestsPayload = {
  labs: Array<{ id: number; name: string }>;
  collaborations: RequestRecord[];
  contacts: RequestRecord[];
};

export default function Requests({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const [data, setData] = useState<RequestsPayload>({ labs: [], collaborations: [], contacts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"collaboration" | "contact">("collaboration");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const res = await fetch("/api/my-labs/requests", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok || !contentType.includes("application/json")) {
          const txt = await res.text();
          throw new Error(txt || "Unable to load requests");
        }
        const payload = (await res.json()) as RequestsPayload;
        setData(payload);
      } catch (err: any) {
        setError(err.message || "Unable to load requests");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const toggleOpen = async (key: string, item: RequestRecord) => {
    let willOpen = true;
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        willOpen = false;
      } else {
        next.add(key);
        willOpen = true;
      }
      return next;
    });

    if (willOpen && item.contact_email && !notifiedIds.has(key)) {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        await fetch("/api/my-labs/requests/viewed", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            contactEmail: item.contact_email,
            labName: item.lab_name,
            type: filter === "collaboration" ? "collaboration" : "rental",
          }),
        });
        setNotifiedIds(prev => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      } catch {
        // ignore notify errors
      }
    }
  };

  const renderCard = (item: RequestRecord) => {
    const key = (item.id ?? `${item.lab_id ?? ""}-${item.lab_name ?? ""}-${item.contact_email ?? ""}-${item.created_at ?? ""}`) as string;
    const created = item.created_at ? new Date(item.created_at).toLocaleString() : null;
    const isOpen = openIds.has(key);

    return (
      <div
        key={key}
        className="rounded-2xl border border-border bg-card/70"
      >
        <button
          type="button"
          onClick={() => toggleOpen(key, item)}
          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/50 transition"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
            <p className="text-sm font-semibold text-foreground">{item.lab_name || "Unknown lab"}</p>
            <p className="text-sm text-muted-foreground">{item.contact_name || "Unknown contact"}</p>
          </div>
          <div className="flex items-center gap-2">
            {created && <p className="text-[11px] text-muted-foreground whitespace-nowrap">{created}</p>}
            <span className="text-xs text-primary">{isOpen ? "Hide" : "View"}</span>
          </div>
        </button>
        {isOpen && (
          <div className="border-t border-border px-4 py-4 space-y-4 text-sm text-foreground">
            <div className="grid gap-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Contact</p>
              <p className="text-sm text-muted-foreground">{item.contact_email || "No email provided"}</p>
              {item.preferred_contact && (
                <p className="text-xs text-muted-foreground">
                  Preferred: {item.preferred_contact === "video_call" ? "Video call" : item.preferred_contact === "in_person" ? "In person" : "Email"}
                </p>
              )}
            </div>
            <div className="grid gap-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Request</p>
              {item.collaboration_focus && <p><span className="font-medium">Focus:</span> {item.collaboration_focus}</p>}
              {item.desired_timeline && <p><span className="font-medium">Timeline:</span> {item.desired_timeline}</p>}
              {item.target_labs && <p><span className="font-medium">Target labs:</span> {item.target_labs}</p>}
              {item.resources_offered && <p><span className="font-medium">Resources offered:</span> {item.resources_offered}</p>}
            </div>
            {item.additional_notes && (
              <div className="grid gap-1">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Notes</p>
                <p>{item.additional_notes}</p>
              </div>
            )}
            {item.message && !item.collaboration_focus && (
              <div className="grid gap-1">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Message</p>
                <p>{item.message}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {item.contact_email && (
                <a
                  href={`mailto:${encodeURIComponent(item.contact_email)}?subject=Re:%20${encodeURIComponent(item.lab_name || "your request")}`}
                  className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary hover:border-primary"
                >
                  Reply via email
                </a>
              )}
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary"
                onClick={() => {
                  if (item.contact_email) {
                    const text = `Video call with ${item.contact_name ?? "contact"} (${item.contact_email})`;
                    void navigator.clipboard?.writeText(text);
                  }
                }}
              >
                Schedule call
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary"
                onClick={() => {
                  if (item.contact_email) {
                    const text = `${item.contact_name ?? "Contact"} <${item.contact_email}>`;
                    void navigator.clipboard?.writeText(text);
                  }
                }}
              >
                Copy contact
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const filteredList = filter === "collaboration" ? data.collaborations : data.contacts;

  const sectionClass = embedded ? "bg-transparent" : "bg-background min-h-screen";
  const containerClass = embedded
    ? "w-full px-0 py-0"
    : "container mx-auto px-4 py-20 lg:py-24 max-w-5xl";

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Requests</p>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-foreground">
            <Mail className="h-5 w-5 text-primary" />
            Inbox
          </h1>
          <p className="text-sm text-muted-foreground">Collaboration or rental requests linked to your labs.</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              filter === "collaboration"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-foreground hover:border-primary/60"
            }`}
            onClick={() => setFilter("collaboration")}
          >
            Collaboration ({data.collaborations.length})
          </button>
          <button
            type="button"
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              filter === "contact"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-foreground hover:border-primary/60"
            }`}
            onClick={() => setFilter("contact")}
          >
            Renting / contact ({data.contacts.length})
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-6 rounded-3xl border border-border bg-card/80 p-6 shadow-sm"
        >
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading requests…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : data.labs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No labs linked to your account yet.</p>
          ) : filteredList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No {filter} requests yet.</p>
          ) : (
            <div className="grid gap-3">
              {filteredList.map(renderCard)}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
