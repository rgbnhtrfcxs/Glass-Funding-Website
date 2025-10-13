import { mockResearch } from "./mockResearch";
import { mockFollowUp } from "./mockFollowUp";

export interface FavoriteProject {
  id: number;
  title: string;
  category: string;
  funded: number;
  goal: number;
  progressPercent: number;
  addedAt: string;
  invested: number;
  autoTopUp: boolean;
  latestUpdate: string;
  nextMilestone?: {
    title: string;
    date: string;
  };
  tags: string[];
}

export interface FollowUpTask {
  id: number;
  title: string;
  projectName: string;
  status: "awaiting-response" | "scheduled" | "in-review";
  dueDate: string;
  summary: string;
  lastUpdate: string;
  filesRequired: number;
  progress: number;
  link: string;
}

export interface SubmissionGuideline {
  title: string;
  description: string;
  items: string[];
}

export interface PortfolioProject {
  id: number;
  title: string;
  category: string;
  type: "Investment" | "Donation";
  status: "Active" | "Completed" | "Pending";
  committed: number;
  released: number;
  currency: "EUR" | "USD";
  ownershipShare?: string;
  yieldToDate?: string;
  nextMilestone?: {
    title: string;
    date: string;
  };
  latestUpdate: string;
  researchLead: string;
  contactEmail: string;
  followUpLink: string;
  tags: string[];
  progress: number;
}

export const projectCategories = [
  "Oncology",
  "Climate & Environment",
  "Clean Energy",
  "Neuroscience",
  "Artificial Intelligence",
  "Biotechnology",
  "Mental Health",
];

export const milestoneTemplates = [
  "Regulatory or ethics approval",
  "Prototype or lab validation",
  "Clinical or field deployment",
  "Data analysis & publication",
];

const favoriteProjectSources = [
  {
    researchId: 1,
    invested: 2500,
    autoTopUp: true,
    addedAt: "Added Feb 2025",
    latestUpdate: "Clinical review board approved next experiment cohort.",
    nextMilestone: {
      title: "Neural Network Validation",
      date: "Apr 18, 2025",
    },
  },
  {
    researchId: 3,
    invested: 1800,
    autoTopUp: false,
    addedAt: "Added Jan 2025",
    latestUpdate: "AI pipeline cleared internal replication checks.",
    nextMilestone: {
      title: "Compound Screening",
      date: "May 02, 2025",
    },
  },
  {
    researchId: 5,
    invested: 3200,
    autoTopUp: true,
    addedAt: "Added Nov 2024",
    latestUpdate: "Municipal partner confirmed pilot deployment site.",
    nextMilestone: {
      title: "Pilot Pour",
      date: "Jun 14, 2025",
    },
  },
];

export const favoriteProjects: FavoriteProject[] = favoriteProjectSources.map(source => {
  const research = mockResearch.find(item => item.id === source.researchId);

  if (!research) {
    throw new Error(`Research item with id ${source.researchId} not found in mock data`);
  }

  return {
    id: research.id,
    title: research.name,
    category: research.category,
    goal: research.goal,
    funded: research.funded,
    progressPercent: Math.round((research.funded / research.goal) * 100),
    invested: source.invested,
    autoTopUp: source.autoTopUp,
    addedAt: source.addedAt,
    latestUpdate: source.latestUpdate,
    nextMilestone: source.nextMilestone,
    tags: research.impactTags ?? [],
  };
});

const followUpSourceMap = mockFollowUp.reduce((acc, item) => {
  acc.set(item.id, item);
  return acc;
}, new Map<number, (typeof mockFollowUp)[number]>());

export const followUpTasks: FollowUpTask[] = [
  {
    id: 103,
    title: "Review NDA draft",
    projectName: followUpSourceMap.get(103)?.name ?? "Quantum Encryption for Data Security",
    status: "awaiting-response",
    dueDate: "Apr 22, 2025",
    summary: "Legal team shared confidentiality addendum for upcoming hardware walkthrough.",
    lastUpdate: "Uploaded revised terms on Apr 16",
    filesRequired: 1,
    progress: followUpSourceMap.get(103)?.progress ?? 0,
    link: `/followup/103`,
  },
  {
    id: 101,
    title: "Upload clinical questions",
    projectName: followUpSourceMap.get(101)?.name ?? "AI-Enhanced Cancer Detection",
    status: "scheduled",
    dueDate: "Apr 25, 2025",
    summary: "Principal investigator requested investor questions ahead of lab visit.",
    lastUpdate: "Reminder email sent Apr 15",
    filesRequired: 2,
    progress: followUpSourceMap.get(101)?.progress ?? 0,
    link: `/followup/101`,
  },
  {
    id: 105,
    title: "Share milestone feedback",
    projectName: followUpSourceMap.get(105)?.name ?? "Bioengineered Skin Grafts for Burn Victims",
    status: "in-review",
    dueDate: "May 01, 2025",
    summary: "Provide perspective on scaffold integration data before tranche release.",
    lastUpdate: "Draft feedback saved Apr 17",
    filesRequired: 0,
    progress: followUpSourceMap.get(105)?.progress ?? 0,
    link: `/followup/105`,
  },
];

const portfolioProjectSources: Array<{
  followUpId: number;
  type: PortfolioProject["type"];
  status: PortfolioProject["status"];
  committed: number;
  released: number;
  currency: PortfolioProject["currency"];
  ownershipShare?: string;
  yieldToDate?: string;
  nextMilestone?: { title: string; date: string };
}> = [
  {
    followUpId: 101,
    type: "Investment",
    status: "Active",
    committed: 5000,
    released: 3500,
    currency: "EUR",
    ownershipShare: "0.85%",
    yieldToDate: "+6.2%",
    nextMilestone: { title: "Clinical validation briefing", date: "Apr 29, 2025" },
  },
  {
    followUpId: 103,
    type: "Investment",
    status: "Active",
    committed: 4200,
    released: 2800,
    currency: "EUR",
    ownershipShare: "0.40%",
    yieldToDate: "+4.8%",
    nextMilestone: { title: "Hardware demo walkthrough", date: "May 08, 2025" },
  },
  {
    followUpId: 105,
    type: "Donation",
    status: "Completed",
    committed: 2500,
    released: 2500,
    currency: "EUR",
    nextMilestone: { title: "Post-treatment outcomes brief", date: "May 30, 2025" },
  },
];

export const portfolioProjects: PortfolioProject[] = portfolioProjectSources.map(source => {
  const followUp = followUpSourceMap.get(source.followUpId);

  if (!followUp) {
    throw new Error(`Follow-up project with id ${source.followUpId} not found in mock data`);
  }

  const latestUpdate = followUp.updates?.[0]?.content ?? "No updates posted yet.";
  const researchLead = followUp.researcher?.name ?? "Lead researcher";
  const baseEmail = researchLead
    .replace(/[^a-zA-Z0-9]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\./, "")
    .replace(/\.$/, "")
    .toLowerCase();

  return {
    id: followUp.id,
    title: followUp.name,
    category: followUp.category,
    type: source.type,
    status: source.status,
    committed: source.committed,
    released: source.released,
    currency: source.currency,
    ownershipShare: source.ownershipShare,
    yieldToDate: source.yieldToDate,
    nextMilestone: source.nextMilestone ?? followUp.timeline?.find(item => item.status !== "complete"),
    latestUpdate,
    researchLead,
    contactEmail: `${baseEmail || "team"}@research.glass`,
    followUpLink: `/followup/${followUp.id}`,
    tags: followUp.impactTags ?? [],
    progress: followUp.progress ?? 0,
  };
});

export const submissionGuidelines: SubmissionGuideline[] = [
  {
    title: "Before You Begin",
    description: "Have the essentials ready so the Glass review team can evaluate quickly.",
    items: [
      "One paragraph mission summary (≤ 600 characters).",
      "High-level budget with milestone-linked disbursements.",
      "Lead researcher CV or lab credentials.",
    ],
  },
  {
    title: "What Happens Next",
    description: "Once submitted, here’s the typical flow for new research applications.",
    items: [
      "Glass diligence team reviews within 5 business days.",
      "If qualified, you’ll be invited to a live diligence session.",
      "Approved projects launch to the community dashboard.",
    ],
  },
  {
    title: "Helpful Tips",
    description: "Give your project the best chance at lightning-fast funding.",
    items: [
      "Spell out the breakthrough: what radically changes if you succeed?",
      "Tie impact metrics to existing datasets where possible.",
      "Flag any regulatory dependencies or ethical approvals still pending.",
    ],
  },
];
