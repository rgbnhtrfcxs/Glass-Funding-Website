import { motion } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  Images,
  Lock,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Unlock,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { useMemo } from "react";
import { useLabs } from "@/context/LabsContext";

export default function Labs() {
  const { labs } = useLabs();

  const labCount = labs.length;
  const verifiedCount = labs.filter(lab => lab.isVerified).length;
  const pricePrivateCount = labs.filter(lab => lab.pricePrivacy).length;
  const uniqueEquipmentCount = useMemo(() => {
    const equipment = new Set<string>();
    labs.forEach(lab => {
      lab.equipment.forEach(item => equipment.add(item.toLowerCase()));
    });
    return equipment.size;
  }, [labs]);
  const averageRating = labs.length
    ? Number((labs.reduce((sum, lab) => sum + lab.rating, 0) / labs.length).toFixed(1))
    : 0;
  const getImageUrl = (url: string, width = 1200) =>
    `${url}${url.includes("?") ? "&" : "?"}auto=format&fit=crop&w=${width}&q=75`;

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-20 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <span className="text-sm uppercase tracking-[0.35em] text-muted-foreground">
            Partner Labs
          </span>
          <h1 className="mt-4 text-4xl md:text-5xl font-semibold leading-tight">
            Rent bench space inside vetted labs aligned with Glass.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            Each partner lab lists core equipment, focus areas, and compliance posture so your team can
            spin up work quickly with the right infrastructure in place.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
                Network size
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">{labCount} labs</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Vetted partners with Glass-aligned safety and operational standards.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
                Verified labs
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {verifiedCount} verified
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Labs that completed Glass&apos;s on-site verification workflow.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
                Private pricing
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {pricePrivateCount} labs
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Require a direct quote for their current pricing structure.
            </p>
          </div>
          <div className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
                Avg. rating
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {averageRating.toFixed(1)} / 5
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Feedback aggregated from teams that historically booked these labs.
            </p>
          </div>
        </motion.div>

        <p className="mt-6 text-sm text-muted-foreground">
          Across the network you&apos;ll find {uniqueEquipmentCount}+ distinct pieces of specialized equipment,
          supporting a broad range of wet lab, fabrication, and analytics workflows.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {labs.map((lab, index) => (
            <motion.div
              key={lab.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * (index % 3) }}
              className="flex h-full flex-col rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
            >
              {lab.photos.length > 0 && (
                <div className="mb-6 overflow-hidden rounded-2xl border border-border/60 bg-background/40">
                  <img
                    src={getImageUrl(lab.photos[0].url)}
                    alt={`${lab.name} preview - ${lab.photos[0].name}`}
                    className="h-48 w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">{lab.name}</h3>
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>{lab.location}</span>
                  </div>
                </div>
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
                      Verified
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Pending
                    </>
                  )}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground">
                  <Star className="h-3.5 w-3.5 text-primary" />
                  {lab.rating.toFixed(1)}
                </span>
                <span className="inline-flex items-center gap-2">
                  {lab.pricePrivacy ? (
                    <>
                      <Lock className="h-4 w-4 text-primary" />
                      Private pricing
                    </>
                  ) : (
                    <>
                      <Unlock className="h-4 w-4 text-primary" />
                      Transparent rates
                    </>
                  )}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span>{lab.labManager}</span>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span>{lab.compliance.join(" • ")}</span>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarClock className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span>{lab.minimumStay}</span>
                </div>
              </div>

              <div className="mt-5">
                <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Offers
                </h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {lab.offers.map(offer => (
                    <span
                      key={offer}
                      className="rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {offer}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Focus areas
                </h4>
                <div className="mt-2 flex flex-wrap gap-2">
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

              <div className="mt-5">
                <h4 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Equipment highlights
                </h4>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {lab.equipment.map(item => (
                    <span
                      key={item}
                      className="rounded-full bg-muted/60 px-3 py-1"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              {lab.photos.length > 1 && (
                <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
                    <Images className="h-3.5 w-3.5 text-primary" />
                    {lab.photos.length} photos provided
                  </span>
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={`/labs/${lab.id}`}>
                  <a className="inline-flex items-center justify-center rounded-full border border-primary px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary">
                    View details
                  </a>
                </Link>
                <a
                  href={`mailto:${lab.contactEmail}`}
                  className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                >
                  Contact lab
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
