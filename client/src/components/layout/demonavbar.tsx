import { Link } from "wouter";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function DemoNavbar() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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

  const navigationLinks = [
    { href: "/research", label: "Invest" },
    { href: "/donate", label: "Donate" },
    { href: "/followup", label: "Follow-Up" },
    { href: "/profile", label: "My Profile" },
    { href: "/login", label: "Login" },
    { href: "/signup", label: "Sign Up" },
  ];

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

          <div className="md:hidden">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="relative w-full max-w-xs border-l bg-background px-6 py-16 [&>button:last-child]:hidden"
              >
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Close navigation menu"
                    className="absolute right-4 top-4"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
                <nav className="flex flex-col space-y-6 text-lg font-medium">
                  {navigationLinks.map(link => (
                    <Link key={link.href} href={link.href}>
                      <a
                        className="text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {link.label}
                      </a>
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
