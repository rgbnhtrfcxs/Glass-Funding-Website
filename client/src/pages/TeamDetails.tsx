import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Beaker, MapPin, Users } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import type { Team } from "@shared/teams";

interface TeamDetailsProps {
  params: {
    id: string;
  };
}

export default function TeamDetails({ params }: TeamDetailsProps) {
  const teamId = Number(params.id);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showAllEquipment, setShowAllEquipment] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ index: number } | null>(null);

  useEffect(() => {
    let active = true;
    async function loadTeam() {
      if (Number.isNaN(teamId)) {
        setError("Invalid team id");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/teams/${teamId}`);
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.message || "Unable to load team");
        }
        const data = (await res.json()) as Team;
        if (active) {
          setTeam(data);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load team");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadTeam();
    return () => {
      active = false;
    };
  }, [teamId]);

  const teamPhotos = team?.photos ?? [];
  const teamMembers = team?.members ?? [];
  const teamTechniques = team?.techniques ?? [];
  const teamEquipment = team?.equipment ?? [];
  const teamFocusAreas = team?.focusAreas ?? [];
  const primaryEquipment = useMemo(() => {
    if (!team) return [];
    return team.priorityEquipment.length > 0 ? team.priorityEquipment : teamEquipment.slice(0, 3);
  }, [team, teamEquipment]);
  const remainingEquipment = useMemo(() => {
    if (!team) return [];
    const priority = new Set(team.priorityEquipment);
    return teamEquipment.filter(item => !priority.has(item));
  }, [team, teamEquipment]);
  const leadMembers = teamMembers.filter(member => member.isLead);
  const otherMembers = teamMembers.filter(member => !member.isLead);

  if (loading) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-20 lg:py-24">
          <p className="text-sm text-muted-foreground">Loading team...</p>
        </div>
      </section>
    );
  }

  if (error || !team) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-20 lg:py-24">
          <p className="text-sm text-destructive">{error || "Team not found."}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12 lg:py-16 max-w-6xl">
        <Link href="/teams" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to teams
        </Link>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-3"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-semibold text-foreground">{team.name}</h1>
              {team.field && (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {team.field}
                </span>
              )}
            </div>
            {team.descriptionShort && (
              <p className="text-base text-muted-foreground max-w-2xl">{team.descriptionShort}</p>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4 text-primary" />
                {teamMembers.length} members
              </span>
              {team.labs[0]?.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-primary" />
                  {[team.labs[0].city, team.labs[0].country].filter(Boolean).join(", ")}
                </span>
              )}
              {teamTechniques.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Beaker className="h-4 w-4 text-primary" />
                  {teamTechniques.length} techniques
                </span>
              )}
            </div>
            {team.website && (
              <a
                href={team.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
              >
                Visit team website
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            )}
          </motion.div>
          {team.logoUrl && (
            <div className="h-32 w-32 overflow-hidden rounded-3xl border border-border bg-background/80">
              <img src={team.logoUrl} alt={team.name} className="h-full w-full object-cover" />
            </div>
          )}
        </div>

        {teamPhotos.length > 0 && (
          <div className="mt-8 rounded-3xl border border-border bg-card/70 p-6">
            <h2 className="text-lg font-semibold text-foreground">Team gallery</h2>
            <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
              {teamPhotos.map((photo, index) => {
                const alt = `${team.name} photo - ${photo.name}`;
                return (
                  <button
                    key={photo.url}
                    type="button"
                    onClick={() => setPhotoPreview({ index })}
                    className="h-40 w-60 flex-shrink-0 overflow-hidden rounded-2xl border border-border bg-background cursor-zoom-in"
                    aria-label={`Open ${alt}`}
                  >
                    <img src={photo.url} alt={alt} className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {team.descriptionLong && (
          <div className="mt-8 rounded-3xl border border-border bg-card/70 p-6">
            <h2 className="text-lg font-semibold text-foreground">About this team</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {team.descriptionLong}
            </p>
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-border bg-card/70 p-6">
          <h2 className="text-lg font-semibold text-foreground">Equipment</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Priority equipment is highlighted first, followed by the full list.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
            {primaryEquipment.map(item => (
              <span key={item} className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1 font-semibold text-primary">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
            {(showAllEquipment ? remainingEquipment : remainingEquipment.slice(0, 6)).map(item => (
              <div key={item} className="inline-flex items-center gap-2">
                <Beaker className="h-4 w-4 text-primary" />
                {item}
              </div>
            ))}
            {teamEquipment.length === 0 && <span>No equipment listed yet.</span>}
          </div>
          {remainingEquipment.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllEquipment(prev => !prev)}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              {showAllEquipment ? "Show fewer" : `Show ${remainingEquipment.length - 6} more`}
            </button>
          )}
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card/70 p-6">
          <h2 className="text-lg font-semibold text-foreground">Techniques & expertise</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Detailed methods and domains where the team delivers value.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {teamTechniques.map(technique => (
              <div key={technique.name} className="rounded-2xl border border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{technique.name}</p>
                {technique.description && (
                  <p className="mt-2 text-xs text-muted-foreground">{technique.description}</p>
                )}
              </div>
            ))}
            {teamTechniques.length === 0 && (
              <p className="text-sm text-muted-foreground">No techniques listed yet.</p>
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card/70 p-6">
            <h2 className="text-lg font-semibold text-foreground">Focus areas</h2>
            <p className="mt-2 text-sm text-muted-foreground">Scientific domains the team supports.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
              {teamFocusAreas.map(area => (
                <span key={area} className="rounded-full border border-border px-3 py-1">
                  {area}
                </span>
              ))}
              {teamFocusAreas.length === 0 && <span>No focus areas listed yet.</span>}
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-card/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Team members</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Meet the people leading this research team.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMembers(true)}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                View team
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
            {leadMembers.length > 0 && (
              <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Lead</p>
                {leadMembers.map(member => (
                  <p key={member.name} className="mt-2 text-sm font-medium text-foreground">
                    {member.name} - {member.role}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>

        {team.labs.length > 0 && (
          <section className="mt-8 rounded-3xl border border-border bg-card/70 p-6">
            <h2 className="text-lg font-semibold text-foreground">Connected labs</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The labs this team is linked to.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {team.labs.map(lab => (
                <Link
                  href={`/labs/${lab.id}`}
                  key={lab.id}
                  className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  {lab.logoUrl && (
                    <img
                      src={lab.logoUrl}
                      alt={lab.name}
                      className="h-10 w-10 rounded-full border border-border object-cover"
                    />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{lab.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[lab.city, lab.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {showMembers && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 py-8">
          <div className="w-full max-w-3xl rounded-3xl border border-border bg-background p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Team members</h3>
              <button
                type="button"
                onClick={() => setShowMembers(false)}
                className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:border-primary hover:text-primary"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {leadMembers.map(member => (
                <div key={member.name} className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Lead</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                  {(member.linkedin || member.website) && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {member.linkedin && (
                        <a
                          href={member.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 hover:border-primary hover:text-primary"
                        >
                          LinkedIn
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      )}
                      {member.website && (
                        <a
                          href={member.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 hover:border-primary hover:text-primary"
                        >
                          Website
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {otherMembers.map(member => (
                <div key={member.name} className="rounded-2xl border border-border px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                  {(member.linkedin || member.website) && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {member.linkedin && (
                        <a
                          href={member.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 hover:border-primary hover:text-primary"
                        >
                          LinkedIn
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      )}
                      {member.website && (
                        <a
                          href={member.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 hover:border-primary hover:text-primary"
                        >
                          Website
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {leadMembers.length === 0 && otherMembers.length === 0 && (
                <p className="text-sm text-muted-foreground">No members listed yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {photoPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur"
          onClick={() => setPhotoPreview(null)}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/30 bg-white/25 shadow-2xl backdrop-blur-2xl"
            onClick={event => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPhotoPreview(null)}
              className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/25 text-sm text-white/90 backdrop-blur transition hover:bg-white/40"
              aria-label="Close"
            >
              ✕
            </button>
            <div className="relative flex items-center justify-center bg-white/10 p-4">
              <button
                type="button"
                onClick={() =>
                  setPhotoPreview(prev => {
                    if (!prev) return prev;
                    const total = teamPhotos.length;
                    const nextIndex = (prev.index - 1 + total) % total;
                    return { index: nextIndex };
                  })
                }
                className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/25 text-white/90 backdrop-blur transition hover:bg-white/40"
                aria-label="Previous photo"
              >
                ‹
              </button>
              <img
                src={teamPhotos[photoPreview.index]?.url ?? ""}
                alt={`${team.name} photo ${photoPreview.index + 1} - ${teamPhotos[photoPreview.index]?.name ?? ""}`}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-2xl"
              />
              <button
                type="button"
                onClick={() =>
                  setPhotoPreview(prev => {
                    if (!prev) return prev;
                    const total = teamPhotos.length;
                    const nextIndex = (prev.index + 1) % total;
                    return { index: nextIndex };
                  })
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-white/25 text-white/90 backdrop-blur transition hover:bg-white/40"
                aria-label="Next photo"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
