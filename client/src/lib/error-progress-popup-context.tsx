import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ErrorProgressPopup, ERROR_POPUP_VISIBLE_MS, type ErrorProgressSnapshot } from "@/components/ErrorProgressPopup";
import { markPopupActive } from "@/lib/popup-coordinator";

interface ErrorProgressPopupContextValue {
  showErrorProgressPopup: (snapshot: ErrorProgressSnapshot) => void;
  hideErrorProgressPopup: () => void;
}

const ErrorProgressPopupContext = createContext<ErrorProgressPopupContextValue | undefined>(undefined);

export function ErrorProgressPopupProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ErrorProgressSnapshot | null>(null);

  const showErrorProgressPopup = useCallback((nextSnapshot: ErrorProgressSnapshot) => {
    markPopupActive(ERROR_POPUP_VISIBLE_MS);
    setSnapshot(nextSnapshot);
  }, []);

  const hideErrorProgressPopup = useCallback(() => {
    setSnapshot(null);
  }, []);

  return (
    <ErrorProgressPopupContext.Provider value={{ showErrorProgressPopup, hideErrorProgressPopup }}>
      {children}
      <ErrorProgressPopup snapshot={snapshot} onClose={hideErrorProgressPopup} />
    </ErrorProgressPopupContext.Provider>
  );
}

export function useErrorProgressPopup() {
  const context = useContext(ErrorProgressPopupContext);
  if (!context) {
    throw new Error("useErrorProgressPopup must be used within an ErrorProgressPopupProvider");
  }
  return context;
}
