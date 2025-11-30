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
  const getImageUrl = (url: string, width = 1600) =>
    url.startsWith("data:")
      ? url
      : `${url}${url.includes("?") ? "&" : "?"}auto=format&fit=crop&w=${width}&q=80`;
  const tier = lab.subscriptionTier ?? "base";
  const logoUrl = lab.logoUrl || null;
  const website = lab.website || null;
  const linkedin = lab.linkedin || null;

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
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                  lab.isVerified
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {lab.isVerified ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified by Glass
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Verification pending
                  </>
                )}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground">
                {lab.pricePrivacy ? (
                  <>
                    <Lock className="h-3.5 w-3.5 text-primary" />
                    Pricing shared privately
                  </>
                ) : (
                  <>
                    <Unlock className="h-3.5 w-3.5 text-primary" />
                    Pricing published
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {(logoUrl || tier === "premier") && (
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
            <p className="text-muted-foreground text-base leading-relaxed">
              Review compliance, offers, and baseline expectations before requesting space. Minimum commitment:
              <span className="font-medium text-foreground"> {lab.minimumStay}</span>.
            </p>
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

          <footer className="flex flex-wrap gap-3">
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
