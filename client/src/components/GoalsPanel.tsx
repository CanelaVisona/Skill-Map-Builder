import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Scroll, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { apiRequest } from "@/lib/queryClient";
import { useSkillTree, type Skill } from "@/lib/skill-context";
import { Checkbox } from "@/components/ui/checkbox";
import type { LifeGoalItem, CompletedLifeGoal } from "@shared/schema";

type LifeGoals = { mediumTerm: LifeGoalItem[]; longTerm: LifeGoalItem[]; completed: CompletedLifeGoal[] };
type GoalKey = "mediumTerm" | "longTerm";
type SourceLifeGoals = LifeGoals & { sourceType: "area" | "project"; sourceId: string };
type ActiveSource = { type: "area" | "project"; id: string; name: string };

const LONG_PRESS_MS = 500;

const EMPTY_GOALS: LifeGoals = { mediumTerm: [], longTerm: [], completed: [] };
const HORIZON_LABEL: Record<CompletedLifeGoal["horizon"], string> = {
  short: "Corto plazo",
  medium: "Mediano plazo",
  long: "Largo plazo",
};

// Cada área/proyecto tiene su propia lista de objetivos de mediano y largo plazo.
const lifeGoalsKey = (source: ActiveSource) => ["life-goals", source.type, source.id];
// Todas las listas juntas, para la tab "Objetivos" del Journal.
const ALL_LIFE_GOALS_KEY = ["life-goals", "all"];

// Detecta mantener apretado. Devuelve los handlers para el elemento y si se está presionando.
function useLongPress(onLongPress: () => void) {
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const cancel = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setIsPressing(false);
  };

  const start = () => {
    cancel();
    setIsPressing(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setIsPressing(false);
      onLongPress();
    }, LONG_PRESS_MS);
  };

  return {
    isPressing,
    handlers: {
      onPointerDown: start,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      style: { WebkitTouchCallout: "none" } as React.CSSProperties,
    },
  };
}

function useActiveSource(): ActiveSource | null {
  const { activeArea, activeProject } = useSkillTree();
  if (activeArea) return { type: "area", id: activeArea.id, name: activeArea.name };
  if (activeProject) return { type: "project", id: activeProject.id, name: activeProject.name };
  return null;
}

// Nombre del nivel en el que está parado el área/proyecto activo: el nivel del primer nodo
// pendiente (mismo criterio que usa el canvas para el nodo "siguiente"), y si ya está todo
// dominado, el nivel desbloqueado.
function useCurrentLevelName(): string | null {
  const { activeArea, activeProject } = useSkillTree();
  const item = activeArea || activeProject;
  if (!item) return null;

  const skills = [...(item.skills || [])].sort((a: Skill, b: Skill) => a.level - b.level || a.y - b.y);
  const pending = skills.find((s) => s.status === "available") || skills.find((s) => s.status !== "mastered");
  const level = pending?.level ?? item.unlockedLevel ?? 1;
  const subtitle = ((item.levelSubtitles || {})[level.toString()] || "").trim();
  return subtitle || `Nivel ${level}`;
}

function GoalInput({
  initialValue,
  placeholder,
  onCommit,
  onCancel,
}: {
  initialValue: string;
  placeholder: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(draft.trim());
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => onCommit(draft.trim())}
      placeholder={placeholder}
      className="min-w-0 flex-1 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-sm outline-none focus:border-foreground/40"
    />
  );
}

function GoalRow({
  goal,
  canComplete,
  onComplete,
  onEdit,
  onRemove,
}: {
  goal: LifeGoalItem;
  canComplete: boolean;
  onComplete: () => void;
  onEdit: (text: string) => void;
  onRemove: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const { isPressing, handlers } = useLongPress(() => setIsEditing(true));

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <GoalInput
          initialValue={goal.text}
          placeholder="Objetivo…"
          onCommit={(text) => {
            if (text && text !== goal.text) onEdit(text);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
        <button
          type="button"
          className="shrink-0 text-muted-foreground/60 transition-colors hover:text-destructive"
          // Evita que el blur del input cierre la edición antes de que llegue el click.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onRemove();
            setIsEditing(false);
          }}
          title="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 text-sm text-foreground">
      <Checkbox
        className="mt-0.5"
        checked={false}
        disabled={!canComplete}
        onCheckedChange={(checked) => checked && onComplete()}
        title={canComplete ? "Marcar como cumplido" : "Elegí un área para completar"}
      />
      <span
        className={`flex-1 select-none break-words transition-colors ${isPressing ? "text-muted-foreground" : ""}`}
        {...handlers}
      >
        {goal.text}
      </span>
    </div>
  );
}

function GoalSection({
  title,
  items,
  canComplete,
  onAdd,
  onEdit,
  onRemove,
  onComplete,
}: {
  title: string;
  items: LifeGoalItem[];
  canComplete: boolean;
  onAdd: (text: string) => void;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onComplete: (goal: LifeGoalItem) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const { isPressing, handlers } = useLongPress(() => setIsAdding(true));

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        className={`select-none text-left text-[11px] font-semibold uppercase tracking-wider transition-colors ${
          isPressing ? "text-foreground" : "text-muted-foreground"
        }`}
        {...handlers}
        title="Mantené presionado para agregar"
      >
        {title}
      </button>
      {items.length === 0 && !isAdding && (
        <p className="text-xs text-muted-foreground/50 italic">Mantené presionado el título para agregar</p>
      )}
      {items.map((goal) => (
        <GoalRow
          key={goal.id}
          goal={goal}
          canComplete={canComplete}
          onComplete={() => onComplete(goal)}
          onEdit={(text) => onEdit(goal.id, text)}
          onRemove={() => onRemove(goal.id)}
        />
      ))}
      {isAdding && (
        <div className="flex">
          <GoalInput
            initialValue=""
            placeholder="Nuevo objetivo…"
            onCommit={(text) => {
              if (text) onAdd(text);
              setIsAdding(false);
            }}
            onCancel={() => setIsAdding(false)}
          />
        </div>
      )}
    </div>
  );
}

function GoalsPanel() {
  const queryClient = useQueryClient();
  const levelName = useCurrentLevelName();
  const source = useActiveSource();

  const goalsKey = source ? lifeGoalsKey(source) : ["life-goals-none"];
  const { data: goals = EMPTY_GOALS } = useQuery<LifeGoals>({
    queryKey: goalsKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/life-goals/${source!.type}/${source!.id}`);
      return res.json();
    },
    enabled: !!source,
  });

  // El área viaja con cada guardado: si se cambia de área mientras se guarda, el resultado va a
  // la lista del área original y no pisa la nueva.
  const saveMutation = useMutation({
    mutationFn: async ({ target, next }: { target: ActiveSource; next: LifeGoals }) => {
      const res = await apiRequest("PUT", `/api/life-goals/${target.type}/${target.id}`, next);
      return res.json() as Promise<LifeGoals>;
    },
    onMutate: async ({ target, next }) => {
      const key = lifeGoalsKey(target);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LifeGoals>(key);
      queryClient.setQueryData(key, next);
      return { previous };
    },
    onError: (_err, { target }, context) => {
      if (context?.previous) queryClient.setQueryData(lifeGoalsKey(target), context.previous);
    },
    onSuccess: (saved, { target }) => {
      queryClient.setQueryData(lifeGoalsKey(target), saved);
      queryClient.invalidateQueries({ queryKey: ALL_LIFE_GOALS_KEY });
    },
  });

  const currentGoals = () => ({ ...EMPTY_GOALS, ...(queryClient.getQueryData<LifeGoals>(goalsKey) ?? goals) });
  const save = (next: LifeGoals) => {
    if (source) saveMutation.mutate({ target: source, next });
  };

  const addGoal = (key: GoalKey, text: string) => {
    const current = currentGoals();
    save({ ...current, [key]: [...current[key], { id: crypto.randomUUID(), text }] });
  };

  const editGoal = (key: GoalKey, id: string, text: string) => {
    const current = currentGoals();
    save({ ...current, [key]: current[key].map((g) => (g.id === id ? { ...g, text } : g)) });
  };

  const removeGoal = (key: GoalKey, id: string) => {
    const current = currentGoals();
    save({ ...current, [key]: current[key].filter((g) => g.id !== id) });
  };

  // Al tildar un objetivo de mediano/largo plazo se saca de esta lista y pasa a "completed", que
  // es lo que muestra la tab "Objetivos" del Journal.
  const completeGoal = (key: GoalKey, goal: LifeGoalItem) => {
    const current = currentGoals();
    save({
      ...current,
      [key]: current[key].filter((g) => g.id !== goal.id),
      completed: [
        ...current.completed,
        { id: goal.id, text: goal.text, horizon: key === "mediumTerm" ? "medium" : "long", completedAt: new Date().toISOString() },
      ],
    });
  };

  // El corto plazo sale del nivel actual, así que no se puede sacar de la lista: queda tildado
  // mientras haya un completado de corto plazo con ese nombre, y destildarlo lo saca del Journal.
  const shortTermCompleted = levelName
    ? (goals.completed ?? []).find((g) => g.horizon === "short" && g.text === levelName)
    : undefined;
  const toggleShortTerm = (checked: boolean) => {
    if (!levelName) return;
    const current = currentGoals();
    if (checked && !shortTermCompleted) {
      save({
        ...current,
        completed: [
          ...current.completed,
          { id: crypto.randomUUID(), text: levelName, horizon: "short", completedAt: new Date().toISOString() },
        ],
      });
    } else if (!checked && shortTermCompleted) {
      save({ ...current, completed: current.completed.filter((g) => g.id !== shortTermCompleted.id) });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Corto plazo</span>
        {levelName && source ? (
          <div className="flex items-start gap-2 text-sm text-foreground">
            <Checkbox
              className="mt-0.5"
              checked={!!shortTermCompleted}
              onCheckedChange={(checked) => toggleShortTerm(checked === true)}
              title="Marcar como cumplido"
            />
            <div className="flex-1">
              <span className={shortTermCompleted ? "text-muted-foreground line-through" : ""}>{levelName}</span>
              <span className="block text-xs text-muted-foreground/60">{source.name}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">Sin área activa</p>
        )}
      </div>
      <GoalSection
        title="Mediano plazo"
        items={goals.mediumTerm}
        canComplete={!!source}
        onAdd={(text) => addGoal("mediumTerm", text)}
        onEdit={(id, text) => editGoal("mediumTerm", id, text)}
        onRemove={(id) => removeGoal("mediumTerm", id)}
        onComplete={(goal) => completeGoal("mediumTerm", goal)}
      />
      <GoalSection
        title="Largo plazo"
        items={goals.longTerm}
        canComplete={!!source}
        onAdd={(text) => addGoal("longTerm", text)}
        onEdit={(id, text) => editGoal("longTerm", id, text)}
        onRemove={(id) => removeGoal("longTerm", id)}
        onComplete={(goal) => completeGoal("longTerm", goal)}
      />
    </div>
  );
}

// Icono de papiro que abre los objetivos en un modal centrado; se cierra tocando el fondo.
export function GoalsButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:text-foreground ${
          isOpen ? "text-foreground" : "text-muted-foreground/70"
        }`}
        onClick={() => setIsOpen(true)}
        data-testid="button-goals-toggle"
        title="Objetivos"
      >
        <Scroll className="h-4 w-4" />
      </button>
      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              onClick={() => setIsOpen(false)}
              data-testid="goals-modal-backdrop"
            >
              <motion.div
                className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-border/40 bg-background p-5 shadow-xl minimal-scrollbar"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                onClick={(e) => e.stopPropagation()}
              >
                <GoalsPanel />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

function CompletedGoalsGroup({ goals }: { goals: CompletedLifeGoal[] }) {
  return (
    <div className="flex flex-col gap-2">
      {goals.map((goal) => (
        <div key={goal.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background/70 px-3 py-2 text-sm">
          <span className="min-w-0 break-words">{goal.text}</span>
          <div className="flex shrink-0 flex-col items-end text-[11px] text-muted-foreground">
            <span>{HORIZON_LABEL[goal.horizon]}</span>
            <span className="text-muted-foreground/60">
              {new Date(goal.completedAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Tab "Objetivos" del Journal: los objetivos cumplidos, agrupados por área y por quest.
export function CompletedGoalsJournal() {
  const { areas, projects, archivedProjects } = useSkillTree();
  const { data: allGoals = [] } = useQuery<SourceLifeGoals[]>({
    queryKey: ALL_LIFE_GOALS_KEY,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/life-goals");
      return res.json();
    },
  });

  const byNewest = (a: CompletedLifeGoal, b: CompletedLifeGoal) => b.completedAt.localeCompare(a.completedAt);
  const buildGroups = (type: "area" | "project", sources: { id: string; name: string }[]) =>
    sources
      .map((source) => ({
        id: source.id,
        name: source.name,
        goals: [...(allGoals.find((g) => g.sourceType === type && g.sourceId === source.id)?.completed ?? [])].sort(byNewest),
      }))
      .filter((group) => group.goals.length > 0);

  const areaGroups = buildGroups("area", Array.isArray(areas) ? areas : []);
  const questGroups = buildGroups("project", [
    ...(Array.isArray(projects) ? projects : []),
    ...(Array.isArray(archivedProjects) ? archivedProjects : []),
  ]);

  const renderSection = (title: string, prefix: string, groups: typeof areaGroups) =>
    groups.length > 0 && (
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        <Accordion type="multiple" className="space-y-2" defaultValue={groups.map((g) => `${prefix}-${g.id}`)}>
          {groups.map((group) => (
            <AccordionItem key={group.id} value={`${prefix}-${group.id}`} className="rounded-lg border border-border/50 bg-background/70">
              <AccordionTrigger className="px-3 py-2 text-left hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{group.name}</span>
                  <span className="text-xs text-muted-foreground">({group.goals.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3">
                <CompletedGoalsGroup goals={group.goals} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    );

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
        <p className="text-sm text-muted-foreground">Aquí aparecen los objetivos que marcaste como cumplidos.</p>
      </div>
      {areaGroups.length === 0 && questGroups.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
          Aún no cumpliste ningún objetivo.
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto pr-1 minimal-scrollbar">
          {renderSection("Áreas", "area", areaGroups)}
          {renderSection("Quests", "project", questGroups)}
        </div>
      )}
    </div>
  );
}
