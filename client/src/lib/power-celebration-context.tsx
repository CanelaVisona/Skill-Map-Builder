import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { PowerCelebration, type PowerCelebrationState } from "@/components/PowerCelebration";
import { markPopupActive, POPUP_VISIBLE_MS } from "@/lib/popup-coordinator";
import { playLevelUpSound, playProgressAdvanceSound } from "@/lib/sound";

interface PowerCelebrationContextValue {
  showPowerCelebration: (state: PowerCelebrationState) => void;
}

const PowerCelebrationContext = createContext<PowerCelebrationContextValue | undefined>(undefined);

export function PowerCelebrationProvider({ children }: { children: ReactNode }) {
  const [celebration, setCelebration] = useState<PowerCelebrationState | null>(null);
  const hideTimer = useRef<number | null>(null);

  const showPowerCelebration = useCallback((state: PowerCelebrationState) => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
    }
    markPopupActive(POPUP_VISIBLE_MS);
    setCelebration(state);
    // "unlocked" reuses the same chime as a skill's progress bar advancing; "confirmed"
    // (poder dominado) reuses the level-up clip, same treatment as ¡Subiste de nivel!.
    if (state.kind === "unlocked") {
      playProgressAdvanceSound();
    } else {
      playLevelUpSound();
    }
    hideTimer.current = window.setTimeout(() => setCelebration(null), POPUP_VISIBLE_MS);
  }, []);

  return (
    <PowerCelebrationContext.Provider value={{ showPowerCelebration }}>
      {children}
      <PowerCelebration celebration={celebration} />
    </PowerCelebrationContext.Provider>
  );
}

export function usePowerCelebration() {
  const context = useContext(PowerCelebrationContext);
  if (!context) {
    throw new Error("usePowerCelebration must be used within a PowerCelebrationProvider");
  }
  return context;
}
