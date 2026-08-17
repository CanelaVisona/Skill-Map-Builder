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

// Cadena de pop-ups "en vuelo" (p.ej. otorgar XP a los skills linkeados a un hábito/práctica y
// hacer crecer los componentes corporales linkeados, uno por uno). A diferencia de busyUntil
// (una ventana de tiempo), esto es un conteo booleano que el llamador abre de forma SÍNCRONA
// apenas arranca la acción, antes de esperar cualquier fetch. El pop-up de progreso de hoy
// reacciona a cambios de estado de forma asíncrona y podría ganarle la carrera a markPopupActive
// si esta solo se llama cuando el primer pop-up de la cadena efectivamente se muestra (después
// del fetch); chequeando también esta cadena, sabe desde el primer instante que tiene que
// esperar a que termine, garantizando que siempre se muestre último.
let pendingChains = 0;

export function beginPopupChain() {
  pendingChains += 1;
}

export function endPopupChain() {
  pendingChains = Math.max(0, pendingChains - 1);
}

export function hasPendingPopupChain(): boolean {
  return pendingChains > 0;
}

// Ejecuta una cola de pop-ups de "progreso" (XP de skill, crecimiento corporal) de a uno,
// respetando busyUntil en vez de un desfasaje fijo: cada tarea vuelve a chequear si hay algo
// activo (propio o ajeno) recién antes de mostrarse, en vez de dispararse en un horario fijo
// calculado de entrada que puede quedar corto si algo más se cuela en el medio. Llama a
// onComplete cuando la cola termina (incluso si está vacía), para que el llamador pueda cerrar
// una cadena abierta con endPopupChain.
export function runPopupQueue(tasks: Array<() => void>, onComplete?: () => void) {
  let index = 0;
  const attempt = () => {
    if (index >= tasks.length) {
      onComplete?.();
      return;
    }
    const delay = getPopupBusyDelay();
    if (delay > 0) {
      setTimeout(attempt, delay + 150);
      return;
    }
    tasks[index]();
    index += 1;
    setTimeout(attempt, 150);
  };
  attempt();
}

// Promise wrapper around runPopupQueue, for callers that need to await a batch of pop-ups
// having all been triggered before moving on to their next step (e.g. the node-confirm
// sequence in SkillNode.tsx, which animates one element away per batch of pop-ups shown).
export function runPopupQueueAsync(tasks: Array<() => void>): Promise<void> {
  return new Promise((resolve) => runPopupQueue(tasks, resolve));
}
