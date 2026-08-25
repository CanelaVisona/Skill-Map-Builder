import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { Check, ChevronUp, ChevronDown, ChevronsDown, ChevronsUp, Lock, Trash2, Wrench } from "lucide-react";
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

// Moves the repair with `id` one slot up/down among the pending (not-done) repairs
// only, by swapping its position with the neighboring pending repair inside the
// full array -- resolved repairs keep their own relative order untouched. Same
// mechanic as the priority list's reordering: the underlying array order is what
// decides which repair is first (unlocked).
function movePendingRepair(repairs: HouseRepair[], id: number, direction: "up" | "down"): HouseRepair[] {
  const pendingIndices = repairs
    .map((r, idx) => ({ r, idx }))
    .filter(({ r }) => !r.done)
    .map(({ idx }) => idx);

  const pos = pendingIndices.findIndex((idx) => repairs[idx].id === id);
  if (pos === -1) return repairs;

  const swapWith = direction === "up" ? pos - 1 : pos + 1;
  if (swapWith < 0 || swapWith >= pendingIndices.length) return repairs;

  const a = pendingIndices[pos];
  const b = pendingIndices[swapWith];
  const next = [...repairs];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function RepairRow({
  repair,
  index,
  isLast,
  colors,
  isDark,
  onMove,
  onConfirmFixed,
  onEdit,
  onDelete,
}: {
  repair: HouseRepair;
  index: number;
  isLast: boolean;
  colors: Record<string, string>;
  isDark: boolean;
  onMove: (id: number, direction: "up" | "down") => void;
  onConfirmFixed: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const isUnlocked = index === 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 12px",
        borderRadius: "10px",
        border: isUnlocked ? "1px solid rgba(212,175,55,0.6)" : isDark ? "1px solid #23291f" : "1px solid #dde1e8",
        background: isUnlocked ? (isDark ? "rgba(212,175,55,0.13)" : "rgba(212,175,55,0.1)") : isDark ? "#12140f" : "#eef0f3",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: colors.subtitle,
          width: "18px",
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {index + 1}
      </span>

      <div
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "8px",
          background: isDark ? "#102012" : "#e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "16px",
          flexShrink: 0,
          filter: isUnlocked ? "none" : "grayscale(0.9)",
          opacity: isUnlocked ? 1 : 0.6,
        }}
      >
        🔧
      </div>

      <div
        onClick={() => onEdit(repair.id)}
        title="Toca para editar"
        style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: isUnlocked ? colors.title : colors.subtitle,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {repair.text}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <button
          type="button"
          onClick={() => onMove(repair.id, "up")}
          disabled={index === 0}
          style={{
            width: "20px",
            height: "16px",
            borderRadius: "4px",
            border: "none",
            background: "transparent",
            color: index === 0 ? (isDark ? "#2d3a2d" : "#c9d0da") : colors.subtitle,
            cursor: index === 0 ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronUp size={13} />
        </button>
        <button
          type="button"
          onClick={() => onMove(repair.id, "down")}
          disabled={isLast}
          style={{
            width: "20px",
            height: "16px",
            borderRadius: "4px",
            border: "none",
            background: "transparent",
            color: isLast ? (isDark ? "#2d3a2d" : "#c9d0da") : colors.subtitle,
            cursor: isLast ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronDown size={13} />
        </button>
      </div>

      {isUnlocked ? (
        <button
          type="button"
          onClick={() => onConfirmFixed(repair.id)}
          style={{
            height: "26px",
            borderRadius: "13px",
            border: "none",
            padding: "0 11px",
            fontSize: "10.5px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            cursor: "pointer",
            background: "linear-gradient(135deg, #c2410c, #fb923c)",
            color: "#1c0a02",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            flexShrink: 0,
          }}
        >
          <Wrench size={11} strokeWidth={2.5} />
          Arreglado
        </button>
      ) : (
        <span
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isDark ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.1)",
            flexShrink: 0,
          }}
          title="Bloqueado hasta arreglar el anterior"
        >
          <Lock size={11} color={isDark ? "#9ca3af" : "#64748b"} strokeWidth={2.5} />
        </span>
      )}

      <button
        type="button"
        onClick={() => onDelete(repair.id)}
        aria-label="Eliminar arreglo"
        style={{
          width: "22px",
          height: "22px",
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
        <Trash2 size={12} />
      </button>
    </div>
  );
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
  const [expanded, setExpanded] = useState(false);
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

    setRepairs((prev) => [...prev, { id: Date.now(), text: cleanText, done: false }]);
    setDraft("");
  }, [draft]);

  const move = useCallback((id: number, direction: "up" | "down") => {
    setRepairs((prev) => movePendingRepair(prev, id, direction));
  }, []);

  const confirmFixed = useCallback((id: number) => {
    const target = repairs.find((r) => r.id === id);
    if (!target) return;

    setRepairs((prev) => prev.map((r) => (r.id === id ? { ...r, done: true } : r)));
    playProgressAdvanceSound();
    toast({ title: `¡Arreglaste "${target.text}"! 🎉`, description: "Un problema menos en tu casa." });
  }, [repairs, toast]);

  const reopenRepair = useCallback((id: number) => {
    setRepairs((prev) => prev.map((r) => (r.id === id ? { ...r, done: false } : r)));
  }, []);

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

  const pending = repairs.filter((r) => !r.done);
  const done = repairs.filter((r) => r.done);
  const visiblePending = expanded ? pending : pending.slice(0, 1);
  const hiddenCount = pending.length - visiblePending.length;

  return (
    <div style={{ fontFamily: "'Exo 2', 'Segoe UI', sans-serif", width: "100%" }}>
      <p style={{ color: colors.subtitle, fontSize: "11px", marginBottom: "12px" }}>
        Solo el primer arreglo esta desbloqueado. Usa las flechas para cambiar el orden de prioridad -- al marcarlo arreglado, el siguiente se desbloquea.
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
            🔧 Ya resolviste {done.length} de {repairs.length} arreglos
          </span>
          <span style={{ fontSize: "10.5px", color: colors.subtitle, whiteSpace: "nowrap" }}>{pending.length} pendientes</span>
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

      {pending.length === 0 && done.length === 0 && (
        <p style={{ color: colors.subtitle, fontSize: "11px" }}>No hay arreglos anotados. Agrega el primero arriba.</p>
      )}

      {pending.length === 0 && done.length > 0 && (
        <p style={{ color: colors.subtitle, fontSize: "11px", marginBottom: "8px" }}>No quedan arreglos pendientes. 🎉</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {visiblePending.map((repair, index) => (
          <RepairRow
            key={repair.id}
            repair={repair}
            index={index}
            isLast={index === pending.length - 1}
            colors={colors}
            isDark={isDark}
            onMove={move}
            onConfirmFixed={confirmFixed}
            onEdit={editRepair}
            onDelete={deleteRepair}
          />
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            width: "100%",
            marginTop: "8px",
            height: "34px",
            borderRadius: "10px",
            border: isDark ? "1px dashed #325a32" : "1px dashed #86efac",
            background: "transparent",
            color: colors.subtitle,
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <Lock size={11} />
          +{hiddenCount} más esperando · Ver todos
          <ChevronsDown size={13} />
        </button>
      )}

      {expanded && pending.length > 1 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          style={{
            width: "100%",
            marginTop: "8px",
            height: "30px",
            borderRadius: "10px",
            border: "none",
            background: "transparent",
            color: colors.subtitle,
            fontSize: "10.5px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          Ocultar
          <ChevronsUp size={13} />
        </button>
      )}

      {done.length > 0 && (
        <div style={{ marginTop: "18px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: colors.subtitle, marginBottom: "8px" }}>
            Resueltos
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {done.map((repair) => (
              <div
                key={repair.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid #1e2d1e" : "1px solid #e2e8f0",
                  opacity: 0.6,
                }}
              >
                <button
                  type="button"
                  onClick={() => reopenRepair(repair.id)}
                  aria-label="Marcar como pendiente"
                  title="Toca para reabrir"
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: "none",
                    background: "linear-gradient(135deg, #16a34a, #22c55e)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    padding: 0,
                  }}
                >
                  <Check size={11} color="#052e16" strokeWidth={3} />
                </button>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: "12px",
                    fontWeight: 600,
                    color: colors.subtitle,
                    textDecoration: "line-through",
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
                    width: "22px",
                    height: "22px",
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
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
