import { motion } from "framer-motion";
import { Mail, Facebook, Twitter, Linkedin, Instagram } from "lucide-react";
import { Waitlist } from "@/components/sections/waitlist";
import { Footer } from "@/components/sections/footer";

export default function Contact() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto text-center"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-8">Contact Us</h1>
          <p className="text-lg text-muted-foreground mb-12">
            Have questions about Glass? We'd love to hear from you. Send us a message or connect with us on social media.
          </p>

          <div className="flex items-center justify-center gap-4 mb-8">
            <Mail className="h-6 w-6 text-primary" />
            <a href="mailto:contact@glass-funding.com" className="text-lg hover:text-primary transition-colors">
              contact@glass-funding.com
            </a>
          </div>

          <div className="flex justify-center space-x-6">
            <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
              <Facebook className="h-8 w-8" />
            </a>
            <a href="https://x.com/GlassFunding" className="text-muted-foreground hover:text-primary transition-colors">
              <Twitter className="h-8 w-8" />
            </a>
            <a href="https://www.linkedin.com/in/funding-glass-803485355/" className="text-muted-foreground hover:text-primary transition-colors">
              <Linkedin className="h-8 w-8" />
            </a>
            <a href="https://www.instagram.com/glass_funding/" className="text-muted-foreground hover:text-primary transition-colors">
              <Instagram className="h-8 w-8" />
            </a>
          </div>
        </motion.div>
      </div>
      <Waitlist />
      <Footer />
    </div>
  );
}