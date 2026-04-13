import { useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

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
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
        >
          <Printer className="h-3.5 w-3.5" />
          Print all
        </button>
      </div>

      {/* All letters stacked — each gets its own A4 page when printing */}
      <div className="print:pt-0 pt-16 bg-gray-100 print:bg-white">
        {letters.map((letter, i) => {
          const paragraphs = letter.body.split("\n\n").filter(Boolean);
          const qrSrc = letter.claimUrl
            ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(letter.claimUrl)}&margin=10&color=000000&bgcolor=ffffff`
            : null;

          return (
            <div
              key={letter.labId}
              className="bg-white w-full max-w-2xl print:max-w-none mx-auto my-8 print:my-0 shadow-sm print:shadow-none px-16 py-14 print:px-12 print:py-12 flex flex-col"
              style={{
                minHeight: "297mm",
                fontFamily: "Georgia, 'Times New Roman', serif",
                pageBreakAfter: i < letters.length - 1 ? "always" : "auto",
                breakAfter: i < letters.length - 1 ? "page" : "auto",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <img src="/GlassLogo5.png" alt="Glass" className="h-8 object-contain" />
                {letter.logoUrl && (
                  <img
                    src={letter.logoUrl}
                    alt={letter.labName}
                    className="h-10 object-contain"
                    crossOrigin="anonymous"
                  />
                )}
              </div>

              <hr className="border-gray-200 mt-10" />

              {/* Body */}
              <div className="space-y-4 text-gray-800 text-[15px] leading-relaxed mt-10">
                {paragraphs.map((para, j) => (
                  <p key={j} className="whitespace-pre-line">{para}</p>
                ))}
              </div>

              {/* Spacer — pushes QR into the bottom third */}
              <div className="flex-1" />

              {/* QR code block */}
              <div className="flex flex-col items-center gap-3 pb-2">
                <div className="rounded-2xl border border-gray-200 p-4 inline-block">
                  {qrSrc ? (
                    <img
                      src={qrSrc}
                      alt="Scan to claim lab"
                      width={160}
                      height={160}
                      style={{ display: "block" }}
                    />
                  ) : (
                    <div className="h-40 w-40 bg-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-400">
                      No URL
                    </div>
                  )}
                </div>
                {letter.claimUrl && (
                  <p
                    className="text-sm text-gray-600 break-all max-w-sm text-center font-medium"
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                    {letter.claimUrl}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-between pt-6 border-t border-gray-100 text-xs text-gray-400 mt-6"
                style={{ fontFamily: "system-ui, sans-serif" }}
              >
                <span>glass-connect.com</span>
                <span>
                  Questions?{" "}
                  <a href="mailto:contact@glass-connect.com" className="underline">
                    contact@glass-connect.com
                  </a>
                </span>
              </div>
            </div>
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
