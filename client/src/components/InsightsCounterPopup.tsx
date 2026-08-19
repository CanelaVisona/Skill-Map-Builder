import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Lightbulb, Pencil, Wrench } from "lucide-react";
import { usePopupPalette, type PopupPalette } from "@/lib/popup-theme";
import { playProgressAdvanceSound } from "@/lib/sound";

import type { InsightsCounterKind, InsightsCounterPopupSnapshot } from "@/lib/insights-counter-popup-context";

interface InsightsCounterPopupProps {
  snapshot: InsightsCounterPopupSnapshot | null;
  onClose: () => void;
}

// Mismos íconos que usan las tabs de Thoughts/Learnings/Tools en SkillNode.tsx, para que el
// pop-up se reconozca de un vistazo como "el mismo tipo que acabo de cargar".
const KIND_META: Record<InsightsCounterKind, { icon: typeof Lightbulb; label: string }> = {
  thought: { icon: Pencil, label: "Pensamientos" },
  learning: { icon: Lightbulb, label: "Aprendizajes" },
  tool: { icon: Wrench, label: "Herramientas" },
};

// Cuánto se espera, después de aparecer el pop-up, antes de arrancar el "flip" del número, y
// cuánto dura ese flip. El delay es largo a propósito: tiene que alcanzar para que el número
// viejo se lea como un valor estable (no algo que ya está "de paso") antes de que arranque el
// cambio. El flip en sí es corto y discreto (no un deslizamiento lento) para que se perciba
// como "cambió de A a B" y no como un número que se mueve en cámara lenta hasta que recién al
// final se entiende cuál es el nuevo valor -- ver INSIGHTS_POPUP_VISIBLE_MS en
// insights-counter-popup-context.tsx, que deja tiempo de sobra después de que termine para leer
// el número nuevo, ya asentado.
const FLIP_DELAY_MS = 1100;
const FLIP_DURATION_S = 0.35;

// Un solo dígito "rueda" verticalmente hacia el nuevo valor -- el dígito viejo sale
// deslizándose hacia arriba mientras el nuevo entra desde abajo, como el rodillo de un
// cuentakilómetros o el flip de un reloj digital. AnimatePresence dispara el enter/exit cada
// vez que cambia la key (el dígito en sí), así que alcanza con re-renderizar con el dígito
// nuevo para que se vea el "paso" al número siguiente.
function OdometerDigit({ digit, palette }: { digit: string; palette: PopupPalette }) {
  return (
    <span className="relative inline-block h-[1.15em] w-[0.66em] overflow-hidden align-top" style={{ color: palette.text }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={digit}
          initial={{ y: "70%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-70%", opacity: 0 }}
          transition={{ duration: FLIP_DURATION_S, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function OdometerNumber({ value, palette }: { value: number; palette: PopupPalette }) {
  const digits = String(Math.max(0, value)).split("");
  return (
    <span className="inline-flex">
      {digits.map((digit, i) => (
        <OdometerDigit key={i} digit={digit} palette={palette} />
      ))}
    </span>
  );
}

// Pop-up que muestra el conteo propio de un tipo (pensamientos, aprendizajes o herramientas --
// nunca mezclados) en vez de hacer crecer la barra de progreso del área/proyecto activo, que es
// lo que hacían antes estas tres acciones. Misma "carcasa" que AreaLevelGainPopup/
// TodayProgressGainPopup, pero el número central arranca en countBefore y "rueda" hasta
// countAfter poco después de aparecer, para que la sensación de progreso quede en el conteo de
// ese tipo y no en un área ajena.
export function InsightsCounterPopup({ snapshot, onClose }: InsightsCounterPopupProps) {
  const palette = usePopupPalette();
  const [displayValue, setDisplayValue] = useState(snapshot?.countBefore ?? 0);

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    setDisplayValue(snapshot.countBefore);
    const timer = setTimeout(() => {
      if (snapshot.countAfter > snapshot.countBefore) {
        playProgressAdvanceSound();
      }
      setDisplayValue(snapshot.countAfter);
    }, FLIP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [snapshot]);

  if (!snapshot || typeof document === "undefined") {
    return null;
  }

  const { icon: KindIcon, label } = KIND_META[snapshot.type];

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
              <OdometerNumber value={displayValue} palette={palette} />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
