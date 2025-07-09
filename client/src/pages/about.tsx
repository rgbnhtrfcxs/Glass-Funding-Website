import { motion } from "framer-motion";
import { Waitlist } from "@/components/sections/waitlist";
import { Footer } from "@/components/sections/footer";

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
      title: "What is Glass?",
      content: "Glass is the next-generation platform revolutionizing scientific funding and collaboration. We bridge the gap between researchers, private labs, universities, and investors, ensuring groundbreaking ideas receive the resources they need to become reality. Traditional funding models are slow, bureaucratic, and inefficient—Glass changes that."
    },
    {
      title: "Why Glass?",
      content: "In today’s world, brilliant research often goes unfunded, and cutting-edge labs lack the partnerships needed to accelerate discoveries. Glass provides a transparent, efficient, and impact-driven ecosystem that connects researchers with funding, infrastructure, and industry partnerships."
    },
    {
      title: "What We Aim to Do",
      content: (
        <ul>
          <li><strong>Investors:</strong> We create a new asset class—allowing angel investors, VCs, and private funds to directly invest in high-impact research, with clear pathways to commercialization.</li>
          <li><strong>Universities & Labs:</strong> We provide a streamlined platform to secure private funding and industry partnerships, ensuring research moves beyond the academic world into real-world applications.</li>
          <li><strong>For the Future:</strong> By democratizing access to research funding, we empower scientists to innovate faster, reduce dependence on slow-moving grants, and create a sustainable, high-impact funding model.</li>
        </ul>
      )
    },
    {
      title: "Why You Should Join Us",
      content: (
        <ul>
          <li><strong>Investors:</strong> Be part of the next wave of deep-tech, biotech, and cutting-edge science investments with real ROI potential.</li>
          <li><strong>Universities & Labs:</strong> Gain access to private capital and strategic partnerships that accelerate research without bureaucratic hurdles.</li>
          <li><strong>Visionaries & Innovators:</strong> Join a movement that transforms the way research is funded, developed, and commercialized.</li>
        </ul>
      )
    },
    {
      title: "Let’s Build the Future of Science Together.",
      content: "Glass is more than a platform—it’s a movement. Whether you’re an investor seeking high-growth opportunities, or a research institution looking to accelerate discovery, Glass is your gateway to the future of scientific innovation."
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-20">
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
      </div>
      <Waitlist />
      <Footer />
    </div>
  );
}