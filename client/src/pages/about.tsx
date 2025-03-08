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
      title: "Our Mission",
      content: "At Glass, we're dedicated to revolutionizing scientific funding by creating transparent, efficient pathways between researchers and resources. Our platform aims to accelerate breakthrough discoveries by removing traditional barriers to research funding."
    },
    {
      title: "Our Vision",
      content: "We envision a future where groundbreaking research is limited only by imagination, not funding. Glass strives to be the catalyst that transforms how scientific research is funded, fostering a more collaborative and innovative research ecosystem."
    },
    {
      title: "Our Values",
      content: "Transparency, innovation, and collaboration form the cornerstone of our platform. We believe in creating an inclusive environment where researchers from all backgrounds can access the resources they need to drive scientific progress."
    },
    {
      title: "Our Impact",
      content: "Through our platform, we've helped researchers secure funding for critical projects across various scientific disciplines. Our impact extends beyond individual projects to advancing the broader scientific community."
    },
    {
      title: "Our Team",
      content: "Glass brings together experts from science, technology, and finance, creating a dynamic team dedicated to transforming research funding. Our diverse backgrounds unite under a common goal: accelerating scientific discovery."
    },
    {
      title: "Join Our Journey",
      content: "Be part of the revolution in scientific funding. Whether you're a researcher seeking funding or an organization looking to support groundbreaking research, Glass provides the platform to make it happen."
    }
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