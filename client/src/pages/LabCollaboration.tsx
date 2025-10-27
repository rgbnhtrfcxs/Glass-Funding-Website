import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useLabs } from "@/context/LabsContext";

interface Props {
  params: { id: string };
}

export default function LabCollaboration({ params }: Props) {
  const labId = Number(params.id);
  const { labs } = useLabs();
  const lab = labs.find(l => l.id === labId);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [targetLabs, setTargetLabs] = useState("");
  const [collaborationFocus, setCollaborationFocus] = useState("");
  const [resourcesOffered, setResourcesOffered] = useState("");
  const [desiredTimeline, setDesiredTimeline] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Prefill targetLabs with the current lab name if empty
  useEffect(() => {
    if (lab && !targetLabs) {
      setTargetLabs(lab.name);
    }
  }, [lab]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/lab-collaborations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId,
          contactName,
          contactEmail,
          targetLabs,
          collaborationFocus,
          resourcesOffered,
          desiredTimeline,
          additionalNotes,
        }),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({})))?.message || "Submission failed";
        throw new Error(msg);
      }
      setStatus("Submitted. We'll notify the lab team.");
      setContactName("");
      setContactEmail("");
      setTargetLabs("");
      setCollaborationFocus("");
      setResourcesOffered("");
      setDesiredTimeline("");
      setAdditionalNotes("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto px-4 pt-28 pb-20 max-w-2xl">
        <Link href={`/labs/${labId}`} className="text-sm text-muted-foreground hover:text-primary">Back to lab</Link>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">Propose a collaboration</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {lab ? (
            <>You’re collaborating with <span className="font-medium text-foreground">{lab.name}</span>.</>
          ) : (
            <>Share a brief overview so the lab can assess fit quickly.</>
          )}
        </p>
        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <div>
            <label className="text-sm font-medium text-foreground">Your name</label>
            <input className="mt-2 w-full rounded-full border border-border bg-background px-4 py-2 text-sm" value={contactName} onChange={e => setContactName(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <input type="email" className="mt-2 w-full rounded-full border border-border bg-background px-4 py-2 text-sm" value={contactEmail} onChange={e => setContactEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Target labs (optional)</label>
            <input className="mt-2 w-full rounded-full border border-border bg-background px-4 py-2 text-sm" value={targetLabs} onChange={e => setTargetLabs(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Collaboration focus</label>
            <textarea className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm" rows={4} value={collaborationFocus} onChange={e => setCollaborationFocus(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Resources offered (optional)</label>
            <input className="mt-2 w-full rounded-full border border-border bg-background px-4 py-2 text-sm" value={resourcesOffered} onChange={e => setResourcesOffered(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Desired timeline (optional)</label>
            <input className="mt-2 w-full rounded-full border border-border bg-background px-4 py-2 text-sm" value={desiredTimeline} onChange={e => setDesiredTimeline(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Additional notes (optional)</label>
            <textarea className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-2 text-sm" rows={4} value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} />
          </div>
          {status && <p className="text-sm text-muted-foreground">{status}</p>}
          <button disabled={submitting} className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            {submitting ? "Submitting…" : "Submit proposal"}
          </button>
        </form>
      </div>
    </section>
  );
}
