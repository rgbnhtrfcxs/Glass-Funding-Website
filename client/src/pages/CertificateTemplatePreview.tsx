import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabaseClient";

const defaultTemplate = {
  page: { width: 595, height: 842 },
  colors: {
    background: "#FFFFFF",
    pastelBlue: "#BFE8FF",
    pastelPink: "#FFD7E8",
    mist: "#EDF7FF",
    cardBorder: "#D1DBF2",
    ink: "#1A2238",
    mutedInk: "#59647F",
    subtitle: "#54668F",
    idLabel: "#53668F",
    signatureLine: "#B8C1D9",
    footer: "#6B748D",
    fallbackLogo: "#22345A",
  },
  background: {
    leftGlow: { x: 96, y: 760, xScale: 168, yScale: 132, opacity: 0.38 },
    rightGlow: { x: 505, y: 768, xScale: 152, yScale: 128, opacity: 0.36 },
    bottomGlow: { xScale: 220, yScale: 120, y: 50, opacity: 0.62 },
  },
  card: { x: 30, y: 34, borderWidth: 1.25, opacity: 0.93, topAccentHeight: 2.6 },
  logo: {
    symbol: { file: "GlassLogo3.png", maxWidth: 58, y: 742, opacity: 0.99 },
    wordmark: { file: "GlassLogoLettering.png", maxWidth: 156, y: 690, opacity: 0.98 },
    fallback: { text: "GLASS", y: 710, size: 34 },
  },
  heading: {
    titleY: 668,
    titleSize: 30,
    subtitleY: 644,
    subtitleSize: 12,
    kickerY: 628,
    kickerSize: 11,
  },
  labName: {
    introY: 596,
    topY: 572,
    largeSize: 29,
    mediumSize: 24,
    smallSize: 20,
    lineGap: 6,
    maxWidth: 485,
    maxLines: 3,
    bodyOffset: 28,
  },
  address: {
    labelOffset: 52,
    labelSize: 10,
    textSize: 10,
    maxWidth: 465,
    maxLines: 3,
    lineGap: 12,
    issuedGap: 18,
  },
  idBox: {
    width: 390,
    height: 88,
    y: 364,
    borderWidth: 1.1,
    accentHeight: 4,
    labelYOffset: 60,
    labelSize: 11,
    idYOffset: 31,
    idSize: 22,
  },
  signatures: {
    titleY: 244,
    slotWidth: 220,
    gap: 56,
    imageY: 170,
    imageHeight: 58,
    lineY: 128,
    lineThickness: 1.1,
    nameGap: 18,
    titleGap: 32,
    nameSize: 11,
    titleSize: 10,
  },
  footer: {
    text: "Issued by GLASS for trusted collaboration visibility across verified labs.",
    y: 42,
    size: 9,
  },
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const mergeTemplate = <T,>(base: T, override: unknown): T => {
  if (Array.isArray(base)) return base;
  if (isPlainObject(base) && isPlainObject(override)) {
    const result: Record<string, unknown> = { ...base };
    Object.keys(base).forEach(key => {
      if (!(key in override)) return;
      result[key] = mergeTemplate(
        (base as Record<string, unknown>)[key],
        (override as Record<string, unknown>)[key],
      );
    });
    return result as T;
  }
  if (typeof override === typeof base) {
    return override as T;
  }
  return base;
};

const wrapByLength = (text: string, maxChars: number, maxLines: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (words.join(" ").length > lines.join(" ").length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/\.*$/, "")}...`;
  }
  return lines;
};

const toPreviewLogoSrc = (value: string | null | undefined, fallback: string) => {
  const selected = (value ?? "").trim() || fallback;
  if (/^https?:\/\//i.test(selected)) return selected;
  return selected.startsWith("/") ? selected : `/${selected}`;
};

export default function CertificateTemplatePreview() {
  const [jsonText, setJsonText] = useState(JSON.stringify(defaultTemplate, null, 2));
  const [template, setTemplate] = useState(defaultTemplate);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sampleLabName =
    "International Institute for Translational Biomaterials and Advanced Regenerative Therapeutics";
  const sampleAddress =
    "1234 Long Research Avenue, Innovation Tower 12B, Boston, Massachusetts, 02118, United States";

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch("/api/admin/certificate-template", { headers });
        if (!active) return;
        if (!response.ok) {
          const text = await response.text();
          setLoadError(text || "Unable to load template from server.");
          setLoading(false);
          return;
        }
        const payload = await response.json();
        const raw = typeof payload?.raw === "string" ? payload.raw : JSON.stringify(defaultTemplate, null, 2);
        setJsonText(raw);
        try {
          const parsed = JSON.parse(raw);
          setTemplate(mergeTemplate(defaultTemplate, parsed));
        } catch {
          setTemplate(defaultTemplate);
        }
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load template.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const onJsonChange = (value: string) => {
    setJsonText(value);
    try {
      const parsed = JSON.parse(value);
      setTemplate(mergeTemplate(defaultTemplate, parsed));
      setParseError(null);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Invalid JSON");
    }
  };

  const labFontSize = useMemo(() => {
    if (sampleLabName.length > 72) return template.labName.smallSize;
    if (sampleLabName.length > 52) return template.labName.mediumSize;
    return template.labName.largeSize;
  }, [sampleLabName.length, template.labName.largeSize, template.labName.mediumSize, template.labName.smallSize]);

  const labLines = useMemo(
    () => wrapByLength(sampleLabName, 38, template.labName.maxLines),
    [sampleLabName, template.labName.maxLines],
  );
  const addressLines = useMemo(
    () => wrapByLength(sampleAddress, 62, template.address.maxLines),
    [sampleAddress, template.address.maxLines],
  );
  const symbolLogoSrc = toPreviewLogoSrc(template.logo.symbol.file, "GlassLogo3.png");
  const wordmarkLogoSrc = toPreviewLogoSrc(template.logo.wordmark.file, "GlassLogoLettering.png");

  return (
    <section className="min-h-screen bg-[#f4f7fd] px-4 py-8">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Certificate Template Preview</h1>
            <p className="text-sm text-slate-600">
              Edit JSON and watch the preview update instantly.
            </p>
          </div>
          <Link href="/admin/labs" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-500">
            Back to Admin Labs
          </Link>
        </div>

        {(loadError || parseError) && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {parseError ? `JSON error: ${parseError}` : loadError}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-slate-300 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-700">Template JSON</h2>
              <button
                type="button"
                onClick={() => onJsonChange(JSON.stringify(defaultTemplate, null, 2))}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-500"
              >
                Reset defaults
              </button>
            </div>
            <textarea
              value={jsonText}
              onChange={event => onJsonChange(event.target.value)}
              spellCheck={false}
              className="h-[72vh] w-full rounded-xl border border-slate-200 bg-slate-950 px-3 py-3 font-mono text-xs leading-5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="rounded-2xl border border-slate-300 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-700">Live Preview</h2>
            {loading ? (
              <p className="text-sm text-slate-500">Loading template…</p>
            ) : (
              <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-3">
                <div
                  className="relative mx-auto shadow-2xl"
                  style={{
                    width: `${template.page.width}px`,
                    height: `${template.page.height}px`,
                    background: template.colors.background,
                  }}
                >
                  <div
                    className="absolute rounded-full"
                    style={{
                      width: `${template.background.leftGlow.xScale * 2}px`,
                      height: `${template.background.leftGlow.yScale * 2}px`,
                      left: `${template.background.leftGlow.x - template.background.leftGlow.xScale}px`,
                      bottom: `${template.background.leftGlow.y - template.background.leftGlow.yScale}px`,
                      background: template.colors.pastelBlue,
                      opacity: template.background.leftGlow.opacity,
                    }}
                  />
                  <div
                    className="absolute rounded-full"
                    style={{
                      width: `${template.background.rightGlow.xScale * 2}px`,
                      height: `${template.background.rightGlow.yScale * 2}px`,
                      left: `${template.background.rightGlow.x - template.background.rightGlow.xScale}px`,
                      bottom: `${template.background.rightGlow.y - template.background.rightGlow.yScale}px`,
                      background: template.colors.pastelPink,
                      opacity: template.background.rightGlow.opacity,
                    }}
                  />
                  <div
                    className="absolute rounded-full"
                    style={{
                      width: `${template.background.bottomGlow.xScale * 2}px`,
                      height: `${template.background.bottomGlow.yScale * 2}px`,
                      left: `${template.page.width / 2 - template.background.bottomGlow.xScale}px`,
                      bottom: `${template.background.bottomGlow.y - template.background.bottomGlow.yScale}px`,
                      background: template.colors.mist,
                      opacity: template.background.bottomGlow.opacity,
                    }}
                  />

                  <div
                    className="absolute"
                    style={{
                      left: `${template.card.x}px`,
                      bottom: `${template.card.y}px`,
                      width: `${template.page.width - template.card.x * 2}px`,
                      height: `${template.page.height - template.card.y * 2}px`,
                      border: `${template.card.borderWidth}px solid ${template.colors.cardBorder}`,
                      background: "#fff",
                      opacity: template.card.opacity,
                    }}
                  >
                    <div className="absolute left-0 right-1/2 top-0" style={{ height: `${template.card.topAccentHeight}px`, background: template.colors.pastelBlue }} />
                    <div className="absolute left-1/2 right-0 top-0" style={{ height: `${template.card.topAccentHeight}px`, background: template.colors.pastelPink }} />
                  </div>

                  <img
                    src={symbolLogoSrc}
                    alt="symbol"
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{ width: `${template.logo.symbol.maxWidth}px`, bottom: `${template.logo.symbol.y}px`, opacity: template.logo.symbol.opacity }}
                  />
                  <img
                    src={wordmarkLogoSrc}
                    alt="GLASS"
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{ width: `${template.logo.wordmark.maxWidth}px`, bottom: `${template.logo.wordmark.y}px`, opacity: template.logo.wordmark.opacity }}
                  />

                  <p className="absolute left-1/2 -translate-x-1/2 font-semibold" style={{ bottom: `${template.heading.titleY}px`, color: template.colors.ink, fontSize: `${template.heading.titleSize}px` }}>
                    Verification Certificate
                  </p>
                  <p className="absolute left-1/2 -translate-x-1/2" style={{ bottom: `${template.heading.subtitleY}px`, color: template.colors.subtitle, fontSize: `${template.heading.subtitleSize}px` }}>
                    Verified by GLASS
                  </p>
                  <p className="absolute left-1/2 -translate-x-1/2" style={{ bottom: `${template.heading.kickerY}px`, color: template.colors.subtitle, fontSize: `${template.heading.kickerSize}px` }}>
                    Equipment and Techniques
                  </p>

                  <p className="absolute left-1/2 -translate-x-1/2" style={{ bottom: `${template.labName.introY}px`, color: template.colors.mutedInk, fontSize: "12px" }}>
                    This certifies that
                  </p>
                  {labLines.map((line, index) => (
                    <p
                      key={`${line}-${index}`}
                      className="absolute left-1/2 -translate-x-1/2 text-center font-semibold"
                      style={{
                        bottom: `${template.labName.topY - index * (labFontSize + template.labName.lineGap)}px`,
                        color: template.colors.ink,
                        fontSize: `${labFontSize}px`,
                        maxWidth: `${template.labName.maxWidth}px`,
                      }}
                    >
                      {line}
                    </p>
                  ))}

                  <p className="absolute left-1/2 -translate-x-1/2 text-center" style={{ bottom: `${template.labName.topY - (labLines.length - 1) * (labFontSize + template.labName.lineGap) - template.labName.bodyOffset}px`, color: template.colors.mutedInk, fontSize: "12px", maxWidth: "460px" }}>
                    has been verified for equipment and techniques in the GLASS network.
                  </p>

                  <p className="absolute left-1/2 -translate-x-1/2 font-semibold" style={{ bottom: `${template.labName.topY - (labLines.length - 1) * (labFontSize + template.labName.lineGap) - template.address.labelOffset}px`, color: template.colors.subtitle, fontSize: `${template.address.labelSize}px` }}>
                    Address on file
                  </p>
                  {addressLines.map((line, index) => (
                    <p
                      key={`address-${index}`}
                      className="absolute left-1/2 -translate-x-1/2 text-center"
                      style={{
                        bottom: `${template.labName.topY - (labLines.length - 1) * (labFontSize + template.labName.lineGap) - template.address.labelOffset - 15 - index * template.address.lineGap}px`,
                        color: template.colors.mutedInk,
                        fontSize: `${template.address.textSize}px`,
                        maxWidth: `${template.address.maxWidth}px`,
                      }}
                    >
                      {line}
                    </p>
                  ))}

                  <div
                    className="absolute left-1/2 -translate-x-1/2 rounded-md border"
                    style={{
                      width: `${template.idBox.width}px`,
                      height: `${template.idBox.height}px`,
                      bottom: `${template.idBox.y}px`,
                      borderColor: template.colors.cardBorder,
                      borderWidth: `${template.idBox.borderWidth}px`,
                      background: "#f8fbff",
                    }}
                  >
                    <div className="absolute left-0 right-1/2 top-0" style={{ height: `${template.idBox.accentHeight}px`, background: template.colors.pastelBlue }} />
                    <div className="absolute left-1/2 right-0 top-0" style={{ height: `${template.idBox.accentHeight}px`, background: template.colors.pastelPink }} />
                    <p className="absolute left-1/2 -translate-x-1/2 font-semibold" style={{ bottom: `${template.idBox.labelYOffset}px`, color: template.colors.idLabel, fontSize: `${template.idBox.labelSize}px` }}>
                      GLASS-ID
                    </p>
                    <p className="absolute left-1/2 -translate-x-1/2 font-semibold tracking-wider" style={{ bottom: `${template.idBox.idYOffset}px`, color: template.colors.ink, fontSize: `${template.idBox.idSize}px` }}>
                      GLS-US-8K2M91-A93FQ2
                    </p>
                  </div>

                  <p className="absolute left-1/2 -translate-x-1/2 font-semibold" style={{ bottom: `${template.signatures.titleY}px`, color: template.colors.subtitle, fontSize: "10px" }}>
                    Signatures
                  </p>

                  {(() => {
                    const leftX = (template.page.width - template.signatures.slotWidth * 2 - template.signatures.gap) / 2;
                    const rightX = leftX + template.signatures.slotWidth + template.signatures.gap;
                    return (
                      <>
                        <p className="absolute italic text-slate-500" style={{ left: `${leftX + 20}px`, bottom: `${template.signatures.imageY + 14}px`, fontSize: "20px" }}>
                          Signature
                        </p>
                        <p className="absolute italic text-slate-500" style={{ left: `${rightX + 20}px`, bottom: `${template.signatures.imageY + 14}px`, fontSize: "20px" }}>
                          Signature
                        </p>
                        <div
                          className="absolute"
                          style={{
                            left: `${leftX}px`,
                            bottom: `${template.signatures.lineY}px`,
                            width: `${template.signatures.slotWidth}px`,
                            borderTop: `${template.signatures.lineThickness}px solid ${template.colors.signatureLine}`,
                          }}
                        />
                        <div
                          className="absolute"
                          style={{
                            left: `${rightX}px`,
                            bottom: `${template.signatures.lineY}px`,
                            width: `${template.signatures.slotWidth}px`,
                            borderTop: `${template.signatures.lineThickness}px solid ${template.colors.signatureLine}`,
                          }}
                        />
                        <p className="absolute font-semibold" style={{ left: `${leftX}px`, bottom: `${template.signatures.lineY - template.signatures.nameGap}px`, color: template.colors.ink, fontSize: `${template.signatures.nameSize}px` }}>
                          Lab Representative
                        </p>
                        <p className="absolute font-semibold" style={{ left: `${rightX}px`, bottom: `${template.signatures.lineY - template.signatures.nameGap}px`, color: template.colors.ink, fontSize: `${template.signatures.nameSize}px` }}>
                          GLASS Admin
                        </p>
                        <p className="absolute" style={{ left: `${leftX}px`, bottom: `${template.signatures.lineY - template.signatures.titleGap}px`, color: template.colors.mutedInk, fontSize: `${template.signatures.titleSize}px` }}>
                          Director
                        </p>
                        <p className="absolute" style={{ left: `${rightX}px`, bottom: `${template.signatures.lineY - template.signatures.titleGap}px`, color: template.colors.mutedInk, fontSize: `${template.signatures.titleSize}px` }}>
                          GLASS Verification Team
                        </p>
                      </>
                    );
                  })()}

                  <p className="absolute left-1/2 -translate-x-1/2 text-center" style={{ bottom: `${template.footer.y}px`, color: template.colors.footer, fontSize: `${template.footer.size}px`, maxWidth: "500px" }}>
                    {template.footer.text}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
