import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { LockOpen, Star, Trophy } from "lucide-react";
import { usePopupPalette } from "@/lib/popup-theme";

export interface PowerCelebrationState {
  name: string;
  kind: "unlocked" | "confirmed";
}

interface PowerCelebrationProps {
  celebration: PowerCelebrationState | null;
}

// Deterministic burst of stars flying outward from the badge, arranged evenly
// around a circle with a small per-particle jitter so it doesn't look too mechanical.
const PARTICLE_COUNT = 14;
const particles = Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
  const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
  const jitter = ((i * 41) % 10) / 10; // 0..0.9, deterministic per index
  const distance = 70 + jitter * 46;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    rotate: (i * 59) % 360,
    delay: (i % 5) * 0.04,
    size: 8 + (i % 3) * 3,
  };
});

export function PowerCelebration({ celebration }: PowerCelebrationProps) {
  const palette = usePopupPalette();

  if (typeof document === "undefined") {
    return null;
  }

  // "unlocked" is just a status notice (the power became available) — a small,
  // non-blocking toast. "confirmed" (mastered) is the actual celebration moment,
  // with the full backdrop + star burst treatment.
  if (celebration?.kind === "confirmed") {
    return createPortal(
      <AnimatePresence>
        <motion.div
          key="power-celebration"
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
                <Star
                  size={p.size}
                  className="fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]"
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
                <Trophy className="h-6 w-6 text-amber-400" strokeWidth={2} />
              </motion.div>

              <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: palette.textMuted }}>
                ¡Poder dominado!
              </div>
              <div className="mt-1 truncate text-base font-bold" style={{ color: palette.text }}>
                {celebration.name}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>,
      document.body,
    );
  }

  return createPortal(
    <AnimatePresence>
      {celebration && (
        <motion.div
          key="power-unlocked-toast"
          className="fixed left-1/2 top-1/2 z-[300] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <div
            className="flex items-center gap-2 rounded-full border px-3.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            style={{ backgroundColor: palette.bg, borderColor: palette.border }}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: palette.blockEmpty, border: `1px solid ${palette.text}` }}
            >
              <LockOpen className="h-3.5 w-3.5 text-amber-400" strokeWidth={2} />
            </span>
            <span className="text-xs" style={{ color: palette.textMuted }}>
              Poder desbloqueado ·{" "}
              <span className="font-medium" style={{ color: palette.text }}>
                {celebration.name}
              </span>
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
