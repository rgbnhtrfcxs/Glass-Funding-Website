import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { supabase } from "@/lib/supabaseClient";
import { Search, FileText, Loader2 } from "lucide-react";

type LabStub = { id: number; name: string; owner_user_id: string | null };

const DEFAULT_TEMPLATE = (labName: string) =>
  `Dear ${labName} team,

We are reaching out on behalf of Glass — a platform connecting research labs with industry partners, startups, and investors looking to access cutting-edge infrastructure and expertise.

We are building our network in partnership with BioValley and believe ${labName} would be a valuable addition to our directory. Listing your lab on Glass gives you visibility with a curated network of potential collaborators and clients — at no cost.

To claim your lab profile and get started, simply scan the QR code below with your phone. It takes less than two minutes.

We look forward to welcoming you to the Glass network.

The Glass Team`;

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function AdminOutreach() {
  const [, navigate] = useLocation();
  const [labs, setLabs] = useState<LabStub[]>([]);
  const [labsLoading, setLabsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLab, setSelectedLab] = useState<LabStub | null>(null);
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/admin/all-labs", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        setLabs((json as LabStub[]).filter(l => !l.owner_user_id));
      } finally {
        setLabsLoading(false);
      }
    })();
  }, []);

  const filteredLabs = labs.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectLab = (lab: LabStub) => {
    setSelectedLab(lab);
    setBody(DEFAULT_TEMPLATE(lab.name));
    setError(null);
  };

  const handleGenerate = async () => {
    if (!selectedLab) return;
    setGenerating(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/labs/${selectedLab.id}/claim-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to generate token.");

      const params = new URLSearchParams({
        lab: String(selectedLab.id),
        token: json.token,
        claimUrl: json.claimUrl,
        body: body,
      });
      window.open(`/admin/outreach/letter?${params.toString()}`, "_blank");
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="bg-background min-h-screen">
      <div className="container mx-auto max-w-6xl px-4 py-20 lg:py-24 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Admin</span>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Outreach letters</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a personalised letter with QR code to bring to lab visits.
            </p>
          </div>
          <Link href="/admin">
            <a className="inline-flex items-center rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition">
              ← Admin
            </a>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Step 1 — Lab picker */}
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">1. Select lab</p>
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search unassigned labs…"
                className="w-full bg-transparent text-sm focus:outline-none"
              />
            </div>

            {labsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading labs…
              </div>
            ) : filteredLabs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No unassigned labs found.</p>
            ) : (
              <ul className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {filteredLabs.map(lab => (
                  <li key={lab.id}>
                    <button
                      type="button"
                      onClick={() => selectLab(lab)}
                      className={`w-full text-left rounded-2xl border px-4 py-3 text-sm transition ${
                        selectedLab?.id === lab.id
                          ? "border-primary/50 bg-primary/5 text-primary"
                          : "border-border text-foreground hover:border-primary/30 hover:bg-muted/30"
                      }`}
                    >
                      {lab.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Step 2 — Letter editor */}
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              2. Edit letter {selectedLab ? `— ${selectedLab.name}` : ""}
            </p>

            {!selectedLab ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Select a lab to start editing the letter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={14}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono leading-relaxed"
                />

                {error && (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || !body.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {generating ? "Generating…" : "Generate letter"}
                </button>
                <p className="text-xs text-muted-foreground text-center">
                  Opens a printable letter in a new tab. Generating a new letter invalidates any previous QR for this lab.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
