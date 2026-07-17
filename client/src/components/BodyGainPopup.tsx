import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { BicepsFlexed } from "lucide-react";
import { useEffect, useState } from "react";
import {
  BODY_BLOCKS,
  BODY_DIMENSION_LABELS,
  BODY_ZONE_LABELS,
  type BodyDimension,
  type BodyZone,
  type ZoneProgress,
} from "@/lib/body-progress-context";

export interface BodyGainSnapshot {
  zone: BodyZone;
  dimension: BodyDimension;
  before: ZoneProgress;
  after: ZoneProgress;
}

interface BodyGainPopupProps {
  snapshot: BodyGainSnapshot | null;
  onClose: () => void;
}

const PALETTES: Record<BodyDimension, [string, string, string]> = {
  fuerza: ["#0E7A45", "#37D17A", "#A8FFC4"],
  flex: ["#1B4FA8", "#3B9BFF", "#A8DCFF"],
};

function blockGradient(dimension: BodyDimension, index: number, total: number) {
  const [c1, c2, c3] = PALETTES[dimension];
  const t = total > 1 ? index / (total - 1) : 0;
  const topMix = Math.round(t * 70);
  const bottomMix = Math.round(t * 80);
  return `linear-gradient(180deg, color-mix(in srgb, ${c3} ${topMix}%, ${c2}), color-mix(in srgb, ${c2} ${bottomMix}%, ${c1}))`;
}

export function BodyGainPopup({ snapshot, onClose }: BodyGainPopupProps) {
  const [displayBlocks, setDisplayBlocks] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [barTransitionMs, setBarTransitionMs] = useState(1000);
  const [animationStage, setAnimationStage] = useState<"initial" | "fill" | "afterReset">("initial");

  useEffect(() => {
    if (!snapshot) {
      setDisplayBlocks(0);
      setShowLevelUp(false);
      setBarTransitionMs(1000);
      return;
    }

    const { before, after } = snapshot;
    const leveledUp = after.lvl > before.lvl;
    const cleanupTimers: number[] = [];

    setShowLevelUp(false);
    setBarTransitionMs(1000);
    setDisplayBlocks(before.val);
    setAnimationStage("initial");

    const rafId = window.requestAnimationFrame(() => {
      if (!leveledUp) {
        setDisplayBlocks(after.val);
        setAnimationStage("fill");
        return;
      }

      setDisplayBlocks(BODY_BLOCKS);
      setAnimationStage("fill");

      const firstTimer = window.setTimeout(() => {
        setBarTransitionMs(0);
        setDisplayBlocks(0);
        setAnimationStage("afterReset");

        const secondTimer = window.setTimeout(() => {
          setShowLevelUp(true);
        }, 0);

        const thirdTimer = window.setTimeout(() => {
          setBarTransitionMs(1000);
          setDisplayBlocks(after.val);
        }, 30);

        cleanupTimers.push(secondTimer, thirdTimer);
      }, 1200);

      cleanupTimers.push(firstTimer);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      cleanupTimers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    const closeTimer = window.setTimeout(onClose, 7500);
    return () => window.clearTimeout(closeTimer);
  }, [snapshot, onClose]);

  if (!snapshot || typeof document === "undefined") {
    return null;
  }

  const { zone, dimension, before, after } = snapshot;
  const leveledUp = after.lvl > before.lvl;
  const useResetAnimation = animationStage === "afterReset";
  const [, accentColor] = PALETTES[dimension];

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="body-gain-popup"
        className="fixed inset-0 z-[260] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* No full-screen click-catcher here on purpose: this popup shows while the
            skill-node step-2 popover is still open and in active use (dropdown, tabs,
            repeated "Agregar" clicks). A blocking backdrop would eat the user's next
            click instead of letting it reach the popover underneath. Dismissal is via
            the timer below and the explicit hide calls from the XP flow. */}
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translateX(-50%) translateY(-50%)",
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="w-[min(92vw,356px)] rounded-[4px] border px-[16px] py-[14px] shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
            style={{
              backgroundColor: "#0e0c0a",
              borderColor: "#3a2a14",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full">
                  <polygon
                    points="16,2 30,16 16,30 2,16"
                    fill="#15110b"
                    stroke={accentColor}
                    strokeWidth="1.5"
                  />
                </svg>
                <BicepsFlexed className="relative h-4 w-4" style={{ color: accentColor }} strokeWidth={2.1} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[#c8a96e]">
                  {BODY_ZONE_LABELS[zone]} · {BODY_DIMENSION_LABELS[dimension]}
                </div>
              </div>

              <div
                className="shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#c8a96e]"
                style={{ borderColor: "#3a2a14", backgroundColor: "#15110b" }}
              >
                Lv {after.lvl}
              </div>
            </div>

            <div className="mt-3">
              <div className="w-full h-4 flex gap-0.5 rounded-sm">
                {Array.from({ length: BODY_BLOCKS }).map((_, index) => {
                  const isFilledBefore = !useResetAnimation && index < before.val;
                  const isNewlyFilled = useResetAnimation
                    ? index < displayBlocks
                    : index >= before.val && index < displayBlocks;

                  return (
                    <div key={index} className="flex-1 h-full overflow-hidden rounded-sm bg-[#1e180e]">
                      {isFilledBefore && (
                        <div
                          style={{ width: "100%", height: "100%", background: blockGradient(dimension, index, BODY_BLOCKS) }}
                        />
                      )}

                      {isNewlyFilled && (
                        <div className="h-full w-full overflow-hidden">
                          <motion.div
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{
                              duration: barTransitionMs > 0 ? barTransitionMs / 1000 : 0,
                              ease: [0.4, 0, 0.2, 1],
                              delay: (index - before.val) * 0.12,
                            }}
                            style={{ height: "100%", background: blockGradient(dimension, index, BODY_BLOCKS) }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between text-[9px] text-[#5a4a2a]">
                <span>
                  {after.val} / {BODY_BLOCKS}
                </span>
                <span>{`Lv${after.lvl + 1}`}</span>
              </div>

              <AnimatePresence>
                {showLevelUp && leveledUp && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-2 inline-flex rounded-[3px] border px-[10px] py-[4px] text-[11px] font-medium text-[#c8a96e]"
                    style={{
                      backgroundColor: "#1a1208",
                      borderColor: "#c8a96e",
                      borderWidth: "0.5px",
                    }}
                  >
                    ¡Nivel {after.lvl} alcanzado!
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
