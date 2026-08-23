import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { ErrorCelebration, type ErrorCelebrationState } from "@/components/ErrorCelebration";
import { markPopupActive, POPUP_VISIBLE_MS } from "@/lib/popup-coordinator";
import { playProgressAdvanceSound, playLevelUpSound } from "@/lib/sound";

interface ErrorCelebrationContextValue {
  showErrorCelebration: (state: ErrorCelebrationState) => void;
}

const ErrorCelebrationContext = createContext<ErrorCelebrationContextValue | undefined>(undefined);

export function ErrorCelebrationProvider({ children }: { children: ReactNode }) {
  const [celebration, setCelebration] = useState<ErrorCelebrationState | null>(null);
  const hideTimer = useRef<number | null>(null);

  const showErrorCelebration = useCallback((state: ErrorCelebrationState) => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
    }
    markPopupActive(POPUP_VISIBLE_MS);
    setCelebration(state);
    // "detected" reusa el chime de progreso (mismo trato que "Poder desbloqueado"); "vencido"
    // reusa el mismo sonido que "Poder dominado" (playLevelUpSound), mismo trato que
    // PowerCelebration le da a su kind "confirmed".
    if (state.kind === "detected") {
      playProgressAdvanceSound();
    } else {
      playLevelUpSound();
    }
    hideTimer.current = window.setTimeout(() => setCelebration(null), POPUP_VISIBLE_MS);
  }, []);

  return (
    <ErrorCelebrationContext.Provider value={{ showErrorCelebration }}>
      {children}
      <ErrorCelebration celebration={celebration} />
    </ErrorCelebrationContext.Provider>
  );
}

export function useErrorCelebration() {
  const context = useContext(ErrorCelebrationContext);
  if (!context) {
    throw new Error("useErrorCelebration must be used within an ErrorCelebrationProvider");
  }
  return context;
}
