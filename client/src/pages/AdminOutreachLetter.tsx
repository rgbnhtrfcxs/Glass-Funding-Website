import { useEffect, useRef, useState } from "react";
import { Printer, Download, Loader2 } from "lucide-react";

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
    fetch(`/api/labs/${labId}`)
      .then(r => r.json())
      .then(data => {
        setLabName(data?.name ?? "");
        setLogoUrl(data?.logoUrl ?? data?.logo_url ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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

  const paragraphs = body.split("\n\n").filter(Boolean);
  const qrSrc = claimUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(claimUrl)}&margin=10&color=000000&bgcolor=ffffff`
    : null;

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
        <div
          className="bg-white w-full max-w-2xl print:max-w-none mx-auto my-8 print:my-0 shadow-sm print:shadow-none px-16 py-14 print:px-12 print:py-12 space-y-10"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <img
              src="/GlassLogo5.png"
              alt="Glass"
              className="h-8 object-contain"
            />
            {logoUrl && (
              <img
                src={logoUrl}
                alt={labName}
                className="h-10 object-contain"
                crossOrigin="anonymous"
              />
            )}
          </div>

          <hr className="border-gray-200" />

          {/* Body */}
          <div className="space-y-4 text-gray-800 text-[15px] leading-relaxed">
            {paragraphs.map((para, i) => (
              <p key={i} className="whitespace-pre-line">{para}</p>
            ))}
          </div>

          {/* QR code block */}
          <div className="flex flex-col items-center gap-3 pt-4">
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
            <p
              className="text-xs text-gray-400 break-all max-w-xs text-center"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              {claimUrl}
            </p>
          </div>
        </div>
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
