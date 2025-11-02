import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "../lib/supabaseClient"; // Make sure path is correct

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.includes("@") || password.length < 6) {
      setError("Use a valid email address and a password with at least 6 characters.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Sign up the user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      
      

      // Navigate to a "welcome" or dashboard page
      navigate("/login");
    } catch (err) {
      console.error(err);
      setError("Unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 pt-28 pb-20">
        <div className="mx-auto max-w-4xl grid gap-12 items-center lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Join the community
            </span>
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight text-foreground">
              Build your Glass profile and direct capital where breakthroughs happen.
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Tell us a little about you and we’ll surface handpicked projects, personalized reports, and donation workflows.
            </p>
            <div className="rounded-3xl border border-border bg-card/80 p-6 text-sm text-muted-foreground shadow-sm">
              <p className="font-medium text-foreground">Already supporting teams?</p>
              <p className="mt-1">Sign in to continue tracking milestones and managing your follow-ups.</p>
              <Link href="/login">
                <a className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition">
                  Log in instead
                </a>
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card/90 p-8 shadow-lg">
            <form className="space-y-5" onSubmit={handleSignup}>
              <div>
                <label className="text-sm font-medium text-foreground">Name</label>
                <input
                  type="text"
                  className="mt-2 w-full rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Email</label>
                <input
                  type="email"
                  className="mt-2 w-full rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.org"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Password</label>
                <input
                  type="password"
                  className="mt-2 w-full rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
                disabled={loading}
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login">
                <a className="font-medium text-primary hover:text-primary/80 transition">Log in</a>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
