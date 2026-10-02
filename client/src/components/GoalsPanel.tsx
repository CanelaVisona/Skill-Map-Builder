import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus, RotateCcw, Scroll, Star, Trash2, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { apiRequest } from "@/lib/queryClient";
import { useSkillTree, type Skill } from "@/lib/skill-context";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { playProgressAdvanceSound } from "@/lib/sound";
import { GoalCompletedCelebration, GOAL_CELEBRATION_MS, type GoalCelebrationState } from "./GoalCompletedCelebration";
import type { LifeGoalItem, LifeGoalMilestone, CompletedLifeGoal } from "@shared/schema";

type LifeGoals = { shortTerm: LifeGoalItem[]; mediumTerm: LifeGoalItem[]; longTerm: LifeGoalItem[]; completed: CompletedLifeGoal[] };
type GoalKey = "shortTerm" | "mediumTerm" | "longTerm";
type SourceLifeGoals = LifeGoals & { sourceType: "area" | "project"; sourceId: string };
type ActiveSource = { type: "area" | "project"; id: string; name: string };

const LONG_PRESS_MS = 500;

const EMPTY_GOALS: LifeGoals = { shortTerm: [], mediumTerm: [], longTerm: [], completed: [] };
const HORIZON_LABEL: Record<CompletedLifeGoal["horizon"], string> = {
  short: "Corto plazo",
  medium: "Mediano plazo",
  long: "Largo plazo",
};

const HORIZON_OF: Record<GoalKey, CompletedLifeGoal["horizon"]> = {
  shortTerm: "short",
  mediumTerm: "medium",
  longTerm: "long",
};

// Cada área/proyecto tiene su propia lista de objetivos de corto, mediano y largo plazo.
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
  return item ? levelNameOf(item) : null;
}

function levelNameOf(item: any): string {
  const skills = [...(item.skills || [])].sort((a: Skill, b: Skill) => a.level - b.level || a.y - b.y);
  const pending = skills.find((s) => s.status === "available") || skills.find((s) => s.status !== "mastered");
  const level = pending?.level ?? item.unlockedLevel ?? 1;
  const subtitle = ((item.levelSubtitles || {})[level.toString()] || "").trim();
  return subtitle || `Nivel ${level}`;
}

type GoalFields = Omit<LifeGoalItem, "id">;

const INPUT_CLASS =
  "min-w-0 flex-1 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-sm outline-none focus:border-foreground/40";

// Formulario para crear o editar un objetivo: texto, fecha objetivo (opcional) e hitos.
function GoalForm({
  initial,
  onSave,
  onCancel,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  initial?: LifeGoalItem;
  onSave: (fields: GoalFields) => void;
  onCancel: () => void;
  onRemove?: () => void;
  // Solo al editar: mueven el objetivo en la lista (undefined = ya está en ese extremo).
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [text, setText] = useState(initial?.text ?? "");
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");
  const [milestones, setMilestones] = useState<LifeGoalMilestone[]>(initial?.milestones ?? []);
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    textRef.current?.focus();
    textRef.current?.select();
  }, []);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const cleanMilestones = milestones.map((m) => ({ ...m, text: m.text.trim() })).filter((m) => m.text);
    onSave({
      text: trimmed,
      targetDate: targetDate || undefined,
      milestones: cleanMilestones.length ? cleanMilestones : undefined,
      milestonesDone: cleanMilestones.length
        ? Math.min(initial?.milestonesDone ?? 0, cleanMilestones.length)
        : undefined,
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
      <input
        ref={textRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Objetivo…"
        className={INPUT_CLASS}
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="shrink-0">Fecha objetivo</span>
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          onKeyDown={onKeyDown}
          className={INPUT_CLASS}
        />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Hitos</span>
        {milestones.map((m, i) => (
          <div key={m.id} className="flex items-center gap-2">
            <Star className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <input
              value={m.text}
              onChange={(e) =>
                setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, text: e.target.value } : x)))
              }
              onKeyDown={onKeyDown}
              placeholder={`Hito ${i + 1}…`}
              autoFocus={!m.text}
              className={INPUT_CLASS}
            />
            <button
              type="button"
              className="shrink-0 text-muted-foreground/60 transition-colors hover:text-destructive"
              onClick={() => setMilestones((prev) => prev.filter((x) => x.id !== m.id))}
              title="Quitar hito"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="flex items-center gap-1 self-start text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setMilestones((prev) => [...prev, { id: crypto.randomUUID(), text: "" }])}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar hito
        </button>
      </div>
      <div className="flex items-center gap-2 pt-1">
        {onRemove && (
          <button
            type="button"
            className="text-muted-foreground/60 transition-colors hover:text-destructive"
            onClick={onRemove}
            title="Eliminar objetivo"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        {initial && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              onClick={onMoveUp}
              disabled={!onMoveUp}
              title="Subir"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              onClick={onMoveDown}
              disabled={!onMoveDown}
              title="Bajar"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background transition-opacity disabled:opacity-40"
            onClick={submit}
            disabled={!text.trim()}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// YYYY-MM-DD → DD/MM/AA
const formatTargetDate = (date: string) => {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y.slice(-2)}`;
};

// Meses calendario completos entre hoy y la fecha (siempre positivo).
function wholeMonthsBetween(date: string) {
  const today = new Date();
  const target = new Date(`${date}T00:00:00`);
  const [from, to] = target >= today ? [today, target] : [target, today];
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months--;
  return months;
}

// Hasta un mes cuenta días (13d); a partir de un mes, meses completos (12m). Vencido: con "-".
function timeLeftLabel(date: string, days: number) {
  if (days === 0) return "hoy";
  const months = wholeMonthsBetween(date);
  const amount = months >= 1 ? `${months}m` : `${Math.abs(days)}d`;
  return days < 0 ? `-${amount}` : amount;
}

function daysUntil(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

// Flecha de hoy a la fecha objetivo con los hitos como estrellas repartidas a lo largo. Tocar una
// estrella marca cumplido hasta ahí; tocar la última cumplida la desmarca.
function GoalTimeline({ goal, onSetDone }: { goal: LifeGoalItem; onSetDone: (done: number) => void }) {
  const milestones = goal.milestones ?? [];
  const done = Math.min(goal.milestonesDone ?? 0, milestones.length);
  const n = milestones.length;
  const position = (i: number) => ((i + 1) / (n + 1)) * 100;
  const filledTo = done > 0 ? position(done - 1) : 0;
  const days = goal.targetDate ? daysUntil(goal.targetDate) : null;

  return (
    <div className="mt-1.5 flex flex-col gap-0.5">
      {n > 0 && (
        <div className="relative h-3.5">
          {milestones.map((m, i) => (
            <span
              key={m.id}
              className={`absolute -translate-x-1/2 truncate text-center text-[10px] leading-tight ${
                i < done ? "text-amber-500" : "text-muted-foreground/80"
              }`}
              style={{ left: `${position(i)}%`, maxWidth: `${100 / (n + 1)}%` }}
              title={m.text}
            >
              {m.text}
            </span>
          ))}
        </div>
      )}
      <div className="relative h-5">
        <div className="absolute left-0 right-1.5 top-1/2 h-px -translate-y-1/2 bg-border" />
        <div
          className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-amber-400 transition-all"
          style={{ width: `calc(${filledTo}% - ${(filledTo / 100) * 6}px)` }}
        />
        <div className="absolute right-0 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[4px] border-l-[6px] border-y-transparent border-l-border" />
        <div className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-muted-foreground/60" />
        {milestones.map((m, i) => {
          const isDone = i < done;
          return (
            <button
              key={m.id}
              type="button"
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background p-0.5 transition-transform hover:scale-125"
              style={{ left: `${position(i)}%` }}
              onClick={() => onSetDone(done === i + 1 ? i : i + 1)}
              title={`${m.text}${isDone ? " (cumplido)" : ""}`}
            >
              <Star
                className={`h-3.5 w-3.5 transition-colors ${
                  isDone ? "fill-amber-400 text-amber-400" : "text-muted-foreground/60"
                }`}
              />
            </button>
          );
        })}
      </div>
      <div className="flex items-start justify-between text-[10px] text-muted-foreground/70">
        <span>Hoy</span>
        {goal.targetDate && days !== null ? (
          <div className="flex flex-col items-end leading-tight">
            <span className="text-muted-foreground">{formatTargetDate(goal.targetDate)}</span>
            <span className={days < 0 ? "text-destructive/80" : ""}>{timeLeftLabel(goal.targetDate, days)}</span>
          </div>
        ) : (
          <span>Meta</span>
        )}
      </div>
    </div>
  );
}

function GoalRow({
  goal,
  canComplete,
  onComplete,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  goal: LifeGoalItem;
  canComplete: boolean;
  onComplete: () => void;
  onUpdate: (fields: GoalFields) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const { isPressing, handlers } = useLongPress(() => setIsEditing(true));

  if (isEditing) {
    return (
      <GoalForm
        initial={goal}
        onSave={(fields) => {
          onUpdate(fields);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
        onRemove={() => {
          onRemove();
          setIsEditing(false);
        }}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    );
  }

  const hasTimeline = !!goal.targetDate || (goal.milestones?.length ?? 0) > 0;

  return (
    <div className="flex items-start gap-2 text-sm text-foreground">
      <Checkbox
        className="mt-0.5"
        checked={false}
        disabled={!canComplete}
        onCheckedChange={(checked) => checked && onComplete()}
        title={canComplete ? "Marcar como cumplido" : "Elegí un área para completar"}
      />
      <div className="min-w-0 flex-1">
        <span
          className={`block select-none break-words transition-colors ${isPressing ? "text-muted-foreground" : ""}`}
          {...handlers}
        >
          {goal.text}
        </span>
        {hasTimeline && (
          <GoalTimeline goal={goal} onSetDone={(milestonesDone) => onUpdate({ ...goal, milestonesDone })} />
        )}
      </div>
    </div>
  );
}

function GoalSection({
  title,
  hint,
  items,
  canComplete,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
  onComplete,
  children,
}: {
  title: string;
  hint: string;
  items: LifeGoalItem[];
  canComplete: boolean;
  onAdd: (fields: GoalFields) => void;
  onUpdate: (id: string, fields: GoalFields) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onComplete: (goal: LifeGoalItem) => void;
  // Contenido fijo antes de la lista (el nivel actual, en corto plazo).
  children?: React.ReactNode;
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
        <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/60">{hint}</span>
      </button>
      {children}
      {items.length === 0 && !isAdding && !children && (
        <p className="text-xs text-muted-foreground/50 italic">Mantené presionado el título para agregar</p>
      )}
      {items.map((goal, i) => (
        <GoalRow
          key={goal.id}
          goal={goal}
          canComplete={canComplete}
          onComplete={() => onComplete(goal)}
          onUpdate={(fields) => onUpdate(goal.id, fields)}
          onRemove={() => onRemove(goal.id)}
          onMoveUp={i > 0 ? () => onMove(goal.id, -1) : undefined}
          onMoveDown={i < items.length - 1 ? () => onMove(goal.id, 1) : undefined}
        />
      ))}
      {isAdding && (
        <GoalForm
          onSave={(fields) => {
            onAdd(fields);
            setIsAdding(false);
          }}
          onCancel={() => setIsAdding(false)}
        />
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

  const [celebration, setCelebration] = useState<GoalCelebrationState | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
  }, []);
  const celebrate = (name: string, horizon: CompletedLifeGoal["horizon"]) => {
    playProgressAdvanceSound();
    setCelebration({ name, horizonLabel: HORIZON_LABEL[horizon] });
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = window.setTimeout(() => setCelebration(null), GOAL_CELEBRATION_MS);
  };

  const addGoal = (key: GoalKey, fields: GoalFields) => {
    const current = currentGoals();
    save({ ...current, [key]: [...current[key], { ...fields, id: crypto.randomUUID() }] });
  };

  const updateGoal = (key: GoalKey, id: string, fields: GoalFields) => {
    const current = currentGoals();
    save({ ...current, [key]: current[key].map((g) => (g.id === id ? { ...g, ...fields, id } : g)) });
  };

  const removeGoal = (key: GoalKey, id: string) => {
    const current = currentGoals();
    save({ ...current, [key]: current[key].filter((g) => g.id !== id) });
  };

  const moveGoal = (key: GoalKey, id: string, delta: -1 | 1) => {
    const current = currentGoals();
    const list = [...current[key]];
    const from = list.findIndex((g) => g.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    save({ ...current, [key]: list });
  };

  // Al tildar un objetivo agregado a mano se saca de esta lista y pasa a "completed", que
  // es lo que muestra la tab "Objetivos" del Journal.
  const completeGoal = (key: GoalKey, goal: LifeGoalItem) => {
    const current = currentGoals();
    save({
      ...current,
      [key]: current[key].filter((g) => g.id !== goal.id),
      completed: [
        ...current.completed,
        { id: goal.id, text: goal.text, horizon: HORIZON_OF[key], completedAt: new Date().toISOString(), item: goal },
      ],
    });
    celebrate(goal.text, HORIZON_OF[key]);
  };

  // El nivel actual (primer objetivo de corto plazo) no se puede sacar de la lista: queda tildado
  // mientras haya un completado de corto plazo con ese nombre, y destildarlo lo saca del Journal.
  const shortTermCompleted = levelName
    ? (goals.completed ?? []).find((g) => g.horizon === "short" && !g.item && g.text === levelName)
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
      celebrate(levelName, "short");
    } else if (!checked && shortTermCompleted) {
      save({ ...current, completed: current.completed.filter((g) => g.id !== shortTermCompleted.id) });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <GoalCompletedCelebration celebration={celebration} />
      <GoalSection
        title="Corto plazo"
        hint="< 1 año"
        items={goals.shortTerm ?? []}
        canComplete={!!source}
        onAdd={(fields) => addGoal("shortTerm", fields)}
        onUpdate={(id, fields) => updateGoal("shortTerm", id, fields)}
        onRemove={(id) => removeGoal("shortTerm", id)}
        onMove={(id, delta) => moveGoal("shortTerm", id, delta)}
        onComplete={(goal) => completeGoal("shortTerm", goal)}
      >
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
      </GoalSection>
      <GoalSection
        title="Mediano plazo"
        hint="1 a 2 años"
        items={goals.mediumTerm}
        canComplete={!!source}
        onAdd={(fields) => addGoal("mediumTerm", fields)}
        onUpdate={(id, fields) => updateGoal("mediumTerm", id, fields)}
        onRemove={(id) => removeGoal("mediumTerm", id)}
        onMove={(id, delta) => moveGoal("mediumTerm", id, delta)}
        onComplete={(goal) => completeGoal("mediumTerm", goal)}
      />
      <GoalSection
        title="Largo plazo"
        hint="3 años o más"
        items={goals.longTerm}
        canComplete={!!source}
        onAdd={(fields) => addGoal("longTerm", fields)}
        onUpdate={(id, fields) => updateGoal("longTerm", id, fields)}
        onRemove={(id) => removeGoal("longTerm", id)}
        onMove={(id, delta) => moveGoal("longTerm", id, delta)}
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

const KEY_OF: Record<CompletedLifeGoal["horizon"], GoalKey> = {
  short: "shortTerm",
  medium: "mediumTerm",
  long: "longTerm",
};

// Objetivo cumplido del Journal. Mantenerlo apretado abre la edición: cambiar el texto o
// recuperarlo (vuelve a su lista de pendientes).
function CompletedGoalCard({
  goal,
  onEdit,
  onRestore,
}: {
  goal: CompletedLifeGoal;
  onEdit: (text: string) => void;
  onRestore: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(goal.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isPressing, handlers } = useLongPress(() => {
    setDraft(goal.text);
    setIsEditing(true);
  });

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const submit = () => {
    const text = draft.trim();
    if (text && text !== goal.text) onEdit(text);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setIsEditing(false);
          }}
          className={INPUT_CLASS}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              onRestore();
              setIsEditing(false);
            }}
            title="Vuelve a la lista de objetivos pendientes"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Recuperar
          </button>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setIsEditing(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background transition-opacity disabled:opacity-40"
              onClick={submit}
              disabled={!draft.trim()}
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex select-none items-start justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm transition-colors ${
        isPressing ? "bg-muted/40" : "bg-background/70"
      }`}
      {...handlers}
      title="Mantené presionado para editar o recuperar"
    >
      <span className="min-w-0 break-words">{goal.text}</span>
      <div className="flex shrink-0 flex-col items-end text-[11px] text-muted-foreground">
        <span>{HORIZON_LABEL[goal.horizon]}</span>
        <span className="text-muted-foreground/60">
          {new Date(goal.completedAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>
    </div>
  );
}

type JournalSource = { type: "area" | "project"; id: string; name: string; item: any };

// Objetivos pendientes de un área/quest, divididos por plazo, para "Objetivos live".
function LiveGoalsGroup({
  source,
  goals,
  onSetDone,
}: {
  source: JournalSource;
  goals: LifeGoals;
  onSetDone: (key: GoalKey, goal: LifeGoalItem, done: number) => void;
}) {
  const levelName = levelNameOf(source.item);
  const levelDone = goals.completed.some((g) => g.horizon === "short" && !g.item && g.text === levelName);
  const horizons: { key: GoalKey; title: string; hint: string }[] = [
    { key: "shortTerm", title: "Corto plazo", hint: "< 1 año" },
    { key: "mediumTerm", title: "Mediano plazo", hint: "1 a 2 años" },
    { key: "longTerm", title: "Largo plazo", hint: "3 años o más" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {horizons.map(({ key, title, hint }) => {
        const items = goals[key];
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
              <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/60">{hint}</span>
            </span>
            {key === "shortTerm" && (
              <span className={`text-sm ${levelDone ? "text-muted-foreground line-through" : ""}`}>{levelName}</span>
            )}
            {items.map((goal) => (
              <div key={goal.id} className="text-sm">
                <span className="block break-words">{goal.text}</span>
                {(!!goal.targetDate || (goal.milestones?.length ?? 0) > 0) && (
                  <GoalTimeline goal={goal} onSetDone={(done) => onSetDone(key, goal, done)} />
                )}
              </div>
            ))}
            {items.length === 0 && key !== "shortTerm" && (
              <p className="text-xs italic text-muted-foreground/50">Sin objetivos</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Tab "Objetivos" del Journal: los objetivos en curso ("Objetivos live") y los cumplidos
// ("Logrados"), agrupados por área y por quest.
export function CompletedGoalsJournal() {
  const { areas, projects, archivedProjects } = useSkillTree();
  const queryClient = useQueryClient();
  const { data: allGoals = [] } = useQuery<SourceLifeGoals[]>({
    queryKey: ALL_LIFE_GOALS_KEY,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/life-goals");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ type, id, next }: { type: "area" | "project"; id: string; next: LifeGoals }) => {
      const res = await apiRequest("PUT", `/api/life-goals/${type}/${id}`, next);
      return res.json() as Promise<LifeGoals>;
    },
    onMutate: async ({ type, id, next }) => {
      await queryClient.cancelQueries({ queryKey: ALL_LIFE_GOALS_KEY });
      const previous = queryClient.getQueryData<SourceLifeGoals[]>(ALL_LIFE_GOALS_KEY);
      queryClient.setQueryData<SourceLifeGoals[]>(ALL_LIFE_GOALS_KEY, (old = []) =>
        old.map((g) => (g.sourceType === type && g.sourceId === id ? { ...g, ...next } : g))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(ALL_LIFE_GOALS_KEY, context.previous);
    },
    onSuccess: (saved, { type, id }) => {
      queryClient.setQueryData(["life-goals", type, id], saved);
      queryClient.invalidateQueries({ queryKey: ALL_LIFE_GOALS_KEY });
    },
  });

  const updateSource = (type: "area" | "project", id: string, change: (goals: LifeGoals) => LifeGoals) => {
    const row = allGoals.find((g) => g.sourceType === type && g.sourceId === id);
    if (!row) return;
    const current: LifeGoals = {
      shortTerm: row.shortTerm ?? [],
      mediumTerm: row.mediumTerm ?? [],
      longTerm: row.longTerm ?? [],
      completed: row.completed ?? [],
    };
    saveMutation.mutate({ type, id, next: change(current) });
  };

  const editCompleted = (type: "area" | "project", sourceId: string, goalId: string, text: string) =>
    updateSource(type, sourceId, (current) => ({
      ...current,
      completed: current.completed.map((g) =>
        g.id === goalId ? { ...g, text, item: g.item ? { ...g.item, text } : undefined } : g
      ),
    }));

  // Recuperar: sale del Journal y vuelve a su lista con la fecha e hitos que tenía. El nivel
  // actual de corto plazo no tiene lista propia, así que solo se destilda.
  const restoreCompleted = (type: "area" | "project", sourceId: string, goal: CompletedLifeGoal) =>
    updateSource(type, sourceId, (current) => {
      const completed = current.completed.filter((g) => g.id !== goal.id);
      if (goal.horizon === "short" && !goal.item) return { ...current, completed };
      const key = KEY_OF[goal.horizon];
      const item: LifeGoalItem = goal.item ? { ...goal.item, text: goal.text } : { id: goal.id, text: goal.text };
      return { ...current, completed, [key]: [...current[key].filter((g) => g.id !== item.id), item] };
    });

  const setMilestonesDone = (type: "area" | "project", sourceId: string, key: GoalKey, goalId: string, done: number) =>
    updateSource(type, sourceId, (current) => ({
      ...current,
      [key]: current[key].map((g) => (g.id === goalId ? { ...g, milestonesDone: done } : g)),
    }));

  const goalsOf = (type: "area" | "project", id: string): LifeGoals => {
    const row = allGoals.find((g) => g.sourceType === type && g.sourceId === id);
    return {
      shortTerm: row?.shortTerm ?? [],
      mediumTerm: row?.mediumTerm ?? [],
      longTerm: row?.longTerm ?? [],
      completed: row?.completed ?? [],
    };
  };

  // Áreas y quests activas (las archivadas no tienen objetivos en curso).
  const liveSources = (type: "area" | "project", list: any[]): JournalSource[] =>
    list.map((item) => ({ type, id: item.id, name: item.name, item }));
  const liveAreas = liveSources("area", Array.isArray(areas) ? areas : []);
  const liveQuests = liveSources("project", Array.isArray(projects) ? projects : []);

  const renderLiveSection = (title: string, prefix: string, sources: JournalSource[]) =>
    sources.length > 0 && (
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        <Accordion type="multiple" className="space-y-2" defaultValue={sources.map((s) => `${prefix}-${s.id}`)}>
          {sources.map((source) => (
            <AccordionItem key={source.id} value={`${prefix}-${source.id}`} className="rounded-lg border border-border/50 bg-background/70">
              <AccordionTrigger className="px-3 py-2 text-left hover:no-underline">
                <span className="text-sm font-medium">{source.name}</span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3">
                <LiveGoalsGroup
                  source={source}
                  goals={goalsOf(source.type, source.id)}
                  onSetDone={(key, goal, done) => setMilestonesDone(source.type, source.id, key, goal.id, done)}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    );

  const byNewest = (a: CompletedLifeGoal, b: CompletedLifeGoal) => b.completedAt.localeCompare(a.completedAt);
  const buildGroups = (type: "area" | "project", sources: { id: string; name: string }[]) =>
    sources
      .map((source) => ({
        type,
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
                <div className="flex flex-col gap-2">
                  {group.goals.map((goal) => (
                    <CompletedGoalCard
                      key={goal.id}
                      goal={goal}
                      onEdit={(text) => editCompleted(group.type, group.id, goal.id, text)}
                      onRestore={() => restoreCompleted(group.type, group.id, goal)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    );

  return (
    <Tabs defaultValue="live" className="flex h-full flex-col gap-3">
      <TabsList className="self-start">
        <TabsTrigger value="live" data-testid="tab-goals-live">Objetivos live</TabsTrigger>
        <TabsTrigger value="logrados" data-testid="tab-goals-completed">Logrados</TabsTrigger>
      </TabsList>

      <TabsContent value="live" className="mt-0 flex min-h-0 flex-1 flex-col gap-4">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <p className="text-sm text-muted-foreground">Los objetivos en curso de cada área, por plazo. Tocá una estrella para marcar un hito.</p>
        </div>
        {liveAreas.length === 0 && liveQuests.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
            Todavía no tenés áreas.
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto pr-1 minimal-scrollbar">
            {renderLiveSection("Áreas", "live-area", liveAreas)}
            {renderLiveSection("Quests", "live-project", liveQuests)}
          </div>
        )}
      </TabsContent>

      <TabsContent value="logrados" className="mt-0 flex min-h-0 flex-1 flex-col gap-4">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <p className="text-sm text-muted-foreground">Aquí aparecen los objetivos que marcaste como cumplidos. Mantené presionado uno para editarlo o recuperarlo.</p>
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
      </TabsContent>
    </Tabs>
  );
}
