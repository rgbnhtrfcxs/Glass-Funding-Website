import { motion } from "framer-motion";
import { ArrowUpRight, Beaker, MapPin, Users } from "lucide-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { useTeams } from "@/context/TeamsContext";

export default function Teams() {
  const { teams, isLoading, error, refresh } = useTeams();
  const [searchTerm, setSearchTerm] = useState("");

  const visibleTeams = useMemo(() => teams.filter(team => team.isVisible !== false), [teams]);
  const teamCount = visibleTeams.length;
  const formatLocation = (team: typeof visibleTeams[number]) => {
    const firstLab = team.labs[0];
    if (!firstLab) return "";
    return [firstLab.city, firstLab.country].filter(Boolean).join(", ");
  };

  const filteredTeams = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return visibleTeams;
    return visibleTeams.filter(team => {
      const labsText = team.labs
        .map(lab => [lab.name, lab.city, lab.country].filter(Boolean).join(" "))
        .join(" ");
      const techniqueText = team.techniques.map(tech => tech.name).join(" ");
      const haystack = [
        team.name,
        team.field,
        team.descriptionShort,
        team.descriptionLong,
        team.equipment.join(" "),
        team.priorityEquipment.join(" "),
        team.focusAreas.join(" "),
        techniqueText,
        labsText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [visibleTeams, searchTerm]);

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <span className="text-sm uppercase tracking-[0.35em] text-muted-foreground">
            Research Teams
          </span>
          <h1 className="mt-4 text-4xl md:text-5xl font-semibold leading-tight">
            Explore specialized teams and their scientific focus.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Teams highlight their core equipment, techniques, and focus areas so partners can
            match with the right expertise quickly.
          </p>
        </motion.div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filteredTeams.length} of {teamCount} teams
          </div>
          <div className="relative w-full sm:w-80">
            <input
              type="search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search teams by name, field, or technique"
              className="w-full rounded-full border border-border bg-card/80 px-4 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <MapPin className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading teams...</p>
        ) : error ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => refresh()}
              className="rounded-full border border-destructive/40 px-3 py-1 text-xs font-medium text-destructive"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredTeams.map(team => {
              const featuredEquipment = team.priorityEquipment.length > 0
                ? team.priorityEquipment.slice(0, 3)
                : team.equipment.slice(0, 3);
              const location = formatLocation(team);
              const cover = team.logoUrl || team.labs[0]?.logoUrl || null;
              return (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  whileHover={{ scale: 1.02 }}
                  className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card/80 shadow-sm will-change-transform"
                >
                  <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-white/80 via-white/70 to-sky-100/80 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100" />
                  <div className="relative z-10 flex h-full flex-col">
                    {cover && (
                      <div className="h-36 w-full overflow-hidden border-b border-border/60 bg-background/40">
                        <img src={cover} alt={team.name} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-4 p-5">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold text-foreground">{team.name}</h2>
                          {team.descriptionShort && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                              {team.descriptionShort}
                            </p>
                          )}
                        </div>
                        {team.field && (
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                            {team.field}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {featuredEquipment.map(item => (
                          <span key={item} className="rounded-full border border-border px-2 py-1">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        {team.members.length} members
                      </span>
                      {location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          {location}
                        </span>
                      )}
                      {team.techniques.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Beaker className="h-3.5 w-3.5 text-primary" />
                          {team.techniques.length} techniques
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/teams/${team.id}`}
                      className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                    >
                      View team
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
