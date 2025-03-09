import { Link } from "wouter";
import { motion } from "framer-motion";

export function Navbar() {
  return (
    <motion.nav 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center"> {/* Added div for styling */}
            <Link href="/">
              <img src="/GlassLogo5.png" alt="Glass" className="h-12 w-auto" />
            </Link>
            {/* fallback text */}
          </div>

          <div className="hidden md:flex space-x-8">
            <Link href="/">
              <a className="text-muted-foreground hover:text-primary transition-colors">Home</a>
            </Link>
            <Link href="/about">
              <a className="text-muted-foreground hover:text-primary transition-colors">About</a>
            </Link>
            <Link href="/contact">
              <a className="text-muted-foreground hover:text-primary transition-colors">Contact</a>
            </Link>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}