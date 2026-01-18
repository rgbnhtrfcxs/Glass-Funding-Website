import { motion } from "framer-motion";
import { useState, useMemo, type ReactNode } from "react";
import { Link } from "wouter";
import { CheckCircle2, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { useLabs } from "@/context/LabsContext";
// Note: this standalone page is currently unused in routing; kept for reference/future reuse.

interface RouteProps {
  params: {
    id: string;
  };
}

type FormState = {
  requesterName: string;
  requesterEmail: string;
  organization: string;
  roleTitle: string;
  projectSummary: string;
  workTimeline: string;
  weeklyHoursNeeded: string;
  teamSize: string;
  equipmentNeeds: string;
  complianceNotes: string;
  specialRequirements: string;
  referencesOrLinks: string;
  preferredContactMethods: Array<"email" | "video_call" | "phone">;
};

const defaultState: FormState = {
  requesterName: "",
  requesterEmail: "",
  organization: "",
  roleTitle: "",
  projectSummary: "",
  workTimeline: "",
  weeklyHoursNeeded: "",
  teamSize: "",
  equipmentNeeds: "",
  complianceNotes: "",
  specialRequirements: "",
  referencesOrLinks: "",
  preferredContactMethods: ["email"],
};

export default function LabRequest({ params }: RouteProps) {
  const { labs, isLoading } = useLabs();
  const labId = Number(params.id);
  const lab = useMemo(() => labs.find(item => item.id === labId), [labs, labId]);
  const inputClasses =
    "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  const [formState, setFormState] = useState<FormState>(defaultState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);

  const updateField = (field: keyof FormState, value: string | boolean | string[]) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lab) return;
    if (!formState.preferredContactMethods.length) {
      setError("Select at least one contact method.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/lab-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formState,
          labId: lab.id,
          labName: lab.name,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Unable to submit" }));
        throw new Error(payload?.message ?? "Unable to submit request");
      }

      const payload = await response.json();
      setSuccessId(payload.id);
      setFormState(defaultState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !lab) {
    return (
      <section className="bg-background min-h-screen">
        <div className="container mx-auto px-4 py-24 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">Loading lab details…</p>
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
            The lab you selected doesn’t exist or has been removed. Head back to the directory to choose
            another partner.
          </p>
          <Link href="/labs">
            <a className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
              Browse labs
            </a>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-16 lg:py-20 max-w-4xl">
        <Link href={`/labs/${lab.id}`}>
          <a className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary">
            ← Back to {lab.name}
          </a>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-6 rounded-3xl border border-border bg-card/80 p-8 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Lab intake</span>
              <h1 className="mt-3 text-3xl font-semibold text-foreground">Request time at {lab.name}</h1>
              <p className="mt-2 text-muted-foreground">
                Glass reviews every submission for spam or quality issues before sharing them with the lab. Approved
                requests are batched and delivered on the cadence you choose.
              </p>
            </div>
            <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
              <p className="font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Help labs trust the outreach
              </p>
              <p className="mt-1 text-muted-foreground">
                Share proof of prior collaboration or a partner reference so Glass can pre-screen requests before sending them.
              </p>
            </div>
          </div>

          {successId ? (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-6 py-5 text-sm text-emerald-900">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5" />
                <div>
                  <p className="font-medium">Request queued for review</p>
                  <p className="mt-1 text-emerald-900/80">
                    Your submission #{successId} is pending internal moderation. We’ll route approved requests to {lab.labManager}.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {error && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Your name" required>
                <input
                  type="text"
                  value={formState.requesterName}
                  onChange={event => updateField("requesterName", event.target.value)}
                  className={inputClasses}
                  placeholder="Jordan Reyes"
                  required
                />
              </Field>
              <Field label="Work email" required>
                <input
                  type="email"
                  value={formState.requesterEmail}
                  onChange={event => updateField("requesterEmail", event.target.value)}
                  className={inputClasses}
                  placeholder="jordan@teamglass.bio"
                  required
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Organization / team" required>
                <input
                  type="text"
                  value={formState.organization}
                  onChange={event => updateField("organization", event.target.value)}
                  className={inputClasses}
                  placeholder="Atlas Applied Biology"
                  required
                />
              </Field>
              <Field label="Role / title" required>
                <input
                  type="text"
                  value={formState.roleTitle}
                  onChange={event => updateField("roleTitle", event.target.value)}
                  className={inputClasses}
                  placeholder="Program Lead"
                  required
                />
              </Field>
            </div>

            <Field label="Project summary" description="Help the lab understand why you need space and what success looks like." required>
              <textarea
                value={formState.projectSummary}
                onChange={event => updateField("projectSummary", event.target.value)}
                className={`${inputClasses} min-h-[140px]`}
                placeholder="Outline your experiment goals, team, and safety posture."
                required
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Desired start" required>
                <select
                  className={inputClasses}
                  value={formState.workTimeline}
                  onChange={event => updateField("workTimeline", event.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select timeline
                  </option>
                  <option value="next_2_weeks">Within 2 weeks</option>
                  <option value="next_month">Within a month</option>
                  <option value="next_quarter">Next quarter</option>
                  <option value="flexible">Flexible / exploratory</option>
                </select>
              </Field>
              <Field label="Weekly hours" required>
                <input
                  type="text"
                  className={inputClasses}
                  value={formState.weeklyHoursNeeded}
                  onChange={event => updateField("weeklyHoursNeeded", event.target.value)}
                  placeholder="20 bench hours"
                  required
                />
              </Field>
              <Field label="Team size" required>
                <input
                  type="text"
                  className={inputClasses}
                  value={formState.teamSize}
                  onChange={event => updateField("teamSize", event.target.value)}
                  placeholder="3 researchers"
                  required
                />
              </Field>
            </div>

            <Field label="Equipment & process needs" description="List any instruments, cleanroom access, or SOP support you expect.">
              <textarea
                className={`${inputClasses} min-h-[100px]`}
                value={formState.equipmentNeeds}
                onChange={event => updateField("equipmentNeeds", event.target.value)}
                placeholder="BSL-2 hood, sequencing core time, GMP-aligned QA support..."
              />
            </Field>

            <Field label="Compliance or special requirements" description="Share certifications, biosafety requirements, or onboarding needs.">
              <textarea
                className={inputClasses}
                value={formState.complianceNotes}
                onChange={event => updateField("complianceNotes", event.target.value)}
                placeholder="BSL-2+ handling, cleanroom training, DEA registration..."
              />
            </Field>

            <Field label="Special requests" description="Optional context for lab operations, security, or scheduling.">
              <textarea
                className={inputClasses}
                value={formState.specialRequirements}
                onChange={event => updateField("specialRequirements", event.target.value)}
                placeholder="Preferred shift, shipping logistics, storage requirements..."
              />
            </Field>

            <Field label="References, decks, or links">
              <textarea
                className={inputClasses}
                value={formState.referencesOrLinks}
                onChange={event => updateField("referencesOrLinks", event.target.value)}
                placeholder="Paste Notion docs, pitch decks, public updates, etc."
              />
            </Field>

            <Field label="Contact preferences" description="Choose how you want the lab to reach you." required>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "email", label: "Email" },
                    { value: "video_call", label: "Video call" },
                    { value: "phone", label: "Phone" },
                  ] as const
                ).map(option => {
                  const checked = formState.preferredContactMethods.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                        checked
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-border text-primary"
                        checked={checked}
                        onChange={event =>
                          updateField(
                            "preferredContactMethods",
                            event.target.checked
                              ? [...formState.preferredContactMethods, option.value]
                              : formState.preferredContactMethods.filter(item => item !== option.value),
                          )
                        }
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </Field>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit request
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </section>
  );
}

function Field({
  label,
  description,
  required,
  children,
}: {
  label: string;
  description?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span>
          {label}
          {required ? " *" : ""}
        </span>
      </div>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {children}
    </div>
  );
}
