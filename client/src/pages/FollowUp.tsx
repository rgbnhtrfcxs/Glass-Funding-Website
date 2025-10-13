import { useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { CalendarDays, Users, Target, ArrowRight, Filter, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { mockFollowUp } from "@/data/mockFollowUp";

const publicProjects = mockFollowUp.filter(project => project.visibility !== "private");
const categories = ["All", ...Array.from(new Set(publicProjects.map(project => project.category)))];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getLatestUpdate(project: (typeof mockFollowUp)[number]) {
  return project.updates?.reduce<(typeof project.updates)[number] | undefined>((latest, entry) => {
    if (!latest) return entry;
    return new Date(entry.date) > new Date(latest.date) ? entry : latest;
  }, undefined);
}

function getNextMilestone(project: (typeof mockFollowUp)[number]) {
  return project.timeline?.find(item => item.status !== "complete");
}

export default function FollowUp() {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [search, setSearch] = useState("");

  const totalFunded = useMemo(
    () => publicProjects.reduce((acc, project) => acc + project.funded, 0),
    []
  );

  const totalSupporters = useMemo(
    () => publicProjects.reduce((acc, project) => acc + (project.donors ?? 0), 0),
    []
  );

  const filteredProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return publicProjects.filter(project => {
      const matchesCategory = activeCategory === "All" || project.category === activeCategory;
      if (!matchesCategory) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchTarget = [
        project.name,
        project.category,
        project.description,
        project.researcher?.name,
        project.impactTags?.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchTarget.includes(normalizedSearch);
    });
  }, [activeCategory, search]);

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 pt-28 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <span className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Progress</span>
          <h1 className="mt-4 text-4xl md:text-5xl font-semibold leading-tight">
            See how fully funded research is progressing.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Track milestones, read lab notes, and follow the projects your donations helped bring to life. Each card links
            to deeper updates from the teams in the field.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-12 grid gap-6 md:grid-cols-3"
        >
          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">Funded</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">{publicProjects.length} projects</p>
            <p className="mt-1 text-sm text-muted-foreground">Accessible updates for visitors.</p>
          </div>
          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">Total funded</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">{formatCurrency(totalFunded)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Across every public project.</p>
          </div>
          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">Supporters</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">{totalSupporters.toLocaleString()} people</p>
            <p className="mt-1 text-sm text-muted-foreground">Tracking progress alongside you.</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-12 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex flex-wrap gap-3">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  activeCategory === category
                    ? "border-transparent bg-primary text-primary-foreground shadow-md"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filter
            </div>
            <input
              type="search"
              placeholder="Search funded projects…"
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="w-full sm:w-64 rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </motion.div>

        {filteredProjects.length === 0 ? (
          <div className="mt-16 rounded-3xl border border-border bg-muted/30 p-12 text-center text-muted-foreground">
            <p className="text-lg font-medium text-foreground">No projects match those filters yet.</p>
            <p className="mt-2 text-sm">Try selecting a different category or clearing the search field.</p>
          </div>
        ) : (
          <div className="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map(project => {
              const latestUpdate = getLatestUpdate(project);
              const nextMilestone = getNextMilestone(project);

              return (
                <Link key={project.id} href={`/followups/${project.id}`}>
                  <motion.article
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                    className="flex h-full flex-col rounded-3xl border border-border bg-card/90 p-6 shadow-sm transition hover:shadow-lg hover:border-primary/40 cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      <span>{project.category}</span>
                      <span className="flex items-center gap-2 text-foreground font-medium">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Grade {project.grade}
                      </span>
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold text-foreground">{project.name}</h2>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-3">{project.description}</p>

                    <div className="mt-5 space-y-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Funded</span>
                        <span>{formatCurrency(project.funded)}</span>
                      </div>
                      <Progress value={project.progress ?? 0} className="h-2 rounded-full" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{project.progress ?? 0}% milestones complete</span>
                        <span>{(project.donors ?? 0).toLocaleString()} supporters</span>
                      </div>
                    </div>

                    {latestUpdate && (
                      <div className="mt-5 rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">Latest update</p>
                        <p className="mt-2 text-foreground text-sm leading-relaxed">{latestUpdate.content}</p>
                        <p className="mt-2 text-xs text-muted-foreground">Posted {new Date(latestUpdate.date).toLocaleDateString()}</p>
                      </div>
                    )}

                    <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <span>Funded {new Date(project.dateFunded).toLocaleDateString()}</span>
                      </div>
                      {nextMilestone ? (
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          <span>{nextMilestone.title}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          <span>Monitoring</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-2 text-sm font-medium text-primary">
                      View progress
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </motion.article>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
