import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Campos del alta/edición de un error (o acierto) del Journal, compartidos con el cubo "Error"
// del modal de feedback para que los dos tengan los mismos pasos.

export type BugCategoria = "" | "ups" | "stretch" | "alto-riesgo" | "aha";
export type BugBarMode = "victorias" | "ved" | "ninguna";

// Orden en que se agrupan los errores dentro de cada área ("" = sin categoría, al final).
export const BUG_CATEGORIES: Array<{ value: BugCategoria; label: string }> = [
  { value: "ups", label: "Ups" },
  { value: "stretch", label: "Stretch" },
  { value: "alto-riesgo", label: "Alto-riesgo" },
  { value: "aha", label: "Aha" },
  { value: "", label: "Sin categoría" },
];

export const BUG_BAR_MODES: Array<{ value: BugBarMode; label: string; desc: string }> = [
  { value: "victorias", label: "Barra de 5 victorias", desc: "Se debuguea al llegar a 5 victorias netas." },
  { value: "ved", label: "Victorias, empates y derrotas", desc: "Barra que solo cuenta cada resultado." },
  { value: "ninguna", label: "Sin barra", desc: "Los registros llevan victoria, empate o derrota, sin mostrar barra." },
];

export const newReflexion = (texto: string) => ({
  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  texto,
  fecha: new Date().toISOString().slice(0, 10),
});

// Nombre del error, flecha, y la estrategia elegida para reemplazarlo (de las del error, o una
// nueva que se suma a su lista de estrategias al guardar).
export function BugNombreAccionInputs({
  nombre,
  accion,
  estrategias,
  onNombreChange,
  onAccionChange,
  idPrefix,
  autoFocus,
  nameLabel = "Error",
}: {
  nombre: string;
  accion: string;
  estrategias: string[];
  onNombreChange: (value: string) => void;
  onAccionChange: (value: string) => void;
  idPrefix: string;
  autoFocus?: boolean;
  nameLabel?: string;
}) {
  const options = Array.from(new Set(estrategias.map((item) => item.trim()).filter(Boolean)));
  // Sin estrategias cargadas (error nuevo) se arranca directo escribiendo una.
  const [isNew, setIsNew] = useState(() => options.length === 0 || (!!accion.trim() && !options.includes(accion.trim())));
  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor={`${idPrefix}-nombre`} className="text-xs text-muted-foreground">{nameLabel}</Label>
          <Input
            id={`${idPrefix}-nombre`}
            placeholder={nameLabel.toUpperCase()}
            value={nombre}
            onChange={(e) => onNombreChange(e.target.value.toUpperCase())}
            className="uppercase"
            autoFocus={autoFocus}
          />
        </div>
        <ArrowRight className="mb-3 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <Label htmlFor={`${idPrefix}-accion`} className="text-xs text-muted-foreground">Estrategia</Label>
          <select
            id={`${idPrefix}-accion`}
            value={isNew ? "__new__" : accion}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                setIsNew(true);
                onAccionChange("");
              } else {
                setIsNew(false);
                onAccionChange(e.target.value);
              }
            }}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Sin estrategia</option>
            {options.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
            <option value="__new__">＋ nueva estrategia</option>
          </select>
        </div>
      </div>
      {isNew && (
        <Input
          className="mt-2"
          placeholder="Nueva estrategia"
          value={accion}
          onChange={(e) => onAccionChange(e.target.value)}
        />
      )}
    </div>
  );
}

export function BugCategoriaPicker({ value, onChange }: { value: BugCategoria; onChange: (value: BugCategoria) => void }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">Categoría</Label>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {BUG_CATEGORIES.map((category) => (
          <button
            key={category.value || "sin-categoria"}
            type="button"
            className={`rounded-md border px-3 py-2 text-xs transition-colors ${category.value === "" ? "col-span-2" : ""} ${value === category.value ? "border-foreground bg-muted/60 text-foreground" : "border-border/60 text-muted-foreground hover:bg-muted/40"}`}
            onClick={() => onChange(category.value)}
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BugBarModePicker({ value, onChange }: { value: BugBarMode; onChange: (value: BugBarMode) => void }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">Barra</Label>
      <div className="mt-1 grid gap-2">
        {BUG_BAR_MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            className={`rounded-md border px-3 py-2 text-left transition-colors ${value === mode.value ? "border-foreground bg-muted/60" : "border-border/60 hover:bg-muted/40"}`}
            onClick={() => onChange(mode.value)}
          >
            <p className={`text-xs ${value === mode.value ? "text-foreground" : "text-muted-foreground"}`}>{mode.label}</p>
            <p className="text-[11px] text-muted-foreground">{mode.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
