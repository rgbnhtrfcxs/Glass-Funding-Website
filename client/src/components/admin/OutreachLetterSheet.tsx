import { useLayoutEffect, useRef, useState } from "react";

const A4_PAGE_HEIGHT_MM = 297;
const PRINT_MARGIN_MM = 15;
const PRINTABLE_PAGE_HEIGHT_MM = A4_PAGE_HEIGHT_MM - PRINT_MARGIN_MM * 2;

type OutreachLetterSheetProps = {
  body: string;
  claimUrl: string;
  labName: string;
  logoUrl: string | null;
  pageBreakAfter?: boolean;
};

export function OutreachLetterSheet({
  body,
  claimUrl,
  labName,
  logoUrl,
  pageBreakAfter = false,
}: OutreachLetterSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    let frame = 0;
    let cancelled = false;

    const fitToPage = () => {
      const sheet = sheetRef.current;
      const content = contentRef.current;
      if (!sheet || !content) return;

      const availableHeight = sheet.clientHeight;
      const naturalHeight = content.scrollHeight;
      const nextScale = naturalHeight > availableHeight ? availableHeight / naturalHeight : 1;
      const roundedScale = Number(nextScale.toFixed(3));

      setScale((current) => (Math.abs(current - roundedScale) < 0.001 ? current : roundedScale));
    };

    const scheduleFit = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const fontsReady = document.fonts?.ready;
        if (!fontsReady) {
          fitToPage();
          return;
        }

        void fontsReady.then(() => {
          if (!cancelled) fitToPage();
        });
      });
    };

    scheduleFit();
    window.addEventListener("resize", scheduleFit);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleFit);
    };
  }, [body, claimUrl, labName, logoUrl]);

  const paragraphs = body.split("\n\n").filter(Boolean);
  const qrSrc = claimUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(claimUrl)}&margin=10&color=000000&bgcolor=ffffff`
    : null;
  const contentWidth = scale < 1 ? `${(100 / scale).toFixed(3)}%` : "100%";

  return (
    <div
      ref={sheetRef}
      className="bg-white w-full max-w-2xl print:max-w-none mx-auto my-8 print:my-0 shadow-sm print:shadow-none overflow-hidden"
      style={{
        height: `${PRINTABLE_PAGE_HEIGHT_MM}mm`,
        fontFamily: "Georgia, 'Times New Roman', serif",
        pageBreakAfter: pageBreakAfter ? "always" : "auto",
        breakAfter: pageBreakAfter ? "page" : "auto",
      }}
    >
      <div
        ref={contentRef}
        className="flex min-h-full flex-col px-12 py-10"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: contentWidth,
        }}
      >
        <div className="flex items-center justify-between gap-6">
          <img src="/GlassLogo5.png" alt="Glass" className="h-8 object-contain" />
          {logoUrl && (
            <img
              src={logoUrl}
              alt={labName}
              className="h-10 max-w-[11rem] object-contain"
              crossOrigin="anonymous"
            />
          )}
        </div>

        <hr className="mt-7 border-gray-200" />

        <div className="mt-7 space-y-3 text-[14px] leading-[1.45] text-gray-800">
          {paragraphs.map((para, index) => (
            <p key={index} className="whitespace-pre-line">
              {para}
            </p>
          ))}
        </div>

        <div className="mt-auto pt-6" />

        <div className="flex flex-col items-center gap-2 pb-1">
          <div className="inline-block rounded-2xl border border-gray-200 p-3">
            {qrSrc ? (
              <img
                src={qrSrc}
                alt="Scan to claim lab"
                width={136}
                height={136}
                style={{ display: "block" }}
              />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center rounded-xl bg-gray-100 text-xs text-gray-400">
                No URL
              </div>
            )}
          </div>
          {claimUrl && (
            <p
              className="max-w-sm break-all text-center text-xs font-medium text-gray-600"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              {claimUrl}
            </p>
          )}
        </div>

        <div
          className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-[11px] text-gray-400"
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
    </div>
  );
}
