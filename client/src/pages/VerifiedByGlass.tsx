import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, ClipboardCheck, ShieldAlert, ShieldCheck } from "lucide-react";
import { GlassIdCard, type GlassIdCardData } from "@/components/GlassIdCard";

const sampleCard: GlassIdCardData = {
  glassId: "GLS-4C12-8A37",
  labName: "Northbridge Biofacility",
  location: "Cambridge, United Kingdom",
  countryCode: "GB",
  isActive: true,
  issuedAt: "2026-01-10",
};

const checks = [
  {
    title: "Identity and ownership",
    description: "We validate core organization details and responsible operators before assigning verified status.",
    icon: BadgeCheck,
  },
  {
    title: "Operational profile",
    description: "We review key profile information so collaborators can trust how your lab is represented.",
    icon: ClipboardCheck,
  },
  {
    title: "Equipment and techniques",
    description: "We verify listed equipment and techniques so collaborators can trust what your lab can actually deliver.",
    icon: ShieldCheck,
  },
] as const;

const boundaries = [
  "Verification confirms trust signals and accountability status, not scientific outcomes.",
  "It does not replace contract diligence, legal review, or partner-specific compliance checks.",
  "It does not guarantee fit for every project; partners still assess technical scope and timelines.",
] as const;

export default function VerifiedByGlass() {
  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border bg-[linear-gradient(135deg,rgba(16,185,129,0.11)_0%,rgba(2,132,199,0.08)_40%,rgba(15,23,42,0.06)_100%)]">
        <div className="container mx-auto px-4 py-20 lg:py-24">
          <div className="max-w-4xl">
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="text-sm uppercase tracking-[0.32em] text-muted-foreground"
            >
              Trust Framework
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="mt-4 text-4xl font-semibold leading-tight md:text-5xl"
            >
              Verified by GLASS
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground"
            >
              Verified by GLASS means a lab has passed review and remains accountable through ongoing standards. It is
              designed to make partner trust faster while keeping quality expectations clear.
            </motion.p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/labs">
                <a className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                  View verified labs
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Link>
              <Link href="/glass-id">
                <a className="inline-flex items-center justify-center rounded-full border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground">
                  Learn about GLASS-ID
                </a>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <h2 className="text-2xl font-semibold text-center">What we verify</h2>
          <p className="mt-3 max-w-3xl mx-auto text-center text-muted-foreground leading-relaxed">
            The goal is practical trust: reliable profile signals, clear accountability, and confidence for collaboration intake.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {checks.map(item => {
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
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold">What happens after verification</h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Once a lab is verified, GLASS issues a unique GLASS-ID credential. Partners can use it as a trusted reference
                in collaborations, procurement flows, and cross-lab coordination.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                If standards lapse, verified status and GLASS-ID status can be suspended or revoked.
              </p>
              <Link href="/glass-id">
                <a className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                  See GLASS-ID details
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Link>
            </div>

            <div className="flex justify-center lg:justify-end">
              <GlassIdCard data={sampleCard} variant="info" className="max-w-[420px]" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <h2 className="text-2xl font-semibold">What verification does not mean</h2>
          <div className="mt-6 grid gap-4">
            {boundaries.map(item => (
              <div key={item} className="rounded-2xl border border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 text-primary" />
                  <p>{item}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-semibold">Build with verified partners</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Use verified status and GLASS-ID together to reduce friction and build trusted collaborations faster.
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
