import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { PartnerLogos } from "@/components/sections/PartnerLogos";
import { WaitlistDialog } from "@/components/waitlist/waitlist-dialog";

const howItWorks = [
  {
    title: "1. Publish your lab",
    description: "Share your capabilities, equipment, and collaboration preferences in a structured profile built for scientists.",
  },
  {
    title: "2. Verify once",
    description: "We run a light remote/on-site verification so partners know the details are accurate and trusted.",
  },
  {
    title: "3. Connect quickly",
    description: "Inbound requests are routed straight to your team. Share availability, manage intros, and stay visible to the network.",
  },
] as const;

const audiences = [
  {
    title: "Labs & Core Facilities",
    description: "List your capabilities, surface underused equipment, and make it easy for peers and partners to collaborate.",
  },
  {
    title: "Network Operators",
    description: "Manage multiple labs with consistent profiles, verification, and routing that respects each site’s preferences.",
  },
  {
    title: "Industry & Partners",
    description: "Find trusted collaborators faster, with clear capabilities, contact paths, and lightweight governance.",
  },
] as const;

const networkBenefits = [
  {
    title: "Standardised discovery",
    description: "Profiles use the same structure across labs, so partners can compare expertise, equipment, and availability quickly.",
  },
  {
    title: "Trusted details",
    description: "Verification checks make it clear what’s real, what’s available, and who to reach without endless back-and-forth.",
  },
  {
    title: "Less time chasing",
    description: "GLASS-Connect routes qualified requests to the right people, helping teams spend more time collaborating.",
  },
] as const;

export default function About() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border bg-muted/30">
        <div className="container mx-auto px-4 py-20 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Why we started GLASS-Connect</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
              Science deserves collaboration that’s fast, clear, and trusted.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Labs have incredible capabilities, but no simple way to share them or filter serious collaboration requests
              from noise. GLASS-Connect is a directory and routing layer for labs: structured profiles, light verification,
              and direct introductions so teams can work together faster—without adding bureaucracy.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/roadmap">
                <a className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                  Explore the roadmap
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Link>
              <button
                onClick={() => setWaitlistOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                Join the waitlist
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <h2 className="text-2xl font-semibold text-center">Why a lab network matters</h2>
          <p className="mt-3 max-w-3xl mx-auto text-center text-muted-foreground leading-relaxed">
            We built GLASS-Connect to make it effortless for partners to find, trust, and contact the right lab—without
            long chains of introductions or hidden spreadsheets.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {networkBenefits.map(point => (
              <div key={point.title} className="h-full rounded-3xl border border-border bg-background p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground">{point.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
            <article>
              <h2 className="text-2xl font-semibold">What is GLASS-Connect?</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                GLASS-Connect is a directory and routing layer for research labs. We standardise how labs present their
                capabilities, verify key details, and connect inbound collaborations without burying teams in admin.
              </p>
            </article>
            <article>
              <h2 className="text-2xl font-semibold">Why GLASS-Connect matters</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Today, capabilities are scattered across PDFs, cold emails, and outdated directories. GLASS-Connect gives
                every lab a clear presence and makes it simple for serious partners to reach the right people without
                chasing inboxes.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <h2 className="text-2xl font-semibold text-center">How Glass works</h2>
          <p className="mt-3 max-w-3xl mx-auto text-center text-muted-foreground leading-relaxed">
            We combine structured profiles with light verification and direct routing so collaborators can move from first
            contact to scoped work quickly.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {howItWorks.map(step => (
              <div key={step.title} className="h-full rounded-3xl border border-border bg-card p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-muted/30">
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <h2 className="text-2xl font-semibold text-center">Who we build for</h2>
          <p className="mt-3 max-w-3xl mx-auto text-center text-muted-foreground leading-relaxed">
            GLASS-Connect gives labs and partners a shared surface to collaborate—without forcing them into new workflows.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {audiences.map(card => (
              <div key={card.title} className="h-full rounded-3xl border border-border bg-background p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground">{card.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PartnerLogos />

      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <h2 className="text-2xl font-semibold text-center">Let’s connect labs faster</h2>
          <p className="mt-3 max-w-3xl mx-auto text-center text-muted-foreground leading-relaxed">
            Whether you manage a single lab or a network of facilities, GLASS-Connect gives you a clear, trusted place to
            showcase your work and meet collaborators.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/roadmap">
              <a className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                See what’s next
                <ArrowRight className="h-4 w-4" />
              </a>
            </Link>
            <button
              onClick={() => setWaitlistOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Join the waitlist
            </button>
          </div>
        </div>
      </section>

      <WaitlistDialog open={waitlistOpen} onOpenChange={setWaitlistOpen} />

    </div>
  );
}
