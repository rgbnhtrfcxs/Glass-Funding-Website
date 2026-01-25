import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/labs", label: "Labs" },
    { href: "/teams", label: "Teams" },
    { href: "/pricing", label: "Pricing" },
    { href: "/contact", label: "Contact" },
  ];

  const toggleMenu = () => setIsMenuOpen(prev => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  const { user, signOut } = useAuth();
  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location === href || location.startsWith(`${href}/`);
  };
  const navClass = (href: string) =>
    `text-sm font-medium transition-colors ${
      isActive(href) ? "text-primary" : "text-muted-foreground hover:text-primary"
    }`;
  const mobileNavClass = (href: string) =>
    `rounded-md px-3 py-2 text-lg font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
      isActive(href) ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted hover:text-primary"
    }`;

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-11 left-0 right-0 z-40 bg-background/80 backdrop-blur-sm border-b"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/">
              <img src="/GlassLogo5.png" alt="Glass" className="h-12 w-auto" />
            </Link>
          </div>

          <div className="md:hidden">
            <button
              type="button"
              onClick={toggleMenu}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border text-muted-foreground transition hover:border-primary/40 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-nav"
            >
              <span className="sr-only">Toggle navigation menu</span>
              <div className="flex flex-col items-center justify-center gap-1.5">
                <span className="block h-0.5 w-6 rounded bg-current" />
                <span className="block h-0.5 w-6 rounded bg-current" />
                <span className="block h-0.5 w-6 rounded bg-current" />
              </div>
            </button>
          </div>

          <div className="hidden md:flex items-center space-x-6">
            {navItems.map(item => (
              <Link href={item.href} key={item.href} className={navClass(item.href)}>
                {item.label}
              </Link>
            ))}
            {!user ? (
              <>
                <Link href="/login" className={navClass("/login")}>
                  Sign in
                </Link>
                <Link href="/signup" className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
                  Create account
                </Link>
              </>
            ) : (
              <>
                <Link href="/account" className={navClass("/account")}>
                  My profile
                </Link>
                <button
                  onClick={() => signOut()}
                  className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
              onClick={closeMenu}
            />
            <motion.aside
              key="panel"
              id="mobile-nav"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="fixed top-0 right-0 z-50 flex h-screen w-64 flex-col bg-background shadow-lg md:hidden"
            >
              <div className="flex items-center justify-between border-b px-4 py-3">
                <Link href="/" onClick={closeMenu}>
                  <img src="/GlassLogo5.png" alt="Glass" className="h-10 w-auto" />
                </Link>
                <button
                  type="button"
                  onClick={closeMenu}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground transition hover:border-primary/40 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span className="sr-only">Close navigation menu</span>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-2 px-4 py-6">
                {[...navItems,
                  ...(user
                    ? [{ href: "/account", label: "My profile" }]
                    : [{ href: "/login", label: "Sign in" }, { href: "/signup", label: "Create account" }])].map(item => (
                  <Link
                    href={item.href}
                    key={item.href}
                    onClick={closeMenu}
                    className={mobileNavClass(item.href)}
                  >
                    {item.label}
                  </Link>
                ))}
                {user && (
                  <button
                    onClick={() => { signOut(); closeMenu(); }}
                    className="rounded-md px-3 py-2 text-lg font-medium text-muted-foreground transition hover:bg-muted hover:text-primary text-left"
                  >
                    Sign out
                  </button>
                )}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
