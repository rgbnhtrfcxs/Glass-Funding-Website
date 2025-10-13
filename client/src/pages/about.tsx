import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { PartnerLogos } from "@/components/sections/PartnerLogos";
import { Footer } from "@/components/sections/footer";
import { WaitlistDialog } from "@/components/waitlist/waitlist-dialog";

const howItWorks = [
  {
    title: "1. Surface the work that matters",
    description:
      "Researchers and grassroots teams share projects that are ready to move. The community helps review every submission so the ideas that resonate—no matter where they come from—make it onto Glass.",
  },
  {
    title: "2. Fund together with milestones",
    description:
      "Anyone can donate to specific milestones. Instead of blind grants, capital is unlocked as supporters see evidence, updates, and lab notes—all open by default.",
  },
  {
    title: "3. Track progress in public view",
    description:
      "Every project page shows what has been achieved, what is next, and how each contribution pushes the work forward. Discoveries stay in the sunlight where backers and the public can hold the process accountable.",
  },
];

const audiences = [
  {
    title: "Funders & Supporters",
    description:
      "Give citizens and philanthropists the tools to back frontier science with clarity, control, and updates that prove impact—no gatekeeping required.",
  },
  {
    title: "Universities & Labs",
    description:
      "Offer a streamlined path to connect with private funding and collaborators—helping projects move beyond academic pipelines and invite their communities into the journey.",
  },
  {
    title: "Innovators & Builders",
    description:
      "Be part of the movement that hands the keys back to practitioners and citizen supporters. Glass keeps the process open, fast, and accountable.",
  },
];

const democratizePoints = [
  {
    title: "Open the lab doors",
    description:
      "Glass turns research updates, budgets, and milestone proofs into public knowledge so anyone can understand—and fund—what’s unfolding.",
  },
  {
    title: "Lower the buy-in",
    description:
      "Whether you can give €50 or lead a syndicate, you get the same visibility and control over how your contribution activates new science.",
  },
  {
    title: "Build a new frontier together",
    description:
      "By pooling support from scientists, citizens, and mission-driven donors, we create a funding frontier that reflects the world we want to live in.",
  },
];

export default function About() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <div className="bg-background text-foreground">
      <section className="border-b border-border bg-muted/30">
        <div className="container mx-auto px-4 py-20 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">
              Why we started Glass
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
              Science deserves funding that rewards ideas, not paperwork.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              I first fell in love with science in high school. A summer research camp gave me the chance
              to do real experiments and ask real questions, but it also revealed how painfully slow and
              bureaucratic the funding process was. Promising projects sat idle, paperwork clogged
              progress, and ideas lost momentum before they could even be tested. That frustration stayed
              with me for years. Glass is my answer—a platform that lets everyday supporters stand shoulder
              to shoulder with labs. We focus on <strong>Quality</strong> (rigorous vetting),{" "}
              <strong>Simplicity</strong> (a funding flow anyone can understand), and{" "}
              <strong>Transparency</strong> (live budgets, milestone releases, and public updates).
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
          <h2 className="text-2xl font-semibold text-center">Democratising science funding</h2>
          <p className="mt-3 max-w-3xl mx-auto text-center text-muted-foreground leading-relaxed">
            Glass is built so that breakthroughs are no longer decided behind closed doors. We hand the
            power to fund discovery back to the people who believe in a new era of research.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {democratizePoints.map(point => (
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
              <h2 className="text-2xl font-semibold">What is Glass?</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Glass is a next-generation platform that hands the controls of research funding back to
                people who care. We connect researchers, private labs, and institutions with supporters of
                every size. Traditional models are slow and gatekept—Glass makes scientific finance faster,
                more transparent, and open to the crowd.
              </p>
            </article>
            <article>
              <h2 className="text-2xl font-semibold">Why Glass matters</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                In today’s world, countless brilliant research projects go unfunded, and communities are left
                watching from the sidelines. Glass lets supporters donate directly into the lab,
                creating a public ledger of progress and impact. Our mission is simple: democratise science,
                not paperwork.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16 lg:py-20">
          <h2 className="text-2xl font-semibold text-center">How Glass works</h2>
          <p className="mt-3 max-w-3xl mx-auto text-center text-muted-foreground leading-relaxed">
            We combine rigorous review with transparent funding rails so everyone involved can see exactly
            how science moves from idea to impact.
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
            Glass lets every stakeholder in research move faster while staying accountable—and invites the
            public to participate in discoveries that used to be locked behind grant panels.
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
          <h2 className="text-2xl font-semibold text-center">Let’s build the future of research funding</h2>
          <p className="mt-3 max-w-3xl mx-auto text-center text-muted-foreground leading-relaxed">
            Whether you want to champion transformative ideas or bring your work to life, Glass gives you
            a clear, responsible path forward.
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

      <Footer />
    </div>
  );
}
