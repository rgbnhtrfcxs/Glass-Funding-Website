import { useState, type FormEvent } from "react";
import { useLocation, Link } from "wouter";
import { supabase } from "../lib/supabaseClient"; 

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !password) {
      setError("Enter your email and password to continue.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
      } else if (data.session) {
        // Successful login
        navigate("/"); // Redirect to homepage or dashboard
      }
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
        <div className="mx-auto max-w-4xl grid gap-12 items-center lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Welcome back
            </span>
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight text-foreground">
              Sign in to keep backing the science that matters to you.
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Access your portfolio, track donations, and stay close to the research teams you support.
            </p>
            <div className="rounded-3xl border border-border bg-card/80 p-6 text-sm text-muted-foreground shadow-sm">
              <p className="font-medium text-foreground">New to Glass?</p>
              <p className="mt-1">
                Create an account in minutes and start directing capital to world-class labs.
              </p>
              <Link href="/signup">
                <a className="mt-4 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition">
                  Create your profile
                </a>
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card/90 p-8 shadow-lg">
            <form className="space-y-5" onSubmit={handleLogin}>
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
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <Link href="/forgot-password">
                    <a className="text-xs font-medium text-muted-foreground hover:text-foreground transition">
                      Forgot?
                    </a>
                  </Link>
                </div>
                <input
                  type="password"
                  className="mt-2 w-full rounded-full border border-border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Log in"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Need to get set up?{" "}
              <Link href="/signup">
                <a className="font-medium text-primary hover:text-primary/80 transition">Create an account</a>
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
