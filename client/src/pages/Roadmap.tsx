
const phases = [
  {
    title: "Phase 0 — Foundation",
    copy:
      "Build the core GLASS-Connect directory with structured lab profiles, capability tags, and ownership so every listing stays accurate.",
  },
  {
    title: "Phase 1 — Verified Profiles",
    copy:
      "Launch remote/on-site verification, richer filtering (methods, equipment, availability), and clearer contact preferences for each lab.",
  },
  {
    title: "Phase 2 — Requests & Routing",
    copy:
      "Add scoped request forms, calendar-aware introductions, and response SLAs so collaborators hear back quickly from the right contact.",
  },
  {
    title: "Phase 3 — Integrations & API",
    copy:
      "Ship export/API access for operators, light CRM hooks, and data freshness signals so networks can keep many labs current with less effort.",
  },
];

const history = [
  {
    title: "Network search",
    copy: "Tagging, filtering, and sorting improvements for labs across institutions and partners.",
  },
  {
    title: "Profile polish",
    copy: "Cleaner capability blocks, equipment highlights, and collaboration preferences visible at a glance.",
  },
  {
    title: "Verified badge",
    copy: "Remote verification pilot to improve trust and reduce back-and-forth for partners.",
  },
];

export default function Roadmap() {
  return (
    <div className="min-h-screen bg-background pt-32 pb-32">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Product Roadmap</h1>
          <p className="text-lg text-muted-foreground">
            We’re building GLASS-Connect to make lab discovery and collaboration straightforward. Below is the current plan and
            what’s already shipped to turn GLASS-Connect into the trusted hub for listing, verifying, and connecting labs.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,_1.1fr)_minmax(0,_0.9fr)] lg:items-start">
          <div className="bg-card border border-border rounded-3xl shadow-sm p-8 lg:p-10 h-full">
            <h2 className="text-2xl font-semibold mb-6">Roadmap Overview</h2>

            <div className="space-y-10 text-muted-foreground leading-relaxed">
              {phases.map(phase => (
                <div key={phase.title}>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{phase.title}</h3>
                  <p>{phase.copy}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 border-t border-border pt-8">
              <h3 className="text-2xl font-semibold mb-4 text-foreground">Our Long-Term Vision</h3>
              <p className="text-muted-foreground leading-relaxed">
                GLASS-Connect aims to become the trusted bridge between labs and collaborators—one place to find verified
                capabilities, contact real humans, and keep network data current without heavy tooling.
              </p>
            </div>
          </div>

          <div className="bg-card/80 border border-border rounded-3xl shadow-sm p-8">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Recent progress</h2>
            <div className="space-y-4 text-muted-foreground">
              {history.map(item => (
                <div key={item.title} className="rounded-2xl border border-border/70 bg-background p-4">
                  <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="h-24" />
      </div>
    </div>
  );
}
