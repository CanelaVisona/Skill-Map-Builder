import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type BodyZone = "brazos" | "abdomen" | "piernas" | "mente";
export type BodyDimension = "fuerza" | "flex";

export interface ZoneProgress {
  lvl: number;
  val: number;
}

export const BODY_BLOCKS = 10;
export const BODY_ZONES: BodyZone[] = ["brazos", "abdomen", "piernas", "mente"];
export const BODY_ZONE_LABELS: Record<BodyZone, string> = {
  brazos: "Brazos",
  abdomen: "Abdomen",
  piernas: "Piernas",
  mente: "Mente",
};
export const BODY_DIMENSION_LABELS: Record<BodyDimension, string> = {
  fuerza: "Fuerza",
  flex: "Flexibilidad",
};

export type BodyLinkValue = `${BodyZone}:${BodyDimension}` | "";

export const BODY_LINK_OPTIONS: { value: BodyLinkValue; zone: BodyZone; dimension: BodyDimension; label: string }[] =
  BODY_ZONES.flatMap((zone) =>
    (["fuerza", "flex"] as BodyDimension[]).map((dimension) => ({
      value: `${zone}:${dimension}` as BodyLinkValue,
      zone,
      dimension,
      label: `${BODY_ZONE_LABELS[zone]} · ${BODY_DIMENSION_LABELS[dimension]}`,
    }))
  );

export function parseBodyLink(value: string | null | undefined): { zone: BodyZone; dimension: BodyDimension } | null {
  if (!value || !value.includes(":")) return null;
  const [zone, dimension] = value.split(":");
  return BODY_ZONES.includes(zone as BodyZone) && (dimension === "fuerza" || dimension === "flex")
    ? { zone: zone as BodyZone, dimension: dimension as BodyDimension }
    : null;
}

type BodyKey = `${BodyZone}-f` | `${BodyZone}-x`;
type BodyProgressState = Record<BodyKey, ZoneProgress>;

const STORAGE_KEY = "skill-map-body-progress-v1";

export function bodyKeyFor(zone: BodyZone, dimension: BodyDimension): BodyKey {
  return `${zone}-${dimension === "fuerza" ? "f" : "x"}` as BodyKey;
}

function defaultState(): BodyProgressState {
  const state = {} as BodyProgressState;
  for (const zone of BODY_ZONES) {
    state[bodyKeyFor(zone, "fuerza")] = { lvl: 1, val: 0 };
    state[bodyKeyFor(zone, "flex")] = { lvl: 1, val: 0 };
  }
  return state;
}

function loadState(): BodyProgressState {
  if (typeof window === "undefined") return defaultState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();

    const parsed = JSON.parse(raw) as Partial<Record<BodyKey, Partial<ZoneProgress>>>;
    const state = defaultState();

    for (const zone of BODY_ZONES) {
      for (const dimension of ["fuerza", "flex"] as BodyDimension[]) {
        const key = bodyKeyFor(zone, dimension);
        const entry = parsed[key];
        if (entry && typeof entry.lvl === "number" && typeof entry.val === "number") {
          state[key] = {
            lvl: Math.max(1, Math.floor(entry.lvl)),
            val: Math.max(0, Math.min(BODY_BLOCKS - 1, Math.floor(entry.val))),
          };
        }
      }
    }

    return state;
  } catch {
    return defaultState();
  }
}

interface BodyProgressServerRow {
  zone: BodyZone;
  dimension: BodyDimension;
  lvl: number;
  val: number;
}

function applyServerRows(rows: BodyProgressServerRow[]): BodyProgressState {
  const state = defaultState();
  for (const row of rows) {
    const key = bodyKeyFor(row.zone, row.dimension);
    if (key in state && typeof row.lvl === "number" && typeof row.val === "number") {
      state[key] = { lvl: Math.max(1, Math.floor(row.lvl)), val: Math.max(0, Math.min(BODY_BLOCKS - 1, Math.floor(row.val))) };
    }
  }
  return state;
}

interface BodyProgressContextValue {
  progress: BodyProgressState;
  getZoneProgress: (zone: BodyZone, dimension: BodyDimension) => ZoneProgress;
  addBodyBlock: (zone: BodyZone, dimension: BodyDimension) => { before: ZoneProgress; after: ZoneProgress };
  resetAll: () => void;
  refetch: () => void;
}

const BodyProgressContext = createContext<BodyProgressContextValue | undefined>(undefined);

export function BodyProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<BodyProgressState>(() => loadState());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  // El servidor es la fuente de verdad entre dispositivos; localStorage solo pinta instantáneo
  // mientras se resuelve el fetch (y sirve de caché si no hay red).
  const fetchFromServer = async () => {
    try {
      const res = await fetch("/api/body-progress");
      if (!res.ok) return;
      const rows = (await res.json()) as BodyProgressServerRow[];
      if (Array.isArray(rows)) {
        setProgress(applyServerRows(rows));
      }
    } catch (error) {
      console.error("Error loading body progress from server:", error);
    }
  };

  useEffect(() => {
    fetchFromServer();

    const onFocus = () => fetchFromServer();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const persistToServer = (zone: BodyZone, dimension: BodyDimension, after: ZoneProgress) => {
    fetch("/api/body-progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zone, dimension, lvl: after.lvl, val: after.val }),
    }).catch((error) => console.error("Error saving body progress to server:", error));
  };

  const getZoneProgress = (zone: BodyZone, dimension: BodyDimension) => progress[bodyKeyFor(zone, dimension)];

  const addBodyBlock = (zone: BodyZone, dimension: BodyDimension) => {
    const key = bodyKeyFor(zone, dimension);
    const before = progress[key];
    let { lvl, val } = before;
    val += 1;
    if (val >= BODY_BLOCKS) {
      lvl += 1;
      val -= BODY_BLOCKS;
    }
    const after: ZoneProgress = { lvl, val };
    setProgress((prev) => ({ ...prev, [key]: after }));
    persistToServer(zone, dimension, after);
    return { before, after };
  };

  const resetAll = () => setProgress(defaultState());

  return (
    <BodyProgressContext.Provider value={{ progress, getZoneProgress, addBodyBlock, resetAll, refetch: fetchFromServer }}>
      {children}
    </BodyProgressContext.Provider>
  );
}

export function useBodyProgress() {
  const context = useContext(BodyProgressContext);
  if (!context) {
    throw new Error("useBodyProgress must be used within a BodyProgressProvider");
  }
  return context;
}
