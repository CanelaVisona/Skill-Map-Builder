import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { OctagonAlert, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect } from "react";
import { usePopupPalette } from "@/lib/popup-theme";
import { playProgressAdvanceSound, playBugLossSound } from "@/lib/sound";

// 5 bloques de 10 puntos cada uno. A diferencia de la barra de bugs (0 a 5), acá el valor es
// firmado: de -50 a +50. Sumar xp construye la barra en VERDE (el objetivo es completarla
// entera para superar el error); restar xp le quita el último bloque ganado -- y si ya no
// quedaba ningún bloque verde, sigue "cayendo" hacia el rojo (la barra se llena de rojo en
// sentido contrario). Sumar xp con la barra en rojo primero le va sacando bloques rojos antes
// de volver a construir en verde. Ver getErrorBarBlocks más abajo.
export const ERROR_PROGRESS_BLOCKS = 5;
export const ERROR_POINTS_PER_BLOCK = 10;

export const ERROR_POPUP_VISIBLE_MS = 2600;

export interface ErrorProgressSnapshot {
  errorName: string;
  pointsBefore: number;
  pointsAfter: number;
  // Solo presente en un +10 -- la estrategia elegida (o recién cargada) en el picker que se
  // abre al sumar xp. null/undefined en un -10.
  estrategia?: string | null;
  // Espejo de estrategia, pero para un -10 -- el disparador elegido (o recién cargado) en el
  // mismo picker. null/undefined en un +10.
  disparador?: string | null;
}

interface ErrorProgressPopupProps {
  snapshot: ErrorProgressSnapshot | null;
  onClose: () => void;
}

export const ERROR_GREEN = "#2ecc2e";
export const ERROR_RED = "#ef4444";

// Dado el valor firmado actual de un error (-50..50), cuántos bloques mostrar y de qué color.
// Un valor positivo se ve como bloques verdes creciendo hacia superar el error; uno negativo,
// como bloques rojos. En 0 la barra está vacía (ninguno de los dos colores).
export function getErrorBarBlocks(points: number): { color: "green" | "red" | "empty"; count: number } {
  if (points > 0) {
    return { color: "green", count: Math.min(ERROR_PROGRESS_BLOCKS, Math.round(points / ERROR_POINTS_PER_BLOCK)) };
  }
  if (points < 0) {
    return { color: "red", count: Math.min(ERROR_PROGRESS_BLOCKS, Math.round(-points / ERROR_POINTS_PER_BLOCK)) };
  }
  return { color: "empty", count: 0 };
}

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

  const { errorName, pointsBefore, pointsAfter, estrategia, disparador } = snapshot;
  const delta = pointsAfter - pointsBefore;

  const before = getErrorBarBlocks(pointsBefore);
  const after = getErrorBarBlocks(pointsAfter);
  // Un solo +-10/-10 nunca puede pasar de un lado al otro del cero en un solo paso (siempre pasa
  // por 0 primero), así que como mucho uno de los dos colores tiene bloques en este snapshot --
  // ese es el que se anima (el otro lado se trata como 0 bloques).
  const barColor: "green" | "red" = before.color !== "empty" ? before.color : after.color !== "empty" ? after.color : "green";
  const blocksBefore = before.color === barColor ? before.count : 0;
  const blocksAfter = after.color === barColor ? after.count : 0;

  const increasing = blocksAfter > blocksBefore;
  const decreasing = blocksAfter < blocksBefore;
  const fillColor = barColor === "red" ? ERROR_RED : ERROR_GREEN;
  const directionColor = increasing ? ERROR_GREEN : decreasing ? ERROR_RED : palette.textDim;
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
                    stroke={fillColor}
                    strokeWidth="1.5"
                  />
                </svg>
                <OctagonAlert className="relative h-4 w-4" style={{ color: fillColor }} strokeWidth={2.1} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium leading-snug break-words" style={{ color: palette.text }}>
                  {delta > 0
                    ? (estrategia
                        ? `+${delta} xp en ${errorName} con la estrategia: ${estrategia}`
                        : `+${delta} xp en ${errorName}`)
                    : (disparador
                        ? `${delta} xp en ${errorName} con el disparador: ${disparador}`
                        : `${delta} xp en ${errorName}`)}
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
                        <div style={{ width: "100%", height: "100%", backgroundColor: fillColor }} />
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
                          style={{ height: "100%", backgroundColor: fillColor }}
                        />
                      )}

                      {isShrinking && (
                        <motion.div
                          // El bloque que se pierde no solo se vacía: cae, como la muerte de
                          // Mario -- mismo trato tanto si es un bloque verde que se pierde al
                          // restar xp, como si es el último bloque rojo que se saca al sumar.
                          initial={{ y: 0, opacity: 1 }}
                          animate={{ y: 20, opacity: 0 }}
                          transition={{
                            duration: 0.45,
                            ease: [0.4, 0, 1, 1],
                            delay: 0.15 + (blocksBefore - 1 - index) * 0.12,
                          }}
                          style={{ width: "100%", height: "100%", backgroundColor: fillColor }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between text-[9px]" style={{ color: palette.textDim }}>
                <span>{Math.abs(pointsAfter)} / 50{pointsAfter < 0 ? " (en contra)" : ""}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
