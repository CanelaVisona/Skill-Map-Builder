import { useEffect, useState } from "react";
import { Check } from "lucide-react";

// Pop-up chiquito que aparece cuando se completa una sub-tarea (sub-paso o sub-nodo) y se va solo.
// Se dibuja encima de la lista que se scrollea en Tareas de hoy (el padre tiene que ser
// `relative`): mientras se ve, esa lista queda desenfocada para que la atención quede en el
// pop-up y no en la próxima tarea.
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

  if (!data) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center px-4" data-testid="popup-subtask-done">
      {/* Desenfoca la lista de tareas de abajo (y frena los clics) mientras se ve el pop-up. */}
      <div
        className={`absolute inset-0 rounded-lg bg-background/30 backdrop-blur-md transition-opacity duration-200 ease-out ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`relative flex items-center gap-2 rounded-full border border-emerald-500/40 bg-background px-4 py-2 shadow-lg transition-all duration-200 ease-out ${
          shown ? "opacity-100 scale-100" : "opacity-0 scale-90"
        }`}
      >
        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <span className="text-sm font-medium">Sub-tarea completada</span>
      </div>
    </div>
  );
}
