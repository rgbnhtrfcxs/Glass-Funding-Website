import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, Filter, ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import { mockResearch } from "@/data/mockResearch";
import type { ResearchItem } from "@/data/mockResearch";

type SortKey = "name" | "closingSoon" | "percentFunded" | "goal";
type ViewMode = "grid" | "rows";

const categories = ["All", ...Array.from(new Set(mockResearch.map(item => item.category)))];

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "closingSoon", label: "Closing soon" },
  { value: "percentFunded", label: "Lowest % funded" },
  { value: "goal", label: "Largest goal" },
  { value: "name", label: "A → Z" },
];

function getPercent(project: ResearchItem) {
  return Math.min(Math.round((project.funded / project.goal) * 100), 100);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Research() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("closingSoon");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const filteredProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return mockResearch
      .filter(project => {
        if (selectedCategory !== "All" && project.category !== selectedCategory) {
          return false;
        }
        if (!normalizedSearch) {
          return true;
        }
        const target = [
          project.name,
          project.category,
          project.description,
          project.researcher?.name,
          project.impactTags?.join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return target.includes(normalizedSearch);
      })
      .sort((a, b) => {
        if (sortKey === "name") {
          return a.name.localeCompare(b.name);
        }
        if (sortKey === "goal") {
          return b.goal - a.goal;
        }
        if (sortKey === "percentFunded") {
          return getPercent(a) - getPercent(b);
        }
        if (sortKey === "closingSoon") {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        return 0;
      });
  }, [search, selectedCategory, sortKey]);

  const activeProjects = filteredProjects.length;
  const totalNeeded = filteredProjects.reduce((acc, project) => acc + Math.max(project.goal - project.funded, 0), 0);

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <span className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Explore</span>
          <h1 className="mt-4 text-4xl md:text-5xl font-semibold leading-tight">
            Discover the research you can invest in today.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Every project listed on Glass has passed our scientific review. Filter by domain, check progress,
            and choose the discoveries you want to accelerate.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-10 grid gap-6 md:grid-cols-3"
        >
          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">Active</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">{activeProjects} projects</p>
            <p className="mt-1 text-sm text-muted-foreground">Available to invest or donate right now.</p>
          </div>
          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">Funding need</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">{formatCurrency(totalNeeded)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Remaining capital to complete current milestones.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <ArrowDownAZ className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">Sort</span>
            </div>
            <select
              value={sortKey}
              onChange={event => setSortKey(event.target.value as SortKey)}
              className="mt-3 w-full rounded-full border border-border bg-background px-4 py-2 text-sm"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Organise the list to surface the research you want to back.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex flex-wrap gap-3">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  selectedCategory === category
                    ? "border-transparent bg-primary text-primary-foreground shadow-md"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Search projects, teams, impact areas…"
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="w-full sm:w-64 rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex h-10 rounded-full border border-border overflow-hidden">
              <button
                className={`px-4 text-sm font-medium transition ${
                  viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("grid")}
              >
                Grid
              </button>
              <button
                className={`px-4 text-sm font-medium transition ${
                  viewMode === "rows" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("rows")}
              >
                Rows
              </button>
            </div>
          </div>
        </motion.div>

        {filteredProjects.length === 0 ? (
          <div className="mt-16 rounded-3xl border border-border bg-muted/30 p-12 text-center text-muted-foreground">
            <p className="text-lg font-medium text-foreground">No projects match your filters (yet).</p>
            <p className="mt-2 text-sm">
              Clear the filters or check back soon—new science is being reviewed every week.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map(project => {
              const percent = getPercent(project);
              const remaining = Math.max(project.goal - project.funded, 0);

              return (
                <motion.article
                  key={project.id}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col rounded-3xl border border-border bg-card/90 shadow-sm hover:shadow-lg transition"
                >
                  <div className="p-6 flex-1">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      <span>{project.category}</span>
                      <span className="flex items-center gap-2 text-foreground font-medium">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Grade {project.grade}
                      </span>
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold text-foreground">{project.name}</h3>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{project.description}</p>

                    <div className="mt-5 space-y-3">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Raised</span>
                        <span>{formatCurrency(project.funded)} / {formatCurrency(project.goal)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-primary to-blue-400 transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{percent}% funded</span>
                        <span>{formatCurrency(remaining)} remaining</span>
                      </div>
                    </div>

                    <dl className="mt-6 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                      <div>
                        <dt className="font-semibold text-foreground">Research lead</dt>
                        <dd className="mt-1">{project.researcher?.name ?? "Glass team"}</dd>
                        <dd>{project.researcher?.institution ?? ""}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-foreground">Supporters</dt>
                        <dd className="mt-1">{project.donors?.toLocaleString() ?? "—"} backers</dd>
                        <dd>Closes {new Date(project.date).toLocaleDateString()}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="border-t border-border bg-muted/20 px-6 py-4 flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Invest from €100</span>
                    <button
                      onClick={() => navigate(`/investflow?projectId=${project.id}`)}
                      className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
                    >
                      Invest
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        ) : (
          <div className="mt-12 rounded-3xl border border-border bg-card/90 shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/30">
                <tr className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <th className="px-4 py-3 text-left">Project</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Goal</th>
                  <th className="px-4 py-3 text-left">Raised</th>
                  <th className="px-4 py-3 text-left">Progress</th>
                  <th className="px-4 py-3 text-left">Closing</th>
                  <th className="px-4 py-3 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(project => {
                  const percent = getPercent(project);
                  const remaining = Math.max(project.goal - project.funded, 0);

                  return (
                    <tr
                      key={project.id}
                      className="border-b border-border/80 hover:bg-muted/20 transition"
                    >
                      <td className="px-4 py-4">
                        <p className="font-medium text-primary underline cursor-pointer" onClick={() => navigate(`/research-details/${project.id}`)}>
                          {project.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Lead {project.researcher?.name ?? "Glass team"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{project.category}</td>
                      <td className="px-4 py-4">{formatCurrency(project.goal)}</td>
                      <td className="px-4 py-4">
                        {formatCurrency(project.funded)}
                        <span className="block text-xs text-muted-foreground">
                          {formatCurrency(remaining)} to go
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="w-32">
                          <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-primary to-blue-400 transition-all"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{percent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {new Date(project.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => navigate(`/investflow?projectId=${project.id}`)}
                          className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition"
                        >
                          Invest
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
