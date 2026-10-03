import { useSyncExternalStore } from "react";

// Nodo al que se le eligió "Ahora" en "When exactly?" y que todavía no se ubicó en el lugar de
// la tarea desbloqueada de "Tareas de hoy". La ubicación exacta la resuelve TodayProgressModal,
// que es el único que conoce el orden visual completo de la franja (incluidos los ítems sin fila
// propia, como los hábitos con franja por defecto) y qué tareas están hechas.
export interface NowPlacement {
  date: string;
  nodeId: string;
}

let current: NowPlacement | null = null;
const listeners = new Set<() => void>();

export function setNowPlacement(value: NowPlacement | null) {
  current = value;
  listeners.forEach((l) => l());
}

export function useNowPlacement(): NowPlacement | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current
  );
}
