import { useState } from "react";
import { useTheme } from "next-themes";
import { ChevronUp, ChevronDown, ChevronsDown, ChevronsUp, Lock, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { playProgressAdvanceSound } from "@/lib/sound";
import { HOUSE_TYPE_META, getHouseColors, type HouseItem } from "./HouseInventory";

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
}: {
  item: HouseItem;
  index: number;
  isLast: boolean;
  colors: Record<string, string>;
  isDark: boolean;
  onMove: (id: number, direction: "up" | "down") => void;
  onConfirmPurchase: (id: number) => void;
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
        <div style={{ fontSize: "9.5px", color: colors.subtitle }}>{HOUSE_TYPE_META[item.type].label}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <button
          type="button"
          onClick={() => onMove(item.id, "up")}
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

  const move = (id: number, direction: "up" | "down") => {
    setItems((prev) => moveMissingItem(prev, id, direction));
  };

  const confirmPurchase = (id: number) => {
    const boughtItem = items.find((i) => i.id === id);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "have" } : item)));

    if (boughtItem) {
      playProgressAdvanceSound();
      toast({ title: `¡Sumaste ${boughtItem.name}! 🎉`, description: "Ya es parte de tu casa." });
    }
  };

  return (
    <div style={{ fontFamily: "'Exo 2', 'Segoe UI', sans-serif", width: "100%" }}>
      <p style={{ color: colors.subtitle, fontSize: "11px", marginBottom: "14px" }}>
        Solo el primer objeto esta desbloqueado para comprar. Usa las flechas para cambiar el orden de prioridad -- al comprar el primero, el siguiente se desbloquea.
      </p>

      {pending.length === 0 && (
        <p style={{ color: colors.subtitle, fontSize: "11px" }}>
          No hay objetos pendientes. Agrega los que falten desde la pestaña Inventario.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
    </div>
  );
}
