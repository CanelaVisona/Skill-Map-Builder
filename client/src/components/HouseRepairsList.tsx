import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { Check, ChevronUp, ChevronDown, ChevronsDown, ChevronsUp, Lock, Trash2, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { playProgressAdvanceSound } from "@/lib/sound";
import { getHouseColors, useLongPress } from "./HouseInventory";
import HouseEditPopup, { houseEditInputStyle } from "./HouseEditPopup";

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
  onStartEdit,
}: {
  repair: HouseRepair;
  index: number;
  isLast: boolean;
  colors: Record<string, string>;
  isDark: boolean;
  onMove: (id: number, direction: "up" | "down") => void;
  onConfirmFixed: (id: number) => void;
  onStartEdit: (id: number) => void;
}) {
  const isUnlocked = index === 0;
  const longPress = useLongPress<HTMLDivElement>(() => onStartEdit(repair.id), { delay: 600 });

  return (
    <div
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
      onPointerLeave={longPress.onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      title="Mantené apretado para editar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 12px",
        borderRadius: "10px",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "manipulation",
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

      <div style={{ flex: 1, minWidth: 0 }}>
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
          onPointerDown={(e) => e.stopPropagation()}
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
          onPointerDown={(e) => e.stopPropagation()}
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
          onPointerDown={(e) => e.stopPropagation()}
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
          Arreglar
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
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addDraft, setAddDraft] = useState("");
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

  // Long press en el fondo abre un popup (mismo estilo que los del Inventario,
  // pero solo con el nombre) para anotar un arreglo nuevo -- reemplaza el campo
  // de texto fijo que ocupaba espacio arriba de la lista.
  const openAdd = useCallback(() => {
    setEditingId(null);
    setAddDraft("");
    setIsAdding(true);
  }, []);

  const backgroundLongPress = useLongPress<HTMLDivElement>(openAdd, { delay: 600 });

  const confirmAdd = useCallback(() => {
    const cleanText = addDraft.trim();
    if (!cleanText) {
      window.alert("El texto no puede estar vacio.");
      return;
    }
    setRepairs((prev) => [...prev, { id: Date.now(), text: cleanText, done: false }]);
    setIsAdding(false);
  }, [addDraft]);

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

  // Long press sobre un arreglo abre este modal -- ahi se edita el texto y tambien
  // esta la opcion de eliminarlo.
  const startEdit = useCallback((id: number) => {
    const target = repairs.find((r) => r.id === id);
    if (!target) return;
    setIsAdding(false);
    setEditingId(id);
    setEditDraft(target.text);
  }, [repairs]);

  const saveEdit = useCallback(() => {
    if (editingId === null) return;
    const cleanText = editDraft.trim();
    if (!cleanText) {
      window.alert("El texto no puede estar vacio.");
      return;
    }
    setRepairs((prev) => prev.map((r) => (r.id === editingId ? { ...r, text: cleanText } : r)));
    setEditingId(null);
  }, [editingId, editDraft]);

  const deleteRepair = useCallback((id: number) => {
    setRepairs((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const deleteEditing = useCallback(() => {
    if (editingId === null) return;
    setRepairs((prev) => prev.filter((r) => r.id !== editingId));
    setEditingId(null);
  }, [editingId]);

  const editingRepair = editingId !== null ? repairs.find((r) => r.id === editingId) ?? null : null;

  const pending = repairs.filter((r) => !r.done);
  const done = repairs.filter((r) => r.done);
  const visiblePending = expanded ? pending : pending.slice(0, 1);
  const hiddenCount = pending.length - visiblePending.length;

  return (
    <div
      style={{ fontFamily: "'Exo 2', 'Segoe UI', sans-serif", width: "100%", touchAction: "manipulation" }}
      onPointerDown={backgroundLongPress.onPointerDown}
      onPointerMove={backgroundLongPress.onPointerMove}
      onPointerUp={backgroundLongPress.onPointerUp}
      onPointerCancel={backgroundLongPress.onPointerCancel}
      onPointerLeave={backgroundLongPress.onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
    >
      <p style={{ color: colors.subtitle, fontSize: "11px", marginBottom: "12px" }}>
        Solo el primer arreglo esta desbloqueado. Usa las flechas para cambiar el orden de prioridad -- al marcarlo arreglado, el siguiente se desbloquea. Long press en el fondo para anotar un arreglo nuevo, o sobre un arreglo para editarlo o eliminarlo.
      </p>

      {isAdding && (
        <HouseEditPopup
          heading="Nuevo arreglo"
          colors={colors}
          isDark={isDark}
          onCancel={() => setIsAdding(false)}
          onSubmit={confirmAdd}
          submitLabel="Agregar"
        >
          <div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: colors.subtitle,
                marginBottom: "6px",
              }}
            >
              ¿Que hay que arreglar?
            </div>
            <input
              value={addDraft}
              onChange={(e) => setAddDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmAdd();
              }}
              autoFocus
              placeholder="Ej: Cambiar el foco quemado"
              style={houseEditInputStyle(colors, isDark)}
            />
          </div>
        </HouseEditPopup>
      )}

      {editingRepair && (
        <HouseEditPopup
          heading={`Editando "${editingRepair.text}"`}
          colors={colors}
          isDark={isDark}
          onCancel={() => setEditingId(null)}
          onSubmit={saveEdit}
          onDelete={deleteEditing}
        >
          <input
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
            }}
            autoFocus
            placeholder="¿Que hay que arreglar?"
            style={houseEditInputStyle(colors, isDark)}
          />
        </HouseEditPopup>
      )}

      {repairs.length > 0 && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
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

      {pending.length === 0 && done.length === 0 && (
        <p style={{ color: colors.subtitle, fontSize: "11px" }}>No hay arreglos anotados. Long press en el fondo para agregar el primero.</p>
      )}

      {pending.length === 0 && done.length > 0 && (
        <p style={{ color: colors.subtitle, fontSize: "11px", marginBottom: "8px" }}>No quedan arreglos pendientes. 🎉</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }} onPointerDown={(e) => e.stopPropagation()}>
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
            onStartEdit={startEdit}
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
        <div style={{ marginTop: "18px" }} onPointerDown={(e) => e.stopPropagation()}>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: colors.subtitle, marginBottom: "8px" }}>
            Arreglados ({done.length})
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
