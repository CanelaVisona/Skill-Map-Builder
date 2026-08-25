import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { Check, Trash2, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { playProgressAdvanceSound } from "@/lib/sound";
import { getHouseColors } from "./HouseInventory";

const REPAIRS_STORAGE_KEY = "skill-map-house-repairs-v1";

type HouseRepair = {
  id: number;
  text: string;
  done: boolean;
};

const now = Date.now();

const INITIAL_REPAIRS: HouseRepair[] = [
  { id: now - 2, text: "Arreglar la canilla que pierde", done: false },
  { id: now - 1, text: "Cambiar el foco quemado", done: false },
];

function isValidRepair(value: unknown): value is HouseRepair {
  const raw = value as Partial<HouseRepair>;
  return typeof raw?.id === "number" && typeof raw?.text === "string" && typeof raw?.done === "boolean";
}

function sanitizeRepairs(input: unknown): HouseRepair[] | null {
  if (!Array.isArray(input)) return null;
  const repairs = input.filter(isValidRepair).map((r) => ({ id: r.id, text: r.text, done: r.done }));
  return repairs;
}

function loadStoredRepairs(): HouseRepair[] {
  if (typeof window === "undefined") return INITIAL_REPAIRS;

  try {
    const raw = window.localStorage.getItem(REPAIRS_STORAGE_KEY);
    if (!raw) return INITIAL_REPAIRS;

    const parsed = sanitizeRepairs(JSON.parse(raw));
    return parsed && parsed.length > 0 ? parsed : INITIAL_REPAIRS;
  } catch {
    return INITIAL_REPAIRS;
  }
}

// Pendientes primero, resueltos despues -- lo que falta arreglar siempre queda a
// la vista, lo ya resuelto se corre para abajo en vez de mezclarse.
function sortPendingFirst(repairs: HouseRepair[]) {
  return [...repairs].sort((a, b) => {
    if (a.done === b.done) return 0;
    return a.done ? 1 : -1;
  });
}

export default function HouseRepairsList() {
  const { theme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";
  const colors = getHouseColors(isDark);
  const { toast } = useToast();

  const [repairs, setRepairs] = useState<HouseRepair[]>(() => loadStoredRepairs());
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [remoteSyncEnabled, setRemoteSyncEnabled] = useState(true);
  const [draft, setDraft] = useState("");
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRemoteRepairs = async () => {
      try {
        const response = await fetch("/api/house-repairs/items");

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
        const safeRepairs = sanitizeRepairs(data);
        if (safeRepairs && safeRepairs.length > 0 && !cancelled) {
          setRepairs(safeRepairs);
        }

        if (!cancelled) setRemoteLoaded(true);
      } catch {
        if (!cancelled) setRemoteLoaded(true);
      }
    };

    void loadRemoteRepairs();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(REPAIRS_STORAGE_KEY, JSON.stringify(repairs));
  }, [repairs]);

  useEffect(() => {
    if (!remoteLoaded || !remoteSyncEnabled) return;

    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);

    saveDebounceRef.current = setTimeout(() => {
      void fetch("/api/house-repairs/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: repairs }),
      });
    }, 400);

    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, [remoteLoaded, remoteSyncEnabled, repairs]);

  const addRepair = useCallback(() => {
    const cleanText = draft.trim();
    if (!cleanText) return;

    setRepairs((prev) => [{ id: Date.now(), text: cleanText, done: false }, ...prev]);
    setDraft("");
  }, [draft]);

  const toggleDone = useCallback((id: number) => {
    const target = repairs.find((r) => r.id === id);
    if (!target) return;

    const willBeDone = !target.done;
    setRepairs((prev) => prev.map((r) => (r.id === id ? { ...r, done: willBeDone } : r)));

    if (willBeDone) {
      playProgressAdvanceSound();
      toast({ title: `¡Arreglaste "${target.text}"! 🎉`, description: "Un problema menos en tu casa." });
    }
  }, [repairs, toast]);

  const editRepair = useCallback((id: number) => {
    const target = repairs.find((r) => r.id === id);
    if (!target) return;

    const nextText = window.prompt("Editar arreglo:", target.text);
    if (nextText === null) return;

    const cleanText = nextText.trim();
    if (!cleanText) {
      window.alert("El texto no puede estar vacio.");
      return;
    }

    setRepairs((prev) => prev.map((r) => (r.id === id ? { ...r, text: cleanText } : r)));
  }, [repairs]);

  const deleteRepair = useCallback((id: number) => {
    setRepairs((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const orderedRepairs = sortPendingFirst(repairs);
  const pendingCount = repairs.filter((r) => !r.done).length;
  const doneCount = repairs.length - pendingCount;

  return (
    <div style={{ fontFamily: "'Exo 2', 'Segoe UI', sans-serif", width: "100%" }}>
      <p style={{ color: colors.subtitle, fontSize: "11px", marginBottom: "12px" }}>
        Anota lo que haya que arreglar en la casa. Toca el circulo para marcarlo resuelto, toca el texto para editarlo.
      </p>

      {repairs.length > 0 && (
        <div
          style={{
            borderRadius: "12px",
            border: colors.chipBorder,
            background: colors.chipBg,
            padding: "10px 14px",
            marginBottom: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 700, color: colors.title }}>
            🔧 Ya resolviste {doneCount} de {repairs.length} arreglos
          </span>
          <span style={{ fontSize: "10.5px", color: colors.subtitle, whiteSpace: "nowrap" }}>{pendingCount} pendientes</span>
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addRepair();
          }}
          placeholder="¿Que hay que arreglar?"
          style={{
            flex: 1,
            height: "36px",
            borderRadius: "8px",
            border: isDark ? "1px solid #325a32" : "1px solid #86efac",
            background: isDark ? "#0f1a0f" : "#ffffff",
            color: colors.title,
            padding: "0 12px",
            fontSize: "12px",
          }}
        />
        <button
          type="button"
          onClick={addRepair}
          style={{
            height: "36px",
            borderRadius: "8px",
            border: "none",
            padding: "0 16px",
            fontSize: "11px",
            fontWeight: 700,
            cursor: "pointer",
            background: "linear-gradient(135deg, #16a34a, #22c55e)",
            color: "#052e16",
            flexShrink: 0,
          }}
        >
          Agregar
        </button>
      </div>

      {orderedRepairs.length === 0 && (
        <p style={{ color: colors.subtitle, fontSize: "11px" }}>No hay arreglos anotados. Agrega el primero arriba.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {orderedRepairs.map((repair) => (
          <div
            key={repair.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: repair.done ? (isDark ? "1px solid #1e2d1e" : "1px solid #e2e8f0") : isDark ? "1px solid #23291f" : "1px solid #dde1e8",
              background: repair.done ? "transparent" : isDark ? "#12140f" : "#eef0f3",
              opacity: repair.done ? 0.6 : 1,
            }}
          >
            <button
              type="button"
              onClick={() => toggleDone(repair.id)}
              aria-label={repair.done ? "Marcar como pendiente" : "Marcar como resuelto"}
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                border: repair.done ? "none" : isDark ? "1px solid #325a32" : "1px solid #86efac",
                background: repair.done ? "linear-gradient(135deg, #16a34a, #22c55e)" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
                padding: 0,
              }}
            >
              {repair.done ? <Check size={12} color="#052e16" strokeWidth={3} /> : <Wrench size={11} color={colors.subtitle} />}
            </button>

            <span
              onClick={() => editRepair(repair.id)}
              title="Toca para editar"
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "12px",
                fontWeight: 600,
                color: repair.done ? colors.subtitle : colors.title,
                textDecoration: repair.done ? "line-through" : "none",
                cursor: "pointer",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {repair.text}
            </span>

            <button
              type="button"
              onClick={() => deleteRepair(repair.id)}
              aria-label="Eliminar arreglo"
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                border: "none",
                background: "transparent",
                color: isDark ? "#7f1d1d" : "#b91c1c",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
