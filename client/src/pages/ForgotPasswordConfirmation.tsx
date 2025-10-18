import { Link } from "wouter";

export default function ForgotPasswordConfirmation() {
  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 pt-28 pb-20">
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card/90 p-10 text-center shadow-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Check your inbox
          </span>
          <h1 className="mt-6 text-3xl md:text-4xl font-semibold text-foreground">
            Reset instructions are on their way.
          </h1>
          <p className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed">
            If an account exists for the email you provided, you&apos;ll receive a message in the next few minutes. Follow the
            secure link to choose a new password and jump back into your Glass workspace.
          </p>

          <div className="mt-8 grid gap-4">
            <div className="rounded-2xl border border-border bg-muted/20 px-6 py-4 text-sm text-muted-foreground text-left">
              <p className="font-medium text-foreground">Didn&apos;t see the email?</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Check your spam or promotions folder.</li>
                <li>Make sure you entered the correct address.</li>
                <li>Still stuck? Request another link or reach out to our team.</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/login">
              <a className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
                Return to login
              </a>
            </Link>
            <Link href="/forgot-password">
              <a className="text-sm font-medium text-muted-foreground hover:text-foreground transition">
                Send another reset link
              </a>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
