import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { LevelUpCelebration, type LevelUpCelebrationState } from "@/components/LevelUpCelebration";
import { markPopupActive } from "@/lib/popup-coordinator";

// Debe coincidir con el setTimeout de 1800ms de abajo.
const POPUP_DURATION_MS = 1800;

interface LevelUpCelebrationContextValue {
  showLevelUpCelebration: (state: LevelUpCelebrationState) => void;
}

const LevelUpCelebrationContext = createContext<LevelUpCelebrationContextValue | undefined>(undefined);

export function LevelUpCelebrationProvider({ children }: { children: ReactNode }) {
  const [celebration, setCelebration] = useState<LevelUpCelebrationState | null>(null);
  const hideTimer = useRef<number | null>(null);

  const showLevelUpCelebration = useCallback((state: LevelUpCelebrationState) => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
    }
    markPopupActive(POPUP_DURATION_MS);
    setCelebration(state);
    hideTimer.current = window.setTimeout(() => setCelebration(null), POPUP_DURATION_MS);
  }, []);

  return (
    <LevelUpCelebrationContext.Provider value={{ showLevelUpCelebration }}>
      {children}
      <LevelUpCelebration celebration={celebration} />
    </LevelUpCelebrationContext.Provider>
  );
}

export function useLevelUpCelebration() {
  const context = useContext(LevelUpCelebrationContext);
  if (!context) {
    throw new Error("useLevelUpCelebration must be used within a LevelUpCelebrationProvider");
  }
  return context;
}
