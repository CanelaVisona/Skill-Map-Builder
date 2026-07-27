import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { TodayProgressGainPopup, type TodayProgressGainSnapshot } from "@/components/TodayProgressGainPopup";
import { useTodayProgressSummary } from "@/lib/useTodayProgressSummary";
import { getPopupBusyDelay, markPopupActive } from "@/lib/popup-coordinator";

interface TodayProgressPopupContextValue {
  showTodayProgressPopup: (snapshot: TodayProgressGainSnapshot) => void;
}

const TodayProgressPopupContext = createContext<TodayProgressPopupContextValue | undefined>(undefined);

const POPUP_DURATION_MS = 3200;

export function TodayProgressPopupProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<TodayProgressGainSnapshot | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCompletedRef = useRef<number | null>(null);

  const hidePopup = () => setSnapshot(null);

  const showTodayProgressPopup = (nextSnapshot: TodayProgressGainSnapshot) => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);

    // Espera a que terminen los demás pop-ups de progreso (XP, área, cuerpo, nivel) antes de
    // aparecer, para no solaparse con ellos en pantalla.
    const delay = getPopupBusyDelay() + 250;
    showTimerRef.current = setTimeout(() => {
      markPopupActive(POPUP_DURATION_MS);
      setSnapshot(nextSnapshot);
      closeTimerRef.current = setTimeout(() => setSnapshot(null), POPUP_DURATION_MS);
    }, delay);
  };

  // Observa el total/completado de "hoy" en segundo plano (sin depender de que el modal de
  // Tareas de Hoy esté abierto) y dispara el pop-up apenas el completado sube — venga de un
  // hábito, un nodo dominado, una repetición espaciada confirmada, o una tarea manual tildada.
  const { completed, total, isReady } = useTodayProgressSummary();

  useEffect(() => {
    // Mientras algo siga cargando, total/completed van subiendo de a poco con cada consulta
    // que resuelve (no son tareas confirmadas ahora) — hay que esperar a que todo esté listo
    // antes de fijar la base o comparar, si no el pop-up dispara solo con entrar a la página.
    if (!isReady || total === 0) return;

    if (prevCompletedRef.current === null) {
      // Primera vez con todo cargado: solo establece la base, no dispara el pop-up con datos
      // que ya existían antes de entrar.
      prevCompletedRef.current = completed;
      return;
    }

    if (completed > prevCompletedRef.current) {
      showTodayProgressPopup({ completedBefore: prevCompletedRef.current, completedAfter: completed, total });
    }

    prevCompletedRef.current = completed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, total, isReady]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
    };
  }, []);

  return (
    <TodayProgressPopupContext.Provider value={{ showTodayProgressPopup }}>
      {children}
      <TodayProgressGainPopup snapshot={snapshot} onClose={hidePopup} />
    </TodayProgressPopupContext.Provider>
  );
}

export function useTodayProgressPopup() {
  const context = useContext(TodayProgressPopupContext);
  if (!context) {
    throw new Error("useTodayProgressPopup must be used within a TodayProgressPopupProvider");
  }
  return context;
}
