import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { BadgeCheck, Zap, Eye } from "lucide-react";

export function About() {
  return (
    <section id="about-section" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-4">About Glass</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Glass bridges researchers and funding with three promises:
            <span className="font-semibold"> Quality</span>,{" "}
            <span className="font-semibold">Simplicity</span>, and{" "}
            <span className="font-semibold">Transparency</span>. We rigorously
            vet projects, make the funding flow effortless, and show exactly how
            every euro moves.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mt-12">
          {[
            {
              icon: <BadgeCheck className="h-10 w-10 text-primary" />,
              title: "Quality",
              description:
                "Quality-first projects with clear hypotheses, milestones, and budgets.",
            },
            {
              icon: <Zap className="h-10 w-10 text-primary" />,
              title: "Simplicity",
              description:
                "Simple, guided flows that connect funders, researchers, and institutions.",
            },
            {
              icon: <Eye className="h-10 w-10 text-primary" />,
              title: "Transparency",
              description:
                "Live budgets, milestone-based releases, and public progress updates.",
            },
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
            >
              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="mb-4 flex justify-center">{item.icon}</div>
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
