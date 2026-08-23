import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { OctagonAlert, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect } from "react";
import { usePopupPalette } from "@/lib/popup-theme";
import { playProgressAdvanceSound, playBugLossSound } from "@/lib/sound";

// 5 bloques de 10 puntos cada uno = barra de 0 a 50, misma cuadrícula visual que BugProgressPopup.
export const ERROR_PROGRESS_BLOCKS = 5;
export const ERROR_POINTS_PER_BLOCK = 10;

export const ERROR_POPUP_VISIBLE_MS = 2600;

export interface ErrorProgressSnapshot {
  errorName: string;
  pointsBefore: number;
  pointsAfter: number;
}

interface ErrorProgressPopupProps {
  snapshot: ErrorProgressSnapshot | null;
  onClose: () => void;
}

// A diferencia de los bugs (donde subir la barra es la victoria), acá subir puntos es que el
// error empeora -- así que el color de "crece" es de alarma y el de "baja" es de alivio.
const BAR_COLOR = "#ef4444";
const UP_COLOR = "#ef4444";
const DOWN_COLOR = "#2ecc2e";

export function ErrorProgressPopup({ snapshot, onClose }: ErrorProgressPopupProps) {
  const palette = usePopupPalette();

  useEffect(() => {
    if (!snapshot) return;
    const closeTimer = window.setTimeout(onClose, ERROR_POPUP_VISIBLE_MS);
    return () => window.clearTimeout(closeTimer);
  }, [snapshot, onClose]);

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.pointsAfter > snapshot.pointsBefore) {
      playProgressAdvanceSound();
    } else if (snapshot.pointsAfter < snapshot.pointsBefore) {
      playBugLossSound();
    }
  }, [snapshot]);

  if (!snapshot || typeof document === "undefined") {
    return null;
  }

  const { errorName, pointsBefore, pointsAfter } = snapshot;
  const blocksBefore = Math.min(ERROR_PROGRESS_BLOCKS, Math.round(pointsBefore / ERROR_POINTS_PER_BLOCK));
  const blocksAfter = Math.min(ERROR_PROGRESS_BLOCKS, Math.round(pointsAfter / ERROR_POINTS_PER_BLOCK));
  const increasing = blocksAfter > blocksBefore;
  const decreasing = blocksAfter < blocksBefore;
  const delta = pointsAfter - pointsBefore;
  const directionColor = increasing ? UP_COLOR : decreasing ? DOWN_COLOR : palette.textDim;
  const staticFilled = Math.min(blocksBefore, blocksAfter);

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="error-progress-popup"
        className="fixed inset-0 z-[260] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} />

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
                    stroke={BAR_COLOR}
                    strokeWidth="1.5"
                  />
                </svg>
                <OctagonAlert className="relative h-4 w-4" style={{ color: BAR_COLOR }} strokeWidth={2.1} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium" style={{ color: palette.text }}>
                  {delta > 0 ? `+${delta}p en ${errorName}` : `${delta}p en ${errorName}`}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-2 text-[13px] font-medium" style={{ color: palette.text }}>
              <span>{pointsBefore} → {pointsAfter}</span>
              {delta !== 0 && (
                <span className="inline-flex items-center gap-0.5" style={{ color: directionColor }}>
                  {increasing ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              )}
            </div>

            <div className="mt-3">
              <div className="w-full h-4 flex gap-0.5 rounded-sm">
                {Array.from({ length: ERROR_PROGRESS_BLOCKS }).map((_, index) => {
                  const isStaticFilled = index < staticFilled;
                  const isGrowing = increasing && index >= blocksBefore && index < blocksAfter;
                  const isShrinking = decreasing && index >= blocksAfter && index < blocksBefore;

                  return (
                    <div key={index} className="flex-1 h-full overflow-hidden rounded-sm" style={{ backgroundColor: palette.blockEmpty }}>
                      {isStaticFilled && (
                        <div style={{ width: "100%", height: "100%", backgroundColor: BAR_COLOR }} />
                      )}

                      {isGrowing && (
                        <motion.div
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{
                            duration: 0.6,
                            ease: [0.4, 0, 0.2, 1],
                            delay: (index - blocksBefore) * 0.12,
                          }}
                          style={{ height: "100%", backgroundColor: UP_COLOR }}
                        />
                      )}

                      {isShrinking && (
                        <motion.div
                          initial={{ y: 0, opacity: 1 }}
                          animate={{ y: 20, opacity: 0 }}
                          transition={{
                            duration: 0.45,
                            ease: [0.4, 0, 1, 1],
                            delay: 0.15 + (blocksBefore - 1 - index) * 0.12,
                          }}
                          style={{ width: "100%", height: "100%", backgroundColor: DOWN_COLOR }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between text-[9px]" style={{ color: palette.textDim }}>
                <span>{pointsAfter} / 50</span>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
