export type ReceiptStatus = "Active" | "Completed" | "Exited" | "Pending";

export interface Receipt {
  id: string;
  type: "Investment" | "Donation";
  project: string;
  amount: string;
  date: string;
  status: ReceiptStatus;
}

export interface WorkspaceLink {
  href: string;
  title: string;
  description: string;
  icon: "favorites" | "followups" | "submit";
}

export interface ProfileOverview {
  initials: string;
  fullName: string;
  tagline: string;
  totalInvested: string;
  activePositionsLabel: string;
  totalDonated: string;
  supportedProjectsLabel: string;
  lastContributionDate: string;
  lastContributionNote: string;
}

export interface ProfileSnapshot {
  overview: ProfileOverview;
  receipts: Receipt[];
  workspaceLinks: WorkspaceLink[];
}

export const profileSnapshot: ProfileSnapshot = {
  overview: {
    initials: "LG",
    fullName: "Lucy Glass",
    tagline: "Glass Supporter since 2023 · San Francisco, CA · lucy@glass.fund",
    totalInvested: "$7,500",
    activePositionsLabel: "• 2 active positions",
    totalDonated: "$4,200",
    supportedProjectsLabel: "• 6 projects supported",
    lastContributionDate: "Jan 18, 2025",
    lastContributionNote: "Oncology Cohort tranche released",
  },
  receipts: [
    {
      id: "INV-2041",
      type: "Investment",
      project: "Glass Oncology Cohort",
      amount: "$2,500",
      date: "Jan 18, 2025",
      status: "Active",
    },
    {
      id: "DON-7734",
      type: "Donation",
      project: "AI Drug Discovery Pipeline",
      amount: "$1,000",
      date: "Dec 02, 2024",
      status: "Completed",
    },
    {
      id: "INV-1983",
      type: "Investment",
      project: "Carbon Capture Field Trials",
      amount: "$5,000",
      date: "Nov 11, 2024",
      status: "Exited",
    },
  ],
  workspaceLinks: [
    {
      href: "/favorites",
      title: "Favorites",
      description: "Projects you're tracking closely.",
      icon: "favorites",
    },
    {
      href: "/myfollowups",
      title: "Follow-Ups",
      description: "Requests awaiting your next move.",
      icon: "followups",
    },
    {
      href: "/submit",
      title: "Submit a Project",
      description: "Share a proposal with the Glass team.",
      icon: "submit",
    },
  ],
};
