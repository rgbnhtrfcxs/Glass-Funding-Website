import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_SMOOTH = [0.2, 0.8, 0.2, 1] as const;
const ETCHED_LABEL_CLASS =
  "text-slate-500 [text-shadow:0_1px_0_rgba(255,255,255,0.92),0_-1px_0_rgba(100,116,139,0.22)]";
const ETCHED_TEXT_CLASS =
  "text-slate-600 [text-shadow:0_1px_0_rgba(255,255,255,0.94),0_-1px_0_rgba(71,85,105,0.22)]";

type GlassIdStatus = "active" | "suspended" | "revoked";

type GlassIdCardData = {
  glassId: string;
  labName: string;
  location?: string | null;
  countryCode?: string | null;
  isActive?: boolean;
  revokedAt?: string | null;
  issuedAt?: string | null;
};

type GlassIdCardProps = {
  data: GlassIdCardData;
  variant?: "info" | "issuance";
  className?: string;
  showFullId?: boolean;
  autoPlayIssuance?: boolean;
  issued?: boolean;
  onRevealComplete?: () => void;
};

function deriveStatus(data: GlassIdCardData): GlassIdStatus {
  if (data.revokedAt) return "revoked";
  if (data.isActive === false) return "suspended";
  return "active";
}

function getStatusCopy(status: GlassIdStatus) {
  if (status === "active") {
    return {
      label: "Active",
      className: "border-emerald-500/35 bg-emerald-100/80 text-emerald-700",
      Icon: ShieldCheck,
    };
  }

  return {
    label: status === "revoked" ? "Revoked" : "Suspended",
    className: "border-rose-400/35 bg-rose-100/80 text-rose-700",
    Icon: ShieldX,
  };
}

function maskGlassId(glassId: string) {
  if (!glassId) return "";
  const compact = glassId.trim();
  if (compact.length <= 8) return compact;
  const head = compact.slice(0, 8);
  const tail = compact.slice(-2);
  return `${head}-****${tail}`;
}

export function GlassIdCard({
  data,
  variant = "info",
  className,
  showFullId = false,
  autoPlayIssuance = false,
  issued = false,
  onRevealComplete,
}: GlassIdCardProps) {
  const reduceMotion = useReducedMotion();
  const [isFlipped, setIsFlipped] = useState(false);
  const [manualTurning, setManualTurning] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const flipTimeoutRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<"hidden" | "front" | "glow" | "flip" | "revealed">(
    variant === "issuance"
      ? (issued || autoPlayIssuance ? "hidden" : "front")
      : "revealed",
  );

  useEffect(() => {
    if (variant !== "issuance") return;
    if (!issued && !autoPlayIssuance) {
      setPhase("front");
      setIsFlipped(false);
      return;
    }

    if (reduceMotion) {
      setPhase("revealed");
      setIsFlipped(true);
      onRevealComplete?.();
      return;
    }

    let cancelled = false;
    setPhase("hidden");
    setIsFlipped(false);

    const sequence = async () => {
      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      setPhase("front");
      await wait(350);
      if (cancelled) return;

      setPhase("glow");
      await wait(750);
      if (cancelled) return;

      setPhase("flip");
      setIsFlipped(true);
      await wait(820);
      if (cancelled) return;

      setPhase("revealed");
      onRevealComplete?.();
    };

    void sequence();

    return () => {
      cancelled = true;
    };
  }, [autoPlayIssuance, issued, onRevealComplete, reduceMotion, variant]);

  useEffect(() => {
    return () => {
      if (flipTimeoutRef.current && typeof window !== "undefined") {
        window.clearTimeout(flipTimeoutRef.current);
      }
    };
  }, []);

  const status = deriveStatus(data);
  const statusCopy = getStatusCopy(status);

  const displayId = useMemo(() => {
    return showFullId ? data.glassId : maskGlassId(data.glassId);
  }, [data.glassId, showFullId]);

  const location = data.location || data.countryCode || "Location available in profile";
  const flipDuration = reduceMotion ? 0.2 : variant === "issuance" ? 0.75 : 0.6;
  const isIssuanceTurning = phase === "flip";
  const isTurning = manualTurning || isIssuanceTurning;

  const cardOpacity = phase === "hidden" ? 0 : 1;
  const cardScale = phase === "hidden" ? 0.96 : 1;
  const glowOpacity = phase === "glow" ? 0.95 : 0.38;

  const shouldStagger = variant === "issuance" && !reduceMotion;

  const triggerInfoFlip = () => {
    if (variant === "issuance") return;

    if (flipTimeoutRef.current && typeof window !== "undefined") {
      window.clearTimeout(flipTimeoutRef.current);
      flipTimeoutRef.current = null;
    }

    if (!reduceMotion) {
      setManualTurning(true);
    }

    setIsFlipped(prev => !prev);

    if (!reduceMotion && typeof window !== "undefined") {
      flipTimeoutRef.current = window.setTimeout(() => {
        setManualTurning(false);
        flipTimeoutRef.current = null;
      }, Math.round(flipDuration * 1000) + 120);
    }
  };

  return (
    <div
      className={cn("relative w-full max-w-md", className)}
      style={{ perspective: "1200px" }}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <motion.div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[36px] bg-[radial-gradient(circle_at_82%_18%,rgba(56,189,248,0.32),transparent_46%),radial-gradient(circle_at_14%_84%,rgba(244,114,182,0.28),transparent_52%)] blur-2xl"
        animate={{
          opacity: isTurning ? 0.56 : isFlipped ? 0.34 : 0.16,
          scale: isTurning ? 1.06 : 1,
        }}
        transition={{ duration: 0.28, ease: EASE_OUT }}
      />
      <motion.div
        className="relative h-[250px] w-full rounded-[28px]"
        animate={
          reduceMotion
            ? { rotateX: 0, rotateY: 0 }
            : {
                rotateX: tilt.x,
                rotateY: tilt.y,
                transition: { duration: 0.25, ease: EASE_OUT },
              }
        }
        onMouseMove={event => {
          if (variant !== "info" || reduceMotion) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const px = (event.clientX - rect.left) / rect.width - 0.5;
          const py = (event.clientY - rect.top) / rect.height - 0.5;
          setTilt({
            x: py * -8,
            y: px * 12,
          });
        }}
      >
        <motion.button
          type="button"
          className="relative h-full w-full rounded-[28px] text-left"
          initial={false}
          animate={{
            opacity: cardOpacity,
            scale: cardScale,
            rotateY: isFlipped ? 180 : 0,
          }}
          transition={{
            rotateY: { duration: flipDuration, ease: EASE_SMOOTH },
            opacity: { duration: 0.35, ease: EASE_OUT },
            scale: { duration: 0.35, ease: EASE_OUT },
          }}
          style={{ transformStyle: "preserve-3d" }}
          onClick={triggerInfoFlip}
          onKeyDown={event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            triggerInfoFlip();
          }}
          aria-label="Flip GLASS-ID card"
        >
          <div
            className="absolute inset-0 overflow-hidden rounded-[28px] border border-white/80 bg-gradient-to-br from-[#f8fafc] via-[#e2e8f0] to-[#cbd5e1] p-6 shadow-[0_24px_60px_-32px_rgba(71,85,105,0.7)]"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.84),transparent_56%),radial-gradient(circle_at_82%_86%,rgba(148,163,184,0.28),transparent_52%)]" />
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 text-center">
              <img src="/GlassLogo5.png" alt="GLASS" className="h-16 w-auto opacity-80 saturate-0" />
              <p className={cn("text-sm font-semibold tracking-[0.36em]", ETCHED_TEXT_CLASS)}>GLASS-ID</p>
            </div>
          </div>

          <div
            className="absolute inset-0 overflow-hidden rounded-[28px] border border-white/80 bg-gradient-to-br from-[#f5f7fb] via-[#e5e7eb] to-[#d1d5db] p-6 shadow-[0_24px_60px_-32px_rgba(71,85,105,0.7)]"
            style={{
              transform: "rotateY(180deg)",
              backfaceVisibility: "hidden",
            }}
          >
            <motion.div
              className="pointer-events-none absolute inset-0"
              animate={{ opacity: isTurning ? 0.4 : 0.28 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
              style={{
                background:
                  "radial-gradient(circle at 85% 20%, rgba(56,189,248,0.35), transparent 52%), radial-gradient(circle at 15% 85%, rgba(244,114,182,0.28), transparent 50%)",
              }}
            />
            <div className="relative z-10 flex h-full flex-col">
              <motion.p
                className={cn("text-[11px] uppercase tracking-[0.28em]", ETCHED_LABEL_CLASS)}
                animate={{ opacity: 1, y: 0 }}
                initial={shouldStagger ? { opacity: 0, y: 6 } : false}
                transition={shouldStagger ? { delay: 0.12, duration: 0.35, ease: EASE_OUT } : undefined}
              >
                GLASS-ID
              </motion.p>
              <motion.p
                className={cn("mt-2 text-2xl font-semibold tracking-[0.08em]", ETCHED_TEXT_CLASS)}
                animate={{ opacity: 1, y: 0 }}
                initial={shouldStagger ? { opacity: 0, y: 8 } : false}
                transition={shouldStagger ? { delay: 0.2, duration: 0.4, ease: EASE_OUT } : undefined}
              >
                {displayId}
              </motion.p>

              <div className="mt-7 space-y-3 border-t border-white/15 pt-4">
                <motion.p
                  className={cn("text-sm font-semibold", ETCHED_TEXT_CLASS)}
                  animate={{ opacity: 1, y: 0 }}
                  initial={shouldStagger ? { opacity: 0, y: 8 } : false}
                  transition={shouldStagger ? { delay: 0.3, duration: 0.35, ease: EASE_OUT } : undefined}
                >
                  {data.labName}
                </motion.p>
                <motion.p
                  className={cn("text-sm", ETCHED_LABEL_CLASS)}
                  animate={{ opacity: 1, y: 0 }}
                  initial={shouldStagger ? { opacity: 0, y: 8 } : false}
                  transition={shouldStagger ? { delay: 0.38, duration: 0.35, ease: EASE_OUT } : undefined}
                >
                  {location}
                </motion.p>
              </div>

              <motion.div
                className="mt-auto flex items-center justify-between"
                animate={{ opacity: 1, y: 0 }}
                initial={shouldStagger ? { opacity: 0, y: 8 } : false}
                transition={shouldStagger ? { delay: 0.46, duration: 0.35, ease: EASE_OUT } : undefined}
              >
                <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", statusCopy.className)}>
                  <statusCopy.Icon className="h-3.5 w-3.5" />
                  {statusCopy.label}
                </span>
                {data.issuedAt ? (
                  <span className={cn("text-xs", ETCHED_LABEL_CLASS)}>
                    Issued {new Date(data.issuedAt).toLocaleDateString()}
                  </span>
                ) : null}
              </motion.div>
            </div>
          </div>
        </motion.button>
      </motion.div>
    </div>
  );
}

export type { GlassIdCardData, GlassIdCardProps };
