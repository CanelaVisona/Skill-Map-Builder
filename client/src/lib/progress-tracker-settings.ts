// Preferencias personales (solo cliente) del Progress Tracker: en qué orden se ven las
// áreas/quests dentro de cada sección y cuáles están ocultas. Es preferencia de visualización,
// no data de la app, así que vive en localStorage y no se sincroniza a ningún lado.
const STORAGE_KEY = "progressTrackerPrefs";

export interface ProgressTrackerPrefs {
  // Secuencia de claves (`${type}-${id}`) con el orden elegido a mano. Las claves que no
  // figuran acá conservan su orden natural, después de las ordenadas.
  order: string[];
  // Claves ocultas. Se muestran aparte, en la lista "Ocultos".
  hidden: string[];
}

const EMPTY_PREFS: ProgressTrackerPrefs = { order: [], hidden: [] };

export function loadProgressTrackerPrefs(): ProgressTrackerPrefs {
  if (typeof window === "undefined") return EMPTY_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PREFS;
    const parsed = JSON.parse(raw) as Partial<ProgressTrackerPrefs>;
    return {
      order: Array.isArray(parsed.order) ? parsed.order.filter((k) => typeof k === "string") : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((k) => typeof k === "string") : [],
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
