export interface FollowUpItem {
    id: number;
    name: string;
    category: string;
    goal: number;
    funded: number;
    dateUploaded: string;
    dateFunded: string;
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
    progress?: number;
    updates?: { date: string; content: string; image?: string }[];
    visibility?: "public" | "private";
    timeline?: { title: string; date: string; status: "pending" | "in progress" | "complete" }[];
  }
  // TODO add one more research to make it pretty
  export const mockFollowUp: FollowUpItem[] = [
    {
      id: 101,
      name: "AI-Enhanced Cancer Detection",
      category: "Cancer",
      goal: 50000,
      funded: 50000,
      dateUploaded: "2024-11-15",
      dateFunded: "2025-03-01",
      grade: "A",
      description: "Using machine learning to improve early cancer diagnostics through histopathological image analysis.",
      researcher: {
        name: "Dr. Elena Gomez",
        title: "Professor of Biomedical AI",
        institution: "University of Barcelona",
      },
      impactTags: ["AI", "Oncology", "Diagnostics", "UN SDG 3"],
      documents: [
        { label: "Proposal", url: "/docs/ai-cancer-proposal.pdf" },
        { label: "Budget", url: "/docs/ai-cancer-budget.pdf" }
      ],
      milestones: [
        { title: "Data Collection", description: "Completed dataset from hospitals across Spain." },
        { title: "Model Training", description: "Initial training shows 92% accuracy." }
      ],
      donors: 312,
      tokenPerformance: "+12.5%",
      progress: 70,
      updates: [
        { date: "2025-04-01", content: "Data analysis phase complete, preparing for clinical validation." },
        { date: "2025-05-10", content: "Submitted manuscript to Nature Medicine." }
      ],
      visibility: "public",
      timeline: [
        { title: "Start Project", date: "2025-03-15", status: "complete" },
        { title: "AI Model Build", date: "2025-04-15", status: "in progress" },
        { title: "Clinical Trials", date: "2025-06-30", status: "pending" }
      ]
    },
    {
      id: 102,
      name: "Decarbonizing Cement Production",
      category: "Climate",
      goal: 75000,
      funded: 75000,
      dateUploaded: "2024-10-01",
      dateFunded: "2025-02-12",
      grade: "A+",
      description: "Researching carbon-neutral techniques in concrete manufacturing using bio-based alternatives.",
      researcher: {
        name: "Dr. Oliver Kraft",
        title: "Materials Scientist",
        institution: "Karlsruhe Institute of Technology",
      },
      impactTags: ["Climate Tech", "Construction", "CO2 Reduction", "UN SDG 13"],
      documents: [
        { label: "Lifecycle Study", url: "/docs/cement-carbon-study.pdf" }
      ],
      milestones: [
        { title: "Lab Prototype", description: "Successfully produced pilot batch of low-carbon cement." }
      ],
      donors: 411,
      tokenPerformance: "+9.7%",
      progress: 55,
      updates: [
        { date: "2025-04-05", content: "Lab trials show 40% carbon reduction in initial mix." }
      ],
      visibility: "public",
      timeline: [
        { title: "Start Lab Phase", date: "2025-03-01", status: "complete" },
        { title: "Scale Testing", date: "2025-05-20", status: "in progress" },
        { title: "Industry Pilot", date: "2025-08-01", status: "pending" }
      ]
    },
    {
      id: 103,
      name: "Quantum Encryption for Data Security",
      category: "Technology",
      goal: 60000,
      funded: 60000,
      dateUploaded: "2024-09-15",
      dateFunded: "2025-01-20",
      grade: "B+",
      description: "Developing next-gen quantum key distribution systems for ultra-secure communication.",
      researcher: {
        name: "Dr. Li Wei",
        title: "Quantum Physicist",
        institution: "Tsinghua University",
      },
      impactTags: ["Quantum", "Cybersecurity", "Encryption", "UN SDG 9"],
      documents: [
        { label: "System Design", url: "/docs/quantum-encryption-design.pdf" }
      ],
      milestones: [
        { title: "Protocol Simulation", description: "Quantum protocol simulated over 10km fiber." }
      ],
      donors: 278,
      tokenPerformance: "+15.2%",
      progress: 60,
      updates: [
        { date: "2025-04-18", content: "Hardware testbed assembled and signal integrity verified." }
      ],
      visibility: "private",
      timeline: [
        { title: "Protocol Design", date: "2025-02-01", status: "complete" },
        { title: "Lab Tests", date: "2025-04-01", status: "in progress" },
        { title: "Commercial Integration", date: "2025-09-10", status: "pending" }
      ]
    },
    {
      id: 104,
      name: "Regenerating Coral Reefs with 3D Printing",
      category: "Environment",
      goal: 30000,
      funded: 30000,
      dateUploaded: "2024-08-22",
      dateFunded: "2025-01-10",
      grade: "A",
      description: "Using biodegradable 3D printing materials to regenerate reef structures in the Pacific.",
      researcher: {
        name: "Dr. Talia N’goma",
        title: "Marine Ecologist",
        institution: "University of Queensland",
      },
      impactTags: ["Marine", "3D Printing", "Biodiversity", "UN SDG 14"],
      documents: [
        { label: "Field Plan", url: "/docs/coral-reef-plan.pdf" }
      ],
      milestones: [
        { title: "Deployment Phase", description: "10 reefs restored in Fiji with visible regrowth." }
      ],
      donors: 182,
      tokenPerformance: "+8.3%",
      progress: 85,
      updates: [
        { date: "2025-03-28", content: "Biodegradable structures show strong resilience in underwater tests." }
      ],
      visibility: "public",
      timeline: [
        { title: "3D Print Structures", date: "2025-01-20", status: "complete" },
        { title: "Deploy & Monitor", date: "2025-03-10", status: "in progress" },
        { title: "Biodiversity Analysis", date: "2025-07-01", status: "pending" }
      ]
    },
    {
      id: 105,
      name: "Bioengineered Skin Grafts for Burn Victims",
      category: "Health",
      goal: 45000,
      funded: 45000,
      dateUploaded: "2024-12-01",
      dateFunded: "2025-03-18",
      grade: "A-",
      description: "Advancing skin grafts using patient-derived stem cells and 3D scaffolding.",
      researcher: {
        name: "Dr. Isabelle Dupont",
        title: "Regenerative Medicine Specialist",
        institution: "Institut Pasteur",
      },
      impactTags: ["Stem Cells", "Reconstruction", "UN SDG 3"],
      documents: [
        { label: "Methodology", url: "/docs/skin-graft-methods.pdf" }
      ],
      milestones: [
        { title: "Cell Culture", description: "Successful expansion of autologous skin cells in lab." }
      ],
      donors: 376,
      tokenPerformance: "+11.0%",
      progress: 50,
      updates: [
        { date: "2025-05-01", content: "Scaffold testing in lab with positive integration results." }
      ],
      visibility: "public",
      timeline: [
        { title: "Cell Expansion", date: "2025-04-01", status: "in progress" },
        { title: "Scaffold Biopsy", date: "2025-06-15", status: "pending" }
      ]
    },
    {
      id: 106,
      name: "Battery Recycling with Low-Impact Chemistry",
      category: "Energy",
      goal: 55000,
      funded: 55000,
      dateUploaded: "2024-10-10",
      dateFunded: "2025-02-25",
      grade: "B",
      description: "Developing non-toxic chemical processes to recycle lithium batteries more efficiently.",
      researcher: {
        name: "Dr. Eva Schmidt",
        title: "Green Chemist",
        institution: "ETH Zurich",
      },
      impactTags: ["Battery", "Recycling", "UN SDG 12"],
      documents: [
        { label: "Tech Overview", url: "/docs/battery-recycling.pdf" }
      ],
      milestones: [
        { title: "Solvent Optimization", description: "Green solvent reduces waste by 60%." }
      ],
      donors: 203,
      tokenPerformance: "+7.4%",
      progress: 40,
      updates: [
        { date: "2025-04-20", content: "Pilot tests show consistent lithium recovery rates." }
      ],
      visibility: "private",
      timeline: [
        { title: "Chemical Design", date: "2025-03-01", status: "complete" },
        { title: "Pilot Plant Setup", date: "2025-05-01", status: "in progress" },
        { title: "Industry Testing", date: "2025-09-01", status: "pending" }
      ]
    },
    {
      id: 107,
      name: "AI for Autism Early Detection",
      category: "Neurology",
      goal: 40000,
      funded: 40000,
      dateUploaded: "2024-11-05",
      dateFunded: "2025-03-10",
      grade: "A",
      description: "Building a predictive AI model for early autism detection through speech and behavior patterns.",
      researcher: {
        name: "Dr. Martin Koenig",
        title: "Neuroscientist",
        institution: "Max Planck Institute for Human Development",
      },
      impactTags: ["AI", "Autism", "Diagnosis", "UN SDG 3"],
      documents: [
        { label: "Pilot Results", url: "/docs/autism-ai-pilot.pdf" }
      ],
      milestones: [
        { title: "Speech Model", description: "90% prediction accuracy in children under 4 years." }
      ],
      donors: 309,
      tokenPerformance: "+13.9%",
      progress: 65,
      updates: [
        { date: "2025-04-15", content: "Behavioral dataset annotation complete, model accuracy improved." }
      ],
      visibility: "public",
      timeline: [
        { title: "Data Gathering", date: "2025-03-15", status: "complete" },
        { title: "Model Training", date: "2025-04-20", status: "in progress" },
        { title: "Pediatric Trials", date: "2025-07-10", status: "pending" }
      ]
    }
  ];
  