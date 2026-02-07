import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Plus, Users } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import type { Team } from "@shared/teams";

export default function ManageTeams({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setError(null);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const res = await fetch("/api/my-teams", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "Unable to load teams");
        }
        const data = (await res.json()) as Team[];
        if (active) setTeams(data ?? []);
      } catch (err: any) {
        if (active) setError(err.message || "Unable to load teams");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return teams;
    return teams.filter(team => {
      const labText = team.labs.map(lab => lab.name).join(" ");
      const haystack = [
        team.name,
        team.field,
        team.descriptionShort,
        team.descriptionLong,
        team.equipment.join(" "),
        team.focusAreas.join(" "),
        labText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [teams, search]);

  const sectionClass = embedded ? "bg-transparent" : "bg-background min-h-screen";
  const containerClass = embedded
    ? "w-full px-0 py-0"
    : "container mx-auto px-4 py-20 lg:py-24 max-w-6xl";

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-foreground">Manage your teams</h1>
            <p className="text-sm text-muted-foreground">Create and update research teams linked to labs.</p>
          </div>
          <div className="relative w-full sm:w-80">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search teams"
              className="w-full rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading teams...</p>
        ) : error ? (
          <p className="mt-6 text-sm text-destructive">{error}</p>
        ) : (
          <>
            <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              <motion.div
                key="add-team"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex h-full flex-col rounded-3xl border border-dashed border-border bg-card/60 shadow-sm overflow-hidden"
              >
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Plus className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Add a new team</h3>
                  <p className="text-sm text-muted-foreground">
                    Build a dedicated profile for a research team.
                  </p>
                </div>
                <div className="p-4">
                  <Link
                    href="/team/manage/new"
                    className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                  >
                    Add team
                  </Link>
                </div>
              </motion.div>
              {filtered.map(team => (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex h-full flex-col rounded-3xl border border-border bg-card/80 shadow-sm overflow-hidden"
                >
                  {team.logoUrl && (
                    <div className="h-32 w-full overflow-hidden border-b border-border/60 bg-background/40">
                      <img src={team.logoUrl} alt={team.name} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="p-4 space-y-3 flex-1 flex flex-col">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{team.name}</h2>
                      {team.descriptionShort && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{team.descriptionShort}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      {team.members.length} members
                    </div>
                    <div className="pt-2 mt-auto">
                      <Link href={`/team/manage/${team.id}`}>
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
                No teams match that search. {teams.length === 0 ? "No teams are linked to your account yet." : ""}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
