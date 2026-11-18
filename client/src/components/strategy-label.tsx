import { cn } from "@/lib/utils";
import type { JournalStrategy, StrategyLabel } from "@shared/schema";

// Etiqueta de una estrategia del Journal: "Para intentar" (dorado), "Útil" (verde) o "No útil"
// (gris). Se elige al crearla o al usarla (modal de feedback) y se edita desde el Journal.

export const STRATEGY_LABEL_OPTIONS: Array<{ id: StrategyLabel; label: string }> = [
  { id: "para-intentar", label: "Para intentar" },
  { id: "util", label: "Útil" },
  { id: "no-util", label: "No útil" },
];

const LABEL_STYLES: Record<StrategyLabel, { chip: string; selected: string; badge: string }> = {
  "para-intentar": {
    chip: "text-amber-600 dark:text-amber-400",
    selected: "border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
  },
  util: {
    chip: "text-emerald-600 dark:text-emerald-400",
    selected: "border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  },
  "no-util": {
    chip: "text-muted-foreground",
    selected: "border-muted-foreground/50 bg-muted text-foreground/80",
    badge: "bg-muted text-muted-foreground border-border",
  },
};

export const strategyLabelName = (label: StrategyLabel) =>
  STRATEGY_LABEL_OPTIONS.find((o) => o.id === label)?.label ?? "";

// Estrategia del Journal con ese título (sin importar mayúsculas), si existe.
export const findJournalStrategy = (strategies: JournalStrategy[], title: string | null | undefined) => {
  const key = (title ?? "").trim().toLocaleLowerCase();
  return key ? strategies.find((s) => s.title.trim().toLocaleLowerCase() === key) : undefined;
};

// Etiqueta sugerida al usar una estrategia en una victoria/acierto: la que ya tiene, salvo
// "Para intentar", que al usarse pasa a "Útil" (igual que en el server).
export const labelForUse = (existing: JournalStrategy | undefined): StrategyLabel =>
  !existing || existing.label === "para-intentar" ? "util" : existing.label;

export function StrategyLabelPicker({
  value,
  onChange,
  title = "Etiqueta",
  testIdPrefix = "strategy-label",
}: {
  value: StrategyLabel;
  onChange: (label: StrategyLabel) => void;
  title?: string;
  testIdPrefix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{title}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {STRATEGY_LABEL_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
              value === option.id ? LABEL_STYLES[option.id].selected : cn("border-border/60 bg-muted/40 hover:bg-muted/60", LABEL_STYLES[option.id].chip)
            )}
            data-testid={`${testIdPrefix}-${option.id}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Conteo de usos con el color de la etiqueta (verde/gris/dorado).
export function StrategyCountBadge({ label, count, className }: { label: StrategyLabel; count: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex min-w-[1.5rem] items-center justify-center rounded-full border px-1.5 text-[10px] font-semibold leading-4 tabular-nums", LABEL_STYLES[label].badge, className)}
      title={`${strategyLabelName(label)} · ${count} ${count === 1 ? "uso" : "usos"}`}
    >
      {count}
    </span>
  );
}
