import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import {
  getPasswordPolicyError,
  PASSWORD_POLICY_HINT,
  PASSWORD_MIN_LENGTH,
} from "@/lib/passwordPolicy";

type LabInfo = {
  id: number;
  name: string;
  descriptionShort: string | null;
  logoUrl: string | null;
  city: string | null;
  country: string | null;
};

type Stage =
  | { type: "loading" }
  | { type: "invalid"; message: string }
  | { type: "claimed" }
  | { type: "confirm"; lab: LabInfo }
  | { type: "form"; lab: LabInfo }
  | { type: "submitting"; lab: LabInfo }
  | { type: "done"; labName: string };

export default function ClaimLab() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [stage, setStage] = useState<Stage>({ type: "loading" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setStage({ type: "invalid", message: "Invalid invite link." }); return; }
    fetch(`/api/public/claim/${token}`)
      .then(async res => {
        const json = await res.json();
        if (res.status === 409) { setStage({ type: "claimed" }); return; }
        if (!res.ok) { setStage({ type: "invalid", message: json.message || "Invalid invite link." }); return; }
        setStage({ type: "confirm", lab: json.lab });
      })
      .catch(() => setStage({ type: "invalid", message: "Could not load invite. Please try again." }));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    if (stage.type !== "form") return;

    const policyErr = getPasswordPolicyError(password);
    if (policyErr) { setFieldError(policyErr); return; }

    setStage({ type: "submitting", lab: stage.lab });

    try {
      const res = await fetch(`/api/public/claim/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (res.status === 409) { setStage({ type: "claimed" }); return; }
      if (!res.ok) {
        setStage({ type: "form", lab: (stage as any).lab });
        setFieldError(json.message || "Something went wrong.");
        return;
      }
      setStage({ type: "done", labName: json.lab?.name ?? "" });
    } catch {
      setStage({ type: "form", lab: (stage as any).lab });
      setFieldError("Something went wrong. Please try again.");
    }
  };

  return (
    <section className="bg-background min-h-screen flex items-start justify-center">
      <div className="container mx-auto max-w-lg px-4 py-20 lg:py-28">

        {/* Loading */}
        {stage.type === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}

        {/* Invalid */}
        {stage.type === "invalid" && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
            <p className="text-sm font-medium text-destructive">{stage.message}</p>
            <Link href="/"><a className="text-xs text-muted-foreground underline underline-offset-2">Back to home</a></Link>
          </div>
        )}

        {/* Already claimed */}
        {stage.type === "claimed" && (
          <div className="rounded-2xl border border-border bg-card/90 p-8 text-center space-y-3">
            <p className="text-sm font-medium text-foreground">This lab has already been claimed.</p>
            <p className="text-xs text-muted-foreground">If you believe this is an error, contact us.</p>
            <Link href="/"><a className="text-xs text-muted-foreground underline underline-offset-2">Back to home</a></Link>
          </div>
        )}

        {/* Confirm — "Is this your lab?" */}
        {stage.type === "confirm" && (
          <div className="space-y-6">
            <div>
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Lab claim</span>
              <h1 className="mt-2 text-2xl font-semibold text-foreground">Is this your lab?</h1>
            </div>

            <div className="rounded-2xl border border-border bg-card/90 p-5 flex items-start gap-4">
              {stage.lab.logoUrl && (
                <img
                  src={stage.lab.logoUrl}
                  alt={stage.lab.name}
                  className="h-14 w-14 rounded-xl object-contain border border-border bg-background shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">{stage.lab.name}</p>
                {(stage.lab.city || stage.lab.country) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[stage.lab.city, stage.lab.country].filter(Boolean).join(", ")}
                  </p>
                )}
                {stage.lab.descriptionShort && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{stage.lab.descriptionShort}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStage({ type: "form", lab: stage.lab })}
                className="flex-1 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
              >
                Yes, claim this lab
              </button>
              <Link href="/">
                <a className="flex-1 text-center rounded-full border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition">
                  Not mine
                </a>
              </Link>
            </div>
          </div>
        )}

        {/* Form */}
        {(stage.type === "form" || stage.type === "submitting") && (() => {
          const lab = stage.lab;
          const submitting = stage.type === "submitting";
          return (
            <div className="space-y-6">
              <div>
                <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Create your account</span>
                <h1 className="mt-2 text-2xl font-semibold text-foreground">Set up access for {lab.name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your lab profile is ready. Create an account to take ownership.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card/90 p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={submitting}
                    placeholder="you@example.com"
                    className="mt-2 w-full rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <div className="relative mt-2">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={PASSWORD_MIN_LENGTH}
                      disabled={submitting}
                      placeholder={PASSWORD_POLICY_HINT}
                      className="w-full rounded-full border border-border bg-background px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
                </div>

                {fieldError && (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
                    {fieldError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Creating account…" : "Create account & claim lab"}
                </button>
              </form>

              <p className="text-center text-xs text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login"><a className="underline underline-offset-2 hover:text-foreground transition">Sign in</a></Link>
              </p>
            </div>
          );
        })()}

        {/* Done */}
        {stage.type === "done" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-8 space-y-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-base font-semibold text-emerald-900">Account created!</p>
              <p className="text-sm text-emerald-800">
                We've sent a confirmation email to <strong>{email}</strong>. Click the link to activate your account — your lab <strong>{stage.labName}</strong> will be waiting for you.
              </p>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              <Link href="/login"><a className="underline underline-offset-2 hover:text-foreground transition">Go to sign in</a></Link>
            </p>
          </div>
        )}

      </div>
    </section>
  );
}
