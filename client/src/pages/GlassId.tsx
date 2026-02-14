import { Link } from "wouter";
import { ArrowRight, BadgeCheck, ShieldCheck, Workflow } from "lucide-react";
import { motion } from "framer-motion";
import { GlassIdCard, type GlassIdCardData } from "@/components/GlassIdCard";

const sampleCard: GlassIdCardData = {
  glassId: "GLS-7F2A-9D41",
  labName: "Atlas Molecular Lab",
  location: "Boston, United States",
  countryCode: "US",
  isActive: true,
  issuedAt: "2026-01-08",
};

const valueProps = [
  {
    title: "Recognized Identity",
    description:
      "Your GLASS-ID gives your lab a consistent identity that partners can reference immediately across requests, evaluations, and collaborations.",
    icon: BadgeCheck,
  },
  {
    title: "Faster Partner Decisions",
    description:
      "Collaborators can verify that your lab is active and accountable through GLASS standards before they commit time to onboarding.",
    icon: Workflow,
  },
  {
    title: "Trust That Stays Earned",
    description:
      "The credential remains tied to verification outcomes. If audit or compliance requirements are not met, status can be suspended or revoked.",
    icon: ShieldCheck,
  },
] as const;

export default function GlassId() {
  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border bg-[linear-gradient(130deg,rgba(2,132,199,0.12)_0%,rgba(15,23,42,0.06)_35%,rgba(14,116,144,0.14)_100%)]">
        <div className="container mx-auto px-4 py-20 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <p className="text-sm uppercase tracking-[0.32em] text-muted-foreground">Industry Credential</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">GLASS-ID</h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                A unique identifier issued only to labs that become Verified by GLASS. It is designed to make trusted
                introductions faster and collaboration decisions easier.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/labs">
                  <a className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                    View verified labs
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Link>
                <Link href="/verified-by-glass">
                  <a className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground">
                    Learn about verification
                  </a>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex justify-center lg:justify-end"
            >
              <GlassIdCard data={sampleCard} variant="info" />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold">What is a GLASS-ID?</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              GLASS-ID is the identity credential assigned to a lab after verification is completed. It gives your
              organization a clear, portable reference for partner conversations, procurement flows, and collaboration
              intake across the network.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              It is not a marketing badge alone. It is an accountable status tied to your verification lifecycle.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {valueProps.map(item => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-3xl border border-border bg-card/70 p-6 shadow-sm">
                  <Icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-muted/30">
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <h2 className="text-2xl font-semibold text-center">How GLASS-ID is issued</h2>
          <div className="mx-auto mt-8 grid max-w-5xl gap-6 md:grid-cols-3">
            <article className="rounded-3xl border border-border bg-background p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Step 1</p>
              <h3 className="mt-3 text-lg font-semibold">Verification completed</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A lab completes the GLASS verification process and is approved as verified.
              </p>
            </article>
            <article className="rounded-3xl border border-border bg-background p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Step 2</p>
              <h3 className="mt-3 text-lg font-semibold">GLASS-ID generated</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                We issue a unique alphanumeric ID linked to the lab and verification status.
              </p>
            </article>
            <article className="rounded-3xl border border-border bg-background p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Step 3</p>
              <h3 className="mt-3 text-lg font-semibold">Status maintained</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The ID remains active while standards are maintained; it can be suspended or revoked if obligations are not met.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-semibold">For labs and collaborators</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Labs use GLASS-ID to present earned credibility. Collaborators use it to quickly confirm they are engaging
              with a verified and accountable partner.
            </p>
            <Link href="/labs">
              <a className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                Browse verified labs
                <ArrowRight className="h-4 w-4" />
              </a>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
