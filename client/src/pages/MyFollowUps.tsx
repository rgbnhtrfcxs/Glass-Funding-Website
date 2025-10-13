import { Link } from "wouter";
import { Wallet, Coins, CalendarDays, ArrowUpRight, Mail } from "lucide-react";
import { portfolioProjects } from "@/data/mockWorkspace";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const totalCommitted = portfolioProjects.reduce((acc, project) => acc + project.committed, 0);
const totalReleased = portfolioProjects.reduce((acc, project) => acc + project.released, 0);
const activePositions = portfolioProjects.filter(project => project.status === "Active").length;
const releaseRate = totalCommitted > 0 ? Math.round((totalReleased / totalCommitted) * 100) : 0;

const statusVariant: Record<"Active" | "Completed" | "Pending", "secondary" | "default" | "outline"> = {
  Active: "secondary",
  Completed: "default",
  Pending: "outline",
};

const statusLabel: Record<"Active" | "Completed" | "Pending", string> = {
  Active: "Live",
  Completed: "Completed",
  Pending: "Pending launch",
};

export default function MyFollowups() {
  return (
    <div className="min-h-screen bg-muted/10 pb-24">
      <div className="container mx-auto px-4 pt-32">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">My Portfolio</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              A consolidated view of every project you&apos;ve backed. Track capital deployment, follow milestone
              progress, and stay current on the latest research updates.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Committed capital</p>
              <p className="mt-2 text-2xl font-semibold">€{totalCommitted.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Released</p>
              <p className="mt-2 text-2xl font-semibold">€{totalReleased.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Release rate</p>
              <p className="mt-2 text-2xl font-semibold">{releaseRate}%</p>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Active positions</p>
              <p className="mt-2 text-2xl font-semibold">{activePositions}</p>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-6">
          {portfolioProjects.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-muted/30 p-16 text-center">
              <p className="text-lg font-medium">No funded projects yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Once you donate, those projects will appear here with milestone tracking.
              </p>
              <Link href="/projects">
                <a className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
                  Browse opportunities
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </Link>
            </div>
          ) : (
            portfolioProjects.map(project => (
              <div
                key={project.id}
                className="rounded-3xl border border-border bg-card p-6 lg:p-8 shadow-sm hover:shadow-md transition"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-semibold">{project.title}</h2>
                      <Badge variant="secondary">{project.type}</Badge>
                      <Badge variant={statusVariant[project.status]}>{statusLabel[project.status]}</Badge>
                      <Badge variant="outline">{project.category}</Badge>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                          <Wallet className="h-3.5 w-3.5" />
                          Committed
                        </div>
                        <p className="mt-2 text-lg font-semibold">
                          €{project.committed.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {project.status === "Active" ? "Recurring donation schedule active" : "One-time donation recorded"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                          <Coins className="h-3.5 w-3.5" />
                          Released
                        </div>
                        <p className="mt-2 text-lg font-semibold">
                          €{project.released.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Donations disbursed to date
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Next milestone
                        </div>
                        <p className="mt-2 text-sm font-medium">
                          {project.nextMilestone?.title ?? "Pending milestone"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {project.nextMilestone?.date ?? "To be scheduled"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span>Milestone progress</span>
                        <span>{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} className="mt-3 h-2 rounded-full" />
                    </div>

                    <div className="rounded-2xl border border-border bg-background/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest update</p>
                      <p className="mt-2 text-sm text-foreground">{project.latestUpdate}</p>
                    </div>

                    {project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {project.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/80 px-5 py-5 min-w-[230px]">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Research lead</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{project.researchLead}</p>
                      <a
                        href={`mailto:${project.contactEmail}`}
                        className="group mt-2 inline-flex items-center gap-2 text-xs text-primary hover:underline"
                      >
                        <Mail className="h-4 w-4 group-hover:text-primary" />
                        {project.contactEmail}
                      </a>
                    </div>

                    <Link href={project.followUpLink}>
                      <a className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
                        View updates
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
