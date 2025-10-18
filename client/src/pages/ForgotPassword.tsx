import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setError("Enter the email address linked to your account.");
      return;
    }

    setError(null);
    navigate("/forgot-password/confirmation");
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 pt-28 pb-20">
        <div className="mx-auto max-w-4xl grid gap-12 items-center lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Reset access
            </span>
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight text-foreground">
              Forgotten your password? Let&apos;s get you back to your projects.
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Enter the email you use for Glass and we&apos;ll send a reset link. You&apos;ll see confirmation details on the next
              screen.
            </p>
            <div className="rounded-3xl border border-border bg-card/80 p-6 text-sm text-muted-foreground shadow-sm">
              <p className="font-medium text-foreground">Remembered it?</p>
              <p className="mt-1">Jump back to sign in and continue exploring the portfolio.</p>
              <Link href="/login">
                <a className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition">
                  Return to login
                </a>
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card/90 p-8 shadow-lg">
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label className="text-sm font-medium text-foreground">Email</label>
                <input
                  type="email"
                  className={`mt-2 w-full rounded-full border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                    error ? "border-destructive" : "border-border"
                  }`}
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="you@example.org"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "reset-email-error" : undefined}
                />
                {error ? (
                  <p id="reset-email-error" className="mt-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
              >
                Send reset link
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Prefer to try again later?{" "}
              <Link href="/login">
                <a className="font-medium text-primary hover:text-primary/80 transition">Back to login</a>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
