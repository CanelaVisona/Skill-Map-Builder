import { useEffect, useSyncExternalStore } from "react";

// Cuenta regresiva del tiempo asignado a una tarea de "Tareas de hoy" (botón ▶ al lado de
// "X min"). Vive en localStorage para que siga corriendo aunque se cierre el modal o se recargue.
// La key incluye el día y los minutos: cambiar el tiempo de la tarea arranca un timer nuevo.
export type TaskTimerState =
  | { status: "running"; endsAt: number }
  | { status: "paused"; remainingMs: number }
  | { status: "finished" };

const TIMERS_KEY = "today-task-timers";
// Tareas con hora de inicio ("Empieza a las") que ya se pasaron solas a "Ahora" al llegar esa hora (una sola vez,
// así si después se la mueve a mano no vuelve a saltar).
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

let timers: Record<string, TaskTimerState> = readJson(TIMERS_KEY, {});
const listeners = new Set<() => void>();

function setTimer(key: string, state: TaskTimerState) {
  timers = { ...pruneToDate(timers, key.split("|")[0]), [key]: state };
  writeJson(TIMERS_KEY, timers);
  listeners.forEach((l) => l());
}

// Borra la cuenta regresiva de una tarea (cualquier cantidad de minutos): se usa al guardar su
// tiempo desde "Asignar tiempo", así quitarlo y volver a ponerlo arranca el conteo de cero.
export function clearTaskTimers(date: string, taskKey: string) {
  const prefix = `${date}|${taskKey}|`;
  if (!Object.keys(timers).some((k) => k.startsWith(prefix))) return;
  timers = Object.fromEntries(Object.entries(timers).filter(([k]) => !k.startsWith(prefix)));
  writeJson(TIMERS_KEY, timers);
  listeners.forEach((l) => l());
}

export function taskTimerKey(date: string, taskKey: string, minutes: number) {
  return `${date}|${taskKey}|${minutes}`;
}

export function useTaskTimer(key: string | null, minutes: number) {
  const state = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (key ? timers[key] : undefined)
  );

  // Llegó a cero: deja de contar y queda terminado (tilde).
  useEffect(() => {
    if (!key || state?.status !== "running") return;
    const finishIn = state.endsAt - Date.now();
    if (finishIn <= 0) {
      setTimer(key, { status: "finished" });
      return;
    }
    const id = setTimeout(() => setTimer(key, { status: "finished" }), finishIn);
    return () => clearTimeout(id);
  }, [key, state]);

  const start = () => {
    if (!key) return;
    const remainingMs = state?.status === "paused" ? state.remainingMs : minutes * 60_000;
    setTimer(key, { status: "running", endsAt: Date.now() + remainingMs });
  };
  const pause = () => {
    if (!key || state?.status !== "running") return;
    setTimer(key, { status: "paused", remainingMs: Math.max(0, state.endsAt - Date.now()) });
  };
  return { state, start, pause };
}

export function wasStartTimeNowApplied(flag: string): boolean {
  return !!readJson<Record<string, true>>(START_NOW_KEY, {})[flag];
}

export function markStartTimeNowApplied(flag: string) {
  const all = pruneToDate(readJson<Record<string, true>>(START_NOW_KEY, {}), flag.split("|")[0]);
  writeJson(START_NOW_KEY, { ...all, [flag]: true });
}
