import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useAnimation } from "framer-motion";

const categories = [
  {
    id: "cancer",
    label: "Cancer",
    description: "Fund breakthroughs in detection, treatment, and survivorship for cancers worldwide.",
    subcategories: [
      { id: "precision-oncology", label: "Precision Oncology" },
      { id: "early-detection", label: "Early Detection" },
      { id: "immuno-oncology", label: "Immuno-oncology" },
    ],
  },
  {
    id: "climate-environment",
    label: "Climate & Environment",
    description: "Tackle greenhouse gases, biodiversity loss, and adaptation with science-backed solutions.",
    subcategories: [
      { id: "carbon-removal", label: "Carbon Removal" },
      { id: "climate-modeling", label: "Climate Modeling" },
      { id: "marine-ecology", label: "Marine Ecology" },
    ],
  },
  {
    id: "climate",
    label: "Climate",
    description: "Support high-impact projects focused on planetary-scale resilience and mitigation.",
    subcategories: [
      { id: "policy", label: "Climate Policy" },
      { id: "resilience", label: "Community Resilience" },
    ],
  },
  {
    id: "artificial-intelligence",
    label: "Artificial Intelligence",
    description: "Advance responsible AI for healthcare, infrastructure, and open science.",
    subcategories: [
      { id: "ml-health", label: "ML for Health" },
      { id: "governance", label: "AI Governance" },
      { id: "safety", label: "AI Safety" },
    ],
  },
  {
    id: "neuroscience",
    label: "Neuroscience",
    description: "Unlock understanding of the brain to combat neurodegenerative and cognitive disorders.",
    subcategories: [
      { id: "brain-mapping", label: "Brain Mapping" },
      { id: "neurodegeneration", label: "Neurodegeneration" },
      { id: "neurotech", label: "Neurotechnology" },
    ],
  },
  {
    id: "clean-energy",
    label: "Clean Energy",
    description: "Accelerate the shift toward abundant, affordable, zero-carbon energy.",
    subcategories: [
      { id: "fusion", label: "Fusion" },
      { id: "grid", label: "Grid-scale Storage" },
      { id: "hydrogen", label: "Hydrogen" },
    ],
  },
  {
    id: "food-agriculture",
    label: "Food & Agriculture",
    description: "Secure resilient food systems through agritech, soil science, and new proteins.",
    subcategories: [
      { id: "agritech", label: "AgriTech" },
      { id: "soil-health", label: "Soil Health" },
      { id: "alt-protein", label: "Alternative Protein" },
    ],
  },
  {
    id: "mental-health",
    label: "Mental Health",
    description: "Back research into prevention, treatment, and digital support for mental wellness.",
    subcategories: [
      { id: "youth", label: "Youth Support" },
      { id: "psych-tech", label: "Psych Tech" },
    ],
  },
  {
    id: "future-education",
    label: "Future Education",
    description: "Invest in learning innovations, open access, and education data infrastructure.",
    subcategories: [
      { id: "edtech", label: "EdTech" },
      { id: "open-access", label: "Open Access" },
    ],
  },
  {
    id: "water-access",
    label: "Water Access",
    description: "Deliver clean water through filtration, desalination, and resilient distribution.",
    subcategories: [
      { id: "filtration", label: "Filtration Tech" },
      { id: "desalination", label: "Desalination" },
      { id: "monitoring", label: "Pollution Monitoring" },
    ],
  },
  {
    id: "genetics-biotech",
    label: "Genetics & Biotech",
    description: "Empower teams pushing CRISPR, gene therapies, and synthetic biology platforms.",
    subcategories: [
      { id: "crispr", label: "CRISPR" },
      { id: "gene-therapy", label: "Gene Therapy" },
      { id: "bioinformatics", label: "Bioinformatics" },
    ],
  },
  {
    id: "energy",
    label: "Energy",
    description: "Support breakthroughs in generation, storage, and electrification beyond traditional grids.",
    subcategories: [
      { id: "geothermal", label: "Geothermal" },
      { id: "superconductors", label: "Superconductors" },
    ],
  },
  {
    id: "pandemic-defense",
    label: "Pandemic Defense",
    description: "Boost surveillance, rapid response, and global preparedness for future outbreaks.",
    subcategories: [
      { id: "rapid-tests", label: "Rapid Testing" },
      { id: "vaccines", label: "Vaccines" },
      { id: "biosecurity", label: "Biosecurity" },
    ],
  },
  {
    id: "health-equity",
    label: "Health Equity",
    description: "Scale healthcare access, affordability, and culturally-aware care models.",
    subcategories: [
      { id: "care-delivery", label: "Care Delivery" },
      { id: "rural-health", label: "Rural Health" },
    ],
  },
  {
    id: "biotech",
    label: "Biotech",
    description: "Back platform biology, advanced materials, and biomanufacturing programs.",
    subcategories: [
      { id: "biomanufacturing", label: "Biomanufacturing" },
      { id: "platform-bio", label: "Platform Biology" },
    ],
  },
  {
    id: "equity-justice",
    label: "Equity & Justice",
    description: "Champion research that closes systemic gaps across health, climate, and civic tech.",
    subcategories: [
      { id: "policy-reform", label: "Policy Reform" },
      { id: "community-led", label: "Community-led Science" },
    ],
  },
  {
    id: "space",
    label: "Space",
    description: "Propel exploration with propulsion, habitats, and space-life support innovations.",
    subcategories: [
      { id: "propulsion", label: "Propulsion" },
      { id: "orbital", label: "Orbital Science" },
      { id: "life-support", label: "Life Support" },
    ],
  },
  {
    id: "rare-diseases",
    label: "Rare Diseases",
    description: "Give overlooked patient communities access to precision research and trials.",
    subcategories: [
      { id: "genetic", label: "Genetic Disorders" },
      { id: "trial-access", label: "Trial Access" },
    ],
  },
  {
    id: "food-nutrition",
    label: "Food & Nutrition",
    description: "Ensure healthy nutrition through metabolic science, supplementation, and public health.",
    subcategories: [
      { id: "micronutrients", label: "Micronutrients" },
      { id: "metabolic", label: "Metabolic Health" },
    ],
  },
  {
    id: "environmental",
    label: "Environmental",
    description: "Restore ecosystems and natural infrastructure for long-term planetary health.",
    subcategories: [
      { id: "restoration", label: "Restoration" },
      { id: "biodiversity", label: "Biodiversity" },
    ],
  },
  {
    id: "healthcare",
    label: "Healthcare",
    description: "Power care delivery innovation from hospitals to home diagnostics.",
    subcategories: [
      { id: "remote-care", label: "Remote Care" },
      { id: "clinical-ai", label: "Clinical AI" },
    ],
  },
  {
    id: "materials-science",
    label: "Materials Science",
    description: "Invest in novel materials for infrastructure, lightweight transport, and clean tech.",
    subcategories: [
      { id: "advanced-materials", label: "Advanced Materials" },
      { id: "circular", label: "Circular Manufacturing" },
    ],
  },
  {
    id: "global-health-equity",
    label: "Global Health Equity",
    description: "Deploy capital where it drives health impact fastest across continents.",
    subcategories: [
      { id: "supply-chains", label: "Supply Chains" },
      { id: "diagnostics", label: "Affordable Diagnostics" },
    ],
  },
  {
    id: "open-science",
    label: "Open Science",
    description: "Back the Glass flex fund so we can deploy quickly across all science categories as needs emerge.",
    subcategories: [
      { id: "glass-response", label: "Glass Response Fund" },
      { id: "rapid-grants", label: "Rapid Grants" },
      { id: "community-vote", label: "Community Vote" },
    ],
  },
];

const bubbleGradients = [
  "from-sky-400 via-blue-500 to-indigo-500",
  "from-pink-400 via-red-400 to-orange-400",
  "from-teal-400 via-emerald-400 to-green-500",
  "from-purple-400 via-fuchsia-500 to-rose-500",
  "from-amber-300 via-amber-400 to-orange-500",
  "from-cyan-400 via-blue-400 to-purple-500",
  "from-lime-300 via-emerald-400 to-teal-500",
  "from-orange-400 via-amber-500 to-yellow-500",
  "from-rose-400 via-pink-500 to-fuchsia-500",
  "from-indigo-400 via-blue-500 to-slate-500",
  "from-emerald-300 via-green-400 to-lime-500",
  "from-blue-300 via-sky-400 to-cyan-500",
];

const bubbleVariants = {
  initial: { scale: 0.75, opacity: 0 },
  idle: { scale: 1, opacity: 1 },
  active: { scale: 1.15, opacity: 1 },
  popped: { scale: 0.85, opacity: 0.15 },
};

const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;

function useFloatingAnimation(isActive: boolean) {
  const controls = useAnimation();

  useEffect(() => {
    if (isActive) {
      controls.start({ x: 0, y: 0, rotate: 0, transition: { duration: 0.3 } });
      return;
    }

    let cancelled = false;

    const loop = async () => {
      while (!cancelled) {
        const x = randomBetween(-18, 18);
        const y = randomBetween(-12, 12);
        const rotate = randomBetween(-5, 5);
        const duration = randomBetween(5, 8);

        await controls.start({
          x,
          y,
          rotate,
          transition: { duration, ease: "easeInOut" },
        });
      }
    };

    loop();

    return () => {
      cancelled = true;
    };
  }, [controls, isActive]);

  return controls;
}

export default function Bubbles() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <section className="bg-background min-h-screen pb-24">
      <div className="container mx-auto px-4 pt-24">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-semibold">Support a science bubble.</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Each bubble represents a donation fund curated around a frontier research area. Tap a bubble to pop the others and
            dive into the projects inside.
          </p>
        </div>

        <div className="mt-12 mx-auto max-w-7xl">
          <div className="relative grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-5 md:gap-6 justify-items-center transition-all duration-300">
            {categories.map((category, index) => {
              const gradient = bubbleGradients[index % bubbleGradients.length];
              const isActive = active === category.id;
              const isDimmed = active !== null && !isActive;
              const controls = useFloatingAnimation(isActive);

              return (
                <motion.div
                  key={category.id}
                  className={`flex flex-col items-center gap-4 md:gap-5 transition-all duration-500 ${
                    isActive
                      ? "col-span-full order-first"
                      : ""
                  } ${active && !isActive ? "opacity-0 pointer-events-none" : "opacity-100"}`}
                  animate={isActive ? { x: 0, opacity: 1 } : controls}
                  transition={{ duration: isActive ? 0.35 : 0.6, ease: "easeInOut" }}
                >
                  <motion.button
                    type="button"
                    initial="initial"
                    animate={isActive ? "active" : isDimmed ? "popped" : "idle"}
                    variants={bubbleVariants}
                    transition={{ type: "spring", stiffness: 220, damping: 18 }}
                    onClick={() => setActive(prev => (prev === category.id ? null : category.id))}
                    className={`group relative flex items-center justify-center rounded-full text-center text-base font-semibold text-foreground shadow-lg shadow-primary/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 transition-all duration-300 ${isActive ? "h-48 w-48 md:h-60 md:w-60" : "h-32 w-32 md:h-40 md:w-40"}`}
                    style={{ pointerEvents: isDimmed ? "none" : "auto" }}
                  >
                    <span className={`pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br ${gradient} opacity-75`} />
                    <span className="pointer-events-none absolute inset-[3px] rounded-full bg-background/85 backdrop-blur-sm" />
                    <span className="relative mx-4 leading-tight text-sm md:text-base font-semibold text-foreground transition group-hover:scale-105">
                      {category.label}
                    </span>
                    <span className="absolute -bottom-3 rounded-full bg-background/80 px-3 py-1 text-[11px] font-medium text-primary shadow-sm opacity-0 transition group-hover:opacity-100">
                      Explore
                    </span>
                  </motion.button>

                  <AnimatePresence mode="wait">
                    {isActive && (
                      <motion.div
                        key={`${category.id}-card`}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="mx-auto w-full max-w-4xl rounded-3xl border border-border bg-card/90 p-8 text-left shadow-xl"
                      >
                        <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Donation bubble</p>
                        <h2 className="mt-2 text-lg font-semibold text-foreground">{category.label}</h2>
                        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                          {category.description}
                        </p>

                        {category.subcategories?.length ? (
                          <div className="mt-4">
                            <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Focus areas</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {category.subcategories.map(sub => (
                                <span
                                  key={sub.id}
                                  className="rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground"
                                >
                                  {sub.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-5 flex flex-col gap-2">
                          <Link href={`/donateflow?category=${category.id}`}>
                            <a className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition">
                              Donate to this bubble
                            </a>
                          </Link>
                          <button
                            type="button"
                            onClick={() => setActive(null)}
                            className="text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Pop back to all bubbles
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
