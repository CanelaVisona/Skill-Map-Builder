import { useEffect, useRef, useState, type RefObject } from "react";
import { Flag, Lock, Check, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Area, Project, Skill } from "@/lib/skill-context";

// Cumbre = nivel marcado con la bandera (milestoneLevels): cierra un tramo sin terminar el
// área/quest. La estrella (endOfAreaLevel) sigue siendo el nodo final final que termina todo.
// Muestra la próxima cumbre aunque su nivel siga bloqueado; al tocarla abre una vista previa de
// solo lectura de ese nivel. Hay dos versiones: una a lo ancho, en el flujo, debajo del nodo
// final del árbol; y una fija en pantalla que solo se ve mientras la de abajo está fuera de vista.

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

// Título del nivel (subtítulo del nivel); si no tiene, el título de su nodo final.
function labelOf(container: Area | Project, level: number): string {
  const node = finalNodeOf(container.skills || [], level);
  const nodeTitle = node && node.title !== DEFAULT_TITLE ? node.title.trim() : "";
  return container.levelSubtitles?.[level]?.trim() || nodeTitle || "Sin nombre todavía";
}

// true mientras el elemento está en pantalla (también dentro del contenedor con scroll del mapa).
function useInView<T extends Element>(ref: RefObject<T | null>, deps: unknown[]): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return setInView(false);
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return inView;
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
  const inlineRef = useRef<HTMLButtonElement>(null);
  const inlineInView = useInView(inlineRef, [target, container.id]);
  if (target == null) return null;
  const isFinal = nextCumbre == null;

  const title = labelOf(container, target);
  const kicker = isFinal ? "FINAL:" : "CUMBRE:";
  const icon = (cls: string) => isFinal
    ? <Star className={cn(cls, "flex-shrink-0 fill-amber-400 text-amber-400")} />
    : <Flag className={cn(cls, "flex-shrink-0 fill-emerald-500 text-emerald-500")} />;
  const borderCls = isFinal ? "border-amber-400/40" : "border-emerald-500/40";
  const kickerCls = isFinal ? "text-amber-400" : "text-emerald-500";
  // La fija desaparece (con fundido) cuando la de abajo entra en pantalla.
  const fixedHidden = inlineInView ? "opacity-0 pointer-events-none" : "opacity-100";
  const previewSkills = skills
    .filter(s => s.level === target)
    // De abajo hacia arriba, como se sube la montaña: el nodo final (la cumbre) queda primero.
    .sort((a, b) => (b.levelPosition ?? 0) - (a.levelPosition ?? 0));
  const isLockedLevel = target > container.unlockedLevel;

  return (
    <>
      {/* A lo ancho, debajo del nodo final del árbol. */}
      <button
        ref={inlineRef}
        type="button"
        onClick={() => setPreviewOpen(true)}
        className={cn(
          "mt-6 mb-24 w-full rounded-lg border px-4 py-3 text-left",
          "bg-background/80 hover:bg-muted/60 transition-colors",
          borderCls
        )}
        title="Ver vista previa del nivel"
        data-testid="button-cumbre-card-inline"
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon("h-4 w-4")}
          <span className={cn("text-xs font-level font-bold tracking-wider flex-shrink-0", kickerCls)}>{kicker}</span>
          <span className="text-sm font-semibold truncate">{title}</span>
        </div>
        <div className="mt-0.5 pl-6 text-xs text-muted-foreground">Nivel {target}</div>
      </button>

      {/* Fija mientras no se ve la de abajo. */}
      {fitsInGutter ? (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className={cn(
            "fixed bottom-16 z-40 rounded-lg border px-3 py-2 text-left backdrop-blur-md shadow-lg",
            "bg-background/85 hover:bg-muted/70 transition-[opacity,background-color] duration-200",
            borderCls,
            fixedHidden
          )}
          style={{ right: EDGE, width: CARD_WIDTH }}
          title="Ver vista previa del nivel"
          aria-hidden={inlineInView}
          tabIndex={inlineInView ? -1 : 0}
          data-testid="button-cumbre-card"
        >
          <div className="flex items-center gap-2 min-w-0">
            {icon("h-3.5 w-3.5")}
            <span className={cn("text-[11px] font-level font-bold tracking-wider flex-shrink-0", kickerCls)}>{kicker}</span>
            <span className="text-xs font-semibold truncate">{title}</span>
          </div>
          <div className="mt-0.5 pl-5 text-[11px] text-muted-foreground">Nivel {target}</div>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className={cn(
            "fixed bottom-4 right-16 z-40 flex h-10 items-center gap-1.5 rounded-full border px-3 backdrop-blur-md",
            "bg-background/80 hover:bg-muted/70 transition-[opacity,background-color] duration-200 text-xs text-muted-foreground",
            borderCls,
            fixedHidden
          )}
          title={`${isFinal ? "Final" : "Cumbre"}: ${title} · Nivel ${target}`}
          aria-hidden={inlineInView}
          tabIndex={inlineInView ? -1 : 0}
          data-testid="button-cumbre-card"
        >
          {icon("h-3.5 w-3.5")}
          <span className="font-medium tabular-nums">Nv {target}</span>
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
              {title}
              {isLockedLevel && " — vista previa, este nivel todavía está bloqueado."}
            </DialogDescription>
          </DialogHeader>
          <ol className="flex flex-col gap-1.5">
            {previewSkills.map((s, i) => {
              const isLast = i === 0; // el nodo final, arriba de todo
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
