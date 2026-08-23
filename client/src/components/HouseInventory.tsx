import { useState, useEffect, useRef, useCallback } from "react";
import type { PointerEvent as ReactPointerEvent, CSSProperties } from "react";
import { useTheme } from "next-themes";
import { Check, ShoppingCart, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { playProgressAdvanceSound } from "@/lib/sound";

export const HOUSE_STORAGE_KEY = "skill-map-house-inventory-v1";

export type HouseStatus = "have" | "missing";

export type HouseGroup = "Cocina" | "Living y Comedor" | "Dormitorio" | "Baño" | "Lavadero" | "Pasillo" | "Patio" | "Otros";

export type HouseItemType =
  | "ollas"
  | "vajilla"
  | "cubiertos"
  | "electrodomesticos"
  | "heladera"
  | "sofa"
  | "mesa"
  | "tv"
  | "decoracion"
  | "iluminacion"
  | "cama"
  | "ropadecama"
  | "placard"
  | "toallas"
  | "ducha"
  | "higiene"
  | "lavarropa"
  | "limpieza"
  | "balde"
  | "espejo"
  | "perchero"
  | "plantas"
  | "parrilla"
  | "reposera"
  | "otro";

export const HOUSE_TYPE_META: Record<HouseItemType, { label: string; group: HouseGroup; emoji: string }> = {
  ollas: { label: "Ollas y sartenes", group: "Cocina", emoji: "🍲" },
  vajilla: { label: "Vajilla", group: "Cocina", emoji: "🍽️" },
  cubiertos: { label: "Cubiertos", group: "Cocina", emoji: "🍴" },
  electrodomesticos: { label: "Electrodomésticos", group: "Cocina", emoji: "🔌" },
  heladera: { label: "Heladera", group: "Cocina", emoji: "🧊" },
  sofa: { label: "Sofá", group: "Living y Comedor", emoji: "🛋️" },
  mesa: { label: "Mesa y sillas", group: "Living y Comedor", emoji: "🪑" },
  tv: { label: "TV", group: "Living y Comedor", emoji: "📺" },
  decoracion: { label: "Decoración", group: "Living y Comedor", emoji: "🖼️" },
  iluminacion: { label: "Iluminación", group: "Living y Comedor", emoji: "💡" },
  cama: { label: "Cama", group: "Dormitorio", emoji: "🛏️" },
  ropadecama: { label: "Sábanas y ropa de cama", group: "Dormitorio", emoji: "🧺" },
  placard: { label: "Placard / Ropero", group: "Dormitorio", emoji: "🚪" },
  toallas: { label: "Toallas y textiles", group: "Baño", emoji: "🧻" },
  ducha: { label: "Ducha / Bañera", group: "Baño", emoji: "🚿" },
  higiene: { label: "Higiene", group: "Baño", emoji: "🧴" },
  lavarropa: { label: "Lavarropa", group: "Lavadero", emoji: "🌀" },
  limpieza: { label: "Productos de limpieza", group: "Lavadero", emoji: "🧹" },
  balde: { label: "Balde y trapos", group: "Lavadero", emoji: "🪣" },
  espejo: { label: "Espejo", group: "Pasillo", emoji: "🪞" },
  perchero: { label: "Perchero", group: "Pasillo", emoji: "🧥" },
  plantas: { label: "Plantas", group: "Patio", emoji: "🌿" },
  parrilla: { label: "Parrilla", group: "Patio", emoji: "🔥" },
  reposera: { label: "Reposera / Sombrilla", group: "Patio", emoji: "⛱️" },
  otro: { label: "Otro", group: "Otros", emoji: "📦" },
};

export const HOUSE_TYPE_ORDER = Object.keys(HOUSE_TYPE_META) as HouseItemType[];
export const HOUSE_GROUP_ORDER: HouseGroup[] = ["Cocina", "Living y Comedor", "Dormitorio", "Baño", "Lavadero", "Pasillo", "Patio", "Otros"];
const HOUSE_GROUP_ICON_TYPE: Record<HouseGroup, HouseItemType> = {
  "Cocina": "ollas",
  "Living y Comedor": "sofa",
  "Dormitorio": "cama",
  "Baño": "ducha",
  "Lavadero": "lavarropa",
  "Pasillo": "espejo",
  "Patio": "plantas",
  "Otros": "otro",
};

export function isHouseItemType(value: unknown): value is HouseItemType {
  return typeof value === "string" && value in HOUSE_TYPE_META;
}

export type HouseItem = {
  id: number;
  name: string;
  type: HouseItemType;
  status: HouseStatus;
  // 1-5 "bloquecitos" ratings, same idea as the clothing inventory — utility (how
  // useful/needed it is), condition (how worn/new it is) and importance (how much
  // it matters to get). Purely descriptive; the actual buy order lives in the
  // priority list tab instead.
  utility: number;
  condition: number;
  importance: number;
};

const now = Date.now();

export const INITIAL_HOUSE_ITEMS: HouseItem[] = [
  { id: now - 6, name: "Juego de ollas", type: "ollas", status: "have", utility: 5, condition: 4, importance: 5 },
  { id: now - 5, name: "Heladera", type: "heladera", status: "have", utility: 5, condition: 4, importance: 5 },
  { id: now - 4, name: "Sofá", type: "sofa", status: "missing", utility: 4, condition: 3, importance: 4 },
  { id: now - 3, name: "Aspiradora", type: "limpieza", status: "missing", utility: 4, condition: 3, importance: 3 },
  { id: now - 2, name: "Mesa de living", type: "mesa", status: "missing", utility: 3, condition: 3, importance: 3 },
  { id: now - 1, name: "Cortina de baño", type: "ducha", status: "missing", utility: 3, condition: 3, importance: 2 },
];

function isValidStatus(value: unknown): value is HouseStatus {
  return value === "have" || value === "missing";
}

function isValidRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function sanitizeHouseItems(input: unknown): HouseItem[] | null {
  if (!Array.isArray(input)) return null;

  const items = input
    .map((item) => {
      const raw = item as Partial<HouseItem>;
      if (typeof raw.id !== "number" || typeof raw.name !== "string" || !isHouseItemType(raw.type) || !isValidStatus(raw.status)) {
        return null;
      }

      return {
        id: raw.id,
        name: raw.name,
        type: raw.type,
        status: raw.status,
        utility: isValidRating(raw.utility) ? raw.utility : 3,
        condition: isValidRating(raw.condition) ? raw.condition : 3,
        importance: isValidRating(raw.importance) ? raw.importance : 3,
      } satisfies HouseItem;
    })
    .filter((item): item is HouseItem => item !== null);

  return items;
}

export function loadStoredHouseItems(): HouseItem[] {
  if (typeof window === "undefined") return INITIAL_HOUSE_ITEMS;

  try {
    const raw = window.localStorage.getItem(HOUSE_STORAGE_KEY);
    if (!raw) return INITIAL_HOUSE_ITEMS;

    const parsed = sanitizeHouseItems(JSON.parse(raw));
    return parsed && parsed.length > 0 ? parsed : INITIAL_HOUSE_ITEMS;
  } catch {
    return INITIAL_HOUSE_ITEMS;
  }
}

// Loads from the server on mount (falling back to whatever's cached locally), then
// keeps localStorage and the server in sync as `items` changes — the same pattern
// ClothingInventory and NecesidadesCasa use, so all three tabs stay consistent with
// each other whichever one was open last.
export function useHouseInventoryItems() {
  const [items, setItems] = useState<HouseItem[]>(() => loadStoredHouseItems());
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [remoteSyncEnabled, setRemoteSyncEnabled] = useState(true);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRemoteItems = async () => {
      try {
        const response = await fetch("/api/house-inventory/items");

        if (response.status === 401) {
          if (!cancelled) {
            setRemoteSyncEnabled(false);
            setRemoteLoaded(true);
          }
          return;
        }

        if (!response.ok) {
          if (!cancelled) setRemoteLoaded(true);
          return;
        }

        const data = (await response.json()) as unknown;
        const safeItems = sanitizeHouseItems(data);
        if (safeItems && safeItems.length > 0 && !cancelled) {
          setItems(safeItems);
        }

        if (!cancelled) setRemoteLoaded(true);
      } catch {
        if (!cancelled) setRemoteLoaded(true);
      }
    };

    void loadRemoteItems();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HOUSE_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (!remoteLoaded || !remoteSyncEnabled) return;

    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);

    saveDebounceRef.current = setTimeout(() => {
      void fetch("/api/house-inventory/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
    }, 400);

    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, [remoteLoaded, remoteSyncEnabled, items]);

  return { items, setItems } as const;
}

export function getHouseColors(isDark: boolean) {
  return {
    pageBg: isDark ? "#0d1117" : "#f5f7fb",
    shellBorder: isDark ? "1px solid #1e2d1e" : "1px solid #d7dce6",
    shellShadow: isDark ? "0 0 40px rgba(74,222,128,0.07)" : "0 8px 30px rgba(17,24,39,0.08)",
    title: isDark ? "#f0fdf4" : "#0f172a",
    subtitle: isDark ? "#6b7280" : "#64748b",
    cardBg: isDark ? "#0f1a0f" : "#ffffff",
    cardBorder: isDark ? "1px solid #1e3a1e" : "1px solid #d7dce6",
    chipBg: isDark ? "#112011" : "#f0fdf4",
    chipBorder: isDark ? "1px solid #2d4a2d" : "1px solid #86efac",
  };
}

function useLongPress<T extends HTMLElement>(onLongPress: () => void, { delay = 600, moveTolerance = 10 } = {}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const triggeredRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pointerIdRef.current = null;
    startPointRef.current = null;
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<T>) => {
    pointerIdRef.current = e.pointerId;
    startPointRef.current = { x: e.clientX, y: e.clientY };
    triggeredRef.current = false;
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      onLongPress();
      cancel();
    }, delay);
  }, [cancel, delay, onLongPress]);

  const onPointerMove = useCallback((e: ReactPointerEvent<T>) => {
    if (pointerIdRef.current !== e.pointerId || !startPointRef.current) return;
    const dx = Math.abs(e.clientX - startPointRef.current.x);
    const dy = Math.abs(e.clientY - startPointRef.current.y);
    if (dx > moveTolerance || dy > moveTolerance) cancel();
  }, [cancel, moveTolerance]);

  const onPointerUp = useCallback((e: ReactPointerEvent<T>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    cancel();
  }, [cancel]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onPointerLeave: onPointerUp };
}

type ItemFormState = {
  name: string;
  type: HouseItemType;
  status: HouseStatus;
  utility: number;
  condition: number;
  importance: number;
};

const EMPTY_FORM: ItemFormState = {
  name: "",
  type: "otro",
  status: "have",
  utility: 3,
  condition: 3,
  importance: 3,
};

const RATING_COLOR = "#22c55e";

function RatingBlocks({ value, onChange, isDark }: { value: number; onChange: (v: number) => void; isDark: boolean }) {
  return (
    <div style={{ display: "flex", gap: "5px" }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            title={`${n}/5`}
            style={{
              flex: 1,
              height: "20px",
              borderRadius: "4px",
              border: filled ? "1px solid transparent" : isDark ? "1px solid #325a32" : "1px solid #86efac",
              background: filled ? RATING_COLOR : "transparent",
              cursor: "pointer",
              padding: 0,
            }}
          />
        );
      })}
    </div>
  );
}

function MiniRatingBlocks({ value }: { value: number }) {
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{
            flex: 1,
            height: "3px",
            borderRadius: "1px",
            background: n <= value ? RATING_COLOR : "rgba(148,163,184,0.35)",
          }}
        />
      ))}
    </div>
  );
}

function TypePicker({
  value,
  onChange,
  colors,
  isDark,
}: {
  value: HouseItemType;
  onChange: (type: HouseItemType) => void;
  colors: Record<string, string>;
  isDark: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {HOUSE_GROUP_ORDER.map((group) => {
        const types = HOUSE_TYPE_ORDER.filter((t) => HOUSE_TYPE_META[t].group === group);
        if (types.length === 0) return null;
        return (
          <div key={group}>
            <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: colors.subtitle, marginBottom: "4px" }}>
              {group}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))", gap: "6px" }}>
              {types.map((t) => {
                const active = value === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange(t)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "3px",
                      padding: "6px 2px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      position: "relative",
                      border: active ? "1px solid #4ade80" : colors.chipBorder,
                      background: active ? (isDark ? "rgba(74,222,128,0.12)" : "#ecfdf3") : isDark ? "#0f1a0f" : "#ffffff",
                    }}
                  >
                    {active && (
                      <span
                        style={{
                          position: "absolute",
                          top: "2px",
                          right: "2px",
                          width: "12px",
                          height: "12px",
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #16a34a, #22c55e)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Check size={8} color="#052e16" strokeWidth={3} />
                      </span>
                    )}
                    <span style={{ fontSize: "18px", lineHeight: 1 }}>{HOUSE_TYPE_META[t].emoji}</span>
                    <span style={{ fontSize: "8.5px", fontWeight: 600, color: active ? colors.title : colors.subtitle, textAlign: "center", lineHeight: 1.1 }}>
                      {HOUSE_TYPE_META[t].label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ItemForm({
  form,
  onChange,
  colors,
  isDark,
}: {
  form: ItemFormState;
  onChange: (next: ItemFormState) => void;
  colors: Record<string, string>;
  isDark: boolean;
}) {
  const inputStyle: CSSProperties = {
    height: "34px",
    borderRadius: "8px",
    border: isDark ? "1px solid #325a32" : "1px solid #86efac",
    background: isDark ? "#0f1a0f" : "#ffffff",
    color: colors.title,
    padding: "0 10px",
    fontSize: "12px",
    width: "100%",
  };

  const labelStyle: CSSProperties = {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: colors.subtitle,
    marginBottom: "6px",
  };

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      <div>
        <div style={labelStyle}>Nombre del objeto</div>
        <input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="Ej: Aspiradora"
          style={inputStyle}
        />
      </div>

      <div>
        <div style={labelStyle}>Categoría</div>
        <TypePicker value={form.type} onChange={(type) => onChange({ ...form, type })} colors={colors} isDark={isDark} />
      </div>

      <div>
        <div style={labelStyle}>Disponibilidad</div>
        <div style={{ display: "flex", gap: "6px" }}>
          {(["have", "missing"] as HouseStatus[]).map((status) => {
            const active = form.status === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => onChange({ ...form, status })}
                style={{
                  flex: 1,
                  height: "30px",
                  borderRadius: "8px",
                  border: active ? "1px solid transparent" : isDark ? "1px solid #325a32" : "1px solid #86efac",
                  background: active
                    ? status === "have"
                      ? "linear-gradient(135deg, #16a34a, #22c55e)"
                      : "linear-gradient(135deg, #c2410c, #fb923c)"
                    : "transparent",
                  color: active ? "#052e16" : colors.subtitle,
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {status === "have" ? "Ya lo tengo" : "Falta comprar"}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
          <span>Utilidad</span>
          <span style={{ color: RATING_COLOR }}>{form.utility}/5</span>
        </div>
        <RatingBlocks value={form.utility} onChange={(utility) => onChange({ ...form, utility })} isDark={isDark} />
      </div>

      <div>
        <div style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
          <span>Estado</span>
          <span style={{ color: RATING_COLOR }}>{form.condition}/5</span>
        </div>
        <RatingBlocks value={form.condition} onChange={(condition) => onChange({ ...form, condition })} isDark={isDark} />
      </div>

      <div>
        <div style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
          <span>Importancia</span>
          <span style={{ color: RATING_COLOR }}>{form.importance}/5</span>
        </div>
        <RatingBlocks value={form.importance} onChange={(importance) => onChange({ ...form, importance })} isDark={isDark} />
      </div>
    </div>
  );
}

function ItemPopup({
  heading,
  form,
  onChange,
  colors,
  isDark,
  onCancel,
  onSubmit,
  submitLabel,
  onDelete,
}: {
  heading: string;
  form: ItemFormState;
  onChange: (next: ItemFormState) => void;
  colors: Record<string, string>;
  isDark: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  onDelete?: () => void;
}) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onCancel}
      className="house-popup-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="house-popup-panel"
        style={{
          width: "100%",
          maxWidth: "360px",
          maxHeight: "100%",
          overflowY: "auto",
          background: colors.cardBg,
          border: colors.cardBorder,
          borderRadius: "14px",
          padding: "16px",
          boxShadow: isDark ? "0 20px 50px rgba(0,0,0,0.55)" : "0 20px 50px rgba(15,23,42,0.28)",
        }}
      >
        <div
          style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: colors.title,
            marginBottom: "12px",
            textAlign: "center",
          }}
        >
          {heading}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px", fontSize: "40px" }}>
          {HOUSE_TYPE_META[form.type].emoji}
        </div>
        <ItemForm form={form} onChange={onChange} colors={colors} isDark={isDark} />
        <div style={{ display: "flex", gap: "8px", justifyContent: onDelete ? "space-between" : "flex-end", marginTop: "12px" }}>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              style={{
                height: "30px",
                borderRadius: "8px",
                border: "1px solid #991b1b",
                background: "transparent",
                color: "#f87171",
                padding: "0 10px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Eliminar
            </button>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                height: "30px",
                borderRadius: "8px",
                border: colors.chipBorder,
                background: "transparent",
                color: colors.subtitle,
                padding: "0 10px",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSubmit}
              style={{
                height: "30px",
                borderRadius: "8px",
                border: "none",
                background: "linear-gradient(135deg, #16a34a, #22c55e)",
                color: "#052e16",
                padding: "0 10px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HouseCard({
  item,
  colors,
  isDark,
  celebrating,
  onConfirmPurchase,
  onStartEdit,
}: {
  item: HouseItem;
  colors: Record<string, string>;
  isDark: boolean;
  celebrating: boolean;
  onConfirmPurchase: (id: number) => void;
  onStartEdit: (item: HouseItem) => void;
}) {
  const longPress = useLongPress<HTMLDivElement>(() => onStartEdit(item), { delay: 600 });
  const isHave = item.status === "have";

  return (
    <div
      className={`house-card${celebrating ? " house-card-celebrate" : ""}`}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
      onPointerLeave={longPress.onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      title={`${item.name} · Utilidad ${item.utility}/5 · Estado ${item.condition}/5 · Importancia ${item.importance}/5 · long press para editar`}
      style={{
        position: "relative",
        borderRadius: "10px",
        border: isHave ? "1px solid rgba(212,175,55,0.6)" : isDark ? "1px solid #23291f" : "1px solid #dde1e8",
        background: isHave ? (isDark ? "rgba(212,175,55,0.13)" : "rgba(212,175,55,0.1)") : isDark ? "#12140f" : "#eef0f3",
        padding: "10px 6px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
      }}
    >
      {isHave ? (
        <span
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #16a34a, #22c55e)",
            boxShadow: "0 0 0 2px " + colors.cardBg,
          }}
        >
          <Check size={10} color="#052e16" strokeWidth={3} />
        </span>
      ) : (
        <span
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isDark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.16)",
            boxShadow: "0 0 0 2px " + colors.cardBg,
          }}
        >
          <Lock size={9} color={isDark ? "#9ca3af" : "#64748b"} strokeWidth={2.5} />
        </span>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
          width: "100%",
          filter: isHave ? "none" : "grayscale(0.9)",
          opacity: isHave ? 1 : 0.5,
        }}
      >
        <div style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "2px", fontSize: "26px" }}>
          {HOUSE_TYPE_META[item.type].emoji}
        </div>

        <span
          style={{
            fontSize: "10px",
            fontWeight: 600,
            textAlign: "center",
            color: isHave ? colors.title : colors.subtitle,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {item.name}
        </span>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%", padding: "0 3px" }}>
          <div>
            <span style={{ fontSize: "6.5px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: colors.subtitle, display: "block", marginBottom: "1.5px" }}>
              Utilidad
            </span>
            <MiniRatingBlocks value={item.utility} />
          </div>
          <div>
            <span style={{ fontSize: "6.5px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: colors.subtitle, display: "block", marginBottom: "1.5px" }}>
              Estado
            </span>
            <MiniRatingBlocks value={item.condition} />
          </div>
          <div>
            <span style={{ fontSize: "6.5px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: colors.subtitle, display: "block", marginBottom: "1.5px" }}>
              Importancia
            </span>
            <MiniRatingBlocks value={item.importance} />
          </div>
        </div>
      </div>

      {!isHave && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onConfirmPurchase(item.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            marginTop: "2px",
            height: "22px",
            borderRadius: "12px",
            border: "none",
            padding: "0 9px",
            fontSize: "9.5px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            cursor: "pointer",
            background: "linear-gradient(135deg, #c2410c, #fb923c)",
            color: "#1c0a02",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <ShoppingCart size={10} strokeWidth={2.5} />
          Comprar
        </button>
      )}
    </div>
  );
}

// Ya en casa primero, pendientes de compra despues — nunca intercalados.
function sortHaveFirst(items: HouseItem[]) {
  return [...items].sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === "have" ? -1 : 1;
  });
}

function TypeSection({
  type,
  items,
  colors,
  isDark,
  celebratingId,
  onConfirmPurchase,
  onStartEdit,
}: {
  type: HouseItemType;
  items: HouseItem[];
  colors: Record<string, string>;
  isDark: boolean;
  celebratingId: number | null;
  onConfirmPurchase: (id: number) => void;
  onStartEdit: (item: HouseItem) => void;
}) {
  const haveCount = items.filter((i) => i.status === "have").length;
  const orderedItems = sortHaveFirst(items);

  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
        <span style={{ fontSize: "13px" }}>{HOUSE_TYPE_META[type].emoji}</span>
        <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: colors.subtitle }}>
          {HOUSE_TYPE_META[type].label}
        </span>
        <span style={{ fontSize: "9.5px", color: colors.subtitle, opacity: 0.8 }}>
          ({haveCount}/{items.length})
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(78px, 1fr))", gap: "8px" }}>
        {orderedItems.map((item) => (
          <HouseCard
            key={item.id}
            item={item}
            colors={colors}
            isDark={isDark}
            celebrating={item.id === celebratingId}
            onConfirmPurchase={onConfirmPurchase}
            onStartEdit={onStartEdit}
          />
        ))}
      </div>
    </div>
  );
}

function GroupSection({
  group,
  items,
  colors,
  isDark,
  celebratingId,
  onConfirmPurchase,
  onStartEdit,
}: {
  group: HouseGroup;
  items: HouseItem[];
  colors: Record<string, string>;
  isDark: boolean;
  celebratingId: number | null;
  onConfirmPurchase: (id: number) => void;
  onStartEdit: (item: HouseItem) => void;
}) {
  const haveCount = items.filter((i) => i.status === "have").length;
  const typesPresent = HOUSE_TYPE_ORDER.filter((t) => items.some((i) => i.type === t));

  return (
    <div style={{ marginBottom: "16px" }} onPointerDown={(e) => e.stopPropagation()}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          paddingBottom: "8px",
          marginBottom: "14px",
          borderBottom: isDark ? "1px solid #1e2d1e" : "1px solid #e2e8f0",
        }}
      >
        <span style={{ fontSize: "16px" }}>{HOUSE_TYPE_META[HOUSE_GROUP_ICON_TYPE[group]].emoji}</span>
        <span
          style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: colors.title,
          }}
        >
          {group}
        </span>
        <span style={{ fontSize: "10px", color: colors.subtitle }}>
          ({haveCount}/{items.length})
        </span>
      </div>
      {typesPresent.map((type) => (
        <TypeSection
          key={type}
          type={type}
          items={items.filter((i) => i.type === type)}
          colors={colors}
          isDark={isDark}
          celebratingId={celebratingId}
          onConfirmPurchase={onConfirmPurchase}
          onStartEdit={onStartEdit}
        />
      ))}
    </div>
  );
}

// Highlighted at the top so what she already has is the first thing she sees --
// an overall "ya tenés" headline plus a per-category completion bar, instead of
// only a raw list of everything still missing further down.
function HouseSummaryPanel({
  items,
  colors,
  isDark,
}: {
  items: HouseItem[];
  colors: Record<string, string>;
  isDark: boolean;
}) {
  const totalHave = items.filter((i) => i.status === "have").length;
  const totalCount = items.length;
  if (totalCount === 0) return null;

  const progressPct = (totalHave / totalCount) * 100;

  const groupStats = HOUSE_GROUP_ORDER.map((group) => {
    const groupItems = items.filter((i) => HOUSE_TYPE_META[i.type].group === group);
    const have = groupItems.filter((i) => i.status === "have").length;
    return { group, have, total: groupItems.length };
  }).filter((stat) => stat.total > 0);

  return (
    <div
      style={{
        borderRadius: "12px",
        border: colors.chipBorder,
        background: colors.chipBg,
        padding: "14px",
        marginBottom: "14px",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "8px", gap: "8px" }}>
        <span style={{ fontSize: "12.5px", fontWeight: 700, color: colors.title }}>
          🎉 Ya tenés {totalHave} de {totalCount} cosas para tu casa
        </span>
        <span style={{ fontSize: "11px", fontWeight: 700, color: RATING_COLOR, whiteSpace: "nowrap" }}>{Math.round(progressPct)}%</span>
      </div>
      <div
        style={{
          height: "7px",
          background: isDark ? "#0d1a0d" : "#e5e7eb",
          borderRadius: "4px",
          overflow: "hidden",
          border: isDark ? "1px solid #1a2a1a" : "1px solid #d1d5db",
          marginBottom: groupStats.length > 0 ? "12px" : 0,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progressPct}%`,
            borderRadius: "4px",
            background: "linear-gradient(90deg, #16a34a, #4ade80)",
            transition: "width 0.6s ease",
          }}
        />
      </div>

      {groupStats.length > 0 && (
        <div style={{ display: "grid", gap: "6px" }}>
          {groupStats.map(({ group, have, total }) => {
            const pct = total > 0 ? (have / total) * 100 : 0;
            const complete = have === total;
            return (
              <div key={group} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", width: "16px", textAlign: "center", flexShrink: 0 }}>
                  {HOUSE_TYPE_META[HOUSE_GROUP_ICON_TYPE[group]].emoji}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    color: colors.subtitle,
                    width: "88px",
                    flexShrink: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {group}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "5px",
                    background: isDark ? "#0d1a0d" : "#e5e7eb",
                    borderRadius: "3px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      borderRadius: "3px",
                      background: complete ? "linear-gradient(90deg, #ca8a04, #facc15)" : "linear-gradient(90deg, #16a34a, #4ade80)",
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
                <span style={{ fontSize: "9.5px", color: colors.subtitle, flexShrink: 0, whiteSpace: "nowrap" }}>
                  {complete ? "✓ Completo" : `${have}/${total}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function HouseInventory({
  items,
  setItems,
}: {
  items: HouseItem[];
  setItems: (updater: HouseItem[] | ((prev: HouseItem[]) => HouseItem[])) => void;
}) {
  const { theme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";
  const colors = getHouseColors(isDark);
  const { toast } = useToast();

  const [groupFilter, setGroupFilter] = useState<"Todas" | HouseGroup>("Todas");
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [addForm, setAddForm] = useState<ItemFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ItemFormState>(EMPTY_FORM);
  const [celebratingId, setCelebratingId] = useState<number | null>(null);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    };
  }, []);

  const groupsPresent = HOUSE_GROUP_ORDER.filter((g) => items.some((i) => HOUSE_TYPE_META[i.type].group === g));

  const openAddForm = () => {
    setEditingId(null);
    setAddForm(EMPTY_FORM);
    setIsAddFormOpen(true);
  };

  const backgroundLongPress = useLongPress<HTMLDivElement>(openAddForm, { delay: 600 });

  const createItem = useCallback(() => {
    const cleanName = addForm.name.trim();
    if (!cleanName) {
      window.alert("El nombre no puede estar vacio.");
      return;
    }

    const nextItem: HouseItem = {
      id: Date.now(),
      name: cleanName,
      type: addForm.type,
      status: addForm.status,
      utility: addForm.utility,
      condition: addForm.condition,
      importance: addForm.importance,
    };

    setItems((prev) => [nextItem, ...prev]);
    setIsAddFormOpen(false);
    setAddForm(EMPTY_FORM);
  }, [addForm, setItems]);

  const startEdit = useCallback((item: HouseItem) => {
    setIsAddFormOpen(false);
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      type: item.type,
      status: item.status,
      utility: item.utility,
      condition: item.condition,
      importance: item.importance,
    });
  }, []);

  const saveEdit = useCallback(() => {
    if (editingId === null) return;
    const cleanName = editForm.name.trim();
    if (!cleanName) {
      window.alert("El nombre no puede estar vacio.");
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === editingId
          ? {
              ...item,
              name: cleanName,
              type: editForm.type,
              status: editForm.status,
              utility: editForm.utility,
              condition: editForm.condition,
              importance: editForm.importance,
            }
          : item,
      ),
    );
    setEditingId(null);
  }, [editForm, editingId, setItems]);

  const deleteEditingItem = useCallback(() => {
    if (editingId === null) return;
    setItems((prev) => prev.filter((item) => item.id !== editingId));
    setEditingId(null);
  }, [editingId, setItems]);

  const confirmPurchase = useCallback((id: number) => {
    const boughtItem = items.find((i) => i.id === id);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "have" } : item)));

    if (boughtItem) {
      playProgressAdvanceSound();
      toast({ title: `¡Sumaste ${boughtItem.name}! 🎉`, description: "Ya es parte de tu casa." });
      setCelebratingId(id);
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = setTimeout(() => setCelebratingId(null), 900);
    }
  }, [items, setItems, toast]);

  const editingItem = editingId !== null ? items.find((i) => i.id === editingId) ?? null : null;
  const visibleGroups = groupFilter === "Todas" ? groupsPresent : groupsPresent.filter((g) => g === groupFilter);

  const haveItems = items.filter((i) => i.status === "have");
  const avgOf = (pick: (i: HouseItem) => number) =>
    haveItems.length > 0 ? haveItems.reduce((sum, i) => sum + pick(i), 0) / haveItems.length : 0;
  const avgUtility = avgOf((i) => i.utility);
  const avgCondition = avgOf((i) => i.condition);
  const avgImportance = avgOf((i) => i.importance);

  return (
    <>
      <style>{`
        .house-card { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .house-card:hover { transform: translateY(-1px); }
        .house-chip { cursor: pointer; user-select: none; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 5px; }
        .house-bg-area { touch-action: manipulation; }
        @keyframes house-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes house-pop-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        .house-popup-backdrop { animation: house-fade-in 0.15s ease-out; }
        .house-popup-panel { animation: house-pop-in 0.16s ease-out; }
        @keyframes house-card-pop {
          0% { transform: scale(1); }
          35% { transform: scale(1.08); box-shadow: 0 0 0 3px rgba(74,222,128,0.35); }
          100% { transform: scale(1); }
        }
        .house-card-celebrate { animation: house-card-pop 0.5s ease; }
      `}</style>

      <div
        style={{
          fontFamily: "'Exo 2', 'Segoe UI', sans-serif",
          width: "100%",
        }}
        className="house-bg-area"
        onPointerDown={backgroundLongPress.onPointerDown}
        onPointerMove={backgroundLongPress.onPointerMove}
        onPointerUp={backgroundLongPress.onPointerUp}
        onPointerCancel={backgroundLongPress.onPointerCancel}
        onPointerLeave={backgroundLongPress.onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
      >
        <p style={{ color: colors.subtitle, fontSize: "11px", marginBottom: "12px" }}>
          Apreta Comprar para confirmar una compra. Long press sobre un objeto para editarlo (ahi tambien podes deshacer una compra). Long press en el fondo para agregar uno nuevo.
        </p>

        <HouseSummaryPanel items={items} colors={colors} isDark={isDark} />

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }} onPointerDown={(e) => e.stopPropagation()}>
          {(["Todas", ...groupsPresent] as ("Todas" | HouseGroup)[]).map((g) => {
            const active = groupFilter === g;
            return (
              <span
                key={g}
                className="house-chip"
                onClick={() => setGroupFilter(g)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: active ? "1px solid transparent" : colors.chipBorder,
                  background: active ? "linear-gradient(135deg, #16a34a, #22c55e)" : colors.chipBg,
                  color: active ? "#052e16" : colors.subtitle,
                }}
              >
                {g !== "Todas" && <span>{HOUSE_TYPE_META[HOUSE_GROUP_ICON_TYPE[g]].emoji}</span>}
                {g}
              </span>
            );
          })}
        </div>

        {isAddFormOpen && (
          <ItemPopup
            heading="Nuevo objeto"
            form={addForm}
            onChange={setAddForm}
            colors={colors}
            isDark={isDark}
            onCancel={() => setIsAddFormOpen(false)}
            onSubmit={createItem}
            submitLabel="Agregar"
          />
        )}

        {editingItem && (
          <ItemPopup
            heading={`Editando "${editingItem.name}"`}
            form={editForm}
            onChange={setEditForm}
            colors={colors}
            isDark={isDark}
            onCancel={() => setEditingId(null)}
            onSubmit={saveEdit}
            submitLabel="Guardar"
            onDelete={deleteEditingItem}
          />
        )}

        {visibleGroups.length === 0 && (
          <p style={{ color: colors.subtitle, fontSize: "11px" }}>No hay objetos todavia. Long press en el fondo para agregar el primero.</p>
        )}

        {visibleGroups.map((group) => (
          <GroupSection
            key={group}
            group={group}
            items={items.filter((i) => HOUSE_TYPE_META[i.type].group === group)}
            colors={colors}
            isDark={isDark}
            celebratingId={celebratingId}
            onConfirmPurchase={confirmPurchase}
            onStartEdit={startEdit}
          />
        ))}

        {haveItems.length > 0 && (
          <div style={{ marginTop: "10px", display: "grid", gap: "8px" }} onPointerDown={(e) => e.stopPropagation()}>
            {(
              [
                { label: "Utilidad", value: avgUtility },
                { label: "Estado", value: avgCondition },
                { label: "Importancia", value: avgImportance },
              ] as const
            ).map(({ label, value }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "10px", color: colors.subtitle, whiteSpace: "nowrap", width: "62px" }}>
                  {label}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "6px",
                    background: isDark ? "#0d1a0d" : "#e5e7eb",
                    borderRadius: "3px",
                    overflow: "hidden",
                    border: isDark ? "1px solid #1a2a1a" : "1px solid #d1d5db",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(value / 5) * 100}%`,
                      borderRadius: "3px",
                      background: "linear-gradient(90deg, #16a34a, #4ade80)",
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
                <span style={{ fontSize: "10px", color: colors.subtitle, whiteSpace: "nowrap" }}>
                  {value.toFixed(1)}/5
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
