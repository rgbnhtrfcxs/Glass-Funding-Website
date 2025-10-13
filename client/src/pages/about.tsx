import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/sections/footer";
import { PartnerLogos } from "@/components/sections/PartnerLogos";

function Section({ title, content, index }: { title: string; content: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.2 }}
      className="mb-16"
    >
      <h2 className="text-3xl font-bold mb-6">{title}</h2>
      <p className="text-lg text-muted-foreground">{content}</p>
    </motion.div>
  );
}

export default function About() {
  const sections = [
    {
      title: "Who are we?",
      content: "I first fell in love with science in high school. A summer research camp gave me the chance to do real experiments and ask real questions, but it also revealed how painfully slow and bureaucratic the funding process was. Promising projects sat idle, paperwork clogged progress, and ideas lost momentum before they could even be tested. That frustration stayed with me for years. I could not stop thinking about how much potential was being wasted and how many discoveries never happened because the system was designed for gatekeepers rather than for scientists and society. Glass is my answer. A platform built to strip away elitism and bureaucracy, focused on three promises: Quality (every project is vetted for scientific rigor), Simplicity (the funding flow is clear and intuitive), and Transparency (live budgets, milestone based releases, and public updates). My mission is simple: to give the best ideas a fair chance to move forward quickly, responsibly, and openly. That is why I started Glass."
    },
    {
      title: "What is Glass?",
      content: "Glass is a next-generation platform transforming how scientific research is funded and accelerated. We connect researchers, private labs, and institutions with forward-thinking funders and partners.Traditional funding models are slow, bureaucratic, and often overlook bold ideas—Glass changes that by making research funding faster, more transparent, and directly accessible."
    },
    {
      title: "Why Glass?",
      content: "In today’s world, countless brilliant research projects go unfunded, and cutting-edge labs lack the partnerships needed to thrive. Glass creates a trusted, efficient ecosystem where researchers, donors, and collaborators come together to unlock real-world innovation. Our mission is simple: empower science, not paperwork."
    },
    {
      title: "What We Aim to Do",
      content: (
        <ul>
          <li><strong>Funders & Supporters:</strong> Enable individuals, philanthropists, and future-focused organizations to support high-impact research with clear transparency and long-term impact tracking.</li>
          <li><strong>Universities, Labs:</strong> Offer a streamlined way to connect with private funding and external collaborators—helping projects move beyond academic pipelines and into real-world application.</li>
          <li><strong>For the Future:</strong> Our long-term vision includes enabling optional participation in research outcomes, including shared benefits from IP and commercialization—once the legal structure is in place.</li>
        </ul>
      )
    },
    {
      title: "Why You Should Join Us",
      content: (
        <ul>
          <li><strong>Supporters & Visionaries:</strong> Contribute to breakthroughs that matter. Help fund cancer research, climate innovation, biotech advances, and more—with full visibility into progress and results.</li>
          <li><strong>Universities & Labs:</strong> Gain access to alternative funding and strategic partnerships—without the delays or constraints of legacy systems.</li>
          <li><strong>Innovators & Builders:</strong> Be part of the movement reshaping how science gets done. Whether you’re a researcher or a funder, Glass puts the future of science in your hands.</li>
        </ul>
      )
    },
    {
      title: "Let’s Build the Future of Science Together.",
      content: "Glass is more than a platform. It’s a growing movement dedicated to funding better science, faster. Whether you're looking to support transformative ideas or bring your research to life, Glass is your gateway to the next era of scientific innovation."
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-20">
        <div className="flex justify-end">
          <Link href="/roadmap">
            <a className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card/70 transition shadow-sm">
              Roadmap
              <ArrowRight className="h-4 w-4" />
            </a>
          </Link>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-5xl font-bold text-center mb-16"
        >
          About Glass
        </motion.h1>

        {sections.map((section, index) => (
          <Section
            key={index}
            title={section.title}
            content={section.content}
            index={index}
          />
        ))}
        <div className="mt-16 flex justify-center">
          <Link href="/roadmap">
            <a className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition shadow-md">
              Explore Our Roadmap
              <ArrowRight className="h-4 w-4" />
            </a>
          </Link>
        </div>
      </div>
      <PartnerLogos />
      <Footer />
    </div>
  );
}
