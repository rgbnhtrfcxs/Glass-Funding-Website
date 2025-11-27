import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "wouter";

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
            Infrastructure for scientific collaboration.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-12">
            GLASS-Connect gives labs a standard profile, trusted verification, and direct routing so innovation moves faster.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="text-lg px-8" asChild>
              <Link href="/admin/labs">List your lab</Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8" asChild>
              <Link href="/labs">Browse labs</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 bg-pink-500 text-white border-none hover:bg-pink-500/90"
              onClick={scrollToAbout}
            >
              How it works
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
