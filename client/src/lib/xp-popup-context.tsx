import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ExperienceGainPopup, type ExperienceGainSnapshot } from "@/components/ExperienceGainPopup";

interface XpPopupContextValue {
  showXpPopup: (snapshot: ExperienceGainSnapshot) => void;
  hideXpPopup: () => void;
}

const XpPopupContext = createContext<XpPopupContextValue | undefined>(undefined);

export function XpPopupProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ExperienceGainSnapshot | null>(null);

  const showXpPopup = useCallback((nextSnapshot: ExperienceGainSnapshot) => {
    setSnapshot(nextSnapshot);
  }, []);

  const hideXpPopup = useCallback(() => {
    setSnapshot(null);
  }, []);

  return (
    <XpPopupContext.Provider value={{ showXpPopup, hideXpPopup }}>
      {children}
      <ExperienceGainPopup snapshot={snapshot} onClose={hideXpPopup} />
    </XpPopupContext.Provider>
  );
}

export function useXpPopup() {
  const context = useContext(XpPopupContext);
  if (!context) {
    throw new Error("useXpPopup must be used within an XpPopupProvider");
  }
  return context;
}