import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { FlaskConical, MapPin, ShieldCheck, ShieldAlert, Plus } from "lucide-react";

type LabSummary = {
  id: number;
  name: string;
  lab_status?: string | null;
  city?: string | null;
  country?: string | null;
  logo_url?: string | null;
  is_visible?: boolean | null;
  lab_photos?: Array<{ url: string; name: string }>;
  lab_equipment?: Array<{ item: string; is_priority?: boolean | null }>;
  isVerified?: boolean;
};

export default function ManageSelect({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const [labs, setLabs] = useState<LabSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [profileCaps, setProfileCaps] = useState({
    canCreateLab: false,
    canManageMultipleLabs: false,
  });

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const res = await fetch("/api/my-labs", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "Unable to load labs");
        }
        const data = await res.json();
        setLabs(data ?? []);

        const { data: profileRow } = await supabase
          .from("profiles")
          .select("can_create_lab, can_manage_multiple_labs")
          .eq("user_id", user?.id)
          .maybeSingle();
        setProfileCaps({
          canCreateLab: Boolean((profileRow as any)?.can_create_lab),
          canManageMultipleLabs: Boolean((profileRow as any)?.can_manage_multiple_labs),
        });
      } catch (err: any) {
        setError(err.message || "Unable to load labs");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return labs;
    return labs.filter(lab => {
      const equipment = (lab.lab_equipment ?? []).map(e => e.item).join(" ");
      const location = [lab.city, lab.country].filter(Boolean).join(", ");
      const haystack = [lab.name, location, equipment].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [labs, search]);

  const canAddAnother = profileCaps.canCreateLab && (profileCaps.canManageMultipleLabs || labs.length === 0);

  const badge = (lab: LabSummary) => {
    const status = (lab.lab_status || "listed").toLowerCase();
    const isPremium = status === "premier";
    const hidden = lab.is_visible === false;
    return (
      <div className="flex flex-col items-end gap-1">
        {isPremium ? (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
            Premier
          </span>
        ) : null}
        {hidden ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-medium text-amber-800">Not visible</span>
        ) : null}
      </div>
    );
  };

  const coverUrl = (lab: LabSummary) => {
    if (lab.logo_url) return lab.logo_url;
    const firstPhoto = lab.lab_photos?.[0]?.url;
    return firstPhoto || null;
  };

  const sectionClass = embedded ? "bg-transparent" : "bg-background min-h-screen";
  const containerClass = embedded
    ? "w-full px-0 py-0"
    : "container mx-auto px-4 py-20 lg:py-24 max-w-6xl";

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-3xl font-semibold text-foreground">
              <FlaskConical className="h-5 w-5 text-primary" />
              Manage your labs
            </h1>
            <p className="text-sm text-muted-foreground">Pick a lab to edit. Premier labs keep their analytics and partner features.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search labs by name or city"
              className="w-full rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <MapPin className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading labs…</p>
        ) : error ? (
          <p className="mt-6 text-sm text-destructive">{error}</p>
        ) : (
          <>
            <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <motion.div
                key="add-lab"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex h-full flex-col rounded-3xl border border-dashed border-border bg-card/60 shadow-sm overflow-hidden"
              >
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Plus className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Add a new lab</h3>
                  <p className="text-sm text-muted-foreground">
                    {canAddAnother
                      ? "Create another lab profile and manage its details."
                      : "Multi-lab management is available on Custom tier."}
                  </p>
                </div>
                <div className="p-4">
                  {canAddAnother ? (
                    <Link
                      href="/lab/manage/new"
                      className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                      Add lab
                    </Link>
                  ) : (
                    <Link
                      href="/payments?plan=custom#custom"
                      className="inline-flex w-full items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                    >
                      Upgrade to Custom
                    </Link>
                  )}
                </div>
              </motion.div>
              {filtered.map(lab => (
              <motion.div
                key={lab.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex h-full flex-col rounded-3xl border border-border bg-card/80 shadow-sm overflow-hidden"
              >
                {coverUrl(lab) && (
                  <div className="h-36 w-full overflow-hidden border-b border-border/60 bg-background/40">
                    <img src={coverUrl(lab) as string} alt={lab.name} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-4 space-y-2 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{lab.name}</h2>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        <span>{[lab.city, lab.country].filter(Boolean).join(", ") || "Location not set"}</span>
                      </div>
                    </div>
                    {badge(lab)}
                  </div>
                  {lab.lab_equipment && lab.lab_equipment.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {lab.lab_equipment.slice(0, 3).map(eq => (
                        <span key={eq.item} className="rounded-full border border-border px-2 py-1">
                          {eq.item}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="pt-2">
                    <Link href={`/lab/manage/${lab.id}`}>
                      <a className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                        Manage
                      </a>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
            </div>
            {filtered.length === 0 && (
              <p className="mt-6 text-sm text-muted-foreground">
                No labs match that search. {labs.length === 0 ? "No lab is linked to your account yet." : ""}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
