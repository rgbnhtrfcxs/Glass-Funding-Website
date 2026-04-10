import { useEffect, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_HINT,
  getPasswordPolicyError,
} from "@/lib/passwordPolicy";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isInviteFlow, setIsInviteFlow] = useState(false);
  const [claimedLabName, setClaimedLabName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const init = async () => {
      if (typeof window === "undefined") return;
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const searchParams = new URLSearchParams(url.search);
        const hashType = (hashParams.get("type") || "").toLowerCase();
        const queryType = (searchParams.get("type") || "").toLowerCase();
        const inviteFlag = searchParams.get("invite") === "1";
        const inviteFlow = inviteFlag || hashType === "invite" || queryType === "invite";
        if (active) setIsInviteFlow(inviteFlow);

        const code = searchParams.get("code");
        if (code) {
          // Supabase's detectSessionInUrl may have already exchanged the code (it's one-time use).
          // Check for an existing session first to avoid a double-consumption error.
          const { data: existingData } = await supabase.auth.getSession();
          if (!existingData.session) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
            if (exchangeError) {
              // Race condition: detectSessionInUrl may have just finished — check once more.
              const { data: retryData } = await supabase.auth.getSession();
              if (!retryData.session) throw exchangeError;
            }
          }
        } else {
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            const { data: existingData } = await supabase.auth.getSession();
            if (!existingData.session) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (sessionError) throw sessionError;
            }
          } else {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) {
              throw new Error("Invalid or expired password link.");
            }
          }
        }
        if (active) setReady(true);

        const cleanParams = new URLSearchParams();
        if (inviteFlow) cleanParams.set("invite", "1");
        const cleanUrl = `/reset-password${cleanParams.toString() ? `?${cleanParams.toString()}` : ""}`;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (err: any) {
        if (active) {
          setError(err?.message || "Invalid or expired password link.");
          setReady(false);
        }
      }
    };
    init();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // If this was a claim invite, auto-assign the pre-designated lab
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.claim_lab_id) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          const claimRes = await fetch("/api/me/claim-lab", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          });
          const claimJson = await claimRes.json();
          if (claimRes.ok && claimJson.lab_name) setClaimedLabName(claimJson.lab_name);
        } catch {
          // Non-fatal — lab can be assigned manually by admin if this fails
        }
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Unable to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 pb-20">
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-card/90 p-10 shadow-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {isInviteFlow ? "Set password" : "Reset password"}
          </span>
          <h1 className="mt-6 text-3xl md:text-4xl font-semibold text-foreground">
            {isInviteFlow ? "Create your password." : "Set a new password."}
          </h1>
          <p className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed">
            {isInviteFlow
              ? "Finish your account setup by creating a password you can use for future logins."
              : "Choose a new password to keep your account secure."}
          </p>

          {error && (
            <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!ready && !error && (
            <p className="mt-6 text-sm text-muted-foreground">Validating your password link...</p>
          )}

          {ready && !success && (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-sm font-medium text-foreground">New password</label>
                <input
                  type="password"
                  className="mt-2 w-full rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder={PASSWORD_POLICY_HINT}
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                />
                <p className="mt-2 text-xs text-muted-foreground">{PASSWORD_POLICY_HINT}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Confirm password</label>
                <input
                  type="password"
                  className="mt-2 w-full rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={confirm}
                  onChange={event => setConfirm(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Updating..." : "Update password"}
              </button>
            </form>
          )}

          {success && (
            <div className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 space-y-1">
              <p>Password updated. You can now sign in with email and password.</p>
              {claimedLabName && <p className="font-medium">Your lab <span className="underline">{claimedLabName}</span> has been assigned to your account.</p>}
            </div>
          )}

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/login">
              <a className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition">
                Back to login
              </a>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
