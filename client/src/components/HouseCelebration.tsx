import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { ShoppingCart, Wrench } from "lucide-react";
import { usePopupPalette } from "@/lib/popup-theme";

// Cuánto tiempo queda visible la celebración antes de que el padre limpie el estado.
// Igual que POPUP_VISIBLE_MS del resto de las celebraciones (quests, subir de nivel...).
export const HOUSE_CELEBRATION_MS = 1500;

export interface HouseCelebrationState {
  // "compra" -> objeto sumado a la casa (lista de prioridades / inventario).
  // "arreglo" -> problema resuelto (lista de arreglos).
  kind: "compra" | "arreglo";
  // Nombre del objeto comprado / texto del arreglo resuelto.
  name: string;
}

interface HouseCelebrationProps {
  celebration: HouseCelebrationState | null;
}

// Mismo tratamiento visual que LevelUpCelebration / QuestUpdatedCelebration (backdrop,
// ráfaga determinista de partículas, tarjeta con ícono redondo pulsante y paleta de popup),
// reusado acá para que confirmar una compra o un arreglo de la casa lea con el mismo peso
// que el resto de las celebraciones de la app en vez del toast suelto que tenía antes.
const PARTICLE_COUNT = 14;
const particles = Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
  const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
  const jitter = ((i * 41) % 10) / 10;
  const distance = 70 + jitter * 46;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    rotate: (i * 59) % 360,
    delay: (i % 5) * 0.04,
    size: 8 + (i % 3) * 3,
  };
});

const COPY = {
  compra: { label: "¡Nueva compra!", tail: "Ya es parte de tu casa." },
  arreglo: { label: "¡Arreglo resuelto!", tail: "Un problema menos en tu casa." },
} as const;

export function HouseCelebration({ celebration }: HouseCelebrationProps) {
  const palette = usePopupPalette();

  if (typeof document === "undefined") {
    return null;
  }

  const Icon = celebration?.kind === "arreglo" ? Wrench : ShoppingCart;
  const copy = celebration ? COPY[celebration.kind] : null;

  return createPortal(
    <AnimatePresence>
      {celebration && copy && (
        <motion.div
          key="house-celebration"
          className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <div className="relative flex items-center justify-center">
            {particles.map((p, i) => (
              <motion.div
                key={i}
                className="absolute left-1/2 top-1/2"
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.3, rotate: 0 }}
                animate={{
                  x: p.x,
                  y: p.y,
                  opacity: [0, 1, 1, 0],
                  scale: [0.3, 1, 1, 0.6],
                  rotate: p.rotate,
                }}
                transition={{ duration: 1.3, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
              >
                <Icon
                  size={p.size}
                  strokeWidth={3}
                  className="text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                />
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -6 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-[min(84vw,300px)] rounded-lg border px-5 py-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              style={{ backgroundColor: palette.bg, borderColor: palette.border }}
            >
              <motion.div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: palette.blockEmpty, border: `1.5px solid ${palette.text}` }}
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1.1, repeat: 2, ease: "easeInOut" }}
              >
                <Icon className="h-6 w-6 text-amber-400" strokeWidth={2.4} />
              </motion.div>

              <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: palette.textMuted }}>
                {copy.label}
              </div>
              <div className="mt-1 truncate text-xl font-bold" style={{ color: palette.text }}>
                {celebration.name}
              </div>
              <div className="mt-2 text-[11px]" style={{ color: palette.textDim }}>
                {copy.tail}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
