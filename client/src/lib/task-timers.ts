import { useSyncExternalStore } from "react";

// Contador del tiempo de arranque de una tarea de "Tareas de hoy" (botón ▶ al lado de "X min").
// El tiempo asignado es un empujón para empezar, no lo que dura la tarea: cuenta para atrás
// ("5 min", "4 min"…) y al llegar a cero no corta — sigue contando para arriba sin hacer ruido
// ("✓ 5 · llevo 12 min"), así entrar en flow no tiene un final puesto. Se detiene recién al
// confirmar la tarea (pauseTaskTimer), y queda registrado cuánto se llevó.
// Vive en localStorage para que siga corriendo aunque se cierre el modal o se recargue. La key
// es el día y la tarea (no los minutos): un arranque ya cumplido sigue cumplido aunque después
// se le cambie el tiempo; para volver a contar está "Reiniciar tiempo" (clearTaskTimer).
// starterMs: el tiempo de arranque con el que se empezó a contar (cumplido = elapsed >= starterMs).
export type TaskTimerState =
  | { status: "running"; since: number; elapsedBeforeMs: number; starterMs: number }
  | { status: "paused"; elapsedMs: number; starterMs: number };

const TIMERS_KEY = "today-task-timers";
// Tareas con hora de inicio ("Empieza a las") que ya se pasaron solas a "Ahora" al llegar esa
// hora (una sola vez, así si después se la mueve a mano no vuelve a saltar).
const START_NOW_KEY = "today-start-now";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin storage: el timer funciona igual mientras la página siga abierta.
  }
}

// Solo se conservan las entradas de hoy: las de días anteriores ya no se usan.
function pruneToDate<T>(record: Record<string, T>, date: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k.startsWith(`${date}|`)));
}

// Formatos viejos: keys con los minutos ("día|tarea|10") y estados de pura cuenta regresiva
// ({ endsAt } / { remainingMs } / "finished"). Un arranque que ya se había cumplido se conserva
// como cumplido (sin tiempo registrado); los conteos a medias se descartan.
function migrateLegacy(record: Record<string, any>): Record<string, TaskTimerState> {
  const result: Record<string, TaskTimerState> = {};
  Object.entries(record).forEach(([k, state]) => {
    const parts = k.split("|");
    const key = parts.length > 2 ? parts.slice(0, 2).join("|") : k;
    if (state && typeof state.starterMs === "number") result[key] = state;
    else if (state?.status === "finished" && !result[key]) result[key] = { status: "paused", elapsedMs: 0, starterMs: 0 };
  });
  return result;
}

let timers: Record<string, TaskTimerState> = migrateLegacy(readJson(TIMERS_KEY, {}));
writeJson(TIMERS_KEY, timers);
const listeners = new Set<() => void>();

function setTimer(key: string, state: TaskTimerState) {
  timers = { ...pruneToDate(timers, key.split("|")[0]), [key]: state };
  writeJson(TIMERS_KEY, timers);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function timerElapsedMs(state: TaskTimerState, now = Date.now()) {
  return state.status === "running" ? state.elapsedBeforeMs + (now - state.since) : state.elapsedMs;
}

export function isStarterReached(state: TaskTimerState | undefined, now = Date.now()) {
  return !!state && timerElapsedMs(state, now) >= state.starterMs;
}

// Borra el contador de una tarea: vuelve a "X min ▶" con el tiempo completo.
// keepReached: se usa al guardar el tiempo desde "Asignar tiempo" — un arranque a medias
// empieza de cero, pero uno ya cumplido queda cumplido (y sigue sumando si estaba corriendo).
export function clearTaskTimer(key: string, { keepReached = false }: { keepReached?: boolean } = {}) {
  const state = timers[key];
  if (!state || (keepReached && isStarterReached(state))) return;
  timers = Object.fromEntries(Object.entries(timers).filter(([k]) => k !== key));
  writeJson(TIMERS_KEY, timers);
  listeners.forEach((l) => l());
}

// Detiene el contador guardando lo que se llevó (al confirmar la tarea). No-op si no corría.
export function pauseTaskTimer(key: string) {
  const state = timers[key];
  if (state?.status !== "running") return;
  setTimer(key, { status: "paused", elapsedMs: timerElapsedMs(state), starterMs: state.starterMs });
}

export function taskTimerKey(date: string, taskKey: string) {
  return `${date}|${taskKey}`;
}

export function useTaskTimer(key: string | null, minutes: number) {
  const state = useSyncExternalStore(subscribe, () => (key ? timers[key] : undefined));
  const start = () => {
    if (!key) return;
    if (state?.status === "paused") {
      setTimer(key, { status: "running", since: Date.now(), elapsedBeforeMs: state.elapsedMs, starterMs: state.starterMs });
    } else if (!state) {
      setTimer(key, { status: "running", since: Date.now(), elapsedBeforeMs: 0, starterMs: minutes * 60_000 });
    }
  };
  const pause = () => {
    if (key) pauseTaskTimer(key);
  };
  return { state, start, pause };
}

// Todos los contadores guardados (para detener los de tareas ya confirmadas).
export function useAllTaskTimers() {
  return useSyncExternalStore(subscribe, () => timers);
}

// "En flow": algún contador de hoy ya pasó su tiempo de arranque y sigue sumando. Mientras
// tanto, "Tareas de hoy" no mueve tareas a "Ahora" ni muestra cuánto queda hasta una hora límite.
export function isFlowActive(all: Record<string, TaskTimerState>, date: string, now = Date.now()) {
  return Object.entries(all).some(
    ([k, state]) => k.startsWith(`${date}|`) && state.status === "running" && isStarterReached(state, now)
  );
}

export function wasStartTimeNowApplied(flag: string): boolean {
  return !!readJson<Record<string, true>>(START_NOW_KEY, {})[flag];
}

export function markStartTimeNowApplied(flag: string) {
  const all = pruneToDate(readJson<Record<string, true>>(START_NOW_KEY, {}), flag.split("|")[0]);
  writeJson(START_NOW_KEY, { ...all, [flag]: true });
}
