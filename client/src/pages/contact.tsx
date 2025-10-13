import { motion } from "framer-motion";
import { Mail, X as XIcon, Linkedin, Instagram } from "lucide-react";
import { Waitlist } from "@/components/sections/waitlist";
import { Footer } from "@/components/sections/footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Contact() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-14"
          >
            <h1 className="text-4xl md:text-5xl font-bold">Contact Glass</h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Every question, partnership idea, or introduction helps us democratise science. Whether you are a
              researcher, supporter, donor, journalist, or collaborator—you can reach the team at{" "}
              <a
                href="mailto:contact@glass-funding.com"
                className="font-medium text-primary hover:underline"
              >
                contact@glass-funding.com
              </a>.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-start"
          >
            <div className="rounded-3xl border border-border bg-card/80 shadow-sm p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Write to us</p>
                  <a
                    href="mailto:contact@glass-funding.com"
                    className="text-lg font-medium text-foreground hover:text-primary"
                  >
                    contact@glass-funding.com
                  </a>
                </div>
              </div>
              <div className="grid gap-4 text-sm text-muted-foreground leading-relaxed">
                <div className="rounded-2xl bg-background border border-border/80 p-4">
                  <p className="font-medium text-foreground">Researchers & Labs</p>
                  <p className="mt-2">
                    Share your project, ask about onboarding, or explore how milestone-based funding works for your lab.
                  </p>
                </div>
                <div className="rounded-2xl bg-background border border-border/80 p-4">
                  <p className="font-medium text-foreground">Supporters & Donors</p>
                  <p className="mt-2">
                    Learn how to back science you believe in—whether you’re donating €50 or exploring a matched pledge.
                  </p>
                </div>
                <div className="rounded-2xl bg-background border border-border/80 p-4">
                  <p className="font-medium text-foreground">Media & Partners</p>
                  <p className="mt-2">
                    Request interviews, press kits, or collaboration details. We’re happy to share what Glass is building.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card/60 shadow-sm p-8">
              <h2 className="text-xl font-semibold text-foreground text-left">FAQs</h2>
              <Accordion type="single" collapsible className="mt-4 space-y-1">
                <AccordionItem value="faq-1">
                  <AccordionTrigger className="text-left text-sm">
                    How soon will someone reply?
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      We aim to respond within 2 business days. Research submissions may take a little longer while we loop in
                      advisors for review.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="faq-2">
                  <AccordionTrigger className="text-left text-sm">
                    Do I need to be accredited to support projects?
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      No. Glass is built so anyone can contribute. For larger donations we’ll walk you through any extra checks,
                      but transparency is the same for everyone.
                    </p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="faq-3">
                  <AccordionTrigger className="text-left text-sm">
                    Can I demo the platform before launch?
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Yes—drop us a note at contact@glass-funding.com and we’ll share the latest demo environment and roadmap
                      update.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="mt-8">
                <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground text-left">Social</p>
                <div className="mt-4 flex gap-3 text-muted-foreground">
                  <a
                    href="https://x.com/GlassFunding"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border hover:text-primary transition"
                    aria-label="Glass on X"
                  >
                    <XIcon className="h-4 w-4" />
                  </a>
                  <a
                    href="https://www.linkedin.com/company/glass-funding/"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border hover:text-primary transition"
                    aria-label="Glass on LinkedIn"
                  >
                    <Linkedin className="h-4 w-4" />
                  </a>
                  <a
                    href="https://www.instagram.com/glass_funding/"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border hover:text-primary transition"
                    aria-label="Glass on Instagram"
                  >
                    <Instagram className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      <Waitlist />
      <Footer />
    </div>
  );
}
