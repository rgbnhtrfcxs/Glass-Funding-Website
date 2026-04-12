import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function getParam(key: string): string {
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

export default function AdminOutreachLetter() {
  const labId = getParam("lab");
  const token = getParam("token");
  const claimUrl = getParam("claimUrl");
  const body = getParam("body");

  const [labName, setLabName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const letterRef = useRef<HTMLDivElement>(null);

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

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    if (!letterRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(letterRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      pdf.save(`Glass - ${labName || "Lab"}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const paragraphs = body.split("\n\n").filter(Boolean);

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
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
          >
            {downloading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />}
            {downloading ? "Generating…" : "Download PDF"}
          </button>
        </div>
      </div>

      {/* Letter — A4-ish, centred */}
      <div className="print:pt-0 pt-20 min-h-screen bg-gray-100 print:bg-white flex justify-center">
        <div
          ref={letterRef}
          className="bg-white w-full max-w-2xl print:max-w-none mx-auto my-8 print:my-0 shadow-sm print:shadow-none px-16 py-14 print:px-12 print:py-12 space-y-10"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={labName}
                  className="h-10 object-contain mb-1"
                  crossOrigin="anonymous"
                />
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "system-ui, sans-serif" }}>
                Glass
              </p>
              <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: "system-ui, sans-serif" }}>
                glass-connect.com
              </p>
            </div>
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
              {claimUrl ? (
                <QRCodeSVG value={claimUrl} size={160} />
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
          @page { margin: 0; size: A4; }
        }
      `}</style>
    </>
  );
}
