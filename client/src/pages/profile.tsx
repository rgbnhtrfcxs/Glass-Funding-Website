import { useState } from "react";
import { Link } from "wouter";
import { CalendarDays, Bookmark, ClipboardList, FileText, Download, ExternalLink } from "lucide-react";
import { profileSnapshot, WorkspaceLink } from "@/data/mockProfile";

export default function Profile() {
  const { overview, receipts, workspaceLinks } = profileSnapshot;
  const [showTaxPicker, setShowTaxPicker] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());

  const toggleTaxPicker = () => {
    setShowTaxPicker(current => {
      if (current) {
        setSelectedReceipts(new Set());
      }
      return !current;
    });
  };

  const handleToggleReceipt = (id: string) => {
    setSelectedReceipts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDownloadSelected = () => {
    if (selectedReceipts.size === 0) {
      return;
    }
    const ids = receipts
      .filter(receipt => receipt.type === "Donation" && selectedReceipts.has(receipt.id))
      .map(receipt => receipt.id);
    if (ids.length === 0) {
      return;
    }
    alert(`Downloading tax receipts for: ${ids.join(", ")}`);
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <div className="container mx-auto px-4 pt-32">
        <div className="bg-card border border-border rounded-3xl shadow-sm p-8 lg:p-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 border-b border-border pb-8">
            <div className="flex items-start gap-6">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl font-semibold text-primary">
                {overview.initials}
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{overview.fullName}</h1>
                <p className="text-muted-foreground mt-2">{overview.tagline}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
                <Download className="h-4 w-4" />
                Export Activity
              </button>
              <button className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                <ExternalLink className="h-4 w-4" />
                Edit Profile
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            <div className="rounded-2xl border border-border bg-muted/20 p-6">
              <p className="text-sm text-muted-foreground">Total Donated</p>
              <p className="mt-2 text-3xl font-semibold">{overview.totalDonated}</p>
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground mt-3">
                {overview.supportedProjectsLabel}
              </span>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-6">
              <p className="text-sm text-muted-foreground">Recurring Support</p>
              <p className="mt-2 text-3xl font-semibold">{overview.activeRecurringCount}</p>
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground mt-3">
                {overview.recurringSupportLabel}
              </span>
            </div>
            <div className="rounded-2xl border border-border bg-muted/20 p-6">
              <p className="text-sm text-muted-foreground">Last Contribution</p>
              <p className="mt-2 text-3xl font-semibold">{overview.lastContributionDate}</p>
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground mt-3">
                <CalendarDays className="h-4 w-4" />
                {overview.lastContributionNote}
              </span>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Receipt History</h2>
                <div className="flex items-center gap-3">
                  <button className="text-sm text-primary hover:underline">
                    View statements
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      className={`inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition ${
                        showTaxPicker
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      type="button"
                      onClick={toggleTaxPicker}
                    >
                      {showTaxPicker ? "Done selecting" : "Download tax receipts"}
                    </button>
                    {showTaxPicker && (
                      <button
                        type="button"
                        onClick={handleDownloadSelected}
                        disabled={selectedReceipts.size === 0}
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Download selected
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="overflow-hidden border border-border rounded-2xl">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      {showTaxPicker && (
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Select
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card/40">
                    {receipts.map(receipt => (
                      <tr key={receipt.id} className="hover:bg-muted/40 transition-colors">
                        {showTaxPicker && (
                          <td className="px-4 py-4">
                            {receipt.type === "Donation" ? (
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                checked={selectedReceipts.has(receipt.id)}
                                onChange={() => handleToggleReceipt(receipt.id)}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A</span>
                            )}
                          </td>
                        )}
                        <td className="px-6 py-4 text-sm font-medium text-primary">
                          {receipt.id}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium">{receipt.project}</div>
                          <div className="text-xs text-muted-foreground">{receipt.type}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {receipt.date}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold">
                          {receipt.amount}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-full bg-emerald-100/60 text-emerald-600 px-3 py-1 text-xs font-medium">
                            {receipt.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-muted/20 p-6">
                <h3 className="text-lg font-semibold">My Workspace</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Jump into the sections you use to stay current with your portfolio and new opportunities.
                </p>
                <div className="mt-6 space-y-3">
                  {workspaceLinks.map((link: WorkspaceLink) => {
                    const Icon =
                      link.icon === "favorites"
                        ? Bookmark
                        : link.icon === "followups"
                          ? ClipboardList
                          : FileText;

                    return (
                      <Link key={link.href} href={link.href}>
                        <a className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 hover:border-border hover:bg-card transition-colors">
                          <Icon className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium">{link.title}</p>
                            <p className="text-xs text-muted-foreground">{link.description}</p>
                          </div>
                        </a>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-primary/10 p-6">
                <h3 className="text-lg font-semibold text-primary">Community Updates</h3>
                <p className="text-sm text-primary/80 mt-2">
                  Stay informed about breaking research milestones, new funds, and supporter briefings.
                </p>
                <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                  Manage Notifications
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
