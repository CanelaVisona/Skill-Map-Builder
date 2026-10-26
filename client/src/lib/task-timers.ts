import { useEffect, useSyncExternalStore } from "react";

// Contador del tiempo de arranque de una tarea de "Tareas de hoy" (botón ▶ al lado de "X min").
// El tiempo asignado es un empujón para empezar, no lo que dura la tarea: cuenta para atrás
// ("5 min", "4 min"…) y al llegar a cero no corta — sigue contando para arriba sin hacer ruido
// ("✓ 5 · llevo 12 min"), así entrar en flow no tiene un final puesto. Se detiene recién al
// confirmar la tarea (pauseTaskTimer), y queda registrado cuánto se llevó.
// Se guarda en la base (tabla task_timers, /api/task-timers): se ve igual en todos los
// dispositivos y no depende del navegador. No guarda "cuánto falta" sino desde cuándo corre, así
// que sigue contando bien aunque la página esté cerrada o el servidor se reinicie.
// La key es el día y la tarea (no los minutos): un arranque ya cumplido sigue cumplido aunque
// después se le cambie el tiempo; para volver a contar está "Reiniciar tiempo" (clearTaskTimer).
// starterMs: el tiempo de arranque con el que se empezó a contar (cumplido = elapsed >= starterMs).
export type TaskTimerState =
  | { status: "running"; since: number; elapsedBeforeMs: number; starterMs: number }
  | { status: "paused"; elapsedMs: number; starterMs: number };

type TaskTimerRow = {
  date: string;
  taskKey: string;
  status: "running" | "paused";
  since: number | null;
  elapsedMs: number;
  starterMs: number;
};

// Cada contador se guarda bajo la key del día que se está viendo (`${día}|${tarea}`), pero puede
// venir de una fila de otro día: uno que sigue corriendo desde antes de la medianoche (rowDate).
// Los cambios se escriben en esa fila, no en una nueva.
type Entry = { rowDate: string; taskKey: string; state: TaskTimerState };

let entries: Record<string, Entry> = {};
let timers: Record<string, TaskTimerState> = {};
const listeners = new Set<() => void>();
// Escrituras todavía en viaje: mientras haya alguna, una lectura del server puede traer datos
// viejos y no se aplica (la siguiente sincronización la trae ya actualizada).
let pendingWrites = 0;
let localVersion = 0;

function emit() {
  timers = Object.fromEntries(Object.entries(entries).map(([k, e]) => [k, e.state]));
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function splitKey(key: string) {
  const i = key.indexOf("|");
  return { date: key.slice(0, i), taskKey: key.slice(i + 1) };
}

function toRow(rowDate: string, taskKey: string, state: TaskTimerState): TaskTimerRow {
  return state.status === "running"
    ? { date: rowDate, taskKey, status: "running", since: state.since, elapsedMs: state.elapsedBeforeMs, starterMs: state.starterMs }
    : { date: rowDate, taskKey, status: "paused", since: null, elapsedMs: state.elapsedMs, starterMs: state.starterMs };
}

function fromRow(row: TaskTimerRow): TaskTimerState {
  return row.status === "running"
    ? { status: "running", since: Number(row.since), elapsedBeforeMs: Number(row.elapsedMs), starterMs: Number(row.starterMs) }
    : { status: "paused", elapsedMs: Number(row.elapsedMs), starterMs: Number(row.starterMs) };
}

function write(request: Promise<Response>) {
  localVersion++;
  pendingWrites++;
  request
    .catch((error) => console.error("Error guardando el contador de la tarea:", error))
    .finally(() => {
      pendingWrites--;
    });
}

function setTimer(key: string, state: TaskTimerState) {
  const { date, taskKey } = splitKey(key);
  const rowDate = entries[key]?.rowDate ?? date;
  entries = { ...entries, [key]: { rowDate, taskKey, state } };
  emit();
  write(
    fetch("/api/task-timers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toRow(rowDate, taskKey, state)),
    })
  );
}

// Contadores que quedaron en localStorage de la versión anterior: se suben una sola vez (solo
// los de ese día que el server no tenga) y se borran del navegador.
const LEGACY_TIMERS_KEY = "today-task-timers";
let legacyMigrated = false;
function migrateLegacyTimers(date: string) {
  if (legacyMigrated) return;
  legacyMigrated = true;
  let legacy: Record<string, any> = {};
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_TIMERS_KEY) || "{}");
    localStorage.removeItem(LEGACY_TIMERS_KEY);
  } catch {
    return;
  }
  Object.entries(legacy).forEach(([k, state]) => {
    const key = k.split("|").slice(0, 2).join("|");
    if (!key.startsWith(`${date}|`) || entries[key]) return;
    if (state && typeof state.starterMs === "number") setTimer(key, state as TaskTimerState);
    else if (state?.status === "finished") setTimer(key, { status: "paused", elapsedMs: 0, starterMs: 0 });
  });
}

// Trae los contadores del día (y los que siguen corriendo de días anteriores) desde el server.
export async function loadTaskTimers(date: string) {
  const version = localVersion;
  try {
    const res = await fetch(`/api/task-timers?date=${date}`);
    if (!res.ok) return;
    const rows = (await res.json()) as TaskTimerRow[];
    if (version !== localVersion || pendingWrites > 0) return;
    const next: Record<string, Entry> = {};
    rows
      .filter((r) => r.date === date)
      .forEach((r) => (next[`${date}|${r.taskKey}`] = { rowDate: date, taskKey: r.taskKey, state: fromRow(r) }));
    // Corriendo desde otro día: se muestra en la misma tarea de hoy, si no tiene uno propio.
    rows
      .filter((r) => r.date !== date)
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((r) => {
        const key = `${date}|${r.taskKey}`;
        if (!next[key]) next[key] = { rowDate: r.date, taskKey: r.taskKey, state: fromRow(r) };
      });
    entries = next;
    emit();
    migrateLegacyTimers(date);
  } catch (error) {
    console.error("Error cargando los contadores de las tareas:", error);
  }
}

// Mantiene los contadores sincronizados mientras "Tareas de hoy" está abierto: al abrir, cada
// minuto y al volver a la pestaña (por si se tocó ▶ o se confirmó algo en otro dispositivo).
export function useTaskTimersSync(date: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    loadTaskTimers(date);
    const id = setInterval(() => loadTaskTimers(date), 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") loadTaskTimers(date);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [date, enabled]);
}

export function timerElapsedMs(state: TaskTimerState, now = Date.now()) {
  return state.status === "running" ? state.elapsedBeforeMs + (now - state.since) : state.elapsedMs;
}

export function isStarterReached(state: TaskTimerState | undefined, now = Date.now()) {
  return !!state && timerElapsedMs(state, now) >= state.starterMs;
}

// Día de la fila de la que viene el contador (distinto del día de la key si sigue corriendo
// desde antes de la medianoche).
export function taskTimerRowDate(key: string) {
  return entries[key]?.rowDate ?? splitKey(key).date;
}

// Borra el contador de una tarea: vuelve a "X min ▶" con el tiempo completo.
// keepReached: se usa al guardar el tiempo desde "Asignar tiempo" — un arranque a medias
// empieza de cero, pero uno ya cumplido queda cumplido (y sigue sumando si estaba corriendo).
export function clearTaskTimer(key: string, { keepReached = false }: { keepReached?: boolean } = {}) {
  const entry = entries[key];
  if (!entry || (keepReached && isStarterReached(entry.state))) return;
  entries = Object.fromEntries(Object.entries(entries).filter(([k]) => k !== key));
  emit();
  write(
    fetch(`/api/task-timers?date=${entry.rowDate}&taskKey=${encodeURIComponent(entry.taskKey)}`, { method: "DELETE" })
  );
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

// Todos los contadores cargados (para detener los de tareas ya confirmadas).
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

// Tareas con hora de inicio ("Empieza a las") que ya se pasaron solas a "Ahora" al llegar esa
// hora (una sola vez, así si después se la mueve a mano no vuelve a saltar).
const START_NOW_KEY = "today-start-now";

function readFlags(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(START_NOW_KEY) || "{}");
  } catch {
    return {};
  }
}

export function wasStartTimeNowApplied(flag: string): boolean {
  return !!readFlags()[flag];
}

export function markStartTimeNowApplied(flag: string) {
  const date = flag.split("|")[0];
  const kept = Object.fromEntries(Object.entries(readFlags()).filter(([k]) => k.startsWith(`${date}|`)));
  try {
    localStorage.setItem(START_NOW_KEY, JSON.stringify({ ...kept, [flag]: true }));
  } catch {
    // Sin storage: puede volver a pasar a "Ahora" al recargar, nada más.
  }
}
