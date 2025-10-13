import { Link } from "wouter";
import { motion } from "framer-motion";
import { useState, useRef } from "react";

export function DemoNavbar() {
  const [showDropdown, setShowDropdown] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowDropdown(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowDropdown(false);
    }, 250); // Delay before hiding the dropdown
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      {/* Demo Banner */}
      <div className="bg-yellow-300 text-black text-sm font-semibold py-1 text-center">
        This is a demo version. All data shown is fictional.
      </div>

      {/* Main Navbar */}
      <div className="bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/">
                <img src="/GlassLogo5.png" alt="Glass" className="h-12 w-auto" />
              </Link>
            </div>

            <div className="hidden md:flex space-x-8 items-center">
              <Link href="/research">
                <a className="text-muted-foreground hover:text-primary transition-colors">Invest</a>
              </Link>
              <Link href="/donate">
                <a className="text-muted-foreground hover:text-primary transition-colors">Donate</a>
              </Link>
              <Link href="/followup">
                <a className="text-muted-foreground hover:text-primary transition-colors">Follow-Up</a>
              </Link>
              <div
                className="relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <button className="text-muted-foreground hover:text-primary transition-colors">
                  My Profile ▾
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded shadow-md z-50">
                    <Link href="/profile">
                      <a className="block px-4 py-2 text-sm text-black hover:bg-gray-100">
                        My Profile
                      </a>
                    </Link>
                    <Link href="/login">
                      <a className="block px-4 py-2 text-sm text-black hover:bg-gray-100">
                        Login
                      </a>
                    </Link>
                    <Link href="/signup">
                      <a className="block px-4 py-2 text-sm text-black hover:bg-gray-100">
                        Sign Up
                      </a>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
