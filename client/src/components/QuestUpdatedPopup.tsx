import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { usePopupPalette } from "@/lib/popup-theme";

interface QuestUpdatedPopupProps {
  show: boolean;
  onClose: () => void;
}

// Misma "carcasa" (tamaño, forma, color) que ExperienceGainPopup / TodayProgressGainPopup —
// el pop-up de "Quest updated!" de siempre, pero con el mismo tamaño de tarjeta que los demás
// pop-ups de progreso en vez del texto grande suelto que tenía antes.
export function QuestUpdatedPopup({ show, onClose }: QuestUpdatedPopupProps) {
  const palette = usePopupPalette();

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          key="quest-updated-popup"
          className="fixed inset-0 z-[260]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Cerrar popup de quest updated"
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="w-[min(92vw,356px)] rounded-[4px] border px-[16px] py-[14px] shadow-[0_18px_40px_rgba(0,0,0,0.45)] text-center"
              style={{
                backgroundColor: palette.bg,
                borderColor: palette.border,
              }}
            >
              <div className="text-lg font-bold" style={{ color: palette.text }}>
                Quest updated!
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
