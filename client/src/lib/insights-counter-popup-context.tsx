import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { InsightsCounterPopup } from "@/components/InsightsCounterPopup";
import { markPopupActive } from "@/lib/popup-coordinator";

// "task": nodo nuevo agregado desde el cubo "Nodo nuevo" del modal de feedback. "record": registro
// en un nodo de reflexión (escrito en su pop-up, o el nodo completado desde "Tareas de hoy"); el
// "Agregaste un registro en …" va como tarea en "Tareas de hoy", no en el pop-up.
// Estos dos solo muestran el anuncio ("¡Nueva tarea!" / "¡Nuevo registro!"), sin la fase del conteo.
export type InsightsCounterKind = "thought" | "learning" | "discovery" | "strategy" | "question" | "tool" | "task" | "record";

export interface InsightsCounterPopupSnapshot {
  type: InsightsCounterKind;
  countBefore: number;
  countAfter: number;
  // Texto chico debajo del anuncio (p.ej. el área/quest del nodo nuevo).
  detail?: string;
}

// Los tipos que solo muestran el anuncio, sin pasar al conteo.
export const isAnnounceOnlyKind = (kind: InsightsCounterKind) => kind === "task" || kind === "record";

// Primera fase del pop-up: el anuncio ("¡Pensamiento nuevo!") solo, antes de pasar -- en el
// mismo cuadro -- al conteo creciendo.
export const INSIGHTS_ANNOUNCE_MS = 1200;

// Este pop-up se queda visible más tiempo que el resto de la familia (POPUP_VISIBLE_MS, 1500ms):
// primero el anuncio y después el número, que arranca en countBefore y cambia a countAfter con un
// "+1"; el tiempo extra es para que se vea el cambio y alcance a leerse con comodidad.
export const INSIGHTS_POPUP_VISIBLE_MS = INSIGHTS_ANNOUNCE_MS + 2800;

interface InsightsCounterPopupContextValue {
  snapshot: InsightsCounterPopupSnapshot | null;
  showInsightsCounterPopup: (snapshot: InsightsCounterPopupSnapshot) => void;
  hideInsightsCounterPopup: () => void;
}

const InsightsCounterPopupContext = createContext<InsightsCounterPopupContextValue | undefined>(undefined);

// Conteo propio de cada tipo (pensamientos, aprendizajes, herramientas) -- no se mezclan entre
// sí. Reemplaza el pop-up de progreso de área/proyecto que antes disparaban esas tres acciones
// (ver SkillNode.tsx): ya no hacen crecer un área ajena, sino el conteo de su propio tipo.
export function InsightsCounterPopupProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<InsightsCounterPopupSnapshot | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideInsightsCounterPopup = useCallback(() => {
    setSnapshot(null);
  }, []);

  const showInsightsCounterPopup = useCallback((nextSnapshot: InsightsCounterPopupSnapshot) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }

    const visibleMs = isAnnounceOnlyKind(nextSnapshot.type) ? INSIGHTS_ANNOUNCE_MS + 600 : INSIGHTS_POPUP_VISIBLE_MS;
    markPopupActive(visibleMs);
    setSnapshot(nextSnapshot);
    closeTimerRef.current = setTimeout(() => {
      setSnapshot(null);
    }, visibleMs);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({ snapshot, showInsightsCounterPopup, hideInsightsCounterPopup }),
    [hideInsightsCounterPopup, showInsightsCounterPopup, snapshot],
  );

  return (
    <InsightsCounterPopupContext.Provider value={value}>
      {children}
      <InsightsCounterPopup snapshot={snapshot} onClose={hideInsightsCounterPopup} />
    </InsightsCounterPopupContext.Provider>
  );
}

export function useInsightsCounterPopup() {
  const context = useContext(InsightsCounterPopupContext);
  if (!context) {
    throw new Error("useInsightsCounterPopup must be used within an InsightsCounterPopupProvider");
  }
  return context;
}
