import { useMemo } from "react";
import { Link, useLocation } from "wouter";

export default function DonationConfirmation() {
  const [location] = useLocation();
  const params = useMemo(() => new URLSearchParams(location.split("?")[1] ?? ""), [location]);
  const status = params.get("status") ?? "success";
  const amount = params.get("amount");

  const isSuccess = status === "success";

  return (
    <div className="max-w-3xl mx-auto px-4 pb-20">
      <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary text-xl font-semibold">
          {isSuccess ? "✓" : "!"}
        </div>
        <h1 className="text-2xl font-semibold">
          {isSuccess ? "Thank you for supporting Glass Connect" : "We could not confirm your donation"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSuccess
            ? `Your contribution keeps the beta free and helps us deliver new features faster.${
                amount ? ` We received €${amount}.` : ""
              }`
            : "Your payment wasn’t completed. You can try again or reach out if the issue persists."}
        </p>
        {isSuccess ? (
          <p className="text-xs text-muted-foreground">
            A receipt will be sent to your email. If you need anything corrected, reply to that email and we’ll help.
          </p>
        ) : null}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link href="/donate" className="rounded-full bg-primary px-5 py-2 text-primary-foreground text-sm font-medium hover:bg-primary/90">
            {isSuccess ? "Make another donation" : "Try again"}
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
