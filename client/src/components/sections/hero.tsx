import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function Hero() {
  const scrollToAbout = () => {
    const aboutSection = document.querySelector('#about-section');
    if (aboutSection) {
      aboutSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 py-20">
      <div 
        className="absolute inset-0 z-0 opacity-10 bg-gradient-to-br from-blue-400 to-pink-400"
      />
      <div className="container mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto text-center"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-pink-600">
            The Future of Scientific Investment Starts Here.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-12">
            Connecting researchers with the resources they need to drive progress
          </p>
          <Button size="lg" className="text-lg px-8" onClick={scrollToAbout}>
            Get Started
          </Button>
        </motion.div>
      </div>
    </section>
  );
}