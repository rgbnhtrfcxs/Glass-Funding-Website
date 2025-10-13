import { Link } from "wouter";
import { RefreshCcw, Clock, ArrowUpRight, Heart } from "lucide-react";
import { favoriteProjects } from "@/data/mockWorkspace";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const totalDonated = favoriteProjects.reduce((acc, project) => acc + project.donated, 0);
const activeAutoTopUps = favoriteProjects.filter(project => project.autoTopUp).length;

export default function Favorites() {
  return (
    <div className="min-h-screen bg-muted/20 pb-24">
      <div className="container mx-auto px-4 pt-32">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Favorite Projects</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">
              Quick access to the research you monitor most closely. These projects will appear first in updates and
              portfolio summaries.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="rounded-2xl border border-border bg-background px-5 py-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total committed</p>
              <p className="mt-2 text-2xl font-semibold">€{totalDonated.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-5 py-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Auto top-ups</p>
              <p className="mt-2 text-2xl font-semibold">{activeAutoTopUps}</p>
            </div>
          </div>
        </div>

        {favoriteProjects.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/30 p-16 text-center">
            <p className="text-lg font-medium">No saved projects yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Browse the research directory and tap the star icon to pin new projects here.
            </p>
            <Link href="/projects">
              <a className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
                Explore projects
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {favoriteProjects.map(project => (
              <div
                key={project.id}
                className="rounded-3xl border border-border bg-card p-6 lg:p-8 shadow-sm hover:shadow-md transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-semibold">{project.title}</h2>
                      <Badge variant="secondary">{project.category}</Badge>
                      <span className="text-xs font-medium text-muted-foreground">{project.addedAt}</span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
                      {project.latestUpdate}
                    </p>
                    {project.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {project.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/80 px-6 py-5 min-w-[220px]">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">You’ve donated</span>
                      <span className="font-semibold text-primary">€{project.donated.toLocaleString()}</span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span>{project.progressPercent}% funded</span>
                        <span>€{project.funded.toLocaleString()} / €{project.goal.toLocaleString()}</span>
                      </div>
                      <Progress value={project.progressPercent} className="mt-3 h-2 rounded-full" />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Heart className="h-4 w-4" />
                      Highlighted in supporter digest
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <RefreshCcw className="h-4 w-4" />
                      Auto top-up {project.autoTopUp ? "enabled" : "off"}
                    </div>
                    {project.nextMilestone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {project.nextMilestone.title} · {project.nextMilestone.date}
                      </div>
                    )}
                    <Link href={`/projects/${project.id}`}>
                      <a className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
                        View project
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
