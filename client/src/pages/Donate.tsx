import { useState } from "react";
import { Link } from "wouter";

const categories = [
  {
  id: "cancer",
  label: "Cancer Research",
  description: "Support groundbreaking research in cancer treatment, early detection, and immunotherapy.",
  subcategories: [
    { id: "breast", label: "Breast Cancer" },
    { id: "lung", label: "Lung Cancer" },
    { id: "leukemia", label: "Leukemia" },
    { id: "immunotherapy", label: "Cancer Immunotherapy" },
    { id: "early-detection", label: "Early Detection Technologies" }
  ]
},
  {
    id: "mental",
    label: "Mental Health",
    description: "Fund studies into depression, adolescent mental health, and brain therapies.",
    subcategories: [
      { id: "depression", label: "Depression" },
      { id: "anxiety", label: "Anxiety Disorders" },
      { id: "youth", label: "Youth Mental Health" },
    ]
  },
  {
    id: "rare",
    label: "Rare Diseases",
    description: "Help researchers find treatments for overlooked and rare genetic conditions.",
    subcategories: [
        { id: "orphan", label: "Orphan Diseases" },
        { id: "lysosomal", label: "Lysosomal Storage Disorders" },
        { id: "mitochondrial", label: "Mitochondrial Diseases" },
        { id: "huntington", label: "Huntington’s Disease" },
        { id: "muscular-dystrophy", label: "Muscular Dystrophy" }
    ]
  },
  {
    id: "climate",
    label: "Climate & Environment",
    description: "Support solutions for climate change, clean air, and biodiversity preservation.",
    subcategories: [
      { id: "carbon", label: "Carbon Capture" },
      { id: "reforestation", label: "Reforestation" },
      { id: "airquality", label: "Air Quality Monitoring" },
    ]
  },
  {
    id: "energy",
    label: "Clean Energy",
    description: "Fund the future of solar power, hydrogen fuel, and sustainable infrastructure.",
    subcategories: [
        { id: "solar", label: "Solar Power" },
        { id: "wind", label: "Wind Energy" },
        { id: "hydrogen", label: "Hydrogen Fuel" },
        { id: "nuclear", label: "Nuclear Fusion" },
        { id: "storage", label: "Energy Storage & Batteries" }
    ]
  },
  {
    id: "space",
    label: "Space Exploration",
    description: "Accelerate humanity's journey to Mars and beyond through research and innovation.",
    subcategories: [
        { id: "mars", label: "Mars Missions" },
        { id: "telescopes", label: "Space Telescopes" },
        { id: "propulsion", label: "Advanced Propulsion" },
        { id: "colonization", label: "Space Colonization" },
        { id: "asteroids", label: "Asteroid Mining" }
    ]
  },
  {
    id: "ai",
    label: "Artificial Intelligence",
    description: "Support ethical AI development, health diagnostics, and smarter education tools.",
    subcategories: [
        { id: "ethical", label: "Ethical AI" },
        { id: "health-ai", label: "AI in Healthcare" },
        { id: "education-ai", label: "AI in Education" },
        { id: "nlp", label: "Natural Language Processing" },
        { id: "robotics", label: "AI Robotics" }
    ]
  },
  {
    id: "neuro",
    label: "Neuroscience",
    description: "Advance our understanding of the brain and treatments for neurodegenerative diseases.",
    subcategories: [
        { id: "alzheimers", label: "Alzheimer's Research" },
        { id: "parkinsons", label: "Parkinson's Disease" },
        { id: "brain-mapping", label: "Brain Mapping" },
        { id: "cognitive", label: "Cognitive Neuroscience" },
        { id: "neurotech", label: "Neurotechnology" }
    ]
  },
  {
    id: "biotech",
    label: "Genetics & Biotech",
    description: "Help drive CRISPR, gene therapy, and synthetic biology breakthroughs.",
    subcategories: [
        { id: "crispr", label: "CRISPR & Gene Editing" },
        { id: "gene-therapy", label: "Gene Therapy" },
        { id: "synthetic-biology", label: "Synthetic Biology" },
        { id: "genome-mapping", label: "Genome Mapping" },
        { id: "bioinformatics", label: "Bioinformatics" }
    ]
  },
  {
    id: "pandemic",
    label: "Pandemic Prevention",
    description: "Prepare for future outbreaks with vaccine research and viral surveillance.",
    subcategories: [
        { id: "vaccines", label: "Vaccine Development" },
        { id: "viral-surveillance", label: "Viral Surveillance" },
        { id: "rapid-diagnostics", label: "Rapid Diagnostics" },
        { id: "pandemic-modeling", label: "Pandemic Modeling" },
        { id: "biosecurity", label: "Biosecurity Measures" }
    ]     
  },
  {
    id: "food",
    label: "Food & Agriculture",
    description: "Support food security research, sustainable farming, and lab-grown alternatives.",
    subcategories: [
      { id: "food-security", label: "Food Security" },
      { id: "sustainable-farming", label: "Sustainable Farming" },
      { id: "lab-grown", label: "Lab-Grown Alternatives" },
      { id: "soil-research", label: "Soil & Nutrient Research" },
      { id: "agritech", label: "AgriTech Innovation" }
    ]
  },
  {
    id: "water",
    label: "Water Access",
    description: "Fund solutions for global clean water access and pollution mitigation.",
    subcategories: [
        { id: "clean-water", label: "Clean Water Solutions" },
        { id: "water-filtration", label: "Water Filtration Tech" },
        { id: "desalination", label: "Desalination" },
        { id: "pollution-monitoring", label: "Water Pollution Monitoring" },
        { id: "distribution", label: "Water Distribution Systems" }
    ]
  },
  {
    id: "equity",
    label: "Global Health Equity",
    description: "Make healthcare more accessible in underserved regions.",
    subcategories: [
        { id: "access-medicine", label: "Access to Medicines" },
        { id: "health-infrastructure", label: "Health Infrastructure" },
        { id: "rural-health", label: "Rural & Remote Healthcare" },
        { id: "affordable-care", label: "Affordable Care Models" },
        { id: "health-policy", label: "Health Equity Policy Research" }
    ]
  },
  {
    id: "education",
    label: "Future Education",
    description: "Empower education innovations and open science accessibility.",
    subcategories: [
        { id: "edtech", label: "EdTech Tools" },
        { id: "open-access", label: "Open Access Science" },
        { id: "stem", label: "STEM Education" },
        { id: "remote-learning", label: "Remote & Hybrid Learning" },
        { id: "neuroeducation", label: "Neuroeducation & Learning Science" }
    ]
  },
  {
    id: "maternal",
    label: "Child & Maternal Health",
    description: "Back projects improving health outcomes for mothers and children.",
    subcategories: [
        { id: "maternal-care", label: "Maternal Care" },
        { id: "neonatal", label: "Neonatal Health" },
        { id: "malnutrition", label: "Child Malnutrition" },
        { id: "vaccination", label: "Child Vaccination Programs" },
        { id: "birth-complications", label: "Birth Complications Research" }
    ]
  }
];

export default function Donate() {
  const [active, setActive] = useState<string | null>(null);

  const handleClick = (id: string) => {
    setActive((prev) => (prev === id ? null : id));
  };

  const activeCategory = categories.find((c) => c.id === active);

  return (
    <section className="py-20 bg-background min-h-screen">
      <div className="container mx-auto px-4 pt-16 text-center">
        <h2 className="text-3xl font-bold mb-6">Donate to a Cause</h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-10">
          Choose a scientific cause you care about. Your donation will help fund vetted research projects within that theme.
        </p>

        <div className="flex flex-wrap justify-center gap-6 mb-8">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleClick(cat.id)}
              className={`rounded-full px-8 py-5 text-base font-semibold transition-all duration-300 shadow-md hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary ${
                active === cat.id ? "bg-primary text-white" : "bg-muted"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {activeCategory && (
          <div className="max-w-2xl mx-auto bg-muted/30 border border-muted p-6 rounded-lg text-left">
            <h3 className="text-xl font-semibold mb-2">{activeCategory.label}</h3>
            <p className="mb-4 text-muted-foreground">{activeCategory.description}</p>

            {activeCategory.subcategories && (
              <div className="mb-4">
                <p className="font-medium mb-2">Subcategories:</p>
                <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
                  {activeCategory.subcategories.map((sub) => (
                    <li key={sub.id}>{sub.label}</li>
                  ))}
                </ul>
              </div>
            )}

            <Link href={`/demo/donateflow?category=${activeCategory.id}`}>
              <button className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500">
                Donate
              </button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
