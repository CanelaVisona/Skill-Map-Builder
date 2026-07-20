import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";
import { calculateAreaLevel, calculateAreaProgressPercentage } from "@/lib/area-progress";
import { usePopupPalette } from "@/lib/popup-theme";

import type { AreaXpPopupSnapshot } from "@/lib/area-xp-popup-context";

interface AreaLevelGainPopupProps {
  snapshot: AreaXpPopupSnapshot | null;
  onClose: () => void;
}

export function AreaLevelGainPopup({ snapshot, onClose }: AreaLevelGainPopupProps) {
  const palette = usePopupPalette();

  if (!snapshot || typeof document === "undefined") {
    return null;
  }

  const progressBefore = snapshot.progressBeforePct;
  const progressAfter = snapshot.progressAfterPct;

  const getLevelColorHex = (level: number): string => {
    const colors: { [key: number]: string } = {
      1: "#bbf7d0",
      2: "#86efac",
      3: "#4ade80",
      4: "#22c55e",
      5: "#16a34a",
      6: "#15803d",
      7: "#166534",
      8: "#14532d",
    };
    return colors[level] || "#22c55e";
  };

  const level = calculateAreaLevel(snapshot.currentXp ?? 0);

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="area-level-gain-popup"
        className="fixed inset-0 z-[260]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          type="button"
          aria-label="Cerrar popup de progreso de área"
          className="absolute inset-0 cursor-default bg-transparent"
          onClick={onClose}
        />

        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translateX(-50%) translateY(-50%)",
            zIndex: 9999,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="w-[min(92vw,356px)] rounded-[4px] border px-[16px] py-[14px] shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
            style={{
              backgroundColor: palette.bg,
              borderColor: palette.border,
            }}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full">
                  <polygon
                    points="16,2 30,16 16,30 2,16"
                    fill={palette.surfaceInset}
                    stroke={snapshot.areaColor}
                    strokeWidth="1.5"
                  />
                </svg>
                <Sparkles className="relative h-4 w-4" style={{ color: snapshot.areaColor }} strokeWidth={2.1} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium" style={{ color: palette.text }}>{snapshot.scopeName}</div>
                <div className="truncate text-[10px] uppercase tracking-[0.12em]" style={{ color: palette.textMuted }}>
                  Area progress boosted
                </div>
              </div>

              <div
                className="shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                style={{ borderColor: palette.border, backgroundColor: palette.surfaceInset, color: palette.text }}
              >
                +{snapshot.bonusXp}
              </div>
            </div>

            <div className="mt-3 text-center text-[13px] font-medium" style={{ color: palette.text }}>
              +{snapshot.bonusXp} XP
            </div>

            <div className="mt-3">
              {/* Barra dividida en 15 bloques */}
              <div className="w-full h-4 flex gap-0.5 rounded-sm">
                {Array.from({ length: 15 }).map((_, i) => {
                  const totalBlocks = 15;
                  const filledBlocks = Math.round((progressAfter / 100) * totalBlocks);
                  const prevFilledBlocks = Math.round((progressBefore / 100) * totalBlocks);
                  const isAlreadyFilled = i < prevFilledBlocks;
                  const isNewlyFilled = i >= prevFilledBlocks && i < filledBlocks;

                  return (
                    <div key={i} className="flex-1 h-full overflow-hidden rounded-sm" style={{ backgroundColor: palette.blockEmpty }}>
                      {isAlreadyFilled && (
                        <div style={{ width: '100%', height: '100%', backgroundColor: getLevelColorHex(level) }} />
                      )}

                      {isNewlyFilled && (
                        <div className="h-full w-full overflow-hidden">
                          <motion.div
                            initial={{ width: '0%' }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1], delay: (i - prevFilledBlocks) * 0.12 }}
                            style={{ height: '100%', backgroundColor: getLevelColorHex(level) }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between text-[9px]" style={{ color: palette.textDim }}>
                <span>{progressBefore.toFixed(0)}%</span>
                <span>{progressAfter.toFixed(0)}%</span>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
