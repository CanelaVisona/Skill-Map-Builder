import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Check, Plus, X } from "lucide-react";
import {
  ACHIEVEMENT_TYPES,
  HELP_CONTEXT_LABELS,
  achievementEmoji,
  achievementLabel,
  type AchievementType,
  type ConceptAchievement,
} from "@/lib/conceptAchievements";

// «Mis logros durante la respuesta»: se marcan/desmarcan en cualquier momento mientras se
// escribe, sin salir del editor. Nada acá es obligatorio para continuar.
export function ConceptAchievementsPanel({
  achievements,
  onToggle,
  onAddCustom,
  onRemove,
  saveState,
  summary,
}: {
  achievements: ConceptAchievement[]; // Solo los de la sesión actual
  onToggle: (type: Exclude<AchievementType, "custom">) => void;
  onAddCustom: (description: string) => void;
  onRemove: (id: string) => void;
  saveState: "idle" | "saving" | "saved" | "error";
  summary?: boolean; // Al finalizar: resumen + agregar los que faltaron
}) {
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const marked = new Set(achievements.map((a) => a.type));
  const customs = achievements.filter((a) => a.type === "custom");

  const addCustom = () => {
    if (!custom.trim()) return;
    onAddCustom(custom.trim());
    setCustom("");
    setShowCustom(false);
  };

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <p className="flex-1 text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
          {summary ? `Mis logros de esta sesión (${achievements.length})` : "¿Qué lograste en esta respuesta?"}
        </p>
        <span className="text-[10px] text-muted-foreground">
          {saveState === "saving" ? "Guardando…" : saveState === "saved" ? "Guardado ✓" : saveState === "error" ? "No se pudo guardar" : ""}
        </span>
      </div>
      {summary && achievements.length === 0 && (
        <p className="mb-1.5 text-xs text-muted-foreground">No marcaste logros. Si te olvidaste de alguno, podés agregarlo ahora.</p>
      )}
      {summary && achievements.length > 0 && (
        <ul className="mb-2 flex flex-col gap-0.5 text-xs">
          {achievements.map((a) => (
            <li key={a.id} className="flex items-start gap-1.5">
              <span>{achievementEmoji(a.type)}</span>
              <span className="flex-1">{achievementLabel(a)} <span className="text-muted-foreground">· {HELP_CONTEXT_LABELS[a.helpContext]}</span></span>
            </li>
          ))}
        </ul>
      )}
      {summary && <p className="mb-1 text-[11px] font-semibold text-muted-foreground">¿Falta alguno?</p>}
      <div className="flex flex-col gap-1">
        {ACHIEVEMENT_TYPES.map((t) => {
          const on = marked.has(t.type);
          return (
            <button
              key={t.type}
              type="button"
              onClick={() => onToggle(t.type)}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1 text-left text-xs transition-colors ${
                on ? "border-emerald-500/60 bg-emerald-500/15 text-foreground" : "border-transparent text-muted-foreground hover:bg-emerald-500/10 hover:text-foreground"
              }`}
            >
              <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${on ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40"}`}>
                {on && <Check className="h-3 w-3" />}
              </span>
              <span>{t.emoji} {t.label}</span>
            </button>
          );
        })}
        {customs.map((a) => (
          <div key={a.id} className="flex items-center gap-2 rounded-lg border border-emerald-500/60 bg-emerald-500/15 px-2 py-1 text-xs">
            <span>⭐</span>
            <span className="flex-1">{a.description}</span>
            <button type="button" onClick={() => onRemove(a.id)} className="text-muted-foreground hover:text-foreground" title="Quitar">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {showCustom ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addCustom(); }
                if (e.key === "Escape") setShowCustom(false);
              }}
              placeholder="Otro logro o descubrimiento…"
              className="h-7 rounded-lg text-xs"
            />
            <button type="button" onClick={addCustom} disabled={!custom.trim()} className="rounded-lg p-1 text-emerald-700 disabled:opacity-40 dark:text-emerald-400" title="Agregar">
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowCustom(true)} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
            <Plus className="h-3 w-3" /> Otro logro
          </button>
        )}
      </div>
    </div>
  );
}
