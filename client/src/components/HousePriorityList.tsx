import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Check, ChevronUp, ChevronDown, ChevronsDown, ChevronsUp, Lock, ShoppingCart, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { playProgressAdvanceSound } from "@/lib/sound";
import { getHouseColors, useLongPress, HOUSE_GROUP_EMOJI, type HouseItem } from "./HouseInventory";
import HouseEditPopup, { houseEditInputStyle } from "./HouseEditPopup";
import { HouseCelebration, HOUSE_CELEBRATION_MS, type HouseCelebrationState } from "./HouseCelebration";

// Moves the item with `id` one slot up/down among the "missing" items only, by
// swapping its position with the neighboring missing item inside the full array
// -- "have" items keep their own relative order untouched. This is what "Lista de
// prioridades" reordering actually changes: the underlying array order, which is
// also what decides which item is first (unlocked) here.
function moveMissingItem(items: HouseItem[], id: number, direction: "up" | "down"): HouseItem[] {
  const missingIndices = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => item.status === "missing")
    .map(({ idx }) => idx);

  const posInMissing = missingIndices.findIndex((idx) => items[idx].id === id);
  if (posInMissing === -1) return items;

  const swapWith = direction === "up" ? posInMissing - 1 : posInMissing + 1;
  if (swapWith < 0 || swapWith >= missingIndices.length) return items;

  const a = missingIndices[posInMissing];
  const b = missingIndices[swapWith];
  const next = [...items];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function PriorityRow({
  item,
  index,
  isLast,
  colors,
  isDark,
  onMove,
  onConfirmPurchase,
  onStartEdit,
}: {
  item: HouseItem;
  index: number;
  isLast: boolean;
  colors: Record<string, string>;
  isDark: boolean;
  onMove: (id: number, direction: "up" | "down") => void;
  onConfirmPurchase: (id: number) => void;
  onStartEdit: (id: number) => void;
}) {
  const isUnlocked = index === 0;
  const longPress = useLongPress<HTMLDivElement>(() => onStartEdit(item.id), { delay: 600 });

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
          fontSize: "18px",
          flexShrink: 0,
          filter: isUnlocked ? "none" : "grayscale(0.9)",
          opacity: isUnlocked ? 1 : 0.6,
        }}
      >
        {item.emoji}
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
          {item.name}
        </div>
        <div style={{ fontSize: "9.5px", color: colors.subtitle }}>{item.group}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <button
          type="button"
          onClick={() => onMove(item.id, "up")}
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
          onClick={() => onMove(item.id, "down")}
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
          onClick={() => onConfirmPurchase(item.id)}
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
          <ShoppingCart size={11} strokeWidth={2.5} />
          Comprar
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
          title="Bloqueado hasta comprar el objeto anterior"
        >
          <Lock size={11} color={isDark ? "#9ca3af" : "#64748b"} strokeWidth={2.5} />
        </span>
      )}
    </div>
  );
}

// Fila de un objeto ya conseguido. El tacho de basura no se muestra siempre: aparece
// solo tras un long press sobre la fila (y se vuelve a esconder solo a los 3s), para
// que la lista de "Conseguidos" no quede llena de botones de borrar a la vista.
function BoughtItemRow({
  item,
  colors,
  isDark,
  onUndo,
  onRemove,
}: {
  item: HouseItem;
  colors: Record<string, string>;
  isDark: boolean;
  onUndo: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const revealDelete = useCallback(() => {
    setShowDelete(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowDelete(false), 3000);
  }, []);

  const longPress = useLongPress<HTMLDivElement>(revealDelete, { delay: 500 });

  return (
    <div
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
      onPointerLeave={longPress.onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      title="Mantené apretado para eliminar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 12px",
        borderRadius: "10px",
        border: isDark ? "1px solid #1e2d1e" : "1px solid #e2e8f0",
        opacity: 0.6,
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "manipulation",
      }}
    >
      <button
        type="button"
        onClick={() => onUndo(item.id)}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Deshacer compra"
        title="Toca para volver a pendientes"
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
      <span style={{ fontSize: "14px", flexShrink: 0 }}>{item.emoji}</span>
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
        {item.name}
      </span>
      {showDelete && (
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Eliminar objeto"
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
      )}
    </div>
  );
}

export default function HousePriorityList({
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

  // Order here is exactly the array order -- the same order HouseInventory persists
  // and moveMissingItem edits -- so index 0 is always "the next thing to buy".
  const pending = items.filter((item) => item.status === "missing");

  // Only the unlocked item shows by default -- a long wall of grayed-out locked
  // objects is exactly the "abrumada" feeling this list should avoid, since only
  // the first one is actionable anyway. The rest stay a tap away behind a counter.
  const [expanded, setExpanded] = useState(false);
  const visiblePending = expanded ? pending : pending.slice(0, 1);
  const hiddenCount = pending.length - visiblePending.length;

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [celebration, setCelebration] = useState<HouseCelebrationState | null>(null);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    };
  }, []);

  const move = (id: number, direction: "up" | "down") => {
    setItems((prev) => moveMissingItem(prev, id, direction));
  };

  // Long press sobre un objeto abre este modal -- edita emoji y nombre, y adentro
  // esta la opcion de eliminarlo de la lista (y del inventario).
  const startEdit = useCallback((id: number) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    setIsAdding(false);
    setEditingId(id);
    setEditName(target.name);
    setEditEmoji(target.emoji);
  }, [items]);

  const saveEdit = useCallback(() => {
    if (editingId === null) return;
    const cleanName = editName.trim();
    if (!cleanName) {
      window.alert("El nombre no puede estar vacio.");
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === editingId ? { ...i, name: cleanName, emoji: editEmoji.trim() || i.emoji } : i,
      ),
    );
    setEditingId(null);
  }, [editingId, editName, editEmoji, setItems]);

  const deleteEditing = useCallback(() => {
    if (editingId === null) return;
    setItems((prev) => prev.filter((i) => i.id !== editingId));
    setEditingId(null);
  }, [editingId, setItems]);

  const editingItem = editingId !== null ? items.find((i) => i.id === editingId) ?? null : null;

  // Long press en el fondo abre un popup (mismo estilo que los del Inventario,
  // pero solo con el nombre) para agregar un objeto pendiente sin salir de esta
  // pestaña. Queda con la categoria "Otros" y el emoji por defecto -- se puede
  // afinar despues con long press desde el Inventario.
  const openAdd = useCallback(() => {
    setEditingId(null);
    setAddName("");
    setIsAdding(true);
  }, []);

  const backgroundLongPress = useLongPress<HTMLDivElement>(openAdd, { delay: 600 });

  const confirmAdd = useCallback(() => {
    const cleanName = addName.trim();
    if (!cleanName) {
      window.alert("El nombre no puede estar vacio.");
      return;
    }

    const nextItem: HouseItem = {
      id: Date.now(),
      name: cleanName,
      emoji: HOUSE_GROUP_EMOJI.Otros,
      group: "Otros",
      status: "missing",
      utility: 3,
      condition: 3,
      importance: 3,
    };

    setItems((prev) => [...prev, nextItem]);
    setIsAdding(false);
    toast({ title: `Agregaste ${cleanName}`, description: "Quedo al final de la lista de prioridades." });
  }, [addName, setItems, toast]);

  const confirmPurchase = (id: number) => {
    const boughtItem = items.find((i) => i.id === id);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "have" } : item)));

    if (boughtItem) {
      playProgressAdvanceSound();
      setCelebration({ kind: "compra", name: boughtItem.name });
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = setTimeout(() => setCelebration(null), HOUSE_CELEBRATION_MS);
    }
  };

  // Los objetos ya comprados (status "have") -- se muestran abajo en "Conseguidos".
  // Tocar el tilde deshace la compra y los devuelve a la lista de pendientes.
  const bought = items.filter((item) => item.status === "have");

  const undoPurchase = useCallback((id: number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "missing" } : item)));
  }, [setItems]);

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, [setItems]);

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
      <HouseCelebration celebration={celebration} />

      <p style={{ color: colors.subtitle, fontSize: "11px", marginBottom: "14px" }}>
        Solo el primer objeto esta desbloqueado para comprar. Usa las flechas para cambiar el orden de prioridad -- al comprar el primero, el siguiente se desbloquea. Long press en el fondo para agregar un objeto nuevo, o sobre un objeto para editarlo o eliminarlo.
      </p>

      {isAdding && (
        <HouseEditPopup
          heading="Nuevo objeto"
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
              Nombre del objeto
            </div>
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmAdd();
              }}
              autoFocus
              placeholder="Ej: Aspiradora"
              style={houseEditInputStyle(colors, isDark)}
            />
          </div>
        </HouseEditPopup>
      )}

      {editingItem && (
        <HouseEditPopup
          heading={`Editando "${editingItem.name}"`}
          colors={colors}
          isDark={isDark}
          onCancel={() => setEditingId(null)}
          onSubmit={saveEdit}
          onDelete={deleteEditing}
        >
          <div style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: "8px" }}>
            <input
              value={editEmoji}
              onChange={(e) => setEditEmoji(e.target.value)}
              maxLength={4}
              placeholder="📦"
              style={{ ...houseEditInputStyle(colors, isDark), textAlign: "center", fontSize: "18px", padding: 0 }}
            />
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
              }}
              autoFocus
              placeholder="Ej: Aspiradora"
              style={houseEditInputStyle(colors, isDark)}
            />
          </div>
        </HouseEditPopup>
      )}

      {pending.length === 0 && (
        <p style={{ color: colors.subtitle, fontSize: "11px" }}>
          No hay objetos pendientes. Agrega los que falten desde la pestaña Inventario.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }} onPointerDown={(e) => e.stopPropagation()}>
        {visiblePending.map((item, index) => (
          <PriorityRow
            key={item.id}
            item={item}
            index={index}
            isLast={index === pending.length - 1}
            colors={colors}
            isDark={isDark}
            onMove={move}
            onConfirmPurchase={confirmPurchase}
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

      {bought.length > 0 && (
        <div style={{ marginTop: "18px" }} onPointerDown={(e) => e.stopPropagation()}>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: colors.subtitle, marginBottom: "8px" }}>
            Conseguidos ({bought.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {bought.map((item) => (
              <BoughtItemRow
                key={item.id}
                item={item}
                colors={colors}
                isDark={isDark}
                onUndo={undoPurchase}
                onRemove={removeItem}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
