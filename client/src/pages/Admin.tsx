import { Link } from "wouter";
import { FlaskConical, CalendarCheck, UserPlus, Users } from "lucide-react";

const PAGES = [
  {
    href: "/admin/users",
    icon: Users,
    title: "Users",
    description: "View all accounts, manage permissions and lab assignments.",
  },
  {
    href: "/admin/labs",
    icon: FlaskConical,
    title: "Labs",
    description: "Manage lab listings, details, and visibility.",
  },
  {
    href: "/admin/audit",
    icon: CalendarCheck,
    title: "Audit scheduling",
    description: "Configure availability slots and review audit bookings.",
  },
  {
    href: "/admin/invite",
    icon: UserPlus,
    title: "Invite users",
    description: "Send account invites directly via Brevo — one or in bulk.",
  },
];

export default function Admin() {
  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-20 lg:py-24 space-y-8">
        <div>
          <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Admin</span>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Select a section to manage.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAGES.map(({ href, icon: Icon, title, description }) => (
            <Link key={href} href={href}>
              <a className="group flex flex-col gap-3 rounded-2xl border border-border bg-card/90 p-6 hover:border-primary transition">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background group-hover:border-primary transition">
                  <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                </div>
              </a>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
