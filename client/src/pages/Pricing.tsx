import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardCheck } from "lucide-react";
import { Link } from "wouter";
import { usePricing } from "@/hooks/usePricing";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type UpgradeTier = "verified" | "premier";

type OwnedLab = {
  id: number;
  name: string;
  labStatus: string | null;
};

type OnboardingForm = {
  labName: string;
  website: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
};

const getLabSubscriptionTierRank = (status?: string | null) => {
  const normalized = (status || "").toLowerCase().trim();
  if (normalized === "premier") return 2;
  if (normalized === "verified" || normalized === "verified_active" || normalized === "verified_passive") {
    return 1;
  }
  return 0;
};

const canLabSubscribeToPlan = (status: string | null | undefined, plan: UpgradeTier) => {
  const rank = getLabSubscriptionTierRank(status);
  if (plan === "verified") return rank < 1;
  return rank < 2;
};

const formatLabStatusLabel = (status?: string | null) => {
  const normalized = (status || "listed").toLowerCase().trim();
  if (normalized === "verified_active" || normalized === "verified_passive") return "verified";
  return normalized;
};

const buildOnboardingForm = (seed?: Partial<OnboardingForm>): OnboardingForm => ({
  labName: seed?.labName ?? "",
  website: seed?.website ?? "",
  contactName: seed?.contactName ?? "",
  contactEmail: seed?.contactEmail ?? "",
  contactPhone: seed?.contactPhone ?? "",
  notes: seed?.notes ?? "",
});

export default function Pricing() {
  const { tiers } = usePricing();
  const { user } = useAuth();
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<UpgradeTier | null>(null);
  const [labsLoading, setLabsLoading] = useState(false);
  const [labsError, setLabsError] = useState<string | null>(null);
  const [labs, setLabs] = useState<OwnedLab[]>([]);
  const [selectedLabIds, setSelectedLabIds] = useState<number[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [onboardingDialogOpen, setOnboardingDialogOpen] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState<OnboardingForm>(buildOnboardingForm());
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingSuccess, setOnboardingSuccess] = useState(false);

  const openUpgradeDialog = (tier: UpgradeTier) => {
    setSelectedTier(tier);
    setDialogOpen(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    setSelectedLabIds([]);
  };

  const openOnboardingDialog = () => {
    const metadataName =
      (user?.user_metadata?.full_name as string | undefined) ||
      (user?.user_metadata?.name as string | undefined) ||
      "";
    setOnboardingForm(current =>
      buildOnboardingForm({
        ...current,
        contactEmail: current.contactEmail || user?.email || "",
        contactName: current.contactName || metadataName,
      }),
    );
    setOnboardingError(null);
    setOnboardingSuccess(false);
    setOnboardingDialogOpen(true);
  };

  const eligibleLabsByTier = useMemo(
    () => ({
      verified: labs.filter(lab => canLabSubscribeToPlan(lab.labStatus, "verified")),
      premier: labs.filter(lab => canLabSubscribeToPlan(lab.labStatus, "premier")),
    }),
    [labs],
  );

  const eligibleLabs = selectedTier ? eligibleLabsByTier[selectedTier] : [];

  useEffect(() => {
    if (!dialogOpen || !selectedTier) return;

    const eligibleIdSet = new Set(eligibleLabs.map(lab => lab.id));
    setSelectedLabIds(current => {
      const stillValid = current.filter(id => eligibleIdSet.has(id));
      if (stillValid.length) return stillValid;
      if (eligibleLabs.length === 1) return [eligibleLabs[0].id];
      return [];
    });
  }, [dialogOpen, selectedTier, eligibleLabs]);

  useEffect(() => {
    if (!user?.id) {
      setLabs([]);
      setLabsError(null);
      return;
    }

    let active = true;
    (async () => {
      setLabsLoading(true);
      setLabsError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch("/api/my-labs", { headers });
        if (!res.ok) {
          throw new Error("Unable to load your labs");
        }
        const payload = await res.json();
        const ownedLabs: OwnedLab[] = Array.isArray(payload)
          ? payload
              .map((lab: any) => {
                const id = Number(lab?.id);
                const name = typeof lab?.name === "string" ? lab.name.trim() : "";
                const labStatus = typeof lab?.lab_status === "string" ? lab.lab_status : null;
                if (!Number.isInteger(id) || id <= 0 || !name) return null;
                return { id, name, labStatus };
              })
              .filter((lab: OwnedLab | null): lab is OwnedLab => Boolean(lab))
              .sort((a, b) => a.name.localeCompare(b.name))
          : [];

        if (!active) return;
        setLabs(ownedLabs);
      } catch (error) {
        if (!active) return;
        setLabs([]);
        setLabsError(error instanceof Error ? error.message : "Unable to load your labs");
      } finally {
        if (active) setLabsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const toggleLab = (labId: number) => {
    setSelectedLabIds(current =>
      current.includes(labId) ? current.filter(id => id !== labId) : [...current, labId],
    );
  };

  const submitUpgradeRequest = async () => {
    if (!selectedTier) return;
    if (!user) {
      window.location.href = `/login?next=${encodeURIComponent("/pricing")}`;
      return;
    }
    if (selectedLabIds.length === 0) {
      setSubmitError("Select at least one lab to continue.");
      return;
    }

    setSubmitLoading(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch("/api/tier-upgrade-interest", {
        method: "POST",
        headers,
        body: JSON.stringify({
          tier: selectedTier,
          interval,
          labIds: selectedLabIds,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: "Unable to submit request" }));
        throw new Error(payload?.message || "Unable to submit request");
      }

      setSubmitSuccess(true);
      setSelectedLabIds([]);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit request");
    } finally {
      setSubmitLoading(false);
    }
  };

  const submitOnboardingRequest = async () => {
    const labName = onboardingForm.labName.trim();
    const website = onboardingForm.website.trim();
    const contactName = onboardingForm.contactName.trim();
    const contactEmail = onboardingForm.contactEmail.trim();
    const contactPhone = onboardingForm.contactPhone.trim();
    const notes = onboardingForm.notes.trim();

    if (!labName || !website || !contactName || !contactEmail) {
      setOnboardingError("Please complete lab name, website, contact name, and contact email.");
      return;
    }

    setOnboardingLoading(true);
    setOnboardingError(null);
    setOnboardingSuccess(false);
    try {
      const res = await fetch("/api/onboarding-call-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labName,
          website,
          contactName,
          contactEmail,
          contactPhone: contactPhone || undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: "Unable to send onboarding request" }));
        throw new Error(payload?.message || "Unable to send onboarding request");
      }
      setOnboardingSuccess(true);
      setOnboardingForm(
        buildOnboardingForm({
          contactName,
          contactEmail,
        }),
      );
    } catch (error) {
      setOnboardingError(error instanceof Error ? error.message : "Unable to send onboarding request");
    } finally {
      setOnboardingLoading(false);
    }
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6 lg:py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">GLASS-Connect tiers</span>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Pick the right visibility tier</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 p-1 text-sm">
            <button
              type="button"
              onClick={() => setInterval("monthly")}
              className={`rounded-full px-4 py-1.5 font-medium transition ${
                interval === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setInterval("yearly")}
              className={`rounded-full px-4 py-1.5 font-medium transition ${
                interval === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              Yearly
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="grid gap-6 lg:grid-cols-3"
        >
          {tiers.map(tier => {
            const plan = tier.name.toLowerCase().trim();
            const monthlyPrice: any = (tier as any).monthly_price ?? (tier as any).monthlyPrice;
            const yearlyPrice: any = (tier as any).yearly_price ?? (tier as any).yearlyPrice;
            const priceVal = interval === "yearly" ? yearlyPrice : monthlyPrice;
            const isBase = plan === "base";
            const isFree = isBase || priceVal === 0 || priceVal === "0";
            const hasPrice = priceVal !== null && priceVal !== undefined && !isFree;
            const priceLabel = isFree ? "Free" : hasPrice ? `€${priceVal}` : "Custom";
            const canRequestUpgrade = plan === "verified" || plan === "premier";
            const eligibleLabsForPlan =
              plan === "verified"
                ? eligibleLabsByTier.verified
                : plan === "premier"
                  ? eligibleLabsByTier.premier
                  : [];
            const noEligibleLabs = canRequestUpgrade && Boolean(user) && !labsLoading && eligibleLabsForPlan.length === 0;
            const disabledLabel = noEligibleLabs
              ? plan === "premier"
                ? "All labs already Premier"
                : "All labs already Verified"
              : null;

            return (
              <article
                key={tier.name}
                className={`flex h-full flex-col rounded-[28px] border border-border bg-card/90 p-7 shadow-sm ${
                  plan === "verified" ? "ring-2 ring-primary/50 bg-gradient-to-br from-card to-primary/10" : ""
                }`}
              >
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{tier.name}</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-semibold text-foreground">{priceLabel}</span>
                    {hasPrice && (
                      <span className="text-sm text-muted-foreground">
                        {interval === "yearly" ? "/ year" : "/ month"}
                      </span>
                    )}
                    {hasPrice && interval === "yearly" && (
                      <span className="rounded-full border border-pink-200 bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700">
                        2 months free
                      </span>
                    )}
                    {hasPrice && interval === "monthly" && (
                      <span className="rounded-full border border-pink-200 bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700">
                        2 months free on yearly
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                </div>

                <div className="mt-6 flex-1">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">What&apos;s included</h3>
                  <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                    {tier.highlights.map(item => (
                      <li key={item} className="flex items-start gap-3">
                        <ClipboardCheck className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6">
                  {isBase ? (
                    <button
                      type="button"
                      onClick={openOnboardingDialog}
                      className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/90"
                    >
                      Book onboarding call
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openUpgradeDialog(plan as UpgradeTier)}
                      disabled={Boolean(disabledLabel)}
                      className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:opacity-60"
                    >
                      {disabledLabel || "Contact for upgrade"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </motion.div>

        <div className="flex flex-wrap gap-3">
          <Link href="/contact">
            <a className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary">
              General contact
            </a>
          </Link>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {selectedTier === "premier" ? "Premier" : "Verified"} upgrade request
            </DialogTitle>
            <DialogDescription>
              Select the lab(s) you want to upgrade and we&apos;ll contact you to finalize onboarding.
            </DialogDescription>
          </DialogHeader>

          {!user ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Sign in to select your labs and submit an upgrade request.</p>
              <Link href={`/login?next=${encodeURIComponent("/pricing")}`}>
                <a className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Sign in
                </a>
              </Link>
            </div>
          ) : labsLoading ? (
            <p className="text-sm text-muted-foreground">Loading your labs…</p>
          ) : labsError ? (
            <p className="text-sm text-destructive">{labsError}</p>
          ) : labs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No labs found for your account. Create a lab first to request an upgrade.</p>
          ) : eligibleLabs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {selectedTier === "premier"
                ? "All your labs are already on Premier."
                : "All your labs are already on Verified or Premier."}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLabIds(eligibleLabs.map(lab => lab.id))}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLabIds([])}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                >
                  Clear
                </button>
              </div>

              <div className="max-h-64 space-y-2 overflow-auto rounded-xl border border-border p-3">
                {eligibleLabs.map(lab => {
                  const checked = selectedLabIds.includes(lab.id);
                  return (
                    <label key={lab.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLab(lab.id)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{lab.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Current status: {formatLabStatusLabel(lab.labStatus)}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {submitError && <p className="text-sm text-destructive">{submitError}</p>}
              {submitSuccess && (
                <p className="text-sm text-emerald-600">
                  Request sent. We&apos;ll follow up with you shortly.
                </p>
              )}

              <DialogFooter>
                <button
                  type="button"
                  onClick={submitUpgradeRequest}
                  disabled={submitLoading || labs.length === 0}
                  className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:opacity-60"
                >
                  {submitLoading ? "Sending…" : "Send upgrade request"}
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={onboardingDialogOpen} onOpenChange={setOnboardingDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Book onboarding call</DialogTitle>
            <DialogDescription>
              Share your lab and contact details and we&apos;ll reach out to schedule the onboarding call.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={event => {
              event.preventDefault();
              void submitOnboardingRequest();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="onboarding-lab-name">Lab name</Label>
              <Input
                id="onboarding-lab-name"
                value={onboardingForm.labName}
                onChange={event => setOnboardingForm(current => ({ ...current, labName: event.target.value }))}
                placeholder="Example Research Lab"
                autoComplete="organization"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboarding-website">Website</Label>
              <Input
                id="onboarding-website"
                value={onboardingForm.website}
                onChange={event => setOnboardingForm(current => ({ ...current, website: event.target.value }))}
                placeholder="https://examplelab.org"
                autoComplete="url"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="onboarding-contact-name">Contact name</Label>
                <Input
                  id="onboarding-contact-name"
                  value={onboardingForm.contactName}
                  onChange={event => setOnboardingForm(current => ({ ...current, contactName: event.target.value }))}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboarding-contact-email">Contact email</Label>
                <Input
                  id="onboarding-contact-email"
                  type="email"
                  value={onboardingForm.contactEmail}
                  onChange={event => setOnboardingForm(current => ({ ...current, contactEmail: event.target.value }))}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboarding-contact-phone">Phone (optional)</Label>
              <Input
                id="onboarding-contact-phone"
                value={onboardingForm.contactPhone}
                onChange={event => setOnboardingForm(current => ({ ...current, contactPhone: event.target.value }))}
                autoComplete="tel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboarding-notes">Notes (optional)</Label>
              <Textarea
                id="onboarding-notes"
                value={onboardingForm.notes}
                onChange={event => setOnboardingForm(current => ({ ...current, notes: event.target.value }))}
                placeholder="Anything we should know before the call?"
              />
            </div>

            {onboardingError && <p className="text-sm text-destructive">{onboardingError}</p>}
            {onboardingSuccess && (
              <p className="text-sm text-emerald-600">
                Request sent. We&apos;ll email you a confirmation and follow up shortly.
              </p>
            )}

            <DialogFooter>
              <button
                type="submit"
                disabled={onboardingLoading}
                className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:opacity-60"
              >
                {onboardingLoading ? "Sending…" : "Send request"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
