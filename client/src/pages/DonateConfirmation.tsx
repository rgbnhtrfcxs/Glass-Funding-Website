import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
// confirmation doesnt show data form the donation
// need to add email confirmation of the tax document
interface DonationSummary {
  total?: number;
  donation?: number;
  fee?: number;
  email?: string;
  project?: string;
  category?: string;
  recurring?: boolean;
}

export default function DonateConfirmation() {
  const [summary, setSummary] = useState<DonationSummary>({});
  const [location] = useLocation();

  const extractSearch = () => {
    if (typeof window !== "undefined" && window.location.search) {
      return new URLSearchParams(window.location.search);
    }
    const query = location.split("?")[1];
    return new URLSearchParams(query ?? "");
  };

  useEffect(() => {
    const search = extractSearch();
    const total = search.get("amount");
    const donation = search.get("donation");
    const fee = search.get("fee");
    const email = search.get("email");
    const project = search.get("project");
    const category = search.get("category");
    const recurring = search.get("recurring");

    setSummary({
      total: total ? Number(total) : undefined,
      donation: donation ? Number(donation) : undefined,
      fee: fee ? Number(fee) : undefined,
      email: email ? decodeURIComponent(email) : undefined,
      project: project ? decodeURIComponent(project) : undefined,
      category: category ? decodeURIComponent(category) : undefined,
      recurring: recurring ? recurring === "true" : undefined,
    });
  }, [location]);

  const target = summary.project ?? summary.category;
  const hasData = Boolean(summary.total && summary.email && target);

  return (
    <div className="max-w-md mx-auto pt-28 px-4 pb-20 text-center">
      <h1 className="text-3xl font-bold mb-4">Thank You for Your Donation</h1>

      {hasData ? (
        <div className="space-y-4 text-left">
          <p className="text-muted-foreground text-center">
            You’ve donated <strong>{summary.total!.toFixed(2)} €</strong> to <strong>{target}</strong>.
          </p>
          <div className="rounded-3xl border border-border bg-card/80 p-4 text-sm text-foreground space-y-2">
            <p><strong>Recipient:</strong> {target}</p>
            {summary.donation !== undefined && (
              <p><strong>Donation:</strong> {summary.donation.toFixed(2)} €</p>
            )}
            {summary.fee !== undefined && (
              <p><strong>Platform fee:</strong> {summary.fee.toFixed(2)} €</p>
            )}
            <p><strong>Total today:</strong> {summary.total!.toFixed(2)} €</p>
            <p><strong>Updates sent to:</strong> {summary.email}</p>
            {summary.recurring !== undefined && (
              <p>
                <strong>Recurring:</strong> {summary.recurring ? "Yes, charged monthly." : "No, one-time donation."}
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              A confirmation email is on the way. Thanks for helping researchers stay on track.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">
          Unable to retrieve donation details. Please return to the donation page and try again.
        </p>
      )}

      <Link href="/bubbles">
        <button className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
          Back to Bubbles
        </button>
      </Link>
    </div>
  );
}
