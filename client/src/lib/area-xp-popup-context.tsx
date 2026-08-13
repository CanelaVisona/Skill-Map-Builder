import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { AreaLevelGainPopup } from "@/components/AreaLevelGainPopup";
import { markPopupActive, POPUP_VISIBLE_MS } from "@/lib/popup-coordinator";

export interface AreaXpPopupSnapshot {
  areaOrProjectId: string;
  scopeName: string;
  areaColor: string;
  progressBeforePct: number;
  progressAfterPct: number;
  bonusXp: number;
  // Nivel desbloqueado del área/quest y cantidad de nodos que tiene ese nivel -- reemplazan la
  // vieja división fija por 15: la barra ahora se divide en tantos bloques como nodos tenga el
  // nivel actual, y "level" se usa solo para el color del bloque.
  level: number;
  totalInLevel: number;
}

interface AreaXpPopupContextValue {
  snapshot: AreaXpPopupSnapshot | null;
  showAreaXpPopup: (snapshot: AreaXpPopupSnapshot) => void;
  hideAreaXpPopup: () => void;
}

const AreaXpPopupContext = createContext<AreaXpPopupContextValue | undefined>(undefined);

export function AreaXpPopupProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<AreaXpPopupSnapshot | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideAreaXpPopup = useCallback(() => {
    setSnapshot(null);
  }, []);

  const showAreaXpPopup = useCallback((nextSnapshot: AreaXpPopupSnapshot) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }

    markPopupActive(POPUP_VISIBLE_MS);
    setSnapshot(nextSnapshot);
    closeTimerRef.current = setTimeout(() => {
      setSnapshot(null);
    }, POPUP_VISIBLE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({ snapshot, showAreaXpPopup, hideAreaXpPopup }),
    [hideAreaXpPopup, showAreaXpPopup, snapshot],
  );

  return (
    <AreaXpPopupContext.Provider value={value}>
      {children}
      <AreaLevelGainPopup snapshot={snapshot} onClose={hideAreaXpPopup} />
    </AreaXpPopupContext.Provider>
  );
}

export function useAreaXpPopup() {
  const context = useContext(AreaXpPopupContext);
  if (!context) {
    throw new Error("useAreaXpPopup must be used within an AreaXpPopupProvider");
  }
  return context;
}
