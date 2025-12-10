import { motion } from "framer-motion";
import {
  ArrowLeft,
  Beaker,
  CalendarClock,
  CheckCircle2,
  Globe2,
  Images,
  Linkedin,
  Lock,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Star,
  Unlock,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { useLabs } from "@/context/LabsContext";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { nanoid } from "nanoid";

interface LabDetailsProps {
  params: {
    id: string;
  };
}

export default function LabDetails({ params }: LabDetailsProps) {
  const { labs, isLoading } = useLabs();
  const { user } = useAuth();
  const [canCollaborate, setCanCollaborate] = useState(false);
  useEffect(() => {
    let mounted = true;
    async function checkRole() {
      if (!user) {
        setCanCollaborate(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        setCanCollaborate(false);
        return;
      }
      setCanCollaborate((data?.role as string) === "lab" || (data?.role as string) === "admin");
    }
    checkRole();
    return () => {
      mounted = false;
    };
  }, [user?.id]);
  const lab = labs.find(item => item.id === Number(params.id));

  if (isLoading && !lab) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-20">
          <div className="rounded-3xl border border-border bg-card/80 p-8 text-muted-foreground">Loading lab…</div>
        </div>
      </section>
    );
  }

  if (!lab) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-20">
          <div className="rounded-3xl border border-border bg-card/80 p-8 text-muted-foreground">Lab not found.</div>
        </div>
      </section>
    );
  }
  const getImageUrl = (url: string, width = 1600) =>
    url.startsWith("data:")
      ? url
      : `${url}${url.includes("?") ? "&" : "?"}auto=format&fit=crop&w=${width}&q=80`;
  const tier = (lab as any)?.subscriptionTier ?? (lab as any)?.subscription_tier ?? "base";
  const logoUrl = (lab as any)?.logoUrl ?? (lab as any)?.logo_url ?? null;
  const tierLower = (tier as string).toLowerCase?.() ?? (typeof tier === "string" ? tier.toLowerCase() : "base");
  const status = lab.isVerified ? "verified" : tierLower === "base" ? "unverified" : "pending";
  const offersLabSpace =
    lab.offersLabSpace === true ||
    lab.offersLabSpace === "true" ||
    lab.offersLabSpace === 1 ||
    lab.offersLabSpace === "1";
  const badgeClass =
    status === "verified"
      ? "bg-emerald-50 text-emerald-700"
      : status === "pending"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-700";
  const badgeLabel = status === "verified" ? "Verified by Glass" : status === "pending" ? "Verification pending" : "Unverified";
  const partnerLogos = lab.partnerLogos ?? [];
  const website = lab.website || null;
  const linkedin = lab.linkedin || null;
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [viewRecorded, setViewRecorded] = useState(false);

  const toggleFavorite = async () => {
    if (!user) {
      setFavoriteError("Sign in to favorite labs.");
      return;
    }
    setFavoriteLoading(true);
    setFavoriteError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        setFavoriteError("Please sign in again.");
        return;
      }
      const method = isFavorite ? "DELETE" : "POST";
      const res = await fetch(`/api/labs/${lab.id}/favorite`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.message || "Unable to update favorite");
      }
      const payload = await res.json();
      setIsFavorite(Boolean(payload?.favorited));
    } catch (error) {
      setFavoriteError(error instanceof Error ? error.message : "Unable to update favorite");
    } finally {
      setFavoriteLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    async function loadFavorite() {
      if (!user) {
        setIsFavorite(false);
        return;
      }
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) return;
        const res = await fetch(`/api/labs/${lab.id}/favorite`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const payload = await res.json();
        if (active) setIsFavorite(Boolean(payload?.favorited));
      } catch {
        // ignore
      }
    }
    loadFavorite();
    return () => {
      active = false;
    };
  }, [lab.id, user?.id]);

  useEffect(() => {
    if (viewRecorded) return;
    const sessionKey = "glass-view-session";
    let sessionId = localStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = nanoid();
      localStorage.setItem(sessionKey, sessionId);
    }
    const lastKey = `glass-view-${lab.id}`;
    const lastTs = localStorage.getItem(lastKey);
    const now = Date.now();
    if (lastTs && now - Number(lastTs) < 60 * 60 * 1000) {
      setViewRecorded(true);
      return;
    }
    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        await fetch(`/api/labs/${lab.id}/view`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            labId: lab.id,
            sessionId,
            referrer: document.referrer || null,
          }),
        });
        localStorage.setItem(lastKey, String(now));
        setViewRecorded(true);
      } catch {
        // ignore
      }
    })();
  }, [lab.id, viewRecorded]);

  if (isLoading && labs.length === 0) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-24 max-w-3xl text-center space-y-6">
          <h1 className="text-4xl font-semibold text-foreground">Loading lab details…</h1>
          <p className="text-muted-foreground">Pulling the latest information from the lab directory.</p>
        </div>
      </section>
    );
  }

  if (!lab) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-24 max-w-3xl text-center space-y-6">
          <h1 className="text-4xl font-semibold text-foreground">Lab not found</h1>
          <p className="text-muted-foreground">
            We could not find the lab you were looking for. It may have been removed or you might
            have followed an outdated link.
          </p>
          <Link href="/labs">
            <a className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary">
              Browse labs
            </a>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 lg:py-24 max-w-5xl">
        <Link href="/labs" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary">
          <ArrowLeft className="h-4 w-4" />
          Back to labs
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mt-8 rounded-3xl border border-border bg-card/80 p-8 shadow-sm space-y-10"
        >
          <header className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <MapPin className="h-3.5 w-3.5" />
                {lab.location}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}>
                {status === "verified" ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {badgeLabel}
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {badgeLabel}
                  </>
                )}
              </span>
              {offersLabSpace && (
                <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground">
                  <Unlock className="h-3.5 w-3.5 text-primary" />
                  Offers lab space
                </span>
              )}
              <button
                type="button"
                onClick={toggleFavorite}
                disabled={favoriteLoading}
                className={`ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-60 disabled:cursor-not-allowed ${
                  isFavorite ? "border-red-500 bg-red-50 text-red-500" : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}
                aria-label={isFavorite ? "Unfavorite lab" : "Favorite lab"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill={isFavorite ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21s-6.5-4.35-9-8.5C1 7.5 3.5 4 7 4c1.9 0 3.2 1.2 4 2.4C11.8 5.2 13.1 4 15 4c3.5 0 6 3.5 4 8.5-2.5 4.15-9 8.5-9 8.5Z"
                  />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-3">
        {(logoUrl || ["premier", "custom"].includes(tierLower)) && (
                <div className="h-12 w-12 overflow-hidden rounded-full border border-dashed border-border bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-center flex-shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt={`${lab.name} logo`} className="h-full w-full object-cover" />
                  ) : (
                    "Logo"
                  )}
                </div>
              )}
              <h1 className="text-4xl font-semibold text-foreground">{lab.name}</h1>
            </div>
            {lab.description ? (
              <p className="text-muted-foreground text-base leading-relaxed">{lab.description}</p>
            ) : (
              <p className="text-muted-foreground text-base leading-relaxed">
                Review compliance, offers, and baseline expectations before requesting space. Minimum commitment:
                <span className="font-medium text-foreground"> {lab.minimumStay}</span>.
              </p>
            )}
            {favoriteError && <span className="text-xs text-destructive">{favoriteError}</span>}
          </header>

          {lab.photos.length > 0 && (
            <div className="mt-2 overflow-x-auto pb-2">
              <div className="flex gap-4 min-w-full">
                {lab.photos.map((photo, index) => (
                  <div
                    key={photo.url}
                    className="min-w-[320px] max-w-[420px] h-64 overflow-hidden rounded-3xl border border-border/80 bg-background/40 flex-shrink-0"
                  >
                    <img
                      src={getImageUrl(photo.url, 1200)}
                      alt={`${lab.name} photo ${index + 1} - ${photo.name}`}
                      className="h-full w-full object-cover"
                      loading={index === 0 ? "eager" : "lazy"}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-border/80 bg-background/50 p-6 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Lab leadership
              </span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-primary" />
                {lab.labManager}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4 text-primary" />
                {website || linkedin ? "Connect with the team" : "Social links not provided yet"}
              </div>
              {(website || linkedin) && (
                <div className="flex flex-wrap gap-2">
                  {website && (
                    <a
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
                    >
                      <Globe2 className="h-3.5 w-3.5 text-primary" />
                      Website
                    </a>
                  )}
                  {linkedin && (
                    <a
                      href={linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
                    >
                      <Linkedin className="h-3.5 w-3.5 text-primary" />
                      LinkedIn
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/50 p-6 space-y-3 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Compliance posture
              </span>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {lab.compliance.map(item => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    {item}
                  </span>
                ))}
              </div>
              {lab.complianceDocs.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    Supporting documents
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {lab.complianceDocs.map(doc => (
                      <li key={doc.url}>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 hover:border-primary hover:text-primary transition"
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                          {doc.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {offersLabSpace && (
            <section className="rounded-2xl border border-border/80 bg-background/50 p-6">
              <h2 className="text-lg font-semibold text-foreground">Pricing & availability offers</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Labs may extend multiple engagement models; choose the approach that best matches your run plan.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {lab.offers.map(offer => (
                  <span
                    key={offer}
                    className="rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {offer}
                  </span>
                ))}
              </div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4 text-primary" />
                Minimum stay expectation: <span className="font-medium text-foreground">{lab.minimumStay}</span>
              </div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
                <Images className="h-4 w-4 text-primary" />
                {lab.photos.length} photo{lab.photos.length === 1 ? "" : "s"} included
              </div>
            </section>
          )}

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/80 bg-background/50 p-6">
              <h2 className="text-lg font-semibold text-foreground">Focus areas</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Primary scientific domains supported by the lab team.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {lab.focusAreas.map(area => (
                  <span
                    key={area}
                    className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-background/50 p-6">
              <h2 className="text-lg font-semibold text-foreground">Equipment inventory</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Critical instrumentation and tooling available in this lab.
              </p>
              <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                {lab.equipment.map(item => (
                  <div key={item} className="inline-flex items-center gap-2">
                    <Beaker className="h-4 w-4 text-primary" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

        {["premier", "custom"].includes(tierLower) && partnerLogos.length > 0 && (
            <div className="mt-8 rounded-2xl border border-primary/40 bg-primary/5 p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Featured partners</h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {partnerLogos.map((logo, idx) => (
                  <div
                    key={`${logo.url}-${idx}`}
                    className="h-16 w-24 overflow-hidden rounded-xl border border-primary/40 bg-background flex-shrink-0"
                    title={logo.name}
                  >
                    <img src={logo.url} alt={logo.name} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <footer className="flex flex-wrap gap-3 mt-6">
            <Link
              href={`/labs/${lab.id}/request`}
              className="inline-flex items-center justify-center rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              Request lab time
            </Link>
            {canCollaborate && (
              <Link
                href={`/labs/${lab.id}/collaborate`}
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
              >
                Collaborate
              </Link>
            )}
            <Link
              href="/labs"
              className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
            >
              Explore other labs
            </Link>
          </footer>
        </motion.div>
      </div>
    </section>
  );
}
