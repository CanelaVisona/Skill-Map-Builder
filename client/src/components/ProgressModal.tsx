import React, { useEffect, useState } from "react";
import { CalendarClock, ChevronDown, ChevronUp, Clock, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSkillTree, type Area, type Project } from "@/lib/skill-context";
import {
  calculateLevelProgressPercentage,
  countMasteredSkillsInLevel,
  countSkillsInLevel,
  getUnlockedNode,
} from "@/lib/area-progress";
import {
  applyManualOrder,
  fixSectionOrder,
  loadProgressTrackerPrefs,
  saveProgressTrackerPrefs,
  type ProgressTrackerPrefs,
} from "@/lib/progress-tracker-settings";

interface ProgressItem {
  id: string;
  name: string;
  type: "area" | "project";
  level: number;
  subtitle?: string;
  // undefined: no hay ningún nodo "available" ahora mismo. "": hay un nodo desbloqueado
  // pero todavía no tiene nombre cargado.
  nodeTitle?: string;
  hasUnlockedNode: boolean;
  masteredInLevel: number;
  totalInLevel: number;
}

// ISO -> value para <input type="datetime-local"> (hora local, sin segundos).
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Fecha programada en texto corto, o un aviso si todavía no se eligió ninguna.
function formatSchedule(iso: string | null): string {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Intensidad por nivel en verde (mismo tono en dark y light, para que la barra se
// lea siempre como progreso "completo" sin importar el tema). Se usa para rellenar
// los bloques de la barra (sin texto encima).
const getLevelColor = (level: number): string => {
  const colors: { [key: number]: string } = {
    1: "bg-green-100 dark:bg-green-100",
    2: "bg-green-200 dark:bg-green-200",
    3: "bg-green-300 dark:bg-green-300",
    4: "bg-green-400 dark:bg-green-400",
    5: "bg-green-500 dark:bg-green-500",
    6: "bg-green-600 dark:bg-green-600",
    7: "bg-green-700 dark:bg-green-700",
    8: "bg-green-800 dark:bg-green-800",
  };
  return colors[level] || "bg-green-500 dark:bg-green-500";
};

// Chip "Lvl X": mismo tratamiento que los campos del formulario del skill
// (bg-muted, sin borde), legible en dark y light.
const levelBadgeClass = "bg-muted text-foreground";

// Áreas/quests con subtítulo cargado primero, para que lo relevante quede arriba
function sortBySubtitleFirst(items: ProgressItem[]): ProgressItem[] {
  return [...items.filter((item) => item.subtitle), ...items.filter((item) => !item.subtitle)];
}

// Clave estable de cada fila, usada para orden manual y para la lista de ocultos.
const getItemKey = (item: Pick<ProgressItem, "type" | "id">) => `${item.type}-${item.id}`;

type ProgressViewMode = "classic" | "node";

// Mantener presionado (mouse o touch) dispara `onLongPress` a los `ms` configurados.
// Si dispara, se traga el click que sigue (onClickCapture) para que no navegue al
// skill tree justo al entrar en modo edición.
function useLongPress(onLongPress: () => void, ms = 500) {
  const timerRef = React.useRef<number | null>(null);
  const firedRef = React.useRef(false);

  const clear = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = () => {
    firedRef.current = false;
    clear();
    timerRef.current = window.setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, ms);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (firedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      firedRef.current = false;
    }
  };

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClickCapture,
  };
}

function ProgressItemRow({
  item,
  onGoToItem,
  viewMode,
  editMode = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onHide,
  onLongPress,
}: {
  item: ProgressItem;
  onGoToItem: (item: ProgressItem) => void;
  viewMode: ProgressViewMode;
  editMode?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onHide?: () => void;
  onLongPress?: () => void;
}) {
  const totalBlocks = Math.max(item.totalInLevel, 1);
  const progress = calculateLevelProgressPercentage(item.masteredInLevel, item.totalInLevel);
  const longPress = useLongPress(() => onLongPress?.());

  // Tres casos para la vista "Nodo": no hay ningún nodo "available" todavía; hay uno pero
  // no tiene nombre cargado (se invita a definirlo); o hay uno con nombre, que es el caso normal.
  const nodeLabel = !item.hasUnlockedNode
    ? "Sin nodo desbloqueado"
    : item.nodeTitle || "Definí un paso";
  const nodeLabelIsPlaceholder = !item.hasUnlockedNode;

  return (
    <div
      className="space-y-1 pb-3 border-b border-border/40 last:border-none select-none"
      {...longPress}
    >
      {viewMode === "node" ? (
        /* Vista "Nodo": el título del nodo puntual desbloqueado (status "available") a la
           izquierda es lo protagonista de la fila -- no el subtítulo del nivel entero.
           Área/proyecto a la derecha, como referencia chica, junto con el nivel. Si no hay
           ningún nodo "available" ahora mismo (nivel recién mastered/en transición), se avisa
           chico y en itálica en vez de simular uno. Si hay nodo pero sin nombre, se invita a
           definirlo en vez de mostrar un espacio en blanco. */
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onGoToItem(item)}
            title={`Ir al skill tree de ${item.name}`}
            className={`truncate min-w-0 text-left hover:opacity-70 active:opacity-60 transition-opacity ${
              nodeLabelIsPlaceholder
                ? "text-xs italic text-muted-foreground/70"
                : "font-quest font-semibold text-base sm:text-xl text-foreground"
            }`}
          >
            {nodeLabel}
          </button>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate max-w-[120px]">
              {item.name}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${levelBadgeClass}`}>
              Lvl {item.level}
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* Nombre del área/quest: referencia chica, no es lo protagonista */}
          <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">
            {item.name}
          </span>

          {/* Subtítulo del nivel actual: lo más visible, indica de qué es la barra de abajo.
              Clickeable: lleva directo al skill tree de esa área/quest.
              Si no hay subtítulo cargado, se avisa chico y en itálica en vez de simular uno. */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onGoToItem(item)}
              title={`Ir al skill tree de ${item.name}`}
              className={`truncate min-w-0 text-left hover:opacity-70 active:opacity-60 transition-opacity ${
                item.subtitle
                  ? "font-level font-bold text-sm sm:text-lg text-foreground"
                  : "text-xs italic text-muted-foreground/70"
              }`}
            >
              {item.subtitle || "Título no asignado"}
            </button>
            <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${levelBadgeClass}`}>
              Lvl {item.level}
            </span>
          </div>
        </>
      )}

      {/* Barra de progreso del subtítulo/nivel actual, en bloques (uno por nodo del nivel).
          En modo edición se esconde para que la lista quede compacta al reordenar. */}
      {!editMode && (
        <div className="flex items-center gap-1 mt-1" title={`${progress.toFixed(0)}%`}>
          {Array.from({ length: totalBlocks }).map((_, idx) => {
            const filled = item.totalInLevel > 0 && idx < item.masteredInLevel;
            return (
              <div
                key={idx}
                className={`h-2.5 flex-1 rounded-sm transition-colors duration-500 ${
                  filled ? getLevelColor(item.level) : "bg-muted"
                }`}
              />
            );
          })}
        </div>
      )}

      {/* Completados / total del nivel actual + controles de orden/ocultar (solo en modo edición) */}
      <div className="flex items-center justify-between">
        {editMode ? (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              title="Subir"
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              title="Bajar"
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onHide}
              title="Ocultar / posponer"
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span />
        )}
        <span className="text-right text-xs font-semibold text-muted-foreground">
          {item.masteredInLevel}/{item.totalInLevel}
        </span>
      </div>
    </div>
  );
}

// Una fila de "Próximos": el área/quest está apagada en el tracker. Sin fecha queda oculta
// hasta que se la muestre a mano; con fecha, reaparece sola cuando ese momento pasa. El
// selector de fecha se despliega recién al tocar el calendario, para no sumar ruido.
function UpcomingItemRow({
  item,
  iso,
  onSchedule,
  onShow,
}: {
  item: ProgressItem;
  iso: string;
  onSchedule: (key: string, iso: string) => void;
  onShow: (key: string) => void;
}) {
  const [editingDate, setEditingDate] = useState(false);
  const [value, setValue] = useState(() => toLocalInputValue(iso || null));
  const key = getItemKey(item);

  useEffect(() => {
    setValue(toLocalInputValue(iso || null));
  }, [iso]);

  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-foreground">{item.name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {iso ? `vuelve ${formatSchedule(iso)}` : "oculto · sin fecha"}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setEditingDate((v) => !v)}
          title={iso ? "Cambiar fecha" : "Poner fecha"}
          className={`rounded p-1 transition-colors hover:bg-muted ${
            iso || editingDate ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarClock className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onShow(key)}
          title="Mostrar ahora"
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      </div>
      {editingDate && (
        <div className="mt-2 space-y-2">
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!value}
              onClick={() => {
                const parsed = new Date(value);
                if (Number.isNaN(parsed.getTime())) return;
                onSchedule(key, parsed.toISOString());
                setEditingDate(false);
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-40"
            >
              <Clock size={13} /> Programar
            </button>
            {iso && (
              <button
                type="button"
                onClick={() => {
                  onSchedule(key, "");
                  setEditingDate(false);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Quitar fecha
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// "Próximos": unifica lo que antes eran "Ocultos" y "Próximos". Toda área/quest apagada en
// el tracker vive acá -- con fecha (reaparece sola) o sin fecha (hasta mostrarla a mano).
// Colapsada por defecto para no competirle la atención a lo que sí hay que hacer ahora.
// Siempre montada (aunque no haya nada oculto todavía) porque acá vive el botón
// minimalista que entra/sale del modo edición -- la otra forma es el long press en
// cualquier fila de arriba.
function UpcomingSection({
  items,
  scheduled,
  onSchedule,
  onShow,
  editMode,
  onToggleEditMode,
}: {
  items: ProgressItem[];
  scheduled: Record<string, string>;
  onSchedule: (key: string, iso: string) => void;
  onShow: (key: string) => void;
  editMode: boolean;
  onToggleEditMode: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-t border-border/40 pt-2">
      <div className="flex w-full items-center justify-between gap-2 py-1">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground group">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Próximos <span className="font-normal">({items.length})</span></span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
        </CollapsibleTrigger>
        {/* Botón minimalista: entra/sale del modo edición. La otra forma es mantener
            presionada cualquier fila de Áreas/Main Quest/Side Quest. */}
        <button
          type="button"
          onClick={onToggleEditMode}
          title={editMode ? "Listo" : "Ordenar, ocultar y agendar"}
          className={`shrink-0 rounded-full p-1.5 transition-colors ${
            editMode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
      <CollapsibleContent className="space-y-2 pt-2">
        {items.map((item) => (
          <UpcomingItemRow
            key={getItemKey(item)}
            item={item}
            iso={scheduled[getItemKey(item)] ?? ""}
            onSchedule={onSchedule}
            onShow={onShow}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProgressSection({
  title,
  items,
  onGoToItem,
  viewMode,
  editMode = false,
  onMove,
  onHide,
  onLongPress,
}: {
  title: string;
  items: ProgressItem[];
  onGoToItem: (item: ProgressItem) => void;
  viewMode: ProgressViewMode;
  editMode?: boolean;
  onMove?: (key: string, direction: -1 | 1) => void;
  onHide?: (key: string) => void;
  onLongPress?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (items.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 py-1 group">
        <span className="text-sm font-bold uppercase tracking-wide text-foreground/80">
          {title} <span className="text-muted-foreground font-normal">({items.length})</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        {items.map((item, idx) => {
          const key = getItemKey(item);
          return (
            <ProgressItemRow
              key={key}
              item={item}
              onGoToItem={onGoToItem}
              viewMode={viewMode}
              editMode={editMode}
              canMoveUp={idx > 0}
              canMoveDown={idx < items.length - 1}
              onMoveUp={() => onMove?.(key, -1)}
              onMoveDown={() => onMove?.(key, 1)}
              onHide={() => onHide?.(key)}
              onLongPress={onLongPress}
            />
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ProgressModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { areas, projects, setActiveAreaId, setActiveProjectId } = useSkillTree();
  const [viewMode, setViewMode] = useState<ProgressViewMode>("classic");
  const [editMode, setEditMode] = useState(false);
  const [prefs, setPrefs] = useState<ProgressTrackerPrefs>(loadProgressTrackerPrefs);

  // Al abrir el tracker se relee la preferencia (por si cambió en otra pestaña) y se
  // arranca siempre en modo lectura. Mientras está abierto, cada tanto se sacan de
  // "Próximos" las quests con fecha ya vencida: vuelven solas a su sección normal.
  useEffect(() => {
    if (!open) return;
    const dropDueSchedules = () => {
      setPrefs((prev) => {
        const now = Date.now();
        const next: Record<string, string> = {};
        for (const [key, iso] of Object.entries(prev.hidden)) {
          // sin fecha: queda oculta hasta mostrarla a mano. con fecha futura: sigue oculta.
          if (!iso || new Date(iso).getTime() > now) next[key] = iso;
        }
        if (Object.keys(next).length === Object.keys(prev.hidden).length) return prev;
        const updated = { ...prev, hidden: next };
        saveProgressTrackerPrefs(updated);
        return updated;
      });
    };
    setPrefs(loadProgressTrackerPrefs());
    setEditMode(false);
    dropDueSchedules();
    const id = window.setInterval(dropDueSchedules, 60000);
    return () => window.clearInterval(id);
  }, [open]);

  const updatePrefs = (next: ProgressTrackerPrefs) => {
    setPrefs(next);
    saveProgressTrackerPrefs(next);
  };

  // Entra/sale del modo edición: mantener presionada cualquier fila, o el botón
  // minimalista de la sección "Próximos", disparan lo mismo.
  const toggleEditMode = () => setEditMode((v) => !v);

  // Ocultar una fila: la manda a "Próximos" sin fecha (vuelve solo al mostrarla a mano).
  const hideItem = (key: string) => {
    updatePrefs({ ...prefs, hidden: { ...prefs.hidden, [key]: "" } });
  };
  // Mostrarla de nuevo ahora: la saca de "Próximos".
  const showItem = (key: string) => {
    const { [key]: _removed, ...rest } = prefs.hidden;
    updatePrefs({ ...prefs, hidden: rest });
  };
  // Ponerle / cambiarle / quitarle (iso "") la fecha en la que reaparece sola.
  const scheduleItem = (key: string, iso: string) => {
    updatePrefs({ ...prefs, hidden: { ...prefs.hidden, [key]: iso } });
  };

  // Mover una fila dentro de su sección. `sectionKeys` es el orden visible actual de esa
  // sección; se intercambia con el vecino y se fija el nuevo orden.
  const moveWithin = (sectionKeys: string[], key: string, direction: -1 | 1) => {
    const from = sectionKeys.indexOf(key);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= sectionKeys.length) return;
    const reordered = [...sectionKeys];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    updatePrefs({ ...prefs, order: fixSectionOrder(prefs.order, reordered) });
  };

  const buildProgressItem = (item: Area | Project, type: "area" | "project"): ProgressItem => {
    const level = item.unlockedLevel;
    const skills = item.skills || [];
    const unlockedNode = getUnlockedNode(skills, level);
    return {
      id: item.id,
      name: item.name,
      type,
      level,
      subtitle: item.levelSubtitles?.[level.toString()],
      nodeTitle: unlockedNode?.title,
      hasUnlockedNode: unlockedNode !== undefined,
      masteredInLevel: countMasteredSkillsInLevel(skills, level),
      totalInLevel: countSkillsInLevel(skills, level),
    };
  };

  const allAreaItems = sortBySubtitleFirst(Array.isArray(areas) ? areas.map((area) => buildProgressItem(area, "area")) : []);

  const projectList = Array.isArray(projects) ? projects : [];
  const allMainQuestItems = sortBySubtitleFirst(
    projectList.filter((p) => !p.questType || p.questType === "main").map((project) => buildProgressItem(project, "project"))
  );
  // Side, emergent y experience quests se agrupan juntos como "Side Quests"
  const allSideQuestItems = sortBySubtitleFirst(
    projectList.filter((p) => p.questType && p.questType !== "main").map((project) => buildProgressItem(project, "project"))
  );

  const allItems = [...allAreaItems, ...allMainQuestItems, ...allSideQuestItems];

  // "Próximos" (solo del tracker): la quest tiene una entrada en `prefs.hidden`. Se saca
  // de su sección normal mientras siga apagada -- sin fecha (hasta mostrarla a mano) o con
  // fecha futura (reaparece sola al pasar). Una entrada con fecha ya vencida se ignora acá
  // y la limpia el intervalo. No toca el estado global de la quest.
  const isUpcoming = (item: ProgressItem) => {
    const iso = prefs.hidden[getItemKey(item)];
    if (iso === undefined) return false;
    return !iso || new Date(iso).getTime() > Date.now();
  };

  // Cada sección: primero se saca lo que está en "Próximos", después se aplica el orden manual.
  const visibleOf = (items: ProgressItem[]) =>
    applyManualOrder(items.filter((item) => !isUpcoming(item)), getItemKey, prefs.order);
  const areaItems = visibleOf(allAreaItems);
  const mainQuestItems = visibleOf(allMainQuestItems);
  const sideQuestItems = visibleOf(allSideQuestItems);

  // Lista única de "Próximos", en el orden en que se fueron mandando ahí.
  const upcomingItems = Object.keys(prefs.hidden)
    .map((key) => allItems.find((item) => getItemKey(item) === key))
    .filter((item): item is ProgressItem => item !== undefined && isUpcoming(item));

  const hasAnyItems = allItems.length > 0;

  // Ir hasta el skill tree del área/quest correspondiente y cerrar el tracker
  const goToItem = (item: ProgressItem) => {
    if (item.type === "area") {
      setActiveAreaId(item.id);
    } else {
      setActiveProjectId(item.id);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mismo molde que el formulario del skill: DialogContent estándar (fondo, borde
          y cierre por Radix -- se va al tocar el fondo o con la X), border-0 + shadow-2xl,
          y todo sobre tokens del tema para que acompañe dark/light solo. */}
      <DialogContent className="sm:max-w-[440px] border-0 shadow-2xl max-h-[85dvh] overflow-hidden flex flex-col gap-3 p-4 sm:p-6">
        <VisuallyHidden>
          <DialogTitle>Progress Tracker</DialogTitle>
        </VisuallyHidden>
        <div className="flex shrink-0 items-center justify-between gap-2">
          <h2 className="text-lg sm:text-2xl font-bold">Progress Tracker</h2>
          {/* mr-7 deja lugar a la X de cierre del DialogContent. */}
          <div className="mr-7 flex items-center gap-1.5">
            {/* Toggle entre la vista clásica (área/quest arriba, subtítulo abajo) y la vista
                "Nodo" (nodo desbloqueado destacado a la izquierda, área/quest a la derecha).
                El modo edición ya no vive acá: se entra manteniendo presionada cualquier fila,
                o con el botón minimalista de la sección "Próximos" (donde están los ocultos). */}
            <div className="flex items-center gap-1 rounded-full bg-muted p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("classic")}
                className={`rounded-full px-2.5 py-1 transition-colors ${
                  viewMode === "classic" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Clásica
              </button>
              <button
                type="button"
                onClick={() => setViewMode("node")}
                className={`rounded-full px-2.5 py-1 transition-colors ${
                  viewMode === "node" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Nodo
              </button>
            </div>
          </div>
        </div>
        {/* Único contenedor con scroll: vertical nada más, con scrollbar fina y su propio
            colchón a la derecha (pr-2 -mr-2) para que la barra no le coma ancho al contenido.
            pt-2 separa el título "Progress Tracker" de los títulos de sección (Áreas / Quests). */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden minimal-scrollbar pr-2 -mr-2 pt-2 space-y-4">
          <ProgressSection
            title="Áreas"
            items={areaItems}
            onGoToItem={goToItem}
            viewMode={viewMode}
            editMode={editMode}
            onMove={(key, dir) => moveWithin(areaItems.map(getItemKey), key, dir)}
            onHide={hideItem}
            onLongPress={toggleEditMode}
          />
          <ProgressSection
            title="Main Quest"
            items={mainQuestItems}
            onGoToItem={goToItem}
            viewMode={viewMode}
            editMode={editMode}
            onMove={(key, dir) => moveWithin(mainQuestItems.map(getItemKey), key, dir)}
            onHide={hideItem}
            onLongPress={toggleEditMode}
          />
          <ProgressSection
            title="Side Quest"
            items={sideQuestItems}
            onGoToItem={goToItem}
            viewMode={viewMode}
            editMode={editMode}
            onMove={(key, dir) => moveWithin(sideQuestItems.map(getItemKey), key, dir)}
            onHide={hideItem}
            onLongPress={toggleEditMode}
          />

          {/* Siempre montada: acá vive el botón minimalista que entra/sale del modo
              edición, tenga o no la quest tracker algo oculto todavía. */}
          <UpcomingSection
            items={upcomingItems}
            scheduled={prefs.hidden}
            onSchedule={scheduleItem}
            onShow={showItem}
            editMode={editMode}
            onToggleEditMode={toggleEditMode}
          />

          {!hasAnyItems && (
            <div className="text-center py-8 text-muted-foreground">
              No areas or projects yet. Start creating them to track your progress!
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
