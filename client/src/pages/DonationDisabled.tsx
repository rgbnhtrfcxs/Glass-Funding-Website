import { Link } from "wouter";

export default function DonationDisabled() {
  return (
    <div className="max-w-3xl mx-auto pt-32 px-4 pb-20">
      <div className="rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Donations are paused for now</h1>
        <p className="text-sm text-muted-foreground">
          We&apos;re finalizing the donation flow. During the beta you can keep using Glass Connect for free—no payment
          needed right now.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link href="/" className="rounded-full bg-primary px-5 py-2 text-primary-foreground text-sm font-medium hover:bg-primary/90">
            Back to home
          </Link>
          <Link href="/labs" className="text-sm text-muted-foreground hover:text-foreground">
            Explore labs
          </Link>
        </div>
      </div>
    </div>
  );
}
