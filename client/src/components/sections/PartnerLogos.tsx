import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

const logos = [
  {
    src: "/logos/logo-unistra.png",
    alt: "Unistra",
    href: "https://www.unistra.fr",
    className: "scale-125"
  },
  {
    src: "/logos/logo-EMStrasbourg.png",
    alt: "EM Strasbourg",
    href: "https://www.em-strasbourg.com/fr",
    className: "scale-[1.7]"
  },
  {
    src: "/logos/GrandEst.png",
    alt: "Grand Est",
    href: "https://www.grandest.fr/en/",
    className: "scale-[1.9]"
  },
  {
    src: "/logos/logo-etena.png",
    alt: "Pépite Eténa",
    href: "https://etena.unistra.fr/",
    className: "scale-[1.2]"
  },
  {
    src: "/logos/logo-LaRucheAProjets.png",
    alt: "La Ruche a projets",
    href: "https://www.em-strasbourg.com/fr/etudiant/vie-etudiante-et-services/centre-entrepreneurial-la-ruche/incubateur-la-ruche-a-projets",
    className: "scale-[1.2]"
  }
  // {
  //   src: "/logos/logo-placeholder.png",
  //   alt: "Partner Placeholder 1",
  //   href: "#",
  //   className: ""
  // },
  // {
  //   src: "/logos/logo-placeholder.png",
  //   alt: "Partner Placeholder 2",
  //   href: "#",
  //   className: ""
  // },
  // {
  //   src: "/logos/logo-placeholder.png",
  //   alt: "Partner Placeholder 3",
  //   href: "#",
  //   className: ""
  // },
  // {
  //   src: "/logos/logo-placeholder.png",
  //   alt: "Partner Placeholder 4",
  //   href: "#",
  //   className: ""
  // }
];

export function PartnerLogos() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const repeatedLogos = useMemo(() => [...logos, ...logos, ...logos], []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const setInitialScroll = () => {
      const groupWidth = container.scrollWidth / 3;
      if (groupWidth > 0) {
        container.scrollLeft = groupWidth;
      }
    };

    const handleScroll = () => {
      const groupWidth = container.scrollWidth / 3;
      if (groupWidth === 0) return;

      if (container.scrollLeft <= 0) {
        container.scrollLeft += groupWidth;
      } else if (container.scrollLeft >= groupWidth * 2) {
        container.scrollLeft -= groupWidth;
      }
    };

    setInitialScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", setInitialScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", setInitialScroll);
    };
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let animationFrame: number;

    const autoScroll = () => {
      const groupWidth = container.scrollWidth / 3;
      if (groupWidth === 0) return;

      container.scrollLeft += 0.4;

      if (container.scrollLeft >= groupWidth * 2) {
        container.scrollLeft -= groupWidth;
      }

      animationFrame = window.requestAnimationFrame(autoScroll);
    };

    animationFrame = window.requestAnimationFrame(autoScroll);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  const scroll = (direction: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) return;
    const groupWidth = container.scrollWidth / 3;
    if (groupWidth === 0) return;

    const scrollAmount = container.clientWidth * 0.8;
    let nextPosition =
      direction === "left"
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount;

    if (direction === "left" && nextPosition <= 0) {
      nextPosition += groupWidth;
    } else if (direction === "right" && nextPosition >= groupWidth * 2) {
      nextPosition -= groupWidth;
    }

    container.scrollTo({ left: nextPosition, behavior: "smooth" });
  };

  return (
    <section id="partners" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-4">Our Partners</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative"
        >
          <button
            type="button"
            onClick={() => scroll("left")}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 h-12 w-12 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground hover:bg-background transition shadow-sm"
            aria-label="Scroll partners left"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => scroll("right")}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 h-12 w-12 items-center justify-center rounded-full bg-background/80 border border-border text-muted-foreground hover:bg-background transition shadow-sm"
            aria-label="Scroll partners right"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div ref={scrollRef} className="overflow-x-auto scroll-smooth no-scrollbar">
            <div className="flex gap-6 md:gap-8 min-w-max pb-2">
              {repeatedLogos.map((logo, index) => (
                <a
                  key={`${logo.alt}-${index}`}
                  href={logo.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block w-[160px] md:w-[180px] shrink-0"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.04 }}
                  >
                    <div className="bg-white border border-border rounded-xl px-6 py-5 h-28 flex items-center justify-center shadow-sm hover:shadow-md transition">
                      <img
                        src={logo.src}
                        alt={logo.alt}
                        className={`max-h-12 object-contain opacity-80 hover:opacity-100 transition duration-300 ${logo.className}`}
                      />
                    </div>
                  </motion.div>
                </a>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
