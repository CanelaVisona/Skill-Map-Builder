// Coordina el timing entre los distintos pop-ups de "progreso creciendo" (XP, área, cuerpo,
// nivel, hoy, quest updated) para que un pop-up nuevo pueda esperar a que los demás terminen
// antes de aparecer, en vez de solaparse en pantalla. No reemplaza el estado de cada pop-up
// (cada uno sigue siendo dueño de su propio snapshot); solo lleva un registro compartido de
// "ocupado hasta".

// Todos los pop-ups de esta familia se muestran exactamente el mismo tiempo, para que la
// secuencia (uno atrás del otro, nunca solapados) sea predecible.
export const POPUP_VISIBLE_MS = 1500;

let busyUntil = 0;

export function markPopupActive(durationMs: number) {
  const until = Date.now() + durationMs;
  if (until > busyUntil) {
    busyUntil = until;
  }
}

export function getPopupBusyDelay(): number {
  return Math.max(0, busyUntil - Date.now());
}
