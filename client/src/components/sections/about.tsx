import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { BeakerIcon, Users2Icon, Rocket } from "lucide-react";

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
            Glass is a revolutionary platform that bridges the gap between researchers and funding opportunities, 
            fostering collaboration and accelerating scientific breakthroughs.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mt-12">
          {[
            {
              icon: <BeakerIcon className="h-10 w-10 text-primary" />,
              title: "Research Funding",
              description: "Access diverse funding opportunities tailored to your research needs"
            },
            {
              icon: <Users2Icon className="h-10 w-10 text-primary" />,
              title: "Collaboration",
              description: "Connect with leading researchers and institutions worldwide"
            },
            {
              icon: <Rocket className="h-10 w-10 text-primary" />,
              title: "Innovation",
              description: "Accelerate scientific progress through streamlined funding processes"
            }
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