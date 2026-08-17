import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { BugProgressPopup, type BugProgressSnapshot } from "@/components/BugProgressPopup";
import { markPopupActive, POPUP_VISIBLE_MS } from "@/lib/popup-coordinator";

interface BugProgressPopupContextValue {
  showBugProgressPopup: (snapshot: BugProgressSnapshot) => void;
  hideBugProgressPopup: () => void;
}

const BugProgressPopupContext = createContext<BugProgressPopupContextValue | undefined>(undefined);

export function BugProgressPopupProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<BugProgressSnapshot | null>(null);

  const showBugProgressPopup = useCallback((nextSnapshot: BugProgressSnapshot) => {
    markPopupActive(POPUP_VISIBLE_MS);
    setSnapshot(nextSnapshot);
  }, []);

  const hideBugProgressPopup = useCallback(() => {
    setSnapshot(null);
  }, []);

  return (
    <BugProgressPopupContext.Provider value={{ showBugProgressPopup, hideBugProgressPopup }}>
      {children}
      <BugProgressPopup snapshot={snapshot} onClose={hideBugProgressPopup} />
    </BugProgressPopupContext.Provider>
  );
}

export function useBugProgressPopup() {
  const context = useContext(BugProgressPopupContext);
  if (!context) {
    throw new Error("useBugProgressPopup must be used within a BugProgressPopupProvider");
  }
  return context;
}
