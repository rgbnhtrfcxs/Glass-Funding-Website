import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Users,
  Sparkles,
  Clock3,
  CheckCircle2,
  CircleDot,
  FileText,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { mockFollowUp, FollowUpItem } from "@/data/mockFollowUp";

type TimelineStatus = NonNullable<FollowUpItem["timeline"]>[number]["status"];

const statusMeta: Record<
  TimelineStatus,
  { label: string; tone: string; icon: typeof CheckCircle2 }
> = {
  complete: { label: "Complete", tone: "text-emerald-500", icon: CheckCircle2 },
  "in progress": { label: "In progress", tone: "text-primary", icon: CircleDot },
  pending: { label: "Pending", tone: "text-muted-foreground", icon: Clock3 },
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

function getLatestUpdate(project: FollowUpItem) {
  return project.updates?.reduce<FollowUpItem["updates"][number] | undefined>((latest, entry) => {
    if (!latest) return entry;
    return new Date(entry.date) > new Date(latest.date) ? entry : latest;
  }, undefined);
}

export default function FollowUpStory() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const project = mockFollowUp.find(entry => entry.id.toString() === id);

  if (!project) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 pt-32 pb-24 text-center">
          <div className="inline-block rounded-3xl border border-border bg-card px-6 py-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-foreground">Follow-up not found</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              The story you&apos;re looking for may have been moved or is unavailable.
            </p>
            <button
              type="button"
              onClick={() => navigate("/followups")}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to follow-ups
            </button>
          </div>
        </div>
      </section>
    );
  }

  const percentComplete = Math.min(project.progress ?? 0, 100);
  const supporters = project.donors ?? 0;
  const latestUpdate = getLatestUpdate(project);

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 pt-28 pb-24">
        <button
          type="button"
          onClick={() => navigate("/followups")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to follow-ups
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
                <span className="rounded-full border border-border px-3 py-1 text-muted-foreground/90">
                  {project.visibility === "private" ? "Private updates" : "Public updates"}
                </span>
              </div>

              <h1 className="mt-6 text-3xl font-semibold text-foreground md:text-4xl">{project.name}</h1>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed">{project.description}</p>

              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background/80 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Funded</p>
                  <p className="mt-3 text-2xl font-semibold text-foreground">{formatCurrency(project.funded)}</p>
                  <p className="text-xs text-muted-foreground">
                    Goal {formatCurrency(project.goal)}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Funded on {formatDate(project.dateFunded)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background/80 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Progress</p>
                  <p className="mt-3 text-2xl font-semibold text-foreground">{percentComplete}%</p>
                  <Progress value={percentComplete} className="mt-4 h-2 rounded-full" />
                  <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-4 w-4 text-primary" />
                    {supporters.toLocaleString()} supporters following along
                  </p>
                </div>
              </div>

              {latestUpdate && (
                <div className="mt-8 rounded-2xl border border-border bg-background/70 px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Latest update</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {latestUpdate.content}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Posted {formatDate(latestUpdate.date)}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-5">
              {project.researcher && (
                <div className="rounded-2xl border border-border bg-background/60 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Research team</p>
                  <p className="mt-3 text-lg font-semibold text-foreground">{project.researcher.name}</p>
                  <p className="text-sm text-muted-foreground">{project.researcher.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{project.researcher.institution}</p>
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

              {project.tokenPerformance && (
                <div className="rounded-2xl border border-border bg-background/60 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Performance</p>
                  <p className="mt-3 text-lg font-semibold text-primary">{project.tokenPerformance}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Campaign-level signal on how supporters value this research.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {project.timeline && project.timeline.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-12 rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-foreground">Project timeline</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Milestones move from pending to complete as evidence is shared with supporters.
            </p>
            <div className="mt-6 space-y-4">
              {project.timeline.map((step, index) => {
                const meta = statusMeta[step.status];
                const Icon = meta.icon;

                return (
                  <div
                    key={`${step.title}-${index}`}
                    className="flex flex-col gap-2 rounded-2xl border border-border bg-background/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(step.date)}</p>
                    </div>
                    <div className={`inline-flex items-center gap-2 text-xs font-medium ${meta.tone}`}>
                      <Icon className="h-4 w-4" />
                      {meta.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {project.milestones && project.milestones.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-12 rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-foreground">What&apos;s been accomplished</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {project.milestones.map((milestone, index) => (
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

        {project.updates && project.updates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-12 rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-foreground">Field notes</h2>
            <div className="mt-6 space-y-5">
              {project.updates.map((update, index) => (
                <div
                  key={`${update.date}-${index}`}
                  className="rounded-2xl border border-border bg-background/70 px-5 py-4"
                >
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    {formatDate(update.date)}
                  </p>
                  <p className="mt-2 text-sm text-foreground leading-relaxed">{update.content}</p>
                  {update.image && (
                    <img
                      src={update.image}
                      alt="Project update"
                      className="mt-3 w-full rounded-2xl border border-border object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
