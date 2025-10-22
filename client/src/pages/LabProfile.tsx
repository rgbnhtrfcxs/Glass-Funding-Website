import { motion } from "framer-motion";
import { Link } from "wouter";
import { ClipboardList, FileCheck, ShieldCheck, UploadCloud } from "lucide-react";

export default function LabProfile() {
  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-24 lg:py-28 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <span className="text-sm uppercase tracking-[0.35em] text-muted-foreground">
            Lab profile setup
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-foreground">
            Share the essentials about your lab before it appears in listings.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Lab managers can use this guide to collect everything needed for the public listing and verification badge.
            Once you have the details and documents ready, jump into the editor to publish or update your profile.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-12 grid gap-6 md:grid-cols-2"
        >
          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">What to prepare</h2>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <li>Core lab details: location, lab manager, contact email, and equipment list.</li>
              <li>Focus areas and booking offers (monthly, hourly, day rates, or equipment-only access).</li>
              <li>Minimum stay expectations and any special onboarding notes for new teams.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <UploadCloud className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Upload requirements</h2>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <li>High-quality photos of the facility and key equipment (at least one required).</li>
              <li>Optional hosted photo URLs if your lab already has imagery online.</li>
              <li>Safety/compliance certificates (PDF) to display alongside credential summaries.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Verification badge checklist</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              After you submit your profile, Glass coordinates a location-based site visit. A representative will confirm the
              equipment, access controls, and safety documentation on file. Keep digital copies handy for the visit and make
              sure the listed contact can host the walkthrough.
            </p>
            <div className="mt-4 rounded-2xl border border-border bg-background/60 p-5 text-sm text-muted-foreground">
              <p>
                Remember: rental agreements, insurance coverage, and day-to-day operations stay between your team and the
                researchers. Glass provides the marketplace and verification layer, but does not intermediate leases or
                liability.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-12 flex flex-wrap gap-3"
        >
          <Link href="/admin/labs">
            <a className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary">
              Open lab editor
            </a>
          </Link>
          <Link href="/pricing">
            <a className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary">
              Review listing pricing
            </a>
          </Link>
          <a
            href="mailto:support@glass.demo"
            className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
          >
            Contact the Glass team
          </a>
        </motion.div>
      </div>
    </section>
  );
}
