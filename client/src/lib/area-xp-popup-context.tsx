import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { AreaLevelGainPopup } from "@/components/AreaLevelGainPopup";

export interface AreaXpPopupSnapshot {
  areaOrProjectId: string;
  scopeName: string;
  areaColor: string;
  progressBeforePct: number;
  progressAfterPct: number;
  bonusXp: number;
  currentXp?: number;
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

    setSnapshot(nextSnapshot);
    closeTimerRef.current = setTimeout(() => {
      setSnapshot(null);
    }, 3200);
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
