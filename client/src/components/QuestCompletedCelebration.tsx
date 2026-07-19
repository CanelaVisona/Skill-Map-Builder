import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Star, Trophy } from "lucide-react";

interface QuestCompletedCelebrationProps {
  celebration: { name: string; type: "area" | "project" } | null;
}

// Deterministic burst of stars flying outward from the trophy, arranged evenly
// around a circle with a small per-particle jitter so it doesn't look too mechanical.
const PARTICLE_COUNT = 16;
const particles = Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
  const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
  const jitter = ((i * 37) % 10) / 10; // 0..0.9, deterministic per index
  const distance = 90 + jitter * 60;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    rotate: (i * 53) % 360,
    delay: (i % 5) * 0.04,
    size: 10 + (i % 3) * 4,
  };
});

export function QuestCompletedCelebration({ celebration }: QuestCompletedCelebrationProps) {
  if (typeof document === "undefined") {
    return null;
  }

  const title = celebration?.type === "area" ? "¡Área completada!" : "¡Quest completada!";

  return createPortal(
    <AnimatePresence>
      {celebration && (
        <motion.div
          key="quest-completed-celebration"
          className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <div className="relative flex items-center justify-center">
            {/* Star burst */}
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
                transition={{ duration: 1.6, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
              >
                <Star
                  size={p.size}
                  className="fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                />
              </motion.div>
            ))}

            {/* Central card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -8 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-[min(88vw,340px)] rounded-lg border px-6 py-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              style={{ backgroundColor: "#0e0c0a", borderColor: "#3a2a14" }}
            >
              <motion.div
                className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: "#1e180e", border: "1.5px solid #c8a96e" }}
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1.2, repeat: 2, ease: "easeInOut" }}
              >
                <Trophy className="h-7 w-7 text-amber-400" strokeWidth={2} />
              </motion.div>

              <div className="text-[11px] uppercase tracking-[0.16em] text-[#7a6942]">
                {title}
              </div>
              <div className="mt-1 truncate text-lg font-bold text-[#c8a96e]">
                {celebration.name}
              </div>
              <div className="mt-2 text-[11px] text-[#5a4a2a]">
                Archivada en Quests Conquistados
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
