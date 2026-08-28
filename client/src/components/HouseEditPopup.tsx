import type { ReactNode } from "react";

// Shared modal for the Casa lists (prioridades y arreglos) -- used both for the
// "long press -> editar" flow and the "long press en el fondo -> agregar" flow,
// so they match the Inventario popups. The caller supplies the fields as children;
// this shell draws the backdrop, the heading and the button row. `onDelete` is
// optional: with it, an Eliminar button shows on the left (edit); without it, the
// row just has Cancelar + el boton de accion (agregar).
export default function HouseEditPopup({
  heading,
  colors,
  isDark,
  onCancel,
  onSubmit,
  onDelete,
  submitLabel = "Guardar",
  children,
}: {
  heading: string;
  colors: Record<string, string>;
  isDark: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  onDelete?: () => void;
  submitLabel?: string;
  children: ReactNode;
}) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onCancel}
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
        style={{
          width: "100%",
          maxWidth: "340px",
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

        <div style={{ display: "grid", gap: "12px" }}>{children}</div>

        <div style={{ display: "flex", gap: "8px", justifyContent: onDelete ? "space-between" : "flex-end", marginTop: "14px" }}>
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

export function houseEditInputStyle(colors: Record<string, string>, isDark: boolean) {
  return {
    height: "34px",
    borderRadius: "8px",
    border: isDark ? "1px solid #325a32" : "1px solid #86efac",
    background: isDark ? "#0f1a0f" : "#ffffff",
    color: colors.title,
    padding: "0 10px",
    fontSize: "12px",
    width: "100%",
  } as const;
}
