import { useParams, useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Sparkles, Users, Target, ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { mockResearch } from "@/data/mockResearch";
import { Progress } from "@/components/ui/progress";

const sdgDescriptions: Record<string, string> = {
  "UN SDG 1": "No Poverty",
  "UN SDG 2": "Zero Hunger",
  "UN SDG 3": "Good Health and Well-being",
  "UN SDG 4": "Quality Education",
  "UN SDG 5": "Gender Equality",
  "UN SDG 6": "Clean Water and Sanitation",
  "UN SDG 7": "Affordable and Clean Energy",
  "UN SDG 8": "Decent Work and Economic Growth",
  "UN SDG 9": "Industry, Innovation and Infrastructure",
  "UN SDG 10": "Reduced Inequalities",
  "UN SDG 11": "Sustainable Cities and Communities",
  "UN SDG 12": "Responsible Consumption and Production",
  "UN SDG 13": "Climate Action",
  "UN SDG 14": "Life Below Water",
  "UN SDG 15": "Life on Land",
  "UN SDG 16": "Peace, Justice and Strong Institutions",
  "UN SDG 17": "Partnerships for the Goals",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(input: string) {
  const date = new Date(input);
  return Number.isNaN(date.getTime())
    ? input
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const project = mockResearch.find(entry => entry.id.toString() === id);

  if (!project) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 pt-32 pb-24 text-center">
          <div className="inline-block rounded-3xl border border-border bg-card px-6 py-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-foreground">Project not found</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              The project you&apos;re looking for may have been moved or is unavailable.
            </p>
            <button
              type="button"
              onClick={() => navigate("/projects")}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to projects
            </button>
          </div>
        </div>
      </section>
    );
  }

  const percentFunded = Math.min(Math.round((project.funded / project.goal) * 100), 100);
  const remaining = Math.max(project.goal - project.funded, 0);
  const supporters = project.donors ?? 0;
  const closingDate = formatDate(project.date);
  const primaryMilestone = project.milestones?.[0];

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 pt-28 pb-24">
        <button
          type="button"
          onClick={() => navigate("/projects")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </button>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl border border-border bg-card/90 shadow-sm"
        >
          <div className="grid gap-8 p-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:p-12">
            <div>
              <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                <span className="rounded-full border border-border px-3 py-1 text-muted-foreground/90">
                  {project.category}
                </span>
                <span className="inline-flex items-center gap-2 text-foreground font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Grade {project.grade}
                </span>
              </div>
              <h1 className="mt-6 text-3xl font-semibold text-foreground md:text-4xl">{project.name}</h1>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed">{project.description}</p>

              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background/80 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Raised</p>
                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {formatCurrency(project.funded)}{" "}
                    <span className="text-sm text-muted-foreground">
                      / {formatCurrency(project.goal)}
                    </span>
                  </p>
                  <div className="mt-4">
                    <Progress value={percentFunded} className="h-2 rounded-full" />
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      <span>{percentFunded}% funded</span>
                      <span>{formatCurrency(remaining)} remaining</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-background/80 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Supporters</p>
                  <p className="mt-3 text-2xl font-semibold text-foreground">
                    {supporters.toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Funding window closes {closingDate}
                  </p>
                  {primaryMilestone && (
                    <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      <Target className="h-3.5 w-3.5 text-primary" />
                      Next milestone: {primaryMilestone.title}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={`/donateflow?projectId=${project.id}`}>
                  <button className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
                    Support this project
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
                <button
                  type="button"
                  onClick={() => navigate("/projects")}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition"
                >
                  Explore more projects
                </button>
              </div>
            </div>

            <div className="space-y-5">
              {project.researcher && (
                <div className="rounded-2xl border border-border bg-background/60 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Research lead</p>
                  <p className="mt-3 text-lg font-semibold text-foreground">{project.researcher.name}</p>
                  <p className="text-sm text-muted-foreground">{project.researcher.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{project.researcher.institution}</p>
                </div>
              )}

              {project.impactTags && project.impactTags.length > 0 && (
                <div className="rounded-2xl border border-border bg-background/60 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Impact tags</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {project.impactTags.map((tag, index) => {
                      const match = tag.match(/UN SDG (\d+)/);
                      const goal = match?.[1];
                      const url = goal ? `https://sdgs.un.org/goals/goal${goal}` : "#";
                      const tooltip = sdgDescriptions[tag] ?? tag;

                      return (
                        <a
                          key={`${tag}-${index}`}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={tooltip}
                          className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/60 transition"
                        >
                          {tag}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {project.documents && project.documents.length > 0 && (
                <div className="rounded-2xl border border-border bg-background/60 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Documents</p>
                  <ul className="mt-4 space-y-3 text-sm text-foreground">
                    {project.documents.map((doc, index) => (
                      <li key={`${doc.label}-${index}`}>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-primary hover:underline"
                        >
                          <FileText className="h-4 w-4" />
                          {doc.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {(project.milestones?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-12 rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-foreground">Milestones</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Transparent checkpoints that release funding as proof is shared.
            </p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {project.milestones?.map((milestone, index) => (
                <div
                  key={`${milestone.title}-${index}`}
                  className="rounded-2xl border border-border bg-background/70 px-5 py-4"
                >
                  <p className="text-sm font-semibold text-foreground">{milestone.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{milestone.description}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
