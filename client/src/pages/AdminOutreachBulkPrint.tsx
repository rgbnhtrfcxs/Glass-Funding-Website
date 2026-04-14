import { useEffect, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { OutreachLetterSheet } from "@/components/admin/OutreachLetterSheet";

export const BULK_PRINT_SESSION_KEY = "outreach_bulk_print_letters";

export type BulkLetterItem = {
  labId: number;
  labName: string;
  claimUrl: string;
  body: string;
};

type ResolvedLetter = BulkLetterItem & { logoUrl: string | null };

export default function AdminOutreachBulkPrint() {
  const [letters, setLetters] = useState<ResolvedLetter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = sessionStorage.getItem(BULK_PRINT_SESSION_KEY);
        if (!raw) { setLoading(false); return; }

        const items = JSON.parse(raw) as BulkLetterItem[];

        const resolved = await Promise.all(
          items.map(async (item) => {
            try {
              const { data } = await supabase
                .from("labs")
                .select("name, lab_profile(logo_url)")
                .eq("id", item.labId)
                .single();
              const lab = data as any;
              const logoUrl =
                lab?.lab_profile?.[0]?.logo_url ??
                lab?.lab_profile?.logo_url ??
                null;
              return { ...item, logoUrl };
            } catch {
              return { ...item, logoUrl: null };
            }
          }),
        );

        setLetters(resolved);
      } catch {
        /* silently ignore parse errors */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePrint = () => {
    document.title = "Glass - Outreach Letters";
    window.print();
  };

  const handleDownload = () => {
    document.title = "Glass - Outreach Letters";
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (letters.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        No letters found. Generate letters from the outreach page first.
      </div>
    );
  }

  return (
    <>
      {/* Action bar — hidden when printing */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border px-6 py-3 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-foreground">
          {letters.length} outreach letter{letters.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition"
          >
            <Printer className="h-3.5 w-3.5" />
            Print all
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </button>
        </div>
      </div>

      {/* All letters stacked — each gets its own A4 page when printing */}
      <div className="print:pt-0 pt-16 bg-gray-100 print:bg-white">
        {letters.map((letter, i) => {
          return (
            <OutreachLetterSheet
              key={letter.labId}
              body={letter.body}
              claimUrl={letter.claimUrl}
              labName={letter.labName}
              logoUrl={letter.logoUrl}
              pageBreakAfter={i < letters.length - 1}
            />
          );
        })}
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
