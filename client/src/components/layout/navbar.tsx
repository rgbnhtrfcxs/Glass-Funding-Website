import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const labsSubItems = [
  { href: "/labs", label: "Labs" },
  { href: "/teams", label: "Teams" },
  { href: "/orgs", label: "Organizations" },
];

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [labsOpen, setLabsOpen] = useState(false);
  const [location] = useLocation();
  const labsRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topNavItems = [
    { href: "/", label: "Home" },
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

  const isLabsActive = labsSubItems.some(item => isActive(item.href));

  const navClass = (href: string) =>
    `text-sm font-medium transition-colors ${
      isActive(href) ? "text-primary" : "text-muted-foreground hover:text-primary"
    }`;

  const mobileNavClass = (href: string) =>
    `rounded-md px-3 py-2 text-lg font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
      isActive(href) ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted hover:text-primary"
    }`;

  const openDropdown = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setLabsOpen(true);
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setLabsOpen(false), 120);
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-sm border-b"
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
            {/* Home */}
            <Link href="/" className={navClass("/")}>Home</Link>

            {/* Labs dropdown */}
            <div
              ref={labsRef}
              className="relative"
              onMouseEnter={openDropdown}
              onMouseLeave={scheduleClose}
              onFocusCapture={openDropdown}
              onBlurCapture={scheduleClose}
            >
              <button
                type="button"
                onClick={() => setLabsOpen(prev => !prev)}
                className={`inline-flex items-center gap-1 text-sm font-medium transition-colors ${
                  isLabsActive ? "text-primary" : "text-muted-foreground hover:text-primary"
                }`}
                aria-haspopup="true"
                aria-expanded={labsOpen}
              >
                Labs
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${labsOpen ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {labsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-1/2 top-full mt-2 w-44 -translate-x-1/2 rounded-2xl border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur-sm"
                    role="menu"
                  >
                    {labsSubItems.map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setLabsOpen(false)}
                        role="menuitem"
                        className={`flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                          isActive(item.href)
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Remaining top-level items */}
            {topNavItems.slice(1).map(item => (
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
              <nav className="flex flex-1 flex-col gap-1 px-4 py-6">
                <Link href="/" onClick={closeMenu} className={mobileNavClass("/")}>Home</Link>

                {/* Labs group */}
                <div>
                  {labsSubItems.map((item, idx) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMenu}
                      className={`flex items-center rounded-md py-2 text-lg font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        idx === 0 ? "px-3" : "pl-7 pr-3 text-base"
                      } ${
                        isActive(item.href)
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:bg-muted hover:text-primary"
                      }`}
                    >
                      {idx !== 0 && (
                        <span className="mr-2 text-muted-foreground/50">↳</span>
                      )}
                      {item.label}
                    </Link>
                  ))}
                </div>

                {topNavItems.slice(1).map(item => (
                  <Link key={item.href} href={item.href} onClick={closeMenu} className={mobileNavClass(item.href)}>
                    {item.label}
                  </Link>
                ))}

                {user
                  ? (
                    <>
                      <Link href="/account" onClick={closeMenu} className={mobileNavClass("/account")}>My profile</Link>
                      <button
                        onClick={() => { signOut(); closeMenu(); }}
                        className="rounded-md px-3 py-2 text-lg font-medium text-muted-foreground transition hover:bg-muted hover:text-primary text-left"
                      >
                        Sign out
                      </button>
                    </>
                  )
                  : (
                    <>
                      <Link href="/login" onClick={closeMenu} className={mobileNavClass("/login")}>Sign in</Link>
                      <Link href="/signup" onClick={closeMenu} className={mobileNavClass("/signup")}>Create account</Link>
                    </>
                  )
                }
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
