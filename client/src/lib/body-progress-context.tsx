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

interface BodyProgressContextValue {
  progress: BodyProgressState;
  getZoneProgress: (zone: BodyZone, dimension: BodyDimension) => ZoneProgress;
  addBodyBlock: (zone: BodyZone, dimension: BodyDimension) => { before: ZoneProgress; after: ZoneProgress };
  resetAll: () => void;
}

const BodyProgressContext = createContext<BodyProgressContextValue | undefined>(undefined);

export function BodyProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<BodyProgressState>(() => loadState());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

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
    return { before, after };
  };

  const resetAll = () => setProgress(defaultState());

  return (
    <BodyProgressContext.Provider value={{ progress, getZoneProgress, addBodyBlock, resetAll }}>
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
