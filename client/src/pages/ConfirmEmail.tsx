import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabaseClient";

export default function ConfirmEmail() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    const confirmEmail = async () => {
      if (typeof window === "undefined") return;
      try {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (exchangeError) throw exchangeError;
        if (!active) return;
        setStatus("success");
        redirectTimer = setTimeout(() => {
          navigate("/login?confirmed=1", { replace: true });
        }, 1800);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Invalid or expired confirmation link.");
        setStatus("error");
      }
    };

    confirmEmail();

    return () => {
      active = false;
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [navigate]);

  const isLoading = status === "loading";
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 pb-20">
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card/90 p-10 text-center shadow-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {isSuccess ? "Email confirmed" : isError ? "Confirmation failed" : "Confirming email"}
          </span>
          <h1 className="mt-6 text-3xl md:text-4xl font-semibold text-foreground">
            {isSuccess
              ? "Your account is ready to go."
              : isError
                ? "We could not confirm your email."
                : "Hang tight while we verify your link."}
          </h1>
          <p className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed">
            {isSuccess
              ? "Thanks for confirming your email. You can now sign in to finish setting up your Glass profile and explore labs."
              : isError
                ? "The link might have expired or already been used. You can request a new confirmation email or contact support."
                : "This usually takes just a few seconds. Please keep this page open."}
          </p>

          {isLoading && (
            <p className="mt-6 text-sm text-muted-foreground">Validating your confirmation link...</p>
          )}

          {isError && error && (
            <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {isSuccess && (
            <div className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Confirmation successful. Redirecting you to login...
            </div>
          )}

          <div className="mt-8 grid gap-4">
            <div className="rounded-2xl border border-border bg-muted/20 px-6 py-4 text-sm text-muted-foreground text-left">
              <p className="font-medium text-foreground">Having trouble?</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>If the link expired, request a new confirmation email.</li>
                <li>Make sure you confirmed the same address you used to sign up.</li>
                <li>Need help? Reach out and we&apos;ll sort it quickly.</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href={isSuccess ? "/login?confirmed=1" : "/login"}>
              <a className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition">
                Continue to login
              </a>
            </Link>
            <Link href="/contact">
              <a className="text-sm font-medium text-muted-foreground hover:text-foreground transition">
                Contact support
              </a>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
