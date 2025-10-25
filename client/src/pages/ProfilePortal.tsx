import { motion } from "framer-motion";
import { Link } from "wouter";
import type { ReactNode } from "react";

export default function ProfilePortal() {
  const inputClasses = "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 lg:py-24 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl space-y-4">
            <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
              Account preview
            </span>
            <h1 className="text-4xl font-semibold text-foreground">Your Glass profile</h1>
            <p className="text-muted-foreground">
              This page will eventually show your verified status, saved labs, requests, and billing. For now we have a
              lightweight placeholder so you can design flows around it while we wire up real authentication.
            </p>
          </div>
          <Link href="/labs">
            <a className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-primary hover:border-primary">
              Browse labs
            </a>
          </Link>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-foreground">Sign in</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We will connect this form to real authentication shortly. Until then, treat it as a design stub.
            </p>
            <form className="mt-6 space-y-4" onSubmit={event => event.preventDefault()}>
              <Field label="Email address">
                <input type="email" className={inputClasses} placeholder="you@glass.bio" disabled />
              </Field>
              <Field label="Password">
                <input type="password" className={inputClasses} placeholder="••••••••" disabled />
              </Field>
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-60"
                disabled
              >
                Sign in (coming soon)
              </button>
              <p className="text-xs text-center text-muted-foreground">
                Passwordless + social auth will be available once the backend is wired.
              </p>
            </form>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-foreground">Create your profile</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Capture the information we’ll store once auth is live. You can still design the UX and connect it later.
            </p>
            <form className="mt-6 space-y-4" onSubmit={event => event.preventDefault()}>
              <Field label="Full name">
                <input className={inputClasses} placeholder="Jordan Reyes" disabled />
              </Field>
              <Field label="Organization">
                <input className={inputClasses} placeholder="Atlas Applied Biology" disabled />
              </Field>
              <Field label="Role / title">
                <input className={inputClasses} placeholder="Program Lead" disabled />
              </Field>
              <Field label="Verification details">
                <textarea
                  className={`${inputClasses} min-h-[100px]`}
                  placeholder="Links, references, or anything to speed up verification"
                  disabled
                />
              </Field>
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-full border border-dashed border-border px-4 py-2 text-sm font-medium text-muted-foreground opacity-60"
                disabled
              >
                Save profile (backend pending)
              </button>
            </form>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
        >
          <h3 className="text-lg font-semibold text-foreground">What’s next</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Once auth is ready, this space will show your pending lab requests, subscription status, verification badge,
            and saved favorites. Feel free to add layout ideas or additional sections—we’ll plug in the data later.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="font-semibold text-foreground">Profile basics</p>
              <p className="mt-1">Name, organization, role, and verification documents.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="font-semibold text-foreground">Lab activity</p>
              <p className="mt-1">Submitted requests, approval states, and delivery cadence.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
              <p className="font-semibold text-foreground">Billing & membership</p>
              <p className="mt-1">Stripe-powered plans will surface here once subscriptions launch.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {children}
    </div>
  );
}
