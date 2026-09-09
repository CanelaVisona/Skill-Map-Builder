import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Check, ChevronUp, ChevronDown, ChevronsDown, ChevronsUp, Lock, ShoppingCart, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { playProgressAdvanceSound } from "@/lib/sound";
import {
  EMPTY_FORM,
  GARMENT_META,
  GarmentGlyph,
  getClothingColors,
  ItemPopup,
  STYLE_META,
  useLongPress,
  type ClothingItem,
  type ItemFormState,
} from "./ClothingInventory";

// Moves the item with `id` one slot up/down among the "missing" (bloqueadas)
// prendas only, by swapping its position with the neighboring missing item inside
// the full array -- prendas que ya tenés keep their own relative order untouched.
// This is what "Lista de prioridades" reordering actually changes: the underlying
// array order, which is also what decides which prenda es la primera (desbloqueada).
function moveMissingItem(items: ClothingItem[], id: number, direction: "up" | "down"): ClothingItem[] {
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
  item: ClothingItem;
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
          flexShrink: 0,
          filter: isUnlocked ? "none" : "grayscale(0.9)",
          opacity: isUnlocked ? 1 : 0.6,
        }}
      >
        <GarmentGlyph type={item.type} color={item.color} size={22} />
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
        <div style={{ fontSize: "9.5px", color: colors.subtitle }}>
          {GARMENT_META[item.type].label} · {STYLE_META[item.style].label}
        </div>
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
          title="Bloqueada hasta comprar la prenda anterior"
        >
          <Lock size={11} color={isDark ? "#9ca3af" : "#64748b"} strokeWidth={2.5} />
        </span>
      )}
    </div>
  );
}

// Fila de una prenda ya comprada. El tacho de basura no se muestra siempre: aparece
// solo tras un long press sobre la fila (y se vuelve a esconder solo a los 3s), para
// que la lista de "Conseguidas" no quede llena de botones de borrar a la vista.
function BoughtItemRow({
  item,
  colors,
  isDark,
  onUndo,
  onRemove,
}: {
  item: ClothingItem;
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
      <span style={{ flexShrink: 0, display: "flex" }}>
        <GarmentGlyph type={item.type} color={item.color} size={16} />
      </span>
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
          aria-label="Eliminar prenda"
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

export default function ClothingPriorityList({
  items,
  setItems,
}: {
  items: ClothingItem[];
  setItems: (updater: ClothingItem[] | ((prev: ClothingItem[]) => ClothingItem[])) => void;
}) {
  const { theme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";
  const colors = getClothingColors(isDark);
  const { toast } = useToast();

  // Order here is exactly the array order -- the same order ClothingInventory
  // persists and moveMissingItem edits -- so index 0 is always "la próxima prenda
  // a comprar". Las prendas de la lista salen de los elementos bloqueados del
  // inventario, es decir las que todavía faltan comprar (status "missing").
  const pending = items.filter((item) => item.status === "missing");

  // Only the unlocked prenda shows by default -- a long wall of grayed-out locked
  // prendas is exactly the "abrumada" feeling this list should avoid, since only
  // the first one is actionable anyway. The rest stay a tap away behind a counter.
  const [expanded, setExpanded] = useState(false);
  const visiblePending = expanded ? pending : pending.slice(0, 1);
  const hiddenCount = pending.length - visiblePending.length;

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ItemFormState>(EMPTY_FORM);
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<ItemFormState>(EMPTY_FORM);

  const move = (id: number, direction: "up" | "down") => {
    setItems((prev) => moveMissingItem(prev, id, direction));
  };

  // Long press sobre una prenda abre el mismo popup del Inventario -- edita todos
  // los campos, y adentro está la opción de eliminarla de la lista (y del inventario).
  const startEdit = useCallback(
    (id: number) => {
      const target = items.find((i) => i.id === id);
      if (!target) return;
      setIsAdding(false);
      setEditingId(id);
      setEditForm({
        name: target.name,
        type: target.type,
        color: target.color,
        status: target.status,
        style: target.style,
        comfort: target.comfort,
        condition: target.condition,
        styleScore: target.styleScore,
      });
    },
    [items],
  );

  const saveEdit = useCallback(() => {
    if (editingId === null) return;
    const cleanName = editForm.name.trim();
    if (!cleanName) {
      window.alert("El nombre no puede estar vacio.");
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === editingId
          ? {
              ...i,
              name: cleanName,
              type: editForm.type,
              color: editForm.color,
              status: editForm.status,
              style: editForm.style,
              comfort: editForm.comfort,
              condition: editForm.condition,
              styleScore: editForm.styleScore,
            }
          : i,
      ),
    );
    setEditingId(null);
  }, [editingId, editForm, setItems]);

  const deleteEditing = useCallback(() => {
    if (editingId === null) return;
    setItems((prev) => prev.filter((i) => i.id !== editingId));
    setEditingId(null);
  }, [editingId, setItems]);

  const editingItem = editingId !== null ? items.find((i) => i.id === editingId) ?? null : null;

  // Long press en el fondo abre el popup del Inventario para sumar una prenda
  // pendiente sin salir de esta pestaña -- arranca como "Falta comprar" para que
  // caiga derecho en la lista de prioridades.
  const openAdd = useCallback(() => {
    setEditingId(null);
    setAddForm({ ...EMPTY_FORM, status: "missing" });
    setIsAdding(true);
  }, []);

  const backgroundLongPress = useLongPress<HTMLDivElement>(openAdd, { delay: 600 });

  const confirmAdd = useCallback(() => {
    const cleanName = addForm.name.trim();
    if (!cleanName) {
      window.alert("El nombre no puede estar vacio.");
      return;
    }

    const nextItem: ClothingItem = {
      id: Date.now(),
      name: cleanName,
      type: addForm.type,
      color: addForm.color,
      status: addForm.status,
      style: addForm.style,
      comfort: addForm.comfort,
      condition: addForm.condition,
      styleScore: addForm.styleScore,
    };

    setItems((prev) => [...prev, nextItem]);
    setIsAdding(false);
    toast({
      title: `Agregaste ${cleanName}`,
      description:
        nextItem.status === "missing"
          ? "Quedo al final de la lista de prioridades."
          : "Ya la marcaste como conseguida.",
    });
  }, [addForm, setItems, toast]);

  const confirmPurchase = (id: number) => {
    const boughtItem = items.find((i) => i.id === id);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "have" } : item)));

    if (boughtItem) {
      playProgressAdvanceSound();
      toast({ title: `Compraste ${boughtItem.name}`, description: "Se desbloqueo la siguiente prenda." });
    }
  };

  // Las prendas ya compradas (status "have") -- se muestran abajo en "Conseguidas".
  // Tocar el tilde deshace la compra y las devuelve a la lista de pendientes.
  const bought = items.filter((item) => item.status === "have");

  const undoPurchase = useCallback(
    (id: number) => {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "missing" } : item)));
    },
    [setItems],
  );

  const removeItem = useCallback(
    (id: number) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [setItems],
  );

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
      <p style={{ color: colors.subtitle, fontSize: "11px", marginBottom: "14px" }}>
        Las prendas salen de lo que todavía tenés bloqueado en el inventario. Solo la primera está desbloqueada para comprar. Usa las flechas para cambiar el orden de prioridad -- al comprar la primera, la siguiente se desbloquea. Long press en el fondo para agregar una prenda nueva, o sobre una para editarla o eliminarla.
      </p>

      {isAdding && (
        <ItemPopup
          heading="Nueva prenda"
          form={addForm}
          onChange={setAddForm}
          colors={colors}
          isDark={isDark}
          onCancel={() => setIsAdding(false)}
          onSubmit={confirmAdd}
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
          onDelete={deleteEditing}
        />
      )}

      {pending.length === 0 && (
        <p style={{ color: colors.subtitle, fontSize: "11px" }}>
          No hay prendas bloqueadas. Marca como "Falta comprar" las que quieras desde la pestaña Inventario.
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
          +{hiddenCount} más esperando · Ver todas
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
            Conseguidas ({bought.length})
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
