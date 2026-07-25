import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { LevelUpCelebration, type LevelUpCelebrationState } from "@/components/LevelUpCelebration";

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
    setCelebration(state);
    hideTimer.current = window.setTimeout(() => setCelebration(null), 1800);
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
