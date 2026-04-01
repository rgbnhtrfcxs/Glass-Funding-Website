import { useRef, useState } from "react";
import { X } from "lucide-react";
import type { LogoCropParams } from "@/lib/logoUtils";

interface LogoCropModalProps {
  open: boolean;
  logoUrl: string;
  entityName: string;
  entitySubtitle?: string;
  initialParams?: Partial<LogoCropParams>;
  onClose: () => void;
  /** Called with the current crop params when the user clicks Done. */
  onApply: (params: LogoCropParams) => void;
}

export function LogoCropModal({
  open,
  logoUrl,
  entityName,
  entitySubtitle,
  initialParams,
  onClose,
  onApply,
}: LogoCropModalProps) {
  const [scale, setScale] = useState(initialParams?.scale ?? 1);
  const [offsetX, setOffsetX] = useState(initialParams?.offsetX ?? 0);
  const [offsetY, setOffsetY] = useState(initialParams?.offsetY ?? 0);
  const [framePadding, setFramePadding] = useState(initialParams?.framePadding ?? 6);
  const [frameColor, setFrameColor] = useState<"white" | "black" | "custom">(
    initialParams?.frameColor ?? "white",
  );
  const [frameCustomColor, setFrameCustomColor] = useState(
    initialParams?.frameCustomColor ?? "#dbeafe",
  );

  const dragRef = useRef<{
    x: number;
    y: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
  } | null>(null);
  const editorFrameRef = useRef<HTMLDivElement | null>(null);

  const previewTransform = `translate(${offsetX}%, ${offsetY}%) scale(${scale})`;
  const validatedCustomColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(frameCustomColor)
    ? frameCustomColor
    : "#dbeafe";
  const frameBackgroundColor =
    frameColor === "black"
      ? "#000000"
      : frameColor === "custom"
        ? validatedCustomColor
        : "#ffffff";
  const framePaddingRatio = Math.max(0, Math.min(0.45, framePadding / 224));
  const framePaddingPercent = `${(framePaddingRatio * 100).toFixed(2)}%`;

  function handleReset() {
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
    setFramePadding(6);
    setFrameColor("white");
    setFrameCustomColor("#dbeafe");
  }

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    const rect = editorFrameRef.current?.getBoundingClientRect();
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      originX: offsetX,
      originY: offsetY,
      width: rect?.width || 1,
      height: rect?.height || 1,
    };
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    const nextX = dragRef.current.originX + (dx / dragRef.current.width) * 100;
    const nextY = dragRef.current.originY + (dy / dragRef.current.height) * 100;
    setOffsetX(Math.max(-50, Math.min(50, Number(nextX.toFixed(1)))));
    setOffsetY(Math.max(-50, Math.min(50, Number(nextY.toFixed(1)))));
  }

  function handleMouseUp() {
    dragRef.current = null;
  }

  function handleDone() {
    onApply({ scale, offsetX, offsetY, framePadding, frameColor, frameCustomColor });
    onClose();
  }

  if (!open || !logoUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/52 px-4 py-8">
      <div className="w-full max-w-3xl rounded-3xl border border-white/45 bg-white/62 p-6 shadow-2xl backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Logo preview</h2>
            <p className="mt-1 text-sm text-slate-700">
              Preview how the logo avatar appears, then drag or use the sliders to adjust.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-white/70 text-slate-700 transition hover:border-primary hover:text-primary"
            aria-label="Close logo preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
          {/* Left: preview + editor */}
          <div className="rounded-2xl border border-white/50 bg-white/56 p-4 backdrop-blur-lg">
            <p className="text-xs font-medium text-slate-700">Avatar preview</p>
            {/* Small card preview */}
            <div className="mt-3 rounded-2xl border border-white/55 bg-white/72 p-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="size-14 min-h-14 min-w-14 max-h-14 max-w-14 shrink-0 overflow-hidden rounded-full border-2 border-blue-400/80 bg-muted">
                  <div
                    className="h-full w-full overflow-hidden rounded-full"
                    style={{
                      padding: framePaddingPercent,
                      backgroundColor: frameBackgroundColor,
                      clipPath: "circle(50% at 50% 50%)",
                    }}
                  >
                    <img
                      src={logoUrl}
                      alt={`${entityName} logo preview`}
                      draggable={false}
                      className="h-full w-full rounded-full object-cover"
                      style={{
                        transform: previewTransform,
                        transformOrigin: "center center",
                        clipPath: "circle(50% at 50% 50%)",
                      }}
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {entityName || "Your organization"}
                  </p>
                  {entitySubtitle && (
                    <p className="truncate text-xs text-slate-700">{entitySubtitle}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Drag editor */}
            <div className="relative mx-auto mt-4 h-56 w-56 rounded-2xl border border-white/55 bg-white/50 p-2 backdrop-blur-md">
              <div
                ref={editorFrameRef}
                className="relative h-full w-full overflow-hidden rounded-full border-2 border-primary/80 cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <div
                  className="h-full w-full overflow-hidden rounded-full"
                  style={{
                    padding: framePaddingPercent,
                    backgroundColor: frameBackgroundColor,
                    clipPath: "circle(50% at 50% 50%)",
                  }}
                >
                  <img
                    src={logoUrl}
                    alt={`${entityName} logo editor`}
                    draggable={false}
                    className="h-full w-full rounded-full object-cover"
                    style={{
                      transform: previewTransform,
                      transformOrigin: "center center",
                      clipPath: "circle(50% at 50% 50%)",
                    }}
                  />
                </div>
                <div
                  className="pointer-events-none absolute inset-0 opacity-45"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, rgba(15,23,42,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.12) 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                  }}
                />
              </div>
              <span className="pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2 rounded-full border border-white/70 bg-white/75 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                Exact avatar crop area
              </span>
            </div>
          </div>

          {/* Right: controls */}
          <div className="rounded-2xl border border-white/50 bg-white/56 p-4 backdrop-blur-lg">
            <p className="text-xs font-medium text-slate-700">Adjust image</p>
            <div className="mt-3 space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
                  <span>Zoom</span>
                  <span>{scale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={2.5}
                  step={0.01}
                  value={scale}
                  onChange={e => setScale(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
                  <span>Horizontal</span>
                  <span>{offsetX}%</span>
                </div>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={0.1}
                  value={offsetX}
                  onChange={e => setOffsetX(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
                  <span>Vertical</span>
                  <span>{offsetY}%</span>
                </div>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={0.1}
                  value={offsetY}
                  onChange={e => setOffsetY(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-700">
                  <span>Frame thickness</span>
                  <span>
                    {framePadding}px ({Math.round(framePaddingRatio * 100)}%)
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={1}
                  value={framePadding}
                  onChange={e => setFramePadding(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-700">Frame color</p>
                <div className="flex items-center gap-2">
                  {(["white", "black", "custom"] as const).map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFrameColor(color)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
                        frameColor === color
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-300 bg-white/80 text-slate-700 hover:border-primary/60"
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-slate-400"
                        style={{
                          backgroundColor:
                            color === "white"
                              ? "#ffffff"
                              : color === "black"
                                ? "#000000"
                                : frameCustomColor,
                          borderColor: color === "white" ? "#cbd5e1" : color === "black" ? "#64748b" : "#94a3b8",
                        }}
                      />
                      {color.charAt(0).toUpperCase() + color.slice(1)}
                    </button>
                  ))}
                </div>
                {frameColor === "custom" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="color"
                      value={frameCustomColor}
                      onChange={e => setFrameCustomColor(e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                      aria-label="Choose custom frame color"
                    />
                    <input
                      type="text"
                      value={frameCustomColor}
                      onChange={e => setFrameCustomColor(e.target.value)}
                      className="h-8 w-28 rounded border border-slate-300 bg-white/90 px-2 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      placeholder="#RRGGBB"
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary hover:text-primary"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleDone}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
