import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";

export interface TodayProgressGainSnapshot {
  completedBefore: number;
  completedAfter: number;
  total: number;
}

interface TodayProgressGainPopupProps {
  snapshot: TodayProgressGainSnapshot | null;
  onClose: () => void;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

// Sin capitalizar a mano: la clase "capitalize" (igual que en TodayProgressModal) pone en
// mayúscula la primera letra de cada palabra, dando "Lunes, 27 De Julio".
function getTodayLabel(): string {
  return new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function TodayProgressGainPopup({ snapshot, onClose }: TodayProgressGainPopupProps) {
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
            className="w-[min(92vw,356px)] rounded-2xl border bg-background px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
          >
            <h2 className="text-2xl font-bold text-foreground">Hoy</h2>
            <p className="text-sm text-muted-foreground capitalize">{getTodayLabel()}</p>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Completado</span>
                <span className="text-sm font-semibold text-muted-foreground">
                  {completedAfter}/{total}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-emerald-500"
                  initial={{ width: `${pctBefore}%` }}
                  animate={{ width: `${pctAfter}%` }}
                  transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
