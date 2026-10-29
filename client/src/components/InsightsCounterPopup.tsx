import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { HelpCircle, Lightbulb, Pencil, Split, Wrench } from "lucide-react";
import { usePopupPalette, type PopupPalette } from "@/lib/popup-theme";
import { playProgressAdvanceSound } from "@/lib/sound";

import { INSIGHTS_ANNOUNCE_MS, type InsightsCounterKind, type InsightsCounterPopupSnapshot } from "@/lib/insights-counter-popup-context";

interface InsightsCounterPopupProps {
  snapshot: InsightsCounterPopupSnapshot | null;
  onClose: () => void;
}

// Mismos íconos que usan las tabs de Thoughts/Learnings/Tools en SkillNode.tsx, para que el
// pop-up se reconozca de un vistazo como "el mismo tipo que acabo de cargar".
// `announce`: lo primero que muestra el pop-up, solo, antes del conteo.
const KIND_META: Record<InsightsCounterKind, { icon: typeof Lightbulb; label: string; announce: string }> = {
  thought: { icon: Pencil, label: "Pensamientos", announce: "¡Pensamiento nuevo!" },
  learning: { icon: Lightbulb, label: "Aprendizajes", announce: "¡Aprendizaje nuevo!" },
  strategy: { icon: Split, label: "Estrategias", announce: "¡Estrategia nueva!" },
  question: { icon: HelpCircle, label: "Preguntas", announce: "¡Pregunta nueva!" },
  tool: { icon: Wrench, label: "Herramientas", announce: "¡Herramienta nueva!" },
};

// Tiempo que se muestra el valor anterior antes de saltar al nuevo con el "+1".
const COUNT_CHANGE_DELAY_MS = 650;

// Arranca en countBefore y, tras un instante, salta directo a countAfter (sin "rodar" por
// valores intermedios) mientras un "+1" sube y se desvanece junto al número.
function CountChange({ before, after, palette }: { before: number; after: number; palette: PopupPalette }) {
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    setChanged(false);
    const timer = setTimeout(() => setChanged(true), COUNT_CHANGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [before, after]);

  const value = Math.max(0, changed ? after : before);
  const delta = after - before;

  return (
    <span className="relative inline-flex items-center">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ opacity: 0, y: 10, scale: 1.25 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          style={{ color: palette.text, display: "inline-block" }}
        >
          {value}
        </motion.span>
      </AnimatePresence>

      <AnimatePresence>
        {changed && delta > 0 && (
          <motion.span
            key="plus-one"
            className="pointer-events-none absolute left-full top-0 ml-2 text-[16px] font-semibold"
            style={{ color: palette.text }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: [0, 1, 1, 0], y: [6, -4, -10, -18] }}
            transition={{ duration: 1.4, times: [0, 0.15, 0.7, 1], ease: "easeOut" }}
          >
            +{delta}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

// Pop-up que muestra el conteo propio de un tipo (pensamientos, aprendizajes, estrategias,
// preguntas o herramientas -- nunca mezclados) en vez de hacer crecer la barra de progreso del
// área/proyecto activo. Misma "carcasa" que AreaLevelGainPopup/TodayProgressGainPopup. Tiene dos
// fases en el mismo cuadro: primero el anuncio ("¡Pensamiento nuevo!") solo, y después el conteo:
// el número central aparece en countBefore y salta directo a countAfter con un "+1" flotante (ver
// CountChange) -- sin "rodar" por valores intermedios, que se leían como un valor bugueado.
export function InsightsCounterPopup({ snapshot, onClose }: InsightsCounterPopupProps) {
  const palette = usePopupPalette();
  const [phase, setPhase] = useState<"announce" | "count">("announce");

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    setPhase("announce");
    // El sonido va con el anuncio ("¡Pensamiento nuevo!"), no con el conteo.
    if (snapshot.countAfter > snapshot.countBefore) {
      playProgressAdvanceSound();
    }
    const timer = setTimeout(() => setPhase("count"), INSIGHTS_ANNOUNCE_MS);
    return () => clearTimeout(timer);
  }, [snapshot]);

  if (!snapshot || typeof document === "undefined") {
    return null;
  }

  const { icon: KindIcon, label, announce } = KIND_META[snapshot.type];

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="insights-counter-popup"
        className="fixed inset-0 z-[260]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          type="button"
          aria-label="Cerrar popup de registros"
          className="absolute inset-0 cursor-default"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
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
            {/* Mismo alto en las dos fases, para que el cuadro no salte al pasar de una a otra. */}
            <div className="relative min-h-[82px]">
              <AnimatePresence mode="wait" initial={false}>
                {phase === "announce" ? (
                  <motion.div
                    key="announce"
                    className="flex min-h-[82px] flex-col items-center justify-center gap-2 text-center"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <KindIcon className="h-6 w-6" style={{ color: palette.text }} strokeWidth={2.1} />
                    <div className="text-[20px] font-semibold leading-tight" style={{ color: palette.text }}>{announce}</div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="count"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                        <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full">
                          <polygon
                            points="16,2 30,16 16,30 2,16"
                            fill={palette.surfaceInset}
                            stroke={palette.text}
                            strokeWidth="1.5"
                          />
                        </svg>
                        <KindIcon className="relative h-4 w-4" style={{ color: palette.text }} strokeWidth={2.1} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium" style={{ color: palette.text }}>{label}</div>
                        <div className="truncate text-[10px] uppercase tracking-[0.12em]" style={{ color: palette.textMuted }}>
                          Registros
                        </div>
                      </div>

                      <div
                        className="shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                        style={{ borderColor: palette.border, backgroundColor: palette.surfaceInset, color: palette.text }}
                      >
                        +1
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-center text-[32px] font-semibold leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
                      <CountChange before={snapshot.countBefore} after={snapshot.countAfter} palette={palette} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
