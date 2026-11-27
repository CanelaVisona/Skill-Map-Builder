import { useEffect, useState } from "react";
import { Flag, Lock, Check, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Area, Project, Skill } from "@/lib/skill-context";

// Cumbre = nivel marcado con la bandera (milestoneLevels): cierra un tramo sin terminar el
// área/quest. La estrella (endOfAreaLevel) sigue siendo el nodo final final que termina todo.
// Esta tarjeta queda fija arriba del mapa mostrando la próxima cumbre aunque su nivel siga
// bloqueado; al tocarla abre una vista previa de solo lectura de ese nivel.

const DEFAULT_TITLE = "Asigná un paso";

// La tarjeta es fija; para no tapar títulos ni nodos se ubica en el margen libre a la derecha
// de la columna del mapa (marcada con data-cumbre-anchor en SkillTree). Si ese margen no
// alcanza, se achica a una pastilla junto al botón de "ir al nodo pendiente".
const CARD_WIDTH = 260;
const EDGE = 16;

function useRightGutter(): number {
  const [gutter, setGutter] = useState(0);
  useEffect(() => {
    const measure = () => {
      const anchor = document.querySelector("[data-cumbre-anchor]");
      if (!anchor) return setGutter(0);
      setGutter(window.innerWidth - anchor.getBoundingClientRect().right);
    };
    measure();
    const anchor = document.querySelector("[data-cumbre-anchor]");
    const ro = anchor ? new ResizeObserver(measure) : null;
    if (anchor && ro) ro.observe(anchor);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return gutter;
}

function finalNodeOf(skills: Skill[], level: number): Skill | undefined {
  const inLevel = skills.filter(s => s.level === level);
  if (inLevel.length === 0) return undefined;
  return inLevel.reduce((a, b) => ((b.levelPosition ?? 0) > (a.levelPosition ?? 0) ? b : a));
}

function labelOf(container: Area | Project, level: number): string {
  const node = finalNodeOf(container.skills || [], level);
  const nodeTitle = node && node.title !== DEFAULT_TITLE ? node.title.trim() : "";
  return nodeTitle || container.levelSubtitles?.[level]?.trim() || "Sin nombre todavía";
}

export function CumbreCard({ container }: { container: Area | Project }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const gutter = useRightGutter();
  const fitsInGutter = gutter >= CARD_WIDTH + EDGE * 2;
  const skills = container.skills || [];
  const endLevel = container.endOfAreaLevel || null;
  const finalDone = endLevel != null && finalNodeOf(skills, endLevel)?.status === "mastered";

  const cumbres = (container.milestoneLevels || [])
    .filter(l => !endLevel || l < endLevel)
    .sort((a, b) => a - b);
  const nextCumbre = cumbres.find(
    l => l >= container.unlockedLevel && finalNodeOf(skills, l)?.status !== "mastered"
  );

  // Sin cumbre pendiente, la tarjeta apunta al nodo final final (si hay y no está hecho).
  const target = nextCumbre ?? (endLevel != null && !finalDone ? endLevel : null);
  if (target == null) return null;
  const isFinal = nextCumbre == null;

  const tramo = cumbres.filter(l => l < target).length + 1;
  const currentLevel = Math.min(container.unlockedLevel, target);
  const previewSkills = skills
    .filter(s => s.level === target)
    .sort((a, b) => (a.levelPosition ?? 0) - (b.levelPosition ?? 0));
  const isLockedLevel = target > container.unlockedLevel;

  return (
    <>
      {fitsInGutter ? (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className={cn(
            "fixed bottom-16 z-40 rounded-lg border px-3 py-2 text-left backdrop-blur-md shadow-lg",
            "bg-background/85 hover:bg-muted/70 transition-colors",
            isFinal ? "border-amber-400/40" : "border-emerald-500/40"
          )}
          style={{ right: EDGE, width: CARD_WIDTH }}
          title="Ver vista previa del nivel"
          data-testid="button-cumbre-card"
        >
          <div className="flex items-center gap-2 min-w-0">
            {isFinal ? (
              <Star className="h-3.5 w-3.5 flex-shrink-0 fill-amber-400 text-amber-400" />
            ) : (
              <Flag className="h-3.5 w-3.5 flex-shrink-0 fill-emerald-500 text-emerald-500" />
            )}
            <span className={cn("text-[11px] font-level font-bold tracking-wider", isFinal ? "text-amber-400" : "text-emerald-500")}>
              {isFinal ? "FINAL:" : "CUMBRE:"}
            </span>
            <span className="text-xs font-medium truncate">{labelOf(container, target)}</span>
          </div>
          <div className="mt-0.5 pl-5 text-[11px] text-muted-foreground truncate">
            {isFinal ? "Último tramo" : `Tramo ${tramo}`} · Nivel {currentLevel} de {target}
            {!isFinal && endLevel != null && ` · Final en nivel ${endLevel}`}
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className={cn(
            "fixed bottom-4 right-16 z-40 flex h-10 items-center gap-1.5 rounded-full border px-3 backdrop-blur-md",
            "bg-background/80 hover:bg-muted/70 transition-colors text-xs text-muted-foreground",
            isFinal ? "border-amber-400/40" : "border-emerald-500/40"
          )}
          title={`${isFinal ? "Final" : "Cumbre"}: ${labelOf(container, target)}`}
          data-testid="button-cumbre-card"
        >
          {isFinal ? (
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          ) : (
            <Flag className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
          )}
          <span className="font-medium tabular-nums">{currentLevel}/{target}</span>
        </button>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isFinal ? (
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              ) : (
                <Flag className="h-4 w-4 fill-emerald-500 text-emerald-500" />
              )}
              {isFinal ? "Final" : "Cumbre"} · Nivel {target}
            </DialogTitle>
            <DialogDescription>
              {container.levelSubtitles?.[target]?.trim() || labelOf(container, target)}
              {isLockedLevel && " — vista previa, este nivel todavía está bloqueado."}
            </DialogDescription>
          </DialogHeader>
          <ol className="flex flex-col gap-1.5">
            {previewSkills.map((s, i) => {
              const isLast = i === previewSkills.length - 1;
              const done = s.status === "mastered";
              return (
                <li
                  key={s.id}
                  className={cn(
                    "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm",
                    isLast && (isFinal ? "bg-amber-400/10" : "bg-emerald-500/10")
                  )}
                >
                  {done ? (
                    <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/60" />
                  )}
                  <div className="min-w-0">
                    <div className={cn("truncate", s.title === DEFAULT_TITLE && "text-muted-foreground italic")}>
                      {s.title}
                    </div>
                    {s.description?.trim() && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{s.description}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CumbreCard;
