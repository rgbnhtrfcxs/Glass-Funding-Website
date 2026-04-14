import { useEffect, useState } from "react";
import { Printer, Download, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { OutreachLetterSheet } from "@/components/admin/OutreachLetterSheet";

function getParam(key: string): string {
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

export default function AdminOutreachLetter() {
  const labId = getParam("lab");
  const claimUrl = getParam("claimUrl");
  const body = getParam("body");

  const [labName, setLabName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!labId) { setLoading(false); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from("labs")
          .select("name, lab_profile(logo_url)")
          .eq("id", Number(labId))
          .single();
        const lab = data as any;
        setLabName(lab?.name ?? "");
        setLogoUrl(lab?.lab_profile?.[0]?.logo_url ?? lab?.lab_profile?.logo_url ?? null);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [labId]);

  const handlePrint = () => {
    const prev = document.title;
    document.title = `Glass - ${labName || "Lab"}`;
    window.print();
    document.title = prev;
  };

  const handleDownloadPDF = () => {
    const prev = document.title;
    document.title = `Glass - ${labName || "Lab"}`;
    window.print();
    document.title = prev;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Action bar — hidden when printing */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border px-6 py-3 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-foreground">
          Outreach letter — <span className="text-muted-foreground">{labName}</span>
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Letter — A4-ish, centred */}
      <div className="print:pt-0 pt-20 min-h-screen bg-gray-100 print:bg-white flex justify-center">
        <OutreachLetterSheet
          body={body}
          claimUrl={claimUrl}
          labName={labName}
          logoUrl={logoUrl}
        />
      </div>

      <style>{`
        @media print {
          body { background: white; }
          @page { margin: 15mm; size: A4; }
        }
      `}</style>
    </>
  );
}
