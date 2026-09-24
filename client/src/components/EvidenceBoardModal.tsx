import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import boardHtml from "./evidence-board/board.html?raw";

interface EvidenceBoardModalWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Envuelve el "Diario de pistas" (tablero de corcho con pistas, chinchetas e
// hilos) como un iframe con su propio documento HTML autocontenido. Se
// integra así, en vez de reescribirlo en React, porque el tablero maneja su
// propio estado imperativo (arrastre de tarjetas, paneo/zoom, dibujo de
// hilos en SVG) y persiste solo en localStorage; el iframe con srcDoc hereda
// el origen de esta página, así que ese localStorage sobrevive entre
// aperturas del modal.
export function EvidenceBoardModalWrapper({ open, onOpenChange }: EvidenceBoardModalWrapperProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="evidence-board-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="rounded-2xl border border-border/50 bg-background w-[98vw] h-[96dvh] sm:w-[94vw] sm:h-[90dvh] max-w-6xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 shrink-0">
              <span className="text-sm font-semibold text-muted-foreground">Diario de pistas</span>
              <button
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={() => onOpenChange(false)}
                aria-label="Cerrar diario de pistas"
                data-testid="button-close-evidence-board"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <iframe
              title="Diario de pistas"
              srcDoc={boardHtml}
              className="w-full flex-1 min-h-0 border-0 block bg-white dark:bg-black"
              data-testid="frame-evidence-board"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
