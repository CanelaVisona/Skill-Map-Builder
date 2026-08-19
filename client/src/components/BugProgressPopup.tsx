import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Bug, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect } from "react";
import { usePopupPalette } from "@/lib/popup-theme";
import { playProgressAdvanceSound, playBugLossSound } from "@/lib/sound";

export const BUG_PROGRESS_BLOCKS = 5;

// Bug victories get a longer beat than the rest of the "growing progress" popup family: the
// block-fall animation on a derrota needs time to actually play out before the popup closes.
export const BUG_POPUP_VISIBLE_MS = 2600;

export type BugRecordStatus = "identificado" | "debugueando" | "debugueado";

export interface BugProgressSnapshot {
  bugName: string;
  victoryCountBefore: number;
  victoryCountAfter: number;
  statusBefore: BugRecordStatus;
  statusAfter: BugRecordStatus;
  resultado: "victoria" | "empate" | "derrota";
}

interface BugProgressPopupProps {
  snapshot: BugProgressSnapshot | null;
  onClose: () => void;
}

const STATUS_LABEL: Record<BugRecordStatus, string> = {
  identificado: "Identificado",
  debugueando: "Debugueando",
  debugueado: "Debugueado",
};

const RESULT_LABEL: Record<BugProgressSnapshot["resultado"], string> = {
  victoria: "Victoria",
  empate: "Empate",
  derrota: "Derrota",
};

const BAR_COLOR = "#10b981";
const UP_COLOR = "#2ecc2e";
const DOWN_COLOR = "#e0524f";

export function BugProgressPopup({ snapshot, onClose }: BugProgressPopupProps) {
  const palette = usePopupPalette();

  useEffect(() => {
    if (!snapshot) return;
    const closeTimer = window.setTimeout(onClose, BUG_POPUP_VISIBLE_MS);
    return () => window.clearTimeout(closeTimer);
  }, [snapshot, onClose]);

  // The victory bar's fill animation starts as soon as this mounts (via framer's initial/
  // animate props below), so this fires right alongside it -- only on a win, not a loss.
  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.victoryCountAfter > snapshot.victoryCountBefore) {
      playProgressAdvanceSound();
    } else if (snapshot.victoryCountAfter < snapshot.victoryCountBefore) {
      playBugLossSound();
    }
  }, [snapshot]);

  if (!snapshot || typeof document === "undefined") {
    return null;
  }

  const { bugName, victoryCountBefore, victoryCountAfter, statusBefore, statusAfter, resultado } = snapshot;
  const increasing = victoryCountAfter > victoryCountBefore;
  const decreasing = victoryCountAfter < victoryCountBefore;
  const delta = victoryCountAfter - victoryCountBefore;
  const directionColor = increasing ? UP_COLOR : decreasing ? DOWN_COLOR : palette.textDim;
  const justFixed = statusAfter === "debugueado" && statusBefore !== "debugueado";
  const staticFilled = Math.min(victoryCountBefore, victoryCountAfter);

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="bug-progress-popup"
        className="fixed inset-0 z-[260] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Sin click-catcher a pantalla completa, igual que BodyGainPopup: este pop-up
            puede convivir con el modal de bugs abierto, y no debe robarle el próximo
            click al usuario. Se cierra solo por el timer de arriba. El fondo oscuro de
            abajo es solo visual (pointer-events: none), no afecta esto. */}
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
                <Bug className="relative h-4 w-4" style={{ color: BAR_COLOR }} strokeWidth={2.1} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium" style={{ color: palette.text }}>
                  {bugName}
                </div>
              </div>

              <div
                className="shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                style={{ borderColor: palette.border, backgroundColor: palette.surfaceInset, color: palette.text }}
              >
                {STATUS_LABEL[statusAfter]}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-2 text-[13px] font-medium" style={{ color: palette.text }}>
              <span>{victoryCountBefore} → {victoryCountAfter}</span>
              {delta !== 0 && (
                <span className="inline-flex items-center gap-0.5" style={{ color: directionColor }}>
                  {increasing ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {increasing ? `+${delta}` : delta}
                </span>
              )}
            </div>

            <div className="mt-3">
              <div className="w-full h-4 flex gap-0.5 rounded-sm">
                {Array.from({ length: BUG_PROGRESS_BLOCKS }).map((_, index) => {
                  const isStaticFilled = index < staticFilled;
                  const isGrowing = increasing && index >= victoryCountBefore && index < victoryCountAfter;
                  const isShrinking = decreasing && index >= victoryCountAfter && index < victoryCountBefore;

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
                            delay: (index - victoryCountBefore) * 0.12,
                          }}
                          style={{ height: "100%", backgroundColor: UP_COLOR }}
                        />
                      )}

                      {isShrinking && (
                        <motion.div
                          // El último bloque encendido no solo se vacía: se pone rojo y cae,
                          // como la muerte de Mario, en vez de derretirse en el lugar.
                          initial={{ y: 0, opacity: 1 }}
                          animate={{ y: 20, opacity: 0 }}
                          transition={{
                            duration: 0.45,
                            ease: [0.4, 0, 1, 1],
                            delay: 0.15 + (victoryCountBefore - 1 - index) * 0.12,
                          }}
                          style={{ width: "100%", height: "100%", backgroundColor: DOWN_COLOR }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between text-[9px]" style={{ color: palette.textDim }}>
                <span>{victoryCountAfter} / {BUG_PROGRESS_BLOCKS}</span>
                <span style={{ color: directionColor }}>{RESULT_LABEL[resultado]}</span>
              </div>

              <AnimatePresence>
                {justFixed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: 0.5 }}
                    className="mt-2 inline-flex rounded-[3px] border px-[10px] py-[4px] text-[11px] font-medium"
                    style={{
                      backgroundColor: palette.levelUpBg,
                      borderColor: palette.text,
                      color: palette.text,
                      borderWidth: "0.5px",
                    }}
                  >
                    ¡Bug debugueado!
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
