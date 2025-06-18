export interface ResearchItem {
  id: number;
  name: string;
  category: string;
  goal: number;
  funded: number;
  date: string;
  grade: string;
  description: string;
  researcher?: {
    name: string;
    title: string;
    institution: string;
  };
  impactTags?: string[];
  documents?: { label: string; url: string }[];
  milestones?: { title: string; description: string }[];
  donors?: number;
  tokenPerformance?: string;
}

export const mockResearch: ResearchItem[] = [
  {
    id: 1,
    name: "Cancer Cell Mutation Study",
    category: "Cancer",
    goal: 100000,
    funded: 45200,
    date: "2025-06-01",
    grade: "A",
    description: "Researching mutation patterns in aggressive cancer cell lines.",
    researcher: {
      name: "Dr. Emily Chen",
      title: "Oncology Geneticist",
      institution: "Johns Hopkins University"
    },
    documents: [
      { label: "Mutation Protocol", url: "#" },
      { label: "Sample Data Set", url: "#" }
    ],
    impactTags: ["UN SDG 3"],
    donors: 112,
    tokenPerformance: "+3.5%",
    milestones: [
      { title: "Sample Collection", description: "Collect cell samples from 3 hospitals." },
      { title: "Mutation Analysis", description: "Identify high-risk genetic patterns." }
    ]
  },
  {
    id: 2,
    name: "Clean Ocean Microplastic Filter",
    category: "Climate & Environment",
    goal: 50000,
    funded: 36000,
    date: "2025-05-22",
    grade: "B+",
    description: "Engineering scalable ocean filtration for microplastics.",
    researcher: {
      name: "Prof. Lucas Meyer",
      title: "Marine Engineer",
      institution: "ETH Zurich"
    },
    documents: [
      { label: "Filter Blueprint", url: "#" },
      { label: "Impact Assessment", url: "#" }
    ],
    impactTags: ["UN SDG 14", "UN SDG 12"],
    donors: 87,
    tokenPerformance: "+5.1%",
    milestones: [
      { title: "Prototype Build", description: "Develop and test first ocean filter." },
      { title: "Deployment Plan", description: "Coordinate with coastal governments." }
    ]
  },
  {
    id: 3,
    name: "AI Drug Discovery System",
    category: "Artificial Intelligence",
    goal: 75000,
    funded: 74000,
    date: "2025-05-18",
    grade: "A+",
    description: "Using machine learning to accelerate compound identification.",
    researcher: {
      name: "Dr. Sara Al-Khatib",
      title: "Bioinformatics Lead",
      institution: "Karolinska Institute"
    },
    documents: [
      { label: "AI Model Specs", url: "#" },
      { label: "Compound Library", url: "#" }
    ],
    impactTags: ["UN SDG 3", "UN SDG 9"],
    donors: 154,
    tokenPerformance: "+9.2%",
    milestones: [
      { title: "Model Training", description: "Train model on large compound set." },
      { title: "Hit Validation", description: "Lab test top 10 predicted compounds." }
    ]
  },
  {
    id: 4,
    name: "Parkinson’s Early Diagnosis Tool",
    category: "Neuroscience",
    goal: 60000,
    funded: 22000,
    date: "2025-06-10",
    grade: "B",
    description: "Developing a non-invasive tool to detect Parkinson's at early stages.",
    researcher: {
      name: "Dr. Akira Fujimoto",
      title: "Neuroscience Researcher",
      institution: "Kyoto University"
    },
    documents: [
      { label: "Diagnostic Criteria", url: "#" },
      { label: "Early Trial Results", url: "#" }
    ],
    impactTags: ["UN SDG 3"],
    donors: 59,
    tokenPerformance: "+4.7%",
    milestones: [
      { title: "Sensor Design", description: "Build wearable sensor prototype." },
      { title: "Patient Trials", description: "Begin early-stage patient testing." }
    ]
  },
  {
    id: 5,
    name: "Carbon-Neutral Cement Formula",
    category: "Clean Energy",
    goal: 90000,
    funded: 79000,
    date: "2025-06-03",
    grade: "A",
    description: "Creating new eco-friendly concrete alternatives for sustainable building.",
    researcher: {
      name: "Dr. Marta Rossi",
      title: "Material Scientist",
      institution: "Politecnico di Milano"
    },
    documents: [
      { label: "Formula Composition", url: "#" },
      { label: "Durability Study", url: "#" }
    ],
    impactTags: ["UN SDG 9", "UN SDG 11"],
    donors: 94,
    tokenPerformance: "+2.9%",
    milestones: [
      { title: "Formula Approval", description: "Complete regulatory compliance tests." },
      { title: "Field Test", description: "Deploy in pilot building project." }
    ]
  },
  {
    id: 6,
    name: "Bioengineered Crops for Drought Resistance",
    category: "Food & Agriculture",
    goal: 65000,
    funded: 41000,
    date: "2025-06-08",
    grade: "A-",
    description: "Developing genetically modified crops for arid climates.",
    researcher: {
      name: "Dr. Neha Sharma",
      title: "Agricultural Biotechnologist",
      institution: "IIT Delhi"
    },
    documents: [
      { label: "Crop Trial Design", url: "#" },
      { label: "Genetic Engineering Report", url: "#" }
    ],
    impactTags: ["UN SDG 2", "UN SDG 13"],
    donors: 72,
    tokenPerformance: "+3.2%",
    milestones: [
      { title: "Gene Insertion", description: "Add drought-resistant genes to rice." },
      { title: "Pilot Farm Trial", description: "Test crops in semi-arid regions." }
    ]
  },
  {
    id: 7,
    name: "VR-Based Therapy for PTSD in War Zones",
    category: "Mental Health",
    goal: 85000,
    funded: 56000,
    date: "2025-06-21",
    grade: "A-",
    description: "Delivering immersive therapy in mobile clinics for displaced populations.",
    researcher: {
      name: "Dr. Hana Ben Said",
      title: "Clinical Psychologist",
      institution: "University of Tunis"
    },
    documents: [
      { label: "Therapy Scenarios", url: "#" },
      { label: "VR Compliance Checklist", url: "#" }
    ],
    impactTags: ["UN SDG 3", "UN SDG 16"],
    donors: 67,
    tokenPerformance: "+6.4%",
    milestones: [
      { title: "VR Scenario Development", description: "Create safe trauma-exposure modules." },
      { title: "Pilot Sessions", description: "Test therapy on 50 patients." }
    ]
  },
  {
    id: 8,
    name: "AI-Powered Literacy Tutor for Children",
    category: "Future Education",
    goal: 55000,
    funded: 43000,
    date: "2025-06-19",
    grade: "B+",
    description: "Helping early learners through personalized AI reading companions.",
    researcher: {
      name: "Dr. Léo Dubois",
      title: "Educational Technologist",
      institution: "Université de Montréal"
    },
    documents: [
      { label: "Tutor UX Design", url: "#" },
      { label: "Pilot Literacy Scores", url: "#" }
    ],
    impactTags: ["UN SDG 4"],
    donors: 63,
    tokenPerformance: "+2.8%",
    milestones: [
      { title: "Voice AI Integration", description: "Enable voice feedback and correction." },
      { title: "School Pilot", description: "Deploy in 3 primary schools." }
    ]
  },
  {
    id: 9,
    name: "Mobile Water Purification for Crisis Zones",
    category: "Water Access",
    goal: 72000,
    funded: 64000,
    date: "2025-06-11",
    grade: "A",
    description: "Developing solar-powered purifiers for emergency deployment.",
    researcher: {
      name: "Eng. Omid Karimi",
      title: "Water Infrastructure Engineer",
      institution: "Tehran Institute of Technology"
    },
    documents: [
      { label: "Purifier Engineering", url: "#" },
      { label: "Field Efficiency Report", url: "#" }
    ],
    impactTags: ["UN SDG 6"],
    donors: 79,
    tokenPerformance: "+3.9%",
    milestones: [
      { title: "Purifier Manufacturing", description: "Assemble 100 units for pilot use." },
      { title: "Deployment Simulation", description: "Run crisis-response drill in refugee zone." }
    ]
  },
  {
    id: 10,
    name: "Decentralized Genomic Data Sharing System",
    category: "Genetics & Biotech",
    goal: 88000,
    funded: 62000,
    date: "2025-06-15",
    grade: "A",
    description: "Secure and ethical genomic research sharing using blockchain.",
    researcher: {
      name: "Dr. Chloe Martinez",
      title: "Genomics & Privacy Expert",
      institution: "University of Barcelona"
    },
    documents: [
      { label: "Encryption Protocol", url: "#" },
      { label: "Pilot Data Framework", url: "#" }
    ],
    impactTags: ["UN SDG 3", "UN SDG 9"],
    donors: 104,
    tokenPerformance: "+4.3%",
    milestones: [
      { title: "Blockchain Setup", description: "Deploy private network for data sharing." },
      { title: "Compliance Test", description: "Verify GDPR and medical ethics compliance." }
    ]
  },
  {
    id: 11,
    name: "Fusion Battery Storage Prototype",
    category: "Energy",
    goal: 120000,
    funded: 89000,
    date: "2025-06-25",
    grade: "A",
    description: "Developing advanced storage for fusion reactor energy surplus.",
    researcher: {
      name: "Dr. Ingrid Holtz",
      title: "Plasma Physicist",
      institution: "Max Planck Institute"
    },
    documents: [
      { label: "Battery Design Draft", url: "#" },
      { label: "Fusion Compatibility Notes", url: "#" }
    ],
    impactTags: ["UN SDG 7", "UN SDG 13"],
    donors: 92,
    tokenPerformance: "+6.1%",
    milestones: [
      { title: "Material Selection", description: "Select superconductor blend for coils." },
      { title: "Prototype Build", description: "Assemble functioning fusion-compatible battery." }
    ]
  },
  {
    id: 12,
    name: "Next-Gen Pandemic Rapid Test",
    category: "Pandemic Defense",
    goal: 70000,
    funded: 69000,
    date: "2025-06-26",
    grade: "A-",
    description: "Developing a 5-minute viral pathogen test using CRISPR.",
    researcher: {
      name: "Dr. Imani Nwosu",
      title: "Virologist",
      institution: "Cape Town Biomedical Center"
    },
    documents: [
      { label: "CRISPR Diagnostic Guide", url: "#" },
      { label: "Trial Data", url: "#" }
    ],
    impactTags: ["UN SDG 3"],
    donors: 105,
    tokenPerformance: "+7.5%",
    milestones: [
      { title: "CRISPR Targeting", description: "Program target for top 5 threat viruses." },
      { title: "Clinical Evaluation", description: "Run 100 subject blind comparison." }
    ]
  },
  {
    id: 13,
    name: "Affordable Prosthetics via 3D Printing",
    category: "Health Equity",
    goal: 40000,
    funded: 37500,
    date: "2025-06-23",
    grade: "B+",
    description: "3D printing custom prosthetics for underserved communities.",
    researcher: {
      name: "Dr. Kenji Nakamura",
      title: "Biomedical Engineer",
      institution: "University of British Columbia"
    },
    documents: [
      { label: "Print Design Templates", url: "#" },
      { label: "Cost Efficiency Model", url: "#" }
    ],
    impactTags: ["UN SDG 3", "UN SDG 10"],
    donors: 77,
    tokenPerformance: "+2.6%",
    milestones: [
      { title: "Prototype Arms & Legs", description: "Print 10 limb prototypes for trial use." },
      { title: "Training Workshop", description: "Teach local staff to replicate designs." }
    ]
  },
  {
    id: 14,
    name: "Solar-Powered Desalination Units",
    category: "Water Access",
    goal: 95000,
    funded: 80000,
    date: "2025-06-28",
    grade: "A",
    description: "Creating transportable solar desalination units for remote areas.",
    researcher: {
      name: "Eng. Fatima El Rahman",
      title: "Renewable Systems Engineer",
      institution: "Cairo Technical University"
    },
    documents: [
      { label: "Desal Unit Schematic", url: "#" },
      { label: "Solar Yield Test", url: "#" }
    ],
    impactTags: ["UN SDG 6", "UN SDG 13"],
    donors: 84,
    tokenPerformance: "+4.8%",
    milestones: [
      { title: "Solar Optimization", description: "Adapt unit to cloudy climates." },
      { title: "Community Deployment", description: "Deploy to 3 remote villages." }
    ]
  },
  {
    id: 15,
    name: "Antibiotic Alternatives via Bacteriophages",
    category: "Biotech",
    goal: 110000,
    funded: 103000,
    date: "2025-06-30",
    grade: "A+",
    description: "Studying bacteriophage therapy to counter antibiotic resistance.",
    researcher: {
      name: "Dr. Elena Varga",
      title: "Microbiologist",
      institution: "Semmelweis University"
    },
    documents: [
      { label: "Phage Isolation Protocol", url: "#" },
      { label: "Resistance Trend Report", url: "#" }
    ],
    impactTags: ["UN SDG 3", "UN SDG 9"],
    donors: 112,
    tokenPerformance: "+8.6%",
    milestones: [
      { title: "Phage Screening", description: "Find effective strains for resistant infections." },
      { title: "Therapy Trials", description: "Test bacteriophage injections in mice." }
    ]
  },
  {
    id: 16,
    name: "Next-Gen Human Rights Legal AI",
    category: "Equity & Justice",
    goal: 60000,
    funded: 42000,
    date: "2025-06-29",
    grade: "B+",
    description: "Building an AI tool for legal aid in refugee and asylum processes.",
    researcher: {
      name: "Dr. Clara Mendes",
      title: "Legal Tech Researcher",
      institution: "University of São Paulo"
    },
    documents: [
      { label: "Case Law Dataset", url: "#" },
      { label: "AI Fairness Audit", url: "#" }
    ],
    impactTags: ["UN SDG 10", "UN SDG 16"],
    donors: 58,
    tokenPerformance: "+3.4%",
    milestones: [
      { title: "Training on Multilingual Law", description: "Enable Arabic, French, Spanish." },
      { title: "Pilot with NGOs", description: "Test use in 3 refugee legal centers." }
    ]
  },
  {
    id: 17,
    name: "Space Fungal Shield Against Radiation",
    category: "Space",
    goal: 130000,
    funded: 96000,
    date: "2025-07-01",
    grade: "A",
    description: "Studying melanin-producing fungi as natural radiation shields for astronauts.",
    researcher: {
      name: "Dr. Hugo Fernandez",
      title: "Astrobiologist",
      institution: "ESA Research Labs"
    },
    documents: [
      { label: "Fungal Cultivation Notes", url: "#" },
      { label: "Radiation Test Logs", url: "#" }
    ],
    impactTags: ["UN SDG 9", "UN SDG 13"],
    donors: 99,
    tokenPerformance: "+5.9%",
    milestones: [
      { title: "Zero-G Fungal Growth", description: "Grow fungi aboard ISS simulator." },
      { title: "Radiation Barrier Test", description: "Evaluate shield vs. solar flares." }
    ]
  },
  {
    id: 18,
    name: "Rare Disease Atlas for Sub-Saharan Africa",
    category: "Rare Diseases",
    goal: 50000,
    funded: 49000,
    date: "2025-07-02",
    grade: "A-",
    description: "Mapping and profiling rare genetic conditions in underserved regions.",
    researcher: {
      name: "Dr. Jean-Baptiste Mugisha",
      title: "Medical Geneticist",
      institution: "University of Rwanda"
    },
    documents: [
      { label: "Prevalence Data", url: "#" },
      { label: "Genetic Risk Map", url: "#" }
    ],
    impactTags: ["UN SDG 3", "UN SDG 10"],
    donors: 69,
    tokenPerformance: "+4.4%",
    milestones: [
      { title: "Regional Screenings", description: "Collect genomic data in 4 countries." },
      { title: "Public Health Brief", description: "Prepare policy report for ministries." }
    ]
  },
  {
    id: 19,
    name: "Decentralized Solar Grid for Schools",
    category: "Future Education",
    goal: 75000,
    funded: 55000,
    date: "2025-07-03",
    grade: "B",
    description: "Providing solar electricity to rural schools via peer-grid nodes.",
    researcher: {
      name: "Eng. Rafael Gutierrez",
      title: "Energy Infrastructure Developer",
      institution: "Universidad Nacional de Colombia"
    },
    documents: [
      { label: "Grid Architecture", url: "#" },
      { label: "Pilot Site Map", url: "#" }
    ],
    impactTags: ["UN SDG 7", "UN SDG 4"],
    donors: 71,
    tokenPerformance: "+3.1%",
    milestones: [
      { title: "First 3 School Links", description: "Build solar panels and link nodes." },
      { title: "Education Integration", description: "Train students in maintaining grid." }
    ]
  },
  {
    id: 20,
    name: "Reprogrammable Stem Cell Toolkit",
    category: "Genetics & Biotech",
    goal: 150000,
    funded: 112000,
    date: "2025-07-04",
    grade: "A+",
    description: "Designing a modular gene-editing toolkit for pluripotent stem cells.",
    researcher: {
      name: "Dr. Louise Becker",
      title: "Stem Cell Biologist",
      institution: "Leiden University Medical Center"
    },
    documents: [
      { label: "CRISPR Build Sheets", url: "#" },
      { label: "Stem Cell Cultivation Notes", url: "#" }
    ],
    impactTags: ["UN SDG 3", "UN SDG 9"],
    donors: 128,
    tokenPerformance: "+9.0%",
    milestones: [
      { title: "Toolkit Assembly", description: "Complete gene edit control package." },
      { title: "Stem Cell Trials", description: "Reprogram 3 tissue types in vitro." }
    ]
  },
  {
    id: 21,
    name: "AI-Powered Mental Health Companion",
    category: "Mental Health",
    goal: 60000,
    funded: 41000,
    date: "2025-07-05",
    grade: "B+",
    description: "A chatbot-based daily companion for monitoring and improving emotional well-being.",
    researcher: {
      name: "Dr. Roya Khalili",
      title: "Clinical Psychologist",
      institution: "Tehran Institute of Behavioral Science"
    },
    documents: [
      { label: "Chatbot Flow Map", url: "#" },
      { label: "Validation Study", url: "#" }
    ],
    impactTags: ["UN SDG 3"],
    donors: 53,
    tokenPerformance: "+3.9%",
    milestones: [
      { title: "Language Processing Model", description: "Tune chatbot for empathetic responses." },
      { title: "Pilot User Trial", description: "Gather data from 100 users across 4 countries." }
    ]
  },
  {
    id: 22,
    name: "Food Waste Bioconversion Unit",
    category: "Food & Nutrition",
    goal: 72000,
    funded: 69000,
    date: "2025-07-06",
    grade: "A-",
    description: "Turning food waste into high-protein animal feed using larvae bioconversion.",
    researcher: {
      name: "Dr. Liem Tran",
      title: "Agroecologist",
      institution: "Vietnam National University"
    },
    documents: [
      { label: "Conversion Protocol", url: "#" },
      { label: "Efficiency Report", url: "#" }
    ],
    impactTags: ["UN SDG 2", "UN SDG 12"],
    donors: 76,
    tokenPerformance: "+4.5%",
    milestones: [
      { title: "Pilot Unit Setup", description: "Build 3 compost→feed conversion stations." },
      { title: "Government Approval", description: "Get feed certification by local agriculture office." }
    ]
  },
  {
    id: 23,
    name: "Decentralized Climate Prediction Network",
    category: "Climate",
    goal: 95000,
    funded: 74000,
    date: "2025-07-07",
    grade: "A",
    description: "A blockchain-based model to aggregate and verify local weather data.",
    researcher: {
      name: "Dr. Malik Choudhury",
      title: "Climate Data Scientist",
      institution: "Monash University"
    },
    documents: [
      { label: "Data Node Whitepaper", url: "#" },
      { label: "Forecast Engine Trial", url: "#" }
    ],
    impactTags: ["UN SDG 13", "UN SDG 11"],
    donors: 94,
    tokenPerformance: "+5.7%",
    milestones: [
      { title: "20 Sensor Deployments", description: "Launch nodes in 5 countries." },
      { title: "Open Forecast API", description: "Launch beta prediction feed with validation." }
    ]
  },
  {
    id: 24,
    name: "Bio-Luminescent Lighting Panels",
    category: "Environmental",
    goal: 78000,
    funded: 50000,
    date: "2025-07-08",
    grade: "B+",
    description: "Harnessing bioluminescent bacteria for low-energy ambient lighting.",
    researcher: {
      name: "Dr. Ava Martinez",
      title: "Biodesigner",
      institution: "University of Barcelona"
    },
    documents: [
      { label: "Panel Growth Notes", url: "#" },
      { label: "Luminance Test Report", url: "#" }
    ],
    impactTags: ["UN SDG 7", "UN SDG 9"],
    donors: 66,
    tokenPerformance: "+3.3%",
    milestones: [
      { title: "Stable Glow Culture", description: "Genetically engineer high-lumen bacteria." },
      { title: "Lighting Panel Build", description: "Create wall tiles for 72h lighting demo." }
    ]
  },
  {
    id: 25,
    name: "Universal Blood Test for Early Disease",
    category: "Healthcare",
    goal: 110000,
    funded: 106000,
    date: "2025-07-09",
    grade: "A+",
    description: "Detecting dozens of diseases with a single drop of blood using nanotech.",
    researcher: {
      name: "Dr. Omar Al-Karim",
      title: "Nanobiotech Specialist",
      institution: "Weizmann Institute"
    },
    documents: [
      { label: "Nano Marker Index", url: "#" },
      { label: "Early Detection Trial", url: "#" }
    ],
    impactTags: ["UN SDG 3"],
    donors: 121,
    tokenPerformance: "+9.3%",
    milestones: [
      { title: "Lab-on-Chip Assembly", description: "Integrate sensor in drop test form factor." },
      { title: "Initial Patient Testing", description: "Try on 250 high-risk volunteers." }
    ]
  },
  {
    id: 26,
    name: "Open-Access AI for Rare Diseases",
    category: "Rare Diseases",
    goal: 58000,
    funded: 45000,
    date: "2025-07-10",
    grade: "B",
    description: "Crowdsourcing data for an AI model trained to identify rare disease signs.",
    researcher: {
      name: "Dr. Julia Singh",
      title: "AI Ethics Researcher",
      institution: "University of Toronto"
    },
    documents: [
      { label: "Training Set Report", url: "#" },
      { label: "Global Access Plan", url: "#" }
    ],
    impactTags: ["UN SDG 3", "UN SDG 10"],
    donors: 82,
    tokenPerformance: "+4.1%",
    milestones: [
      { title: "Data Collection Campaign", description: "Partner with 12 clinics worldwide." },
      { title: "AI Model Publication", description: "Release as open-source tool." }
    ]
  },
  {
    id: 27,
    name: "Self-Healing Materials for Infrastructure",
    category: "Materials Science",
    goal: 88000,
    funded: 70000,
    date: "2025-07-11",
    grade: "A",
    description: "Developing concrete that seals cracks using embedded bacteria.",
    researcher: {
      name: "Dr. Lars Meijer",
      title: "Structural Engineer",
      institution: "TU Delft"
    },
    documents: [
      { label: "Crack Healing Timeline", url: "#" },
      { label: "Material Viability Test", url: "#" }
    ],
    impactTags: ["UN SDG 9", "UN SDG 11"],
    donors: 79,
    tokenPerformance: "+4.9%",
    milestones: [
      { title: "Small Bridge Test", description: "Use in real outdoor bridge crack repair." },
      { title: "Lab Lifetime Test", description: "Simulate 10-year degradation cycle." }
    ]
  },
  {
    id: 28,
    name: "Ocean CO₂ Capture via Seaweed",
    category: "Climate",
    goal: 99000,
    funded: 82000,
    date: "2025-07-12",
    grade: "B+",
    description: "Using fast-growing kelp to absorb carbon and sink it deep into the ocean.",
    researcher: {
      name: "Dr. Emily Rhee",
      title: "Marine Biologist",
      institution: "University of Tasmania"
    },
    documents: [
      { label: "Kelp Growth Rates", url: "#" },
      { label: "Carbon Sequestration Map", url: "#" }
    ],
    impactTags: ["UN SDG 13", "UN SDG 14"],
    donors: 88,
    tokenPerformance: "+5.0%",
    milestones: [
      { title: "Offshore Farm Setup", description: "Deploy kelp buoys across 3km²." },
      { title: "Deep Sink Trial", description: "Drop 5 tons of mature kelp to seafloor." }
    ]
  },
  {
    id: 29,
    name: "Blockchain Voting for University Elections",
    category: "Equity & Justice",
    goal: 34000,
    funded: 29000,
    date: "2025-07-13",
    grade: "B",
    description: "Secure and transparent digital voting system for student representation.",
    researcher: {
      name: "Dr. Anita Kapoor",
      title: "Civic Tech Developer",
      institution: "Delhi Institute of Technology"
    },
    documents: [
      { label: "Voting Protocol Whitepaper", url: "#" },
      { label: "Student Body Test Run", url: "#" }
    ],
    impactTags: ["UN SDG 16"],
    donors: 41,
    tokenPerformance: "+2.0%",
    milestones: [
      { title: "Pilot with 2 Campuses", description: "Test full election cycle." },
      { title: "Transparency Audit", description: "Validate cryptographic fairness." }
    ]
  },
  {
    id: 30,
    name: "Personalized Nutrition Based on Microbiome",
    category: "Food & Nutrition",
    goal: 87000,
    funded: 68000,
    date: "2025-07-14",
    grade: "A-",
    description: "Tailoring meal plans to gut bacteria to improve metabolism and energy.",
    researcher: {
      name: "Dr. Sofia Lemaitre",
      title: "Gut Health Specialist",
      institution: "Université de Genève"
    },
    documents: [
      { label: "Gut Typing Algorithm", url: "#" },
      { label: "Pilot Meal Plans", url: "#" }
    ],
    impactTags: ["UN SDG 3", "UN SDG 2"],
    donors: 91,
    tokenPerformance: "+4.7%",
    milestones: [
      { title: "Microbiome Data Collection", description: "Sequence gut flora of 200 volunteers." },
      { title: "Meal Matching Trial", description: "Compare energy levels across 3 diets." }
    ]
  },
  {
    id: 31,
    name: "Blockchain for Medical Records",
    category: "Artificial Intelligence",
    goal: 85000,
    funded: 42000,
    date: "2025-06-14",
    grade: "B+",
    description: "Securing global medical records using decentralized blockchain technologies.",
    researcher: {
      name: "Dr. Nora Kim",
      title: "Health Informatics Expert",
      institution: "University of Sydney"
    },
    impactTags: ["UN SDG 3", "UN SDG 9"],
    documents: [
      { label: "White Paper", url: "#" },
      { label: "Security Framework", url: "#" }
    ],
    milestones: [
      { title: "Tech Stack Finalization", description: "Choose blockchain infrastructure" },
      { title: "Pilot with Clinics", description: "Deploy in 5 clinics" }
    ],
    donors: 108,
    tokenPerformance: "+12%"
  },
  {
    id: 32,
    name: "Desalination via Solar Membranes",
    category: "Water Access",
    goal: 90000,
    funded: 79000,
    date: "2025-06-12",
    grade: "A",
    description: "Developing solar-powered filtration membranes for arid regions.",
    researcher: {
      name: "Prof. Omar El-Baz",
      title: "Water Resource Engineer",
      institution: "Cairo Institute of Technology"
    },
    impactTags: ["UN SDG 6", "UN SDG 13"],
    documents: [
      { label: "Desalination Protocol", url: "#" },
      { label: "Field Report", url: "#" }
    ],
    milestones: [
      { title: "Lab Prototype", description: "Functional solar membrane created" },
      { title: "Field Test in Morocco", description: "Deploy prototype in arid zones" }
    ],
    donors: 194,
    tokenPerformance: "+8%"
  },
  {
    id: 33,
    name: "Remote AI Diagnosis for Eye Diseases",
    category: "Global Health Equity",
    goal: 95000,
    funded: 72000,
    date: "2025-06-10",
    grade: "A-",
    description: "Using smartphones and AI to screen for glaucoma and retinopathy in low-resource settings.",
    researcher: {
      name: "Dr. Lina Wei",
      title: "Biomedical AI Researcher",
      institution: "Beijing Medical AI Lab"
    },
    impactTags: ["UN SDG 3", "UN SDG 10"],
    documents: [
      { label: "Dataset Overview", url: "#" },
      { label: "Mobile Deployment Plan", url: "#" }
    ],
    milestones: [
      { title: "Data Collection", description: "Gather 10,000 eye images" },
      { title: "App Development", description: "Deploy first beta in Kenya" }
    ],
    donors: 167,
    tokenPerformance: "+5%"
  },
  {
    id: 34,
    name: "Biodegradable Plastic Alternatives",
    category: "Climate & Environment",
    goal: 70000,
    funded: 39000,
    date: "2025-06-08",
    grade: "B+",
    description: "Sourcing low-cost biodegradable plastics from agricultural waste.",
    researcher: {
      name: "Dr. Alina Radic",
      title: "Green Chemistry Lead",
      institution: "Ljubljana Institute of Materials"
    },
    impactTags: ["UN SDG 12", "UN SDG 15"],
    documents: [
      { label: "Chemical Structure Report", url: "#" },
      { label: "Industry Collaboration Letter", url: "#" }
    ],
    milestones: [
      { title: "Waste Sourcing", description: "Partner with farms for byproduct feedstock" },
      { title: "Decomposition Trials", description: "Test degradation rate in real soil" }
    ],
    donors: 82,
    tokenPerformance: "+3%"
  },
  {
    id: 35,
    name: "Digital Biology Lab for Students",
    category: "Future Education",
    goal: 60000,
    funded: 44000,
    date: "2025-06-06",
    grade: "A",
    description: "Creating virtual biology lab simulations accessible via web for high school students globally.",
    researcher: {
      name: "Dr. Elisa Greco",
      title: "EdTech Developer",
      institution: "Open Science Academy, Italy"
    },
    impactTags: ["UN SDG 4", "UN SDG 9"],
    documents: [
      { label: "Lab Curriculum Draft", url: "#" },
      { label: "Beta Demo Access", url: "#" }
    ],
    milestones: [
      { title: "Build 5 Experiments", description: "Cell division, genetics, etc." },
      { title: "Pilot in 3 Schools", description: "Test usability and learning gains" }
    ],
    donors: 123,
    tokenPerformance: "+6%"
  },
  {
    id: 36,
    name: "Heat-Resistant Crops for Tropics",
    category: "Food & Agriculture",
    goal: 100000,
    funded: 73000,
    date: "2025-06-05",
    grade: "A-",
    description: "Genetically modifying staple crops to resist heat waves and water stress.",
    researcher: {
      name: "Dr. Kwame Mensah",
      title: "Crop Geneticist",
      institution: "West Africa Agricultural University"
    },
    impactTags: ["UN SDG 2", "UN SDG 13"],
    documents: [
      { label: "Gene Mapping Plan", url: "#" },
      { label: "Field Plot Results", url: "#" }
    ],
    milestones: [
      { title: "CRISPR Editing", description: "Targeted edit of maize genome" },
      { title: "Harvest in Test Sites", description: "Compare yields with control group" }
    ],
    donors: 211,
    tokenPerformance: "+9%"
  },
  {
    id: 37,
    name: "Quantum Encryption for Genomic Data",
    category: "Genetics & Biotech",
    goal: 125000,
    funded: 88000,
    date: "2025-06-04",
    grade: "A+",
    description: "Combining quantum computing and genomics to prevent data theft in DNA banks.",
    researcher: {
      name: "Dr. Eva Tanaka",
      title: "Quantum Security Scientist",
      institution: "Tokyo Genomic Security Lab"
    },
    impactTags: ["UN SDG 9", "UN SDG 16"],
    documents: [
      { label: "Encryption Model", url: "#" },
      { label: "Regulatory Compliance Summary", url: "#" }
    ],
    milestones: [
      { title: "Simulate Attack Scenarios", description: "Test resistance against common breaches" },
      { title: "Secure Cloud Pilot", description: "Host encrypted genome database" }
    ],
    donors: 72,
    tokenPerformance: "+14%"
  },
  {
    id: 38,
    name: "Smart Drug Delivery for Parkinson’s",
    category: "Neuroscience",
    goal: 110000,
    funded: 92000,
    date: "2025-06-03",
    grade: "A",
    description: "Nanoparticle carriers for targeted brain delivery of dopamine agonists.",
    researcher: {
      name: "Dr. Leo Caruso",
      title: "Neuropharmacologist",
      institution: "Karolinska Institute"
    },
    impactTags: ["UN SDG 3"],
    documents: [
      { label: "Delivery Protocol", url: "#" },
      { label: "Toxicity Study", url: "#" }
    ],
    milestones: [
      { title: "Nanoparticle Synthesis", description: "Create lipid-based carriers" },
      { title: "Animal Model Tests", description: "Test motor function improvement" }
    ],
    donors: 101,
    tokenPerformance: "+11%"
  },
  {
    id: 39,
    name: "AI-Powered Peer Review Platform",
    category: "Future Education",
    goal: 70000,
    funded: 43000,
    date: "2025-06-02",
    grade: "B+",
    description: "Streamlining academic publishing with AI-assisted quality checks and reviewer suggestions.",
    researcher: {
      name: "Dr. Robert Ndlovu",
      title: "Publishing Technologist",
      institution: "University of Cape Town"
    },
    impactTags: ["UN SDG 4", "UN SDG 9"],
    documents: [
      { label: "Platform UI Demo", url: "#" },
      { label: "Peer Review Algorithms", url: "#" }
    ],
    milestones: [
      { title: "Integration with Journals", description: "API plug-ins ready" },
      { title: "User Testing", description: "Pilot with 20 editors" }
    ],
    donors: 88,
    tokenPerformance: "+4%"
  },
  {
    id: 40,
    name: "AI Companions for Elderly with Dementia",
    category: "Mental Health",
    goal: 80000,
    funded: 62000,
    date: "2025-06-01",
    grade: "A",
    description: "Emotionally adaptive AI companions for elderly patients with cognitive decline.",
    researcher: {
      name: "Dr. Elsa Fournier",
      title: "Human-Robot Interaction Specialist",
      institution: "EPFL Lausanne"
    },
    impactTags: ["UN SDG 3", "UN SDG 10"],
    documents: [
      { label: "Interaction Logs", url: "#" },
      { label: "Patient Feedback Report", url: "#" }
    ],
    milestones: [
      { title: "Prototype Completion", description: "Build 3 functioning robot units" },
      { title: "Hospital Pilot", description: "Test in 2 elder care facilities" }
    ],
    donors: 132,
    tokenPerformance: "+7%"
  }       
];
