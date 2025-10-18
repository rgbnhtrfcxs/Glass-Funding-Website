import { Clock, Activity, CheckCircle, AlertTriangle } from "lucide-react";
import { Link } from "wouter";

const services = [
  {
    id: "glass-web",
    name: "Glass Web App",
    status: "Operational",
    uptime: "99.98%",
    lastIncident: "45 days ago",
    description: "Main fundraising experience for donors and researchers.",
  },
  {
    id: "payments",
    name: "Donations API",
    status: "Operational",
    uptime: "100%",
    lastIncident: "92 days ago",
    description: "Processes pledges, recurring donations, and receipts.",
  },
  {
    id: "updates",
    name: "Milestone Updates",
    status: "Degraded Performance",
    uptime: "99.2%",
    lastIncident: "Today",
    description: "Email and in-app follow-up notifications for donors.",
    note: "Delays of up to 2 hours while we upgrade the messaging queue.",
  },
  {
    id: "workspace",
    name: "Partner Workspace",
    status: "Operational",
    uptime: "99.9%",
    lastIncident: "18 days ago",
    description: "Grant management dashboards for research partners.",
  },
];

const history = [
  {
    date: "Today",
    severity: "minor",
    title: "Milestone updates queue delays",
    description:
      "Messages are sending successfully but slower than usual while we deploy enhanced analytics. We expect normal operation by 18:00 UTC.",
  },
  {
    date: "May 5",
    severity: "maintenance",
    title: "Planned maintenance: Workspace exports",
    description:
      "Completed scheduled maintenance from 01:00–03:00 UTC. Data exports were unavailable during this window.",
  },
  {
    date: "Apr 17",
    severity: "resolved",
    title: "Resolved: Donation webhook retries",
    description:
      "Some partners experienced delayed webhook confirmations. The backlog was cleared within 30 minutes and no donations were lost.",
  },
];

function statusColor(status: string) {
  if (status.toLowerCase().includes("degraded")) return "text-amber-500";
  if (status.toLowerCase().includes("maintenance")) return "text-blue-500";
  if (status.toLowerCase().includes("operational")) return "text-emerald-500";
  return "text-muted-foreground";
}

function historyIcon(severity: string) {
  if (severity === "minor") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (severity === "maintenance") return <Clock className="h-4 w-4 text-blue-500" />;
  return <CheckCircle className="h-4 w-4 text-emerald-500" />;
}

export default function Status() {
  const overallOperational = services.every(service => !service.status.toLowerCase().includes("degraded"));

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 pt-24 pb-20">
        <div className="max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            System status
          </span>
          <h1 className="mt-5 text-4xl font-semibold text-foreground">
            {overallOperational ? "All systems are operational." : "Some services are experiencing delays."}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            This page reports live availability across Glass infrastructure. We refresh these metrics every 60 seconds. For
            urgent issues, reach the team at{" "}
            <a className="text-primary hover:text-primary/80 transition" href="mailto:support@glass.org">
              support@glass.org
            </a>
            .
          </p>
        </div>

        <div className="mt-10 grid gap-6">
          {services.map(service => (
            <div key={service.id} className="rounded-3xl border border-border bg-card/90 p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <Activity className={`h-4 w-4 ${statusColor(service.status)}`} />
                    <h2 className="text-lg font-semibold text-foreground">{service.name}</h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
                  {service.note ? (
                    <p className="mt-2 rounded-2xl border border-amber-300/50 bg-amber-100/20 px-3 py-2 text-xs text-amber-700">
                      {service.note}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-1 text-right text-sm text-muted-foreground">
                  <span className={`font-semibold ${statusColor(service.status)}`}>{service.status}</span>
                  <span>30-day uptime: {service.uptime}</span>
                  <span>Last incident: {service.lastIncident}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <h2 className="text-xl font-semibold text-foreground">Recent updates</h2>
          <div className="mt-4 space-y-4">
            {history.map(item => (
              <div key={item.date + item.title} className="rounded-3xl border border-border bg-card/80 p-5 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    {historyIcon(item.severity)}
                    <span>{item.date}</span>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground md:text-right">
                    {item.severity === "maintenance" ? "Scheduled maintenance" : item.severity === "minor" ? "Minor" : "Resolved"}
                  </p>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 rounded-3xl border border-border bg-card/80 p-6 text-sm text-muted-foreground shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Need more detail?</h2>
          <p className="mt-2">
            Follow{" "}
            <Link href="/roadmap">
              <a className="text-primary hover:text-primary/80 transition">our public roadmap</a>
            </Link>{" "}
            for transparency on upcoming releases, or reach out to{" "}
            <a className="text-primary hover:text-primary/80 transition" href="mailto:infra@glass.org">
              infra@glass.org
            </a>{" "}
            for enterprise status reports.
          </p>
        </div>
      </div>
    </section>
  );
}
