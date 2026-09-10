// Preferencias personales (solo cliente) del Progress Tracker: en qué orden se ven las
// áreas/quests dentro de cada sección y cuáles están en "Próximos" (apagadas, con o sin
// fecha de reaparición). Es preferencia de visualización, no data de la app, así que vive
// en localStorage y no se sincroniza a ningún lado.
const STORAGE_KEY = "progressTrackerPrefs";

export interface ProgressTrackerPrefs {
  // Secuencia de claves (`${type}-${id}`) con el orden elegido a mano. Las claves que no
  // figuran acá conservan su orden natural, después de las ordenadas.
  order: string[];
  // "Próximos": clave -> fecha ISO en la que la quest vuelve sola al tracker. Cadena vacía
  // = oculta sin fecha, solo reaparece si se la muestra a mano. Unifica lo que antes eran
  // "Ocultos" (sin fecha) y "Próximos" (con fecha). Es preferencia de visualización local:
  // NO toca el estado global (`upcoming`) del área/quest.
  hidden: Record<string, string>;
}

const EMPTY_PREFS: ProgressTrackerPrefs = { order: [], hidden: {} };

export function loadProgressTrackerPrefs(): ProgressTrackerPrefs {
  if (typeof window === "undefined") return EMPTY_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PREFS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const hidden: Record<string, string> = {};
    // Formato viejo: `hidden` era un array de claves sin fecha.
    if (Array.isArray(parsed.hidden)) {
      for (const key of parsed.hidden) if (typeof key === "string") hidden[key] = "";
    } else if (parsed.hidden && typeof parsed.hidden === "object") {
      for (const [key, value] of Object.entries(parsed.hidden as Record<string, unknown>)) {
        if (typeof value === "string") hidden[key] = value;
      }
    }
    // Formato viejo: `scheduled` era un mapa aparte -> se fusiona en `hidden`.
    if (parsed.scheduled && typeof parsed.scheduled === "object") {
      for (const [key, value] of Object.entries(parsed.scheduled as Record<string, unknown>)) {
        if (typeof value === "string") hidden[key] = value;
      }
    }
    return {
      order: Array.isArray(parsed.order) ? (parsed.order as unknown[]).filter((k): k is string => typeof k === "string") : [],
      hidden,
    };
  } catch {
    return EMPTY_PREFS;
  }
}

export function saveProgressTrackerPrefs(prefs: ProgressTrackerPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Sin espacio / storage deshabilitado: la preferencia simplemente no persiste.
  }
}

// Ordena una lista según `order`; lo que no está en `order` queda en su orden original, al final.
export function applyManualOrder<T>(items: T[], keyOf: (item: T) => string, order: string[]): T[] {
  if (order.length === 0) return items;
  const rank = new Map(order.map((key, index) => [key, index]));
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ra = rank.has(keyOf(a.item)) ? (rank.get(keyOf(a.item)) as number) : Number.POSITIVE_INFINITY;
      const rb = rank.has(keyOf(b.item)) ? (rank.get(keyOf(b.item)) as number) : Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

// Devuelve un `order` nuevo donde `sectionKeys` (ya reordenadas) quedan fijadas. El orden
// entre secciones distintas no importa: cada sección se ordena por su cuenta.
export function fixSectionOrder(prevOrder: string[], sectionKeys: string[]): string[] {
  const sectionSet = new Set(sectionKeys);
  return [...prevOrder.filter((key) => !sectionSet.has(key)), ...sectionKeys];
}
