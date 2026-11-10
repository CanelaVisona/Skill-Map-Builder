import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

// Pop-up chiquito que aparece en el centro de la pantalla (= centro del modal de Tareas de hoy) cuando se completa una sub-tarea (sub-paso o
// sub-nodo) y se va solo. No bloquea clics (pointer-events-none) para no cortar el flujo.
export type SubtaskDonePopupData = { id: number; title: string };

const VISIBLE_MS = 1600;

export function SubtaskDonePopup({ data, onDone }: { data: SubtaskDonePopupData | null; onDone: () => void }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!data) return;
    setShown(false);
    const enter = requestAnimationFrame(() => setShown(true));
    const leave = setTimeout(() => setShown(false), VISIBLE_MS);
    const done = setTimeout(onDone, VISIBLE_MS + 250);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(leave);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

  if (!data || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none px-4" data-testid="popup-subtask-done">
      <div
        className={`flex items-center gap-2 max-w-sm rounded-full border border-emerald-500/40 bg-background/95 px-4 py-2 shadow-lg backdrop-blur transition-all duration-200 ease-out ${
          shown ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-0 scale-90"
        }`}
      >
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <span className="text-sm font-medium">Sub-tarea completada</span>
      </div>
    </div>,
    document.body,
  );
}
