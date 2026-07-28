import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { BodyGainPopup, type BodyGainSnapshot } from "@/components/BodyGainPopup";
import { markPopupActive, POPUP_VISIBLE_MS } from "@/lib/popup-coordinator";

interface BodyGainPopupContextValue {
  showBodyGainPopup: (snapshot: BodyGainSnapshot) => void;
  hideBodyGainPopup: () => void;
}

const BodyGainPopupContext = createContext<BodyGainPopupContextValue | undefined>(undefined);

export function BodyGainPopupProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<BodyGainSnapshot | null>(null);

  const showBodyGainPopup = useCallback((nextSnapshot: BodyGainSnapshot) => {
    markPopupActive(POPUP_VISIBLE_MS);
    setSnapshot(nextSnapshot);
  }, []);

  const hideBodyGainPopup = useCallback(() => {
    setSnapshot(null);
  }, []);

  return (
    <BodyGainPopupContext.Provider value={{ showBodyGainPopup, hideBodyGainPopup }}>
      {children}
      <BodyGainPopup snapshot={snapshot} onClose={hideBodyGainPopup} />
    </BodyGainPopupContext.Provider>
  );
}

export function useBodyGainPopup() {
  const context = useContext(BodyGainPopupContext);
  if (!context) {
    throw new Error("useBodyGainPopup must be used within a BodyGainPopupProvider");
  }
  return context;
}
