import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { usePopupPalette } from "@/lib/popup-theme";

export interface TodayProgressGainSnapshot {
  completedBefore: number;
  completedAfter: number;
  total: number;
}

interface TodayProgressGainPopupProps {
  snapshot: TodayProgressGainSnapshot | null;
  onClose: () => void;
}

const PROGRESS_COLOR = "#10b981";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function TodayProgressGainPopup({ snapshot, onClose }: TodayProgressGainPopupProps) {
  const palette = usePopupPalette();

  if (!snapshot || typeof document === "undefined") {
    return null;
  }

  const { completedBefore, completedAfter, total } = snapshot;
  const pctBefore = clampPercent(total > 0 ? (completedBefore / total) * 100 : 0);
  const pctAfter = clampPercent(total > 0 ? (completedAfter / total) * 100 : 0);

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="today-progress-gain-popup"
        className="fixed inset-0 z-[260]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          type="button"
          aria-label="Cerrar popup de progreso de hoy"
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
              <div className="min-w-0 flex-1">
                <div className="truncate text-[17px] font-bold" style={{ color: palette.text }}>HOY</div>
              </div>

              <div
                className="shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                style={{ borderColor: palette.border, backgroundColor: palette.surfaceInset, color: palette.text }}
              >
                {completedAfter}/{total}
              </div>
            </div>

            <div className="mt-3">
              {/* Misma forma que la barra de progreso del modal de Tareas de Hoy: una sola
                  barra continua (no bloques segmentados como los demás pop-ups de XP). */}
              <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: palette.blockEmpty }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: PROGRESS_COLOR }}
                  initial={{ width: `${pctBefore}%` }}
                  animate={{ width: `${pctAfter}%` }}
                  transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-[9px]" style={{ color: palette.textDim }}>
                <span>{pctBefore.toFixed(0)}%</span>
                <span>{pctAfter.toFixed(0)}%</span>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
