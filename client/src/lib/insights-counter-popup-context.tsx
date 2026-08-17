import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { InsightsCounterPopup } from "@/components/InsightsCounterPopup";
import { markPopupActive } from "@/lib/popup-coordinator";

export type InsightsCounterKind = "thought" | "learning" | "tool";

export interface InsightsCounterPopupSnapshot {
  type: InsightsCounterKind;
  countBefore: number;
  countAfter: number;
}

// Este pop-up se queda visible más tiempo que el resto de la familia (POPUP_VISIBLE_MS,
// 1500ms): primero hay que darle tiempo al número viejo de leerse como un valor estable, recién
// después arranca el flip al nuevo valor (ver FLIP_DELAY_MS/FLIP_DURATION_S en
// InsightsCounterPopup.tsx), y todavía queda que sobre tiempo de sobra para leer el número nuevo
// ya asentado antes de que se cierre.
export const INSIGHTS_POPUP_VISIBLE_MS = 2800;

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

    markPopupActive(INSIGHTS_POPUP_VISIBLE_MS);
    setSnapshot(nextSnapshot);
    closeTimerRef.current = setTimeout(() => {
      setSnapshot(null);
    }, INSIGHTS_POPUP_VISIBLE_MS);
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
