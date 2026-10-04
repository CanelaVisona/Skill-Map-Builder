import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueries, useQueryClient, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, Pencil, Plus, Star, X } from "lucide-react";
import { useSkillTree, type Area, type Project, type Skill } from "@/lib/skill-context";
import { useHabits, useUpdateHabitRecord } from "@/lib/useHabits";
import { useTodayTaskSlots, useSetTodayTaskSlot, useClearTodayTaskSlot, useReorderTodayTaskSlot, getCurrentTimeSlotKey, getTimeSlotKeyForDate, type TaskSlotKey, type TaskType } from "@/lib/useTodayTaskSlots";
import { useManualTasks, useManualTasksRange, isDefaultManualTask, defaultTaskMealId, useCreateManualTask, useUpdateManualTask, useDeleteManualTask } from "@/lib/useManualTasks";
import { calculateStatus, calculateStatusL2, type SpaceRepetitionPractice } from "@/components/SpaceRepetitionModal";
import { rewiringDayRows } from "@/lib/rewiringTasks";
import { useConfirmHabit, useConfirmPractice } from "@/lib/useConfirmActions";
import { useTodayPriorities, useSetTodayPriorities, MAX_TODAY_PRIORITIES } from "@/lib/useTodayPriorities";
import { MealTrackerModal } from "@/components/MealTrackerModal";
import { useNowPlacement, setNowPlacement } from "@/lib/now-placement";
import { addSubSkillFromToday, toggleSubSkillFromToday, masterWholeSubSkillTree, isSubSkillPlaceholder, moveSubSkillFromToday, renameSubSkill, deleteSubSkillFromToday } from "@/lib/subskill-tree";
import { useTodayTaskSubsteps, useCreateTodayTaskSubstep, useUpdateTodayTaskSubstep, useDeleteTodayTaskSubstep, type SubstepTaskType } from "@/lib/useTodayTaskSubsteps";
import type { Habit, HabitRecord, TodayTaskSlot } from "@shared/schema";

const LONG_PRESS_MS = 1500;

const TIME_SLOTS: { key: TaskSlotKey; label: string }[] = [
  { key: "morning", label: "La mañana" },
  { key: "midday", label: "Mediodía" },
  { key: "afternoon", label: "Tarde" },
  { key: "night", label: "Noche" },
];

interface TodayItem {
  key: string;
  type: TaskType;
  id: string;
  label: React.ReactNode;
  done: boolean;
  // Mismo color que su puntito en el calendario de actividades (NODE_COLOR/TASK_COLOR/
  // EVENT_COLOR) — solo se completa para nodos y tareas/eventos manuales, que son los que se
  // previsualizan ahí en días futuros. Se pinta en la fila para que "Vista previa" se vea
  // consistente con lo que ya se mostró en el calendario.
  dotColor?: string;
  // Emoji al principio del título (ver extractLeadingEmoji): si está presente, TaskDot lo
  // muestra en vez de dotColor, igual que en el calendario.
  dotEmoji?: string | null;
  // Franja horaria "de fábrica" para actividad extra sin franja asignada a mano: la
  // correspondiente al momento en el que se confirmó (en vez de caer en "Más").
  defaultSlot?: TaskSlotKey;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const DAY_LBLS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const HABIT_COLORS = ["#534AB7", "#1D9E75", "#D85A30", "#185FA5"];
const NODE_COLOR = "#f59e0b";
const PRACTICE_COLOR = "#e11d48";
const TASK_COLOR = "#0284c7";
const EVENT_COLOR = "#9333ea";

function getDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Día de la semana (0=Lunes..6=Domingo) de una fecha YYYY-MM-DD, sin depender de "hoy".
function dateStrToDayOfWeek(dateStr: string): number {
  const dow = new Date(dateStr + "T12:00:00").getDay();
  return dow === 0 ? 6 : dow - 1;
}

interface PlannedNode {
  id: string;
  title: string;
  parentName: string;
  plannedDate: string;
  done: boolean;
  // Solo presente en nodos "extra" (sin fecha planeada, detectados por su confirmación): el
  // momento exacto de confirmación, para poder derivar su franja horaria por defecto.
  completedAt?: string;
  // Minutos que se cargaron en el nodo (plannedDuration), para mostrarlos junto a la tarea.
  plannedDuration?: number | null;
  // Solo presentes en nodos con fecha planeada (no en los "extra"): de dónde viene, para poder
  // llamar a updateSkill/updateProjectSkill al cambiar su día desde "Tareas de hoy".
  parentId?: string;
  // "sub" = sub-nodo (dentro del sub-árbol de otro nodo): no vive en areas/projects del
  // contexto, se edita directo por /api/skills/:id (ver patchSubSkill).
  kind?: "area" | "project" | "sub";
}

// Sufijo "· Xmin" que se agrega al lado del título de una tarea cuando tiene una duración
// cargada (nodos: plannedDuration; hábitos/prácticas: minMinutes). Mismo criterio visual en
// los 3 casos, para que "Tareas de hoy" muestre el tiempo estimado sin importar la fuente.
function MinutesSuffix({ minutes }: { minutes?: number | null }) {
  if (!minutes) return null;
  return <span className="text-muted-foreground"> · {minutes}min</span>;
}

// Contador "hechas/total" que se muestra arriba del nombre de una tarea que se completa varias
// veces por día: un rewiring "veces por día" (1/3, 2/3…) o el hábito que lo reemplaza al
// cerrarse la cuota (3/3). Se omite cuando el total es 1 — ahí no aporta nada.
function TaskCountBadge({ done, total }: { done: number; total: number }) {
  if (!total || total <= 1) return null;
  return (
    <sup className="ml-0.5 text-[10px] font-semibold text-muted-foreground">
      {done}/{total}
    </sup>
  );
}

// Emoji (con variation selector y secuencias ZWJ básicas, p.ej. "🧑‍💻") al principio de un
// texto — título de un nodo o de una tarea/evento manual, que no tienen un campo de emoji
// propio como sí tienen hábitos y prácticas. Si el usuario ya lo escribió ahí, se reusa en vez
// de mostrar el puntito de color genérico.
const LEADING_EMOJI_RE = /^(\p{Extended_Pictographic}(?:️)?(?:‍\p{Extended_Pictographic}(?:️)?)*)\s*/u;
function extractLeadingEmoji(text: string): string | null {
  return text.match(LEADING_EMOJI_RE)?.[1] ?? null;
}

// Título sin el emoji inicial (si lo tiene) — se usa junto al punto/TaskDot que ya lo muestra,
// para no repetirlo dos veces seguidas ("🎉 🎉 Fiesta"). No-op si el título no empieza con uno.
function stripLeadingEmoji(text: string): string {
  return text.replace(LEADING_EMOJI_RE, "");
}

// Puntito que identifica a una tarea en el calendario de actividades y en la lista de "Hoy"/
// "Vista previa": si la tarea tiene un emoji (hábitos y prácticas siempre lo tienen; nodos y
// tareas/eventos manuales, solo si el usuario lo escribió al principio del título), se muestra
// ese emoji en vez del punto de color genérico del tipo.
function TaskDot({ emoji, color, size = "sm" }: { emoji?: string | null; color: string; size?: "sm" | "md" }) {
  if (emoji) {
    return (
      <span className={size === "md" ? "text-xs leading-none" : "text-[10px] leading-none"}>
        {emoji}
      </span>
    );
  }
  return (
    <div
      className={`${size === "md" ? "h-2 w-2" : "h-1.5 w-1.5"} rounded-full flex-shrink-0`}
      style={{ background: color }}
    />
  );
}

function getFirstDayOfMonth(date: Date) {
  const firstDow = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return firstDow === 0 ? 6 : firstDow - 1;
}

// Fila de un nodo en el panel de detalle del calendario: completado → verde con tilde;
// pendiente → su punto/emoji de siempre.
function NodeListRow({ node }: { node: PlannedNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {node.done ? <DoneNodeMark size="md" /> : <TaskDot emoji={extractLeadingEmoji(node.title)} color={NODE_COLOR} size="md" />}
      <span className={node.done ? "text-emerald-600 dark:text-emerald-400" : undefined}>
        {node.done ? node.title : stripLeadingEmoji(node.title)} <span className="text-muted-foreground">· {node.parentName}</span>
      </span>
    </div>
  );
}

// Nodo completado (de área, quest o sub-nodo; planeado o "extra") en el calendario de
// actividades: círculo verde con un tilde en vez del punto/emoji del nodo.
function DoneNodeMark({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={`${size === "md" ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} flex flex-shrink-0 items-center justify-center rounded-full bg-emerald-500`}
    >
      <Check className={`${size === "md" ? "h-2.5 w-2.5" : "h-2 w-2"} text-white`} strokeWidth={4} />
    </span>
  );
}

export function TodayProgressModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const { areas, projects, updateSkill, updateProjectSkill, globalSkills, toggleSkillStatus, toggleProjectSkillStatus, addSkillInPlaceOfAvailable, materializePendingEventNodes, refreshSkillTrees } = useSkillTree();
  const { data: habitsData } = useHabits();
  // Confirmar un hábito/práctica desde acá tiene que otorgar exactamente lo mismo (XP, pop-ups)
  // que confirmarlo desde su pantalla de origen — ver useConfirmActions.ts. Los nodos ya usan
  // toggleSkillStatus/toggleProjectSkillStatus (centralizados en skill-context.tsx) directo.
  const { confirmHabit, unconfirmHabit } = useConfirmHabit();
  const { confirmPractice } = useConfirmPractice();
  const [viewMode, setViewMode] = useState<"progress" | "calendar">("progress");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // Previsualización de un día futuro (se entra tocando ese día en el calendario). null = se
  // está viendo el día real de hoy.
  const [previewDate, setPreviewDate] = useState<string | null>(null);
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  // Elegido con los botones "Tarea"/"Evento" del diálogo de agregar — se manda tal cual al crear.
  const [newTaskKind, setNewTaskKind] = useState<"task" | "event">("task");
  // Área o quest a la que pertenece la tarea/evento que se está por crear ("" = ninguna).
  // - Tarea: se crea como un nodo de ese árbol, en el lugar de su nodo desbloqueado y con fecha
  //   planeada en el día que se está viendo: así es a la vez la tarea del día y el nodo, y
  //   confirmarla en "Tareas de hoy" confirma el nodo.
  // - Evento: queda como evento, y el nodo se crea recién el día del evento (en el lugar del
  //   nodo desbloqueado de ese momento, ver materializePendingEventNodes). Confirmar el evento
  //   confirma ese nodo.
  const [newTaskParent, setNewTaskParent] = useState("");
  // Franja a la que se asigna la tarea que se está por crear: null = sin asignar (mantener
  // presionado el fondo). Mantener presionado el título de una franja horaria en vez del fondo
  // apunta la tarea nueva directo a esa franja, para que no caiga en "Sin asignar".
  const [addTaskTargetSlot, setAddTaskTargetSlot] = useState<TaskSlotKey | null>(null);
  const backgroundLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotTitleLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Si el long-press del título ya disparó el diálogo, el click que sigue al soltar no debe
  // además abrir/cerrar el acordeón de esa franja.
  const slotTitleLongPressFired = useRef(false);

  // Pop-up de la estrellita: las (hasta 3) prioridades "no negociables" del día. prioritiesEditing
  // = se está eligiendo cuáles son, entre todas las tareas del día.
  const [prioritiesOpen, setPrioritiesOpen] = useState(false);
  const [prioritiesEditing, setPrioritiesEditing] = useState(false);

  // Pop-up del registro de comidas abierto desde una tarea por defecto (Desayuná/Almorzá/…):
  // id de la comida ("desayuno", "almuerzo"…) o null si está cerrado.
  const [mealPopupId, setMealPopupId] = useState<string | null>(null);

  const todayStr = getDateStr(new Date());
  const effectiveDate = previewDate ?? todayStr;
  const isPreview = previewDate !== null;
  const effectiveDayOfWeek = dateStrToDayOfWeek(effectiveDate);

  // Al cerrar el modal, se vuelve siempre a "hoy" en la vista de progreso — no se queda
  // trabada en la previsualización de un día futuro de la sesión anterior.
  useEffect(() => {
    if (!open) {
      setPreviewDate(null);
      setViewMode("progress");
      setSelectedDay(null);
      setPrioritiesOpen(false);
    }
  }, [open]);

  // Con el modal abierto se re-renderiza cada minuto para que la franja horaria actual (que
  // queda bloqueada abierta) pase sola a la siguiente cuando cambia la hora.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setClockTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [open]);

  const habitsScheduledForView = (habitsData || []).filter((h) => {
    if (h.endDate && h.endDate < effectiveDate) return false;
    const days = h.scheduledDays?.length ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
    return days.includes(effectiveDayOfWeek);
  });

  const viewRecordQueries = useQueries({
    queries: habitsScheduledForView.map((h) => ({
      queryKey: ["habit-records", h.id, effectiveDate, effectiveDate],
      queryFn: async () => {
        const res = await fetch(`/api/habit-records/${h.id}?startDate=${effectiveDate}&endDate=${effectiveDate}`);
        if (!res.ok) throw new Error("Failed to fetch habit records");
        return res.json() as Promise<HabitRecord[]>;
      },
      enabled: open,
    })),
  });

  // Rewirings (RewiringTracker.tsx). Se carga acá arriba porque el contador N/N de un rewiring
  // "veces por día" linkeado a un hábito se pinta sobre la fila de ese hábito (ver más abajo),
  // que se arma antes que la sección de actividad extra.
  const { data: rewiringTrackersData } = useQuery({
    queryKey: ["rewiring-trackers"],
    queryFn: async () => {
      const res = await fetch("/api/rewiring-trackers");
      if (!res.ok) throw new Error("Failed to fetch rewiring trackers");
      return res.json() as Promise<{ id: string; name: string; archivedAt?: string | null; timesPerDay?: number | null; habitId?: string | null; skillId?: string | null; skillIds?: string[]; history?: { timestamp: string; date?: string }[] }[]>;
    },
    enabled: open,
  });

  const rewiringDayResults = (rewiringTrackersData || []).map((t) => ({
    tracker: t,
    result: rewiringDayRows(t, effectiveDate),
  }));

  // Hábito linkeado a un rewiring "veces por día" cuya cuota del día ya se cerró: su fila
  // (venga de habitItems o de extraHabits) lleva el contador N/N encima del nombre — ocupa el
  // lugar de la última repetición, que por eso no se muestra como fila de rewiring.
  const rewiringHabitBadgeById = new Map<string, { done: number; total: number }>();
  rewiringDayResults.forEach(({ result }) => {
    if (result.habitBadge) {
      rewiringHabitBadgeById.set(result.habitBadge.habitId, {
        done: result.habitBadge.done,
        total: result.habitBadge.total,
      });
    }
  });

  const scheduledHabitItems = habitsScheduledForView.map((h, i) => ({
    id: h.id,
    label: (
      <>
        {h.emoji} {h.name}
        <MinutesSuffix minutes={h.minMinutes} />
        {rewiringHabitBadgeById.has(h.id) && (
          <TaskCountBadge {...rewiringHabitBadgeById.get(h.id)!} />
        )}
      </>
    ),
    done: !!(viewRecordQueries[i]?.data as HabitRecord[] | undefined)?.some(
      (r) => r.date === effectiveDate && r.completed === 1
    ),
  }));

  const collectPlannedNodes = (list: (Area | Project)[], kind: "area" | "project"): PlannedNode[] => {
    const result: PlannedNode[] = [];
    list.forEach((parent) => {
      (parent.skills || []).forEach((skill: Skill) => {
        if (skill.plannedDate) {
          result.push({
            id: skill.id,
            title: skill.title || "Sin nombre",
            parentName: parent.name,
            plannedDate: skill.plannedDate,
            done: skill.status === "mastered",
            plannedDuration: skill.plannedDuration,
            parentId: parent.id,
            kind,
          });
        }
      });
    });
    return result;
  };

  // Sub-nodos (a cualquier profundidad) con fecha planeada o completados: el contexto solo
  // tiene los nodos de primer nivel de cada área/quest, así que se piden aparte.
  const { data: datedSubSkillsData } = useQuery({
    queryKey: ["dated-sub-skills"],
    queryFn: async () => {
      const res = await fetch("/api/sub-skills/dated");
      if (!res.ok) throw new Error("Failed to fetch dated sub-skills");
      return res.json() as Promise<{ id: string; title: string; status: string; plannedDate: string | null; plannedDuration: number | null; completedAt: string | null; parentName: string }[]>;
    },
    enabled: open,
    // Los sub-nodos se editan desde el sub-árbol sin invalidar esta consulta: se refresca
    // cada vez que se abre el modal.
    staleTime: 0,
    refetchOnMount: "always",
  });
  const datedSubSkills = datedSubSkillsData || [];

  const plannedSubNodes: PlannedNode[] = datedSubSkills
    .filter((s) => !!s.plannedDate)
    .map((s) => ({
      id: s.id,
      title: s.title || "Sin nombre",
      parentName: s.parentName,
      plannedDate: s.plannedDate!,
      done: s.status === "mastered",
      plannedDuration: s.plannedDuration,
      kind: "sub",
    }));

  const allPlannedNodes = [
    ...collectPlannedNodes(Array.isArray(areas) ? areas : [], "area"),
    ...collectPlannedNodes(Array.isArray(projects) ? projects : [], "project"),
    ...plannedSubNodes,
  ];

  const patchSubSkill = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { plannedDate?: string | null; plannedDuration?: number | null; status?: string } }) => {
      const res = await fetch(`/api/skills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update sub-skill");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dated-sub-skills"] });
      // Sub-nodos que se ven adentro de su nodo en Tareas de hoy (p.ej. tiempo asignado).
      queryClient.invalidateQueries({ queryKey: ["node-subskills"] });
    },
  });

  const plannedNodesForView = allPlannedNodes.filter((n) => n.plannedDate === effectiveDate);

  // Prácticas de repetición espaciada que vencían hoy ("expires_soon") o que se confirmaron el
  // día que se está viendo (lastConfirmedAt cae en effectiveDate y ya avanzaron a otro estado).
  // El "vencimiento" es siempre relativo a ahora (no al día del calendario que se esté viendo),
  // así que solo cuenta cuando se está viendo el día real de hoy — en cualquier otro día (pasado
  // o futuro) sólo importa si hubo una confirmación ese día puntual. Ojo: lastConfirmedAt sólo
  // guarda la ÚLTIMA confirmación, así que un día pasado con confirmaciones más viejas (ya
  // tapadas por una más reciente) no las va a mostrar acá — misma limitación que el calendario.
  const { data: practicesData } = useQuery({
    queryKey: ["space-repetition"],
    queryFn: async () => {
      const res = await fetch("/api/space-repetition");
      if (!res.ok) throw new Error("Failed to fetch space repetition practices");
      return res.json() as Promise<SpaceRepetitionPractice[]>;
    },
    enabled: open,
  });

  const practicesToday = (practicesData || [])
    .map((p) => {
      const status = p.level === 2 ? calculateStatusL2(p) : calculateStatus(p);
      const pending = !isPreview && status === "expires_soon";
      const confirmedAt = p.lastConfirmedAt || p.updatedAt;
      const confirmedOnViewedDay = !pending && status !== "loss" && status !== "frozen" && !!confirmedAt && getDateStr(new Date(confirmedAt)) === effectiveDate;
      return { practice: p, done: confirmedOnViewedDay, include: pending || confirmedOnViewedDay };
    })
    .filter((entry) => entry.include);

  // Actividad extra: hábitos y nodos hechos el día que se está viendo que no estaban
  // configurados para ese día (hábito no programado ese día, o nodo sin fecha planeada). Se
  // calcula para cualquier día (no solo hoy) para que un día pasado también muestre lo que se
  // hizo de más ese día; para un día futuro simplemente no va a haber nada confirmado todavía.
  const habitsNotScheduledForView = (habitsData || []).filter(
    (h) => !habitsScheduledForView.some((s) => s.id === h.id)
  );

  const otherHabitRecordQueries = useQueries({
    queries: habitsNotScheduledForView.map((h) => ({
      queryKey: ["habit-records", h.id, effectiveDate, effectiveDate],
      queryFn: async () => {
        const res = await fetch(`/api/habit-records/${h.id}?startDate=${effectiveDate}&endDate=${effectiveDate}`);
        if (!res.ok) throw new Error("Failed to fetch habit records");
        return res.json() as Promise<HabitRecord[]>;
      },
      enabled: open,
    })),
  });

  // Franjas horarias: cada tarea (hábito/nodo/práctica/manual) puede asignarse a
  // mañana/mediodía/tarde/noche, o marcarse "hidden" (mantener presionada una tarea no hecha)
  // para que deje de contar como tarea de ese día. La asignación es por día (queryKey incluye
  // effectiveDate), lo que también permite ordenar tareas de días futuros previsualizados.
  const { data: slotsData } = useTodayTaskSlots(effectiveDate, open);

  // Hábitos no programados para este día que se agregaron a mano (desde el diálogo de
  // "mantener presionado"): cualquier fila de franja que no sea "hidden" los vuelve una tarea
  // más del día — cuentan en el total aunque todavía no estén hechos, igual que uno programado.
  const addedHabitIds = new Set(
    (slotsData || []).filter((s) => s.taskType === "habit" && s.slot !== "hidden").map((s) => s.taskId)
  );

  const notScheduledHabitRows = habitsNotScheduledForView.map((h, i) => ({
    id: h.id,
    label: (
      <>
        {h.emoji} {h.name}
        <MinutesSuffix minutes={h.minMinutes} />
        {rewiringHabitBadgeById.has(h.id) && (
          <TaskCountBadge {...rewiringHabitBadgeById.get(h.id)!} />
        )}
      </>
    ),
    done: !!(otherHabitRecordQueries[i]?.data as HabitRecord[] | undefined)?.some(
      (r) => r.date === effectiveDate && r.completed === 1
    ),
  }));
  const addedHabitItems = notScheduledHabitRows.filter((h) => addedHabitIds.has(h.id));
  // Los agregados a mano se tratan igual que los programados (cuentan, se pueden ocultar, etc.).
  const habitItems = [...scheduledHabitItems, ...addedHabitItems];
  const extraHabits = notScheduledHabitRows.filter((h) => h.done && !addedHabitIds.has(h.id));
  // Candidatos para agregar a mano: activos ese día, no programados y todavía no agregados.
  const habitsAddableForView = habitsNotScheduledForView.filter(
    (h) => !(h.endDate && h.endDate < effectiveDate) && !addedHabitIds.has(h.id)
  );

  // Rewirings (RewiringTracker.tsx): actividad extra sin concepto de "programado para hoy". Se
  // muestra UNA fila por cada repetición registrada el día que se está viendo, todas con el
  // mismo nombre y un contador "índice/N" (1/N, 2/N, …). Cada fila cae en la franja horaria del
  // momento de esa repetición. Los "veces por día" linkeados a un hábito muestran solo las
  // primeras N-1 repeticiones acá: la última la ocupa el hábito (ver rewiringHabitBadgeById).
  // Ver rewiringDayRows() para el detalle.
  const extraRewirings = rewiringDayResults.flatMap(({ tracker, result }) => {
    // Si el rewiring tiene un skill linkeado, la fila se muestra con el emoji y el nombre de
    // ese skill (más el contador índice/N) en vez del icono 🔄 y el nombre del rewiring.
    const linkedSkillId = tracker.skillId ?? tracker.skillIds?.[0] ?? null;
    const linkedSkill = linkedSkillId
      ? (globalSkills || []).find((s) => s.id === linkedSkillId)
      : undefined;
    return result.rows.map((row) => ({
      // id/key propios por repetición: así cada fila se puede mover de franja por separado.
      rowId: `${tracker.id}#${row.repIndex}`,
      name: tracker.name,
      skillName: linkedSkill?.name ?? null,
      skillIcon: linkedSkill?.icon ?? null,
      repIndex: row.repIndex,
      timesPerDay: row.timesPerDay,
      at: row.at,
    }));
  });

  // Nodos sin fecha planeada (columna "When exactly?" vacía) que se confirmaron dentro del
  // rango [startDate, endDate]. Se usa tanto para "Más" (rango = solo hoy) como para el
  // calendario (rango = mes mostrado), reusando plannedDate para cargar la fecha en la que
  // el nodo cuenta, aunque el nodo en sí nunca tuvo una fecha planeada.
  const collectExtraCompletedNodes = (list: (Area | Project)[], startDate: string, endDate: string): PlannedNode[] => {
    const result: PlannedNode[] = [];
    list.forEach((parent) => {
      (parent.skills || []).forEach((skill: Skill) => {
        if (skill.status === "mastered" && skill.completedAt && !skill.plannedDate) {
          const completedDateStr = getDateStr(new Date(skill.completedAt));
          if (completedDateStr >= startDate && completedDateStr <= endDate) {
            result.push({
              id: skill.id,
              title: skill.title || "Sin nombre",
              parentName: parent.name,
              plannedDate: completedDateStr,
              done: true,
              completedAt: skill.completedAt,
              plannedDuration: skill.plannedDuration,
            });
          }
        }
      });
    });
    return result;
  };

  // Lo mismo para sub-nodos completados sin fecha planeada.
  const collectExtraCompletedSubNodes = (startDate: string, endDate: string): PlannedNode[] =>
    datedSubSkills
      .filter((s) => s.status === "mastered" && !!s.completedAt && !s.plannedDate)
      .map((s) => ({ s, completedDateStr: getDateStr(new Date(s.completedAt!)) }))
      .filter(({ completedDateStr }) => completedDateStr >= startDate && completedDateStr <= endDate)
      .map(({ s, completedDateStr }) => ({
        id: s.id,
        title: s.title || "Sin nombre",
        parentName: s.parentName,
        plannedDate: completedDateStr,
        done: true,
        completedAt: s.completedAt!,
        plannedDuration: s.plannedDuration,
      }));

  // Se usa effectiveDate (no todayStr) para que también aparezcan acá los nodos completados sin
  // fecha planeada de un día pasado que se esté editando; para un día futuro no hay nada
  // completado todavía, así que naturalmente da vacío.
  const extraNodes = [
    ...collectExtraCompletedNodes(Array.isArray(areas) ? areas : [], effectiveDate, effectiveDate),
    ...collectExtraCompletedNodes(Array.isArray(projects) ? projects : [], effectiveDate, effectiveDate),
    ...collectExtraCompletedSubNodes(effectiveDate, effectiveDate),
  ];
  // Nodos "extra" (sin fecha planeada): no tienen un campo de fecha editable (su día sale de
  // completedAt, que no se puede reasignar a mano), así que quedan afuera de "Cambiar de día".
  const extraNodeIds = new Set(extraNodes.map((n) => n.id));

  const extraItems: TodayItem[] = [
    ...extraHabits.map((h) => ({ key: `habit:${h.id}`, type: "habit" as const, id: h.id, label: h.label, done: true })),
    ...extraNodes.map((n) => ({
      key: `node:${n.id}`,
      type: "node" as const,
      id: n.id,
      label: (
        <>
          {stripLeadingEmoji(n.title)} <span className="text-muted-foreground">· {n.parentName}</span>
          <MinutesSuffix minutes={n.plannedDuration} />
        </>
      ),
      done: true,
      dotColor: NODE_COLOR,
      dotEmoji: extractLeadingEmoji(n.title),
      defaultSlot: n.completedAt ? getTimeSlotKeyForDate(new Date(n.completedAt)) : undefined,
    })),
    ...extraRewirings.map((r) => ({
      key: `rewiring:${r.rowId}`,
      type: "rewiring" as const,
      id: r.rowId,
      label: (
        <>
          {r.skillName ? `${r.skillIcon || "🔄"} ${r.skillName}` : `🔄 ${r.name}`}
          <TaskCountBadge done={r.repIndex} total={r.timesPerDay} />
        </>
      ),
      done: true,
      defaultSlot: getTimeSlotKeyForDate(new Date(r.at)),
    })),
  ];

  // Tareas manuales agregadas a mano (mantener presionado el fondo). Existen para cualquier
  // día (hoy o un día futuro previsualizado) y no aparecen en el calendario de actividades.
  const { data: manualTasksData } = useManualTasks(effectiveDate, open);
  const manualTasks = manualTasksData || [];
  const createManualTask = useCreateManualTask();
  const updateManualTask = useUpdateManualTask();
  const deleteManualTask = useDeleteManualTask();

  const setTaskSlot = useSetTodayTaskSlot();
  const clearTaskSlot = useClearTodayTaskSlot();
  const reorderTaskSlot = useReorderTodayTaskSlot();

  const slotByKey = new Map<string, TaskSlotKey>();
  const sortOrderByKey = new Map<string, number>();
  const slotUpdatedAtByKey = new Map<string, number>();
  (slotsData || []).forEach((s) => {
    const key = `${s.taskType}:${s.taskId}`;
    slotByKey.set(key, s.slot as TaskSlotKey);
    sortOrderByKey.set(key, s.sortOrder);
    slotUpdatedAtByKey.set(key, new Date(s.updatedAt).getTime());
  });
  // "hidden" solo oculta mientras la tarea sigue sin hacer: si después se confirma, tiene
  // que volver a aparecer en tareas de hoy (ya como hecha), no quedar oculta para siempre.
  const isHidden = (key: string) => slotByKey.get(key) === "hidden";

  // La barra de progreso no debe subir en el momento en que ocultás una tarea (se sentiría
  // como una recompensa por ocultar). Por eso el total/completado usa una "foto" de qué
  // estaba oculto al abrir el modal, no el estado en vivo: lo que ocultás en esta sesión
  // desaparece de la lista al instante, pero no cambia la barra hasta la próxima vez que
  // abras "Hoy" (ahí sí deja de contar en el denominador).
  const hiddenKeysAtOpenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!open) hiddenKeysAtOpenRef.current = null;
  }, [open]);
  if (open && !hiddenKeysAtOpenRef.current && slotsData) {
    hiddenKeysAtOpenRef.current = new Set(
      slotsData.filter((s) => s.slot === "hidden").map((s) => `${s.taskType}:${s.taskId}`)
    );
  }
  const wasHiddenAtOpen = (key: string) => hiddenKeysAtOpenRef.current?.has(key) ?? false;

  const visibleHabitItems = habitItems.filter((h) => h.done || !isHidden(`habit:${h.id}`));
  const visiblePlannedNodesForView = plannedNodesForView.filter((n) => n.done || !isHidden(`node:${n.id}`));
  const visiblePracticesToday = practicesToday.filter(({ practice: p, done }) => done || !isHidden(`practice:${p.id}`));
  // Las tareas por defecto (comidas) no se eliminan — se recrearían —, se "sacan de hoy" igual
  // que un hábito; las manuales comunes nunca tienen franja "hidden", así que no las afecta.
  const visibleManualTasks = manualTasks.filter((t) => t.done === 1 || !isHidden(`manual:${t.id}`));

  const totalHabits = habitItems.filter((h) => h.done || !wasHiddenAtOpen(`habit:${h.id}`)).length;
  const completedHabits = habitItems.filter((h) => h.done).length;
  const totalNodes = plannedNodesForView.filter((n) => n.done || !wasHiddenAtOpen(`node:${n.id}`)).length;
  const completedNodes = plannedNodesForView.filter((n) => n.done).length;
  const totalPractices = practicesToday.filter(({ practice: p, done }) => done || !wasHiddenAtOpen(`practice:${p.id}`)).length;
  const completedPractices = practicesToday.filter((p) => p.done).length;
  const totalManual = manualTasks.filter((t) => t.done === 1 || !wasHiddenAtOpen(`manual:${t.id}`)).length;
  const completedManual = manualTasks.filter((t) => t.done === 1).length;

  // Tareas configuradas para hoy (usado para decidir si se muestra el acordeón de franjas
  // horarias, que no debe aparecer si lo único que hay es actividad extra en "Más").
  const totalConfigured = totalHabits + totalNodes + totalPractices + totalManual;

  // Los ítems de "Más" ya están todos hechos (son actividad extra detectada como completada
  // hoy), así que suman por igual a total y a completed.
  const total = totalConfigured + extraItems.length;
  const completed = completedHabits + completedNodes + completedPractices + completedManual + extraItems.length;
  const todayItems: TodayItem[] = [
    ...visibleHabitItems.map((h) => ({ key: `habit:${h.id}`, type: "habit" as const, id: h.id, label: h.label, done: h.done })),
    ...visiblePlannedNodesForView.map((n) => ({
      key: `node:${n.id}`,
      type: "node" as const,
      id: n.id,
      label: (
        <>
          {stripLeadingEmoji(n.title)} <span className="text-muted-foreground">· {n.parentName}</span>
          <MinutesSuffix minutes={n.plannedDuration} />
        </>
      ),
      done: n.done,
      dotColor: NODE_COLOR,
      dotEmoji: extractLeadingEmoji(n.title),
    })),
    ...visiblePracticesToday.map(({ practice: p, done }) => ({
      key: `practice:${p.id}`,
      type: "practice" as const,
      id: p.id,
      label: (
        <>
          {p.emoji} {p.name}
          <MinutesSuffix minutes={p.minMinutes} />
        </>
      ),
      done,
    })),
    ...visibleManualTasks.map((t) => ({
      key: `manual:${t.id}`,
      type: "manual" as const,
      id: t.id,
      label: (
        <>
          {t.kind === "event" ? <>📅 {stripLeadingEmoji(t.title)}</> : stripLeadingEmoji(t.title)}
          <MinutesSuffix minutes={t.minutes} />
        </>
      ),
      done: t.done === 1,
      dotColor: t.kind === "event" ? EVENT_COLOR : TASK_COLOR,
      dotEmoji: extractLeadingEmoji(t.title),
    })),
  ];

  // Hábitos que tienen una o más franjas del día linkeadas de fábrica (configuradas en el
  // hábito, no día a día): caen ahí automáticamente si ese día no tienen una franja asignada a
  // mano. Si tiene más de una, el hábito se duplica: aparece en cada una de sus franjas.
  const habitDefaultSlotsById = new Map<string, TaskSlotKey[]>();
  (habitsData || []).forEach((h) => {
    const raw = Array.isArray(h.defaultTimeSlots) ? h.defaultTimeSlots : [];
    const valid = raw.filter((s) => TIME_SLOTS.some((t) => t.key === s)) as TaskSlotKey[];
    if (valid.length > 0) habitDefaultSlotsById.set(h.id, valid);
  });

  // Franja(s) efectiva(s) de una tarea: la asignada a mano para este día tiene prioridad (una
  // sola franja); si no hay ninguna, se usa la franja por defecto del ítem (p.ej. actividad
  // extra confirmada en cierto momento) o, si es un hábito con franjas por defecto, esas —
  // puede ser más de una, en cuyo caso la tarea se duplica en cada franja.
  const resolveSlots = (item: TodayItem): TaskSlotKey[] => {
    const manual = slotByKey.get(item.key);
    // "added" solo marca que el hábito se agregó al día, no es una franja elegida.
    if (manual && manual !== "added") return [manual];
    if (item.defaultSlot) return [item.defaultSlot];
    if (item.type === "habit") return habitDefaultSlotsById.get(item.id) ?? [];
    return [];
  };

  // "more" agrupa la actividad extra (sección "Más") que no tiene ninguna franja, ni manual
  // ni por defecto — hoy en día eso es solo hábitos extra (no hay forma de saber a qué hora se
  // confirmaron). Los nodos extra sí tienen franja por defecto (la hora en la que se
  // confirmaron) y por eso caen directo en la franja del día que corresponda, no acá; desde
  // ahí se pueden mover a otra franja igual que cualquier tarea de hoy.
  const itemBuckets: Record<string, TodayItem[]> = { unassigned: [], more: [] };
  TIME_SLOTS.forEach((s) => (itemBuckets[s.key] = []));
  // Reparte un ítem en los buckets de sus franjas efectivas; si tiene más de una, cada
  // duplicado extra necesita una "key" propia para React (mismo type/id, así que los clics
  // sobre cualquiera de las copias siguen afectando la misma tarea/hábito real).
  const distributeItem = (item: TodayItem, fallbackBucket: "unassigned" | "more") => {
    // "hidden" no es una franja real: puede llegar acá si la tarea se ocultó y después se
    // confirmó (vuelve a aparecer, ya hecha), así que cae al bucket por defecto igual que si
    // nunca hubiera tenido franja.
    const slots = resolveSlots(item).filter((s) => TIME_SLOTS.some((t) => t.key === s));
    if (slots.length === 0) {
      itemBuckets[fallbackBucket].push(item);
      return;
    }
    slots.forEach((slot, i) => {
      itemBuckets[slot].push(i === 0 ? item : { ...item, key: `${item.key}#${slot}` });
    });
  };
  todayItems.forEach((item) => distributeItem(item, "unassigned"));
  extraItems.forEach((item) => distributeItem(item, "more"));

  // Confirmar una tarea no la mueve: hechas y pendientes comparten el mismo orden. Dentro de
  // cada franja horaria se respeta el orden guardado (sortOrder) — el que se puede cambiar de a
  // pares con "Mover arriba"/"Mover abajo". Desempata por updatedAt para que las franjas
  // asignadas antes de tener esta columna (todas con sortOrder 0) tengan igual un orden estable
  // en vez de depender del orden de la consulta. "Sin asignar" queda en el orden en que se armó.
  TIME_SLOTS.forEach((s) => {
    itemBuckets[s.key].sort((a, b) => {
      const diff = (sortOrderByKey.get(a.key) ?? 0) - (sortOrderByKey.get(b.key) ?? 0);
      if (diff !== 0) return diff;
      return (slotUpdatedAtByKey.get(a.key) ?? 0) - (slotUpdatedAtByKey.get(b.key) ?? 0);
    });
  });

  // Nodo al que se le eligió "Ahora" en "When exactly?" (ver setNowPlacement en SkillNode):
  // ocupa el lugar de la tarea desbloqueada de la franja actual (la primera sin hacer), que
  // pasa a quedar justo después. Se hace acá y no en el server porque solo acá se conoce el
  // orden visual real de la franja, incluidos los ítems sin fila propia (hábitos con franja por
  // defecto, actividad extra), que el server no ve. Espera a tener todo cargado (y la fila del
  // nodo ya creada por SkillNode) para no calcular la tarea desbloqueada con datos a medias.
  const nowPlacement = useNowPlacement();
  const nowPlacementReady =
    open &&
    !!nowPlacement &&
    !isPreview &&
    nowPlacement.date === effectiveDate &&
    !!slotsData &&
    !!manualTasksData &&
    !!habitsData &&
    viewRecordQueries.every((q) => !q.isLoading) &&
    slotByKey.has(`node:${nowPlacement.nodeId}`) &&
    todayItems.some((i) => i.type === "node" && i.id === nowPlacement.nodeId);
  useEffect(() => {
    if (!nowPlacementReady || !nowPlacement) return;
    setNowPlacement(null);
    const slot = getCurrentTimeSlotKey();
    const nodeKey = `node:${nowPlacement.nodeId}`;
    const bucket = itemBuckets[slot].filter((i) => i.key !== nodeKey);
    const nodeItem = todayItems.find((i) => i.key === nodeKey)!;
    const firstUndone = bucket.findIndex((i) => !i.done);
    const at = firstUndone === -1 ? bucket.length : firstUndone;
    const ordered = [...bucket.slice(0, at), nodeItem, ...bucket.slice(at)];
    // Un hábito puede estar duplicado en varias franjas (keys "#slot"): una sola entrada por tarea.
    const seen = new Set<string>();
    const order = ordered
      .filter((i) => {
        const k = `${i.type}:${i.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((i) => ({ taskType: i.type, taskId: i.id }));
    reorderTaskSlot.mutate({ date: effectiveDate, slot, order });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowPlacementReady]);

  // Sub-nodos de los nodos de Tareas de hoy: se muestran adentro del nodo padre (sin el "inicio"
  // ni los pasos de relleno sin nombrar) y se confirman en orden. Mientras quede alguno sin
  // confirmar, el padre no se puede confirmar; confirmar el último lo desbloquea, y confirmar el
  // padre confirma todo el sub-árbol. Si el nodo es la tarea desbloqueada, el destacado pasa a
  // su primer sub-nodo sin confirmar. Se agregan con "Agregar sub-nodo" (ver subskill-tree.ts).
  const pendingNodeItems = todayItems.filter((i) => i.type === "node" && !i.done);
  const subSkillQueries = useQueries({
    queries: pendingNodeItems.map((i) => ({
      queryKey: ["node-subskills", i.id],
      queryFn: async () => {
        const res = await fetch(`/api/skills/${i.id}/subskills`);
        if (!res.ok) throw new Error("Failed to fetch sub-skills");
        return res.json() as Promise<Skill[]>;
      },
      enabled: open,
      staleTime: 0,
    })),
  });
  const subSkillsByNodeId = new Map<string, Skill[]>();
  pendingNodeItems.forEach((i, idx) => {
    const list = (subSkillQueries[idx]?.data || [])
      .filter((sub) => (sub.levelPosition || 0) > 1 && !isSubSkillPlaceholder(sub))
      .sort((a, b) => (a.level - b.level) || ((a.levelPosition || 0) - (b.levelPosition || 0)));
    subSkillsByNodeId.set(i.id, list);
  });
  const subNodesFor = (item: TodayItem) => (item.type === "node" ? subSkillsByNodeId.get(item.id) || [] : []);
  const hasPendingSubNodes = (item: TodayItem) => subNodesFor(item).some((sub) => sub.status !== "mastered");
  const [subNodeBusy, setSubNodeBusy] = useState(false);
  const toggleSubNode = async (parentId: string, sub: Skill) => {
    if (subNodeBusy) return;
    setSubNodeBusy(true);
    try {
      await toggleSubSkillFromToday(parentId, sub);
      await refreshSkillTrees();
    } catch (error) {
      console.error("Error confirmando sub-nodo desde Tareas de hoy:", error);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["node-subskills", parentId] });
      queryClient.invalidateQueries({ queryKey: ["dated-sub-skills"] });
      setSubNodeBusy(false);
    }
  };
  // Subir/bajar, renombrar y eliminar un sub-nodo (tocándolo abre su menú). Mismo candado que
  // confirmar: una operación a la vez, y después se refresca el sub-árbol y los árboles.
  const runSubNodeOp = async (parentId: string, op: () => Promise<void>) => {
    if (subNodeBusy) return;
    setSubNodeBusy(true);
    try {
      await op();
      await refreshSkillTrees();
    } catch (error) {
      console.error("Error editando sub-nodo desde Tareas de hoy:", error);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["node-subskills", parentId] });
      queryClient.invalidateQueries({ queryKey: ["dated-sub-skills"] });
      setSubNodeBusy(false);
    }
  };
  const renderSubNodes = (item: TodayItem, parentIsCurrent: boolean) => {
    const subs = subNodesFor(item);
    if (subs.length === 0) return null;
    const firstUndone = subs.findIndex((sub) => sub.status !== "mastered");
    const lastDone = firstUndone === -1 ? subs.length - 1 : firstUndone - 1;
    return subs.map((sub, i) => {
      const prev = subs[i - 1];
      const next = subs[i + 1];
      return (
        <TodaySubRow
          key={sub.id}
          title={stripLeadingEmoji(sub.title || "Sin nombre")}
          done={sub.status === "mastered"}
          current={parentIsCurrent && i === firstUndone}
          dimmed={!(parentIsCurrent && i === firstUndone)}
          onToggleDone={i === firstUndone || i === lastDone ? () => toggleSubNode(item.id, sub) : undefined}
          onMoveUp={prev && prev.level === sub.level ? () => runSubNodeOp(item.id, () => moveSubSkillFromToday(sub, prev)) : undefined}
          onMoveDown={next && next.level === sub.level ? () => runSubNodeOp(item.id, () => moveSubSkillFromToday(sub, next)) : undefined}
          onRename={() => {
            setRenameSubTitle(sub.title || "");
            setRenameSubTarget({ kind: "node", id: sub.id, parentId: item.id });
          }}
          minutes={sub.plannedDuration}
          onAssignTime={() =>
            openTimeDialog({ key: `node:${sub.id}`, type: "node", id: sub.id, label: sub.title, done: sub.status === "mastered" })
          }
          onDelete={() => runSubNodeOp(item.id, () => deleteSubSkillFromToday(item.id, sub))}
          deleteLabel="sub-nodo"
        />
      );
    });
  };

  // Diálogo para cambiarle el nombre a un sub-nodo o a un sub-paso.
  const [renameSubTarget, setRenameSubTarget] = useState<{ kind: "node" | "step"; id: string; parentId: string } | null>(null);
  const [renameSubTitle, setRenameSubTitle] = useState("");
  const submitRenameSub = () => {
    const title = renameSubTitle.trim();
    const target = renameSubTarget;
    if (!title || !target) return;
    setRenameSubTarget(null);
    if (target.kind === "node") {
      runSubNodeOp(target.parentId, () => renameSubSkill(target.id, title));
    } else {
      updateSubstep.mutate({ id: target.id, date: effectiveDate, updates: { title } });
    }
  };

  // Sub-pasos (checklist del día) de las tareas que no son nodos: se agregan desde el menú de la
  // tarea ("Agregar sub-paso"), se muestran adentro de ella y se confirman en orden. Si la tarea
  // es la desbloqueada, el destacado pasa a su primer sub-paso sin hacer.
  const { data: substepsData } = useTodayTaskSubsteps(effectiveDate, open);
  const createSubstep = useCreateTodayTaskSubstep();
  const updateSubstep = useUpdateTodayTaskSubstep();
  const deleteSubstep = useDeleteTodayTaskSubstep();
  const substepsFor = (item: TodayItem) =>
    item.type === "node" ? [] : (substepsData || []).filter((st) => st.taskType === item.type && st.taskId === item.id);
  const [addSubstepFor, setAddSubstepFor] = useState<TodayItem | null>(null);
  const [newSubstepTitle, setNewSubstepTitle] = useState("");
  const openAddSubstepDialog = (item: TodayItem) => {
    setNewSubstepTitle("");
    setAddSubstepFor(item);
  };
  const submitNewSubstep = async () => {
    const title = newSubstepTitle.trim();
    if (!title || !addSubstepFor) return;
    const target = addSubstepFor;
    setAddSubstepFor(null);
    if (target.type === "node") {
      // Nodo: el "sub-paso" es un sub-nodo real de su sub-árbol (se crea el árbol si no existe).
      try {
        await addSubSkillFromToday(target.id, title);
      } catch (error) {
        console.error("Error creando sub-nodo desde Tareas de hoy:", error);
      }
      queryClient.invalidateQueries({ queryKey: ["node-subskills", target.id] });
      return;
    }
    createSubstep.mutate({ date: effectiveDate, taskType: target.type as SubstepTaskType, taskId: target.id, title });
  };

  // Sub-pasos de una tarea, indentados adentro de ella. En orden: solo se puede confirmar el
  // primero sin hacer, y desconfirmar el último hecho.
  const renderSubsteps = (item: TodayItem, parentIsCurrent: boolean) => {
    const steps = substepsFor(item);
    if (steps.length === 0) return null;
    const firstUndone = steps.findIndex((st) => st.done !== 1);
    const lastDone = firstUndone === -1 ? steps.length - 1 : firstUndone - 1;
    // Subir/bajar intercambia el orden con el vecino; si el que sube está sin hacer y el de
    // arriba hecho (o al revés), también se intercambia "hecho", para que el checklist siga
    // confirmado en orden (igual que los sub-nodos, donde el estado queda con la posición).
    const swapSubsteps = (a: typeof steps[number], b: typeof steps[number]) => {
      const aOrder = a.sortOrder === b.sortOrder ? steps.indexOf(a) : a.sortOrder;
      const bOrder = a.sortOrder === b.sortOrder ? steps.indexOf(b) : b.sortOrder;
      updateSubstep.mutate({ id: a.id, date: effectiveDate, updates: { sortOrder: bOrder, done: b.done as 0 | 1 } });
      updateSubstep.mutate({ id: b.id, date: effectiveDate, updates: { sortOrder: aOrder, done: a.done as 0 | 1 } });
    };
    return steps.map((st, i) => (
      <TodaySubRow
        key={st.id}
        title={stripLeadingEmoji(st.title)}
        done={st.done === 1}
        current={parentIsCurrent && i === firstUndone}
        dimmed={!(parentIsCurrent && i === firstUndone)}
        onToggleDone={
          i === firstUndone || i === lastDone
            ? () => updateSubstep.mutate({ id: st.id, date: effectiveDate, updates: { done: st.done === 1 ? 0 : 1 } })
            : undefined
        }
        onMoveUp={i > 0 ? () => swapSubsteps(st, steps[i - 1]) : undefined}
        onMoveDown={i < steps.length - 1 ? () => swapSubsteps(st, steps[i + 1]) : undefined}
        onRename={() => {
          setRenameSubTitle(st.title);
          setRenameSubTarget({ kind: "step", id: st.id, parentId: item.id });
        }}
        onDelete={() => deleteSubstep.mutate({ id: st.id, date: effectiveDate })}
        minutes={st.minutes}
        onAssignTime={() => openSubstepTimeDialog(st.id, st.minutes)}
        deleteLabel="sub-paso"
      />
    ));
  };
  const hasPendingSubsteps = (item: TodayItem) => substepsFor(item).some((st) => st.done !== 1);

  // El acordeón de franjas horarias solo se muestra si hay algo para agrupar ahí: tareas
  // configuradas para hoy, o actividad extra que ya se movió a una franja específica.
  const hasSlotSection = itemBuckets.unassigned.length > 0 || TIME_SLOTS.some((s) => itemBuckets[s.key].length > 0);

  // Si "Sin asignar" tiene alguna tarea todavía sin confirmar, tiene prioridad sobre la franja
  // horaria actual: es la única que arranca abierta (todas las franjas cerradas), sin importar
  // qué hora sea, porque son tareas que no tienen un momento del día asociado y conviene que se
  // vean primero. Si no hay pendientes ahí, se vuelve al comportamiento normal (Sin asignar +
  // franja actual abiertas).
  const hasPendingUnassigned = itemBuckets.unassigned.some((item) => !item.done);

  // En un día futuro previsualizado no existe "la hora actual" (getCurrentTimeSlotKey usa la
  // hora real, que no dice nada de un día que todavía no llegó): ahí se abre de entrada la
  // primera franja del día que ya tenga algo agendado, para que la tarea asignada aparezca
  // destacada de una sin tener que ir abriendo franja por franja.
  const firstNonEmptySlotKey = TIME_SLOTS.find((s) => itemBuckets[s.key].length > 0)?.key;

  // Viendo hoy, la franja horaria actual queda bloqueada abierta (no se puede cerrar) hasta que
  // pase su horario; recién ahí se libera y se bloquea la siguiente. En una previsualización no
  // hay "hora actual", así que no hay franja bloqueada.
  const lockedSlotKey: TaskSlotKey | null = isPreview ? null : getCurrentTimeSlotKey();

  // Además de la franja bloqueada puede haber, como mucho, UNA sección más abierta. Por defecto:
  // "Sin asignar" mientras tenga pendientes; en una previsualización, la primera franja con algo
  // agendado. El resto queda visualmente "de fondo" (ver data-[state=closed] en el trigger).
  const defaultExtraSlotSection: string | null = hasPendingUnassigned
    ? "unassigned"
    : isPreview
    ? firstNonEmptySlotKey ?? getCurrentTimeSlotKey()
    : null;
  // undefined = el usuario no tocó nada (se usa el default); null = cerró la sección extra.
  const [manualExtraSlotSection, setManualExtraSlotSection] = useState<string | null | undefined>(undefined);
  // Al cambiar de día (previsualización) se descarta la elección manual y se vuelve a calcular
  // la sección por defecto para ese día — abrir "Sin asignar" en un día no tiene por qué seguir
  // abierto al pasar a previsualizar otro.
  const [lastSlotSectionDate, setLastSlotSectionDate] = useState(effectiveDate);
  if (effectiveDate !== lastSlotSectionDate) {
    setLastSlotSectionDate(effectiveDate);
    setManualExtraSlotSection(undefined);
  }
  const extraSlotSection = manualExtraSlotSection !== undefined ? manualExtraSlotSection : defaultExtraSlotSection;
  const openSlotSections = Array.from(
    new Set([lockedSlotKey, extraSlotSection].filter((v): v is string => !!v))
  );
  const handleSlotSectionsChange = (values: string[]) => {
    const others = values.filter((v) => v !== lockedSlotKey);
    // Si se abrió una sección nueva, reemplaza a la extra anterior (nunca más de una extra).
    const next = others.find((v) => v !== extraSlotSection) ?? others[0] ?? null;
    // Sin franja bloqueada (previsualización) siempre tiene que quedar algo abierto.
    if (!next && !lockedSlotKey) return;
    setManualExtraSlotSection(next);
  };

  const moveItemToSlot = (item: TodayItem, slot: TaskSlotKey) => {
    setTaskSlot.mutate({ date: effectiveDate, taskType: item.type, taskId: item.id, slot });
  };

  // Recibe el orden visual completo de la franja (itemBuckets[slot], ya con el swap aplicado)
  // en vez de pedirle al backend que intercambie con el "vecino" guardado: así también
  // funciona para ítems que todavía no tienen fila propia (hábitos con franja por defecto,
  // actividad extra), que antes no se podían mover porque no había nada que swapear.
  const moveItemOrder = (slot: TaskSlotKey, bucket: TodayItem[], index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= bucket.length) return;
    const newOrder = bucket.slice();
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    reorderTaskSlot.mutate({
      date: effectiveDate,
      slot,
      order: newOrder.map((it) => ({ taskType: it.type, taskId: it.id })),
    });
  };

  const unassignItem = (item: TodayItem) => {
    // Un hábito agregado a mano existe en el día solo por su fila de franja: borrarla lo
    // sacaría de hoy, así que se lo deja como "added" (sin franja) en vez de borrarla.
    if (item.type === "habit" && addedHabitIds.has(item.id)) {
      setTaskSlot.mutate({ date: effectiveDate, taskType: "habit", taskId: item.id, slot: "added" });
      return;
    }
    clearTaskSlot.mutate({ date: effectiveDate, taskType: item.type, taskId: item.id });
  };

  const hideItemFromToday = (item: TodayItem) => {
    // "Sacar de hoy" en un nodo no es solo taparlo ese día (quedaría agendado igual, solo
    // oculto): se le borra la fecha planeada directamente, así el nodo vuelve a quedar sin
    // fecha en el árbol — mismo efecto que limpiar "When exactly?" a mano en el nodo.
    if (item.type === "node") {
      const node = allPlannedNodes.find((n) => n.id === item.id);
      if (node?.kind === "sub") patchSubSkill.mutate({ id: item.id, updates: { plannedDate: null } });
      else if (node?.parentId && node.kind) {
        if (node.kind === "project") updateProjectSkill(node.parentId, item.id, { plannedDate: null });
        else updateSkill(node.parentId, item.id, { plannedDate: null });
      }
      clearTaskSlot.mutate({ date: effectiveDate, taskType: "node", taskId: item.id });
      return;
    }
    setTaskSlot.mutate({ date: effectiveDate, taskType: item.type, taskId: item.id, slot: "hidden" });
  };

  const toggleManualDone = (item: TodayItem) => {
    const task = manualTasks.find((t) => t.id === item.id);
    if (!task) return;
    const newDone = task.done === 1 ? 0 : 1;
    updateManualTask.mutate({ id: item.id, date: effectiveDate, updates: { done: newDone } });
    // Evento con nodo propio (ver newTaskParent): confirmarlo/desconfirmarlo hace lo mismo con
    // el nodo, salvo que el nodo ya esté en ese estado (p.ej. se confirmó desde el árbol).
    if (task.linkedSkillId) {
      const parent = findNodeParent(task.linkedSkillId);
      const parentTree = parent
        ? (parent.kind === "area" ? areas : projects).find((p) => p.id === parent.parentId)
        : undefined;
      const node = parentTree?.skills?.find((s: Skill) => s.id === task.linkedSkillId);
      if (node && (node.status === "mastered") !== (newDone === 1)) {
        toggleNodeDone({ ...item, type: "node", id: node.id, key: `node:${node.id}`, done: node.status === "mastered" });
      }
    }
  };

  // Busca el área/proyecto dueño de un nodo por su id de skill, sin depender de que el ítem
  // tenga parentId/kind propios (los nodos "extra" de "Más" no los tienen — ver PlannedNode).
  const findNodeParent = (skillId: string): { parentId: string; kind: "area" | "project" } | null => {
    const area = (Array.isArray(areas) ? areas : []).find((a) => a.skills?.some((s: Skill) => s.id === skillId));
    if (area) return { parentId: area.id, kind: "area" };
    const project = (Array.isArray(projects) ? projects : []).find((p) => p.skills?.some((s: Skill) => s.id === skillId));
    if (project) return { parentId: project.id, kind: "project" };
    return null;
  };

  // Confirmar/desconfirmar un nodo desde acá corre exactamente el mismo camino que tocarlo en
  // el árbol (toggleSkillStatus/toggleProjectSkillStatus en skill-context.tsx): mismos guards
  // de progresión de nivel y mismos pop-ups de XP/quest/subida de nivel.
  const toggleNodeDone = (item: TodayItem) => {
    const parent = findNodeParent(item.id);
    if (!parent) {
      // Sub-nodo: no está en el contexto, se marca directo en el server (que igual estampa
      // completedAt, suma XP al padre y desbloquea el siguiente del nivel).
      if (datedSubSkills.some((s) => s.id === item.id)) {
        patchSubSkill.mutate({ id: item.id, updates: { status: item.done ? "available" : "mastered" } });
      }
      return;
    }
    if (parent.kind === "area") toggleSkillStatus(parent.parentId, item.id);
    else toggleProjectSkillStatus(parent.parentId, item.id);
  };

  // Confirmar un hábito/práctica desde acá otorga XP y dispara los mismos pop-ups que
  // confirmarlo desde HabitStreakModal/SpaceRepetitionModal (ver useConfirmActions.ts). Una
  // práctica ya confirmada ese día no se puede "desconfirmar" — no existe esa acción en
  // SpaceRepetitionModal tampoco (avanzar un intervalo es unidireccional).
  const toggleItemDone = (item: TodayItem) => {
    if (item.type === "manual") {
      // Las comidas por defecto no se tildan a mano: se abre el registro de esa comida y la
      // tarea queda confirmada cuando la comida tiene algo registrado (lo sincroniza el
      // backend). En un día futuro no hay nada que registrar todavía: se tilda como siempre.
      const mealId = defaultTaskMealId(item.id);
      if (mealId && effectiveDate <= todayStr) {
        setMealPopupId(mealId);
        return;
      }
      toggleManualDone(item);
      return;
    }
    if (item.type === "habit") {
      const habit = (habitsData || []).find((h) => h.id === item.id);
      if (!habit) return;
      if (item.done) unconfirmHabit(habit, effectiveDate);
      else confirmHabit(habit, effectiveDate);
      return;
    }
    if (item.type === "node") {
      if (!item.done && subNodesFor(item).length > 0) {
        if (hasPendingSubNodes(item)) return;
        masterWholeSubSkillTree(item.id)
          .catch((error) => console.error("Error confirmando el sub-árbol:", error))
          .finally(() => toggleNodeDone(item));
        return;
      }
      toggleNodeDone(item);
      return;
    }
    if (item.type === "practice") {
      if (item.done) return;
      const practice = (practicesData || []).find((p) => p.id === item.id);
      if (practice) confirmPractice(practice);
    }
  };

  const canToggleDone = (item: TodayItem): boolean => {
    if (item.type === "rewiring") return false;
    if (item.type === "practice") return !item.done;
    return true;
  };

  const deleteManualItem = (item: TodayItem) => {
    deleteManualTask.mutate({ id: item.id, date: effectiveDate });
  };

  // Duplicar una tarea manual repite su título tal cual. Duplicar un hábito crea, en cambio,
  // una tarea manual suelta (no ligada al hábito) con su nombre: la copia no marca el hábito
  // como hecho al confirmarla, sino que se tilda a mano como cualquier tarea manual.
  const duplicateManualItem = (item: TodayItem) => {
    const task = manualTasks.find((t) => t.id === item.id);
    if (!task) return;
    createManualTask.mutate({ date: effectiveDate, title: task.title, kind: task.kind });
  };

  const duplicateHabitItem = (item: TodayItem) => {
    const habit = (habitsData || []).find((h) => h.id === item.id);
    const title = habit ? `${habit.emoji} ${habit.name}` : typeof item.label === "string" ? item.label : "Tarea duplicada";
    createManualTask.mutate({ date: effectiveDate, title });
  };

  const duplicateItem = (item: TodayItem) => {
    if (item.type === "manual") duplicateManualItem(item);
    else if (item.type === "habit") duplicateHabitItem(item);
  };

  const canDuplicate = (item: TodayItem) => item.type === "manual" || item.type === "habit";

  // --- Prioridades del día (la estrellita): hasta MAX_TODAY_PRIORITIES tareas "no negociables".
  // Se guardan por key base `${type}:${id}` (sin el sufijo "#franja" de los duplicados de un
  // hábito con varias franjas), así que la tarea queda destacada en todas sus copias. El estado
  // de "hecha" no se guarda aparte: el pop-up muestra los mismos TodayItem que la lista, así
  // que confirmar en un lado se ve confirmado en el otro.
  const { data: priorityKeysData } = useTodayPriorities(effectiveDate, open);
  const setPriorities = useSetTodayPriorities();
  const priorityKeys = priorityKeysData || [];
  const priorityKeySet = new Set(priorityKeys);
  const itemBaseKey = (item: TodayItem) => `${item.type}:${item.id}`;
  const itemsByBaseKey = new Map<string, TodayItem>();
  [...todayItems, ...extraItems].forEach((item) => {
    if (!itemsByBaseKey.has(itemBaseKey(item))) itemsByBaseKey.set(itemBaseKey(item), item);
  });
  // En el orden en que se eligieron; se saltean las que ya no están en el día (p.ej. se sacó de
  // hoy o se movió a otro día después de marcarla).
  const priorityItems = priorityKeys
    .map((k) => itemsByBaseKey.get(k))
    .filter((item): item is TodayItem => !!item);
  // Una prioridad que ya no está en el día no ocupa lugar: se limpia al guardar.
  const prioritiesFull = priorityItems.length >= MAX_TODAY_PRIORITIES;
  // Candidatas a prioridad: las tareas configuradas del día (no la actividad extra de "Más",
  // que ya está hecha, ni los rewirings, que no se confirman desde acá).
  const priorityCandidates = todayItems.filter((item) => item.type !== "rewiring");

  const togglePriority = (item: TodayItem) => {
    const key = itemBaseKey(item);
    const current = priorityItems.map(itemBaseKey);
    if (current.includes(key)) {
      setPriorities.mutate({ date: effectiveDate, taskKeys: current.filter((k) => k !== key) });
    } else if (current.length < MAX_TODAY_PRIORITIES) {
      setPriorities.mutate({ date: effectiveDate, taskKeys: [...current, key] });
    }
  };

  const priorityRowProps = (item: TodayItem) => ({
    priority: priorityKeySet.has(itemBaseKey(item)),
    priorityFull: prioritiesFull,
    onTogglePriority: item.type !== "rewiring" ? () => togglePriority(item) : undefined,
  });

  const openPriorities = () => {
    // Sin prioridades elegidas todavía, el pop-up arranca directo en el selector.
    setPrioritiesEditing(priorityItems.length === 0);
    setPrioritiesOpen(true);
  };

  // --- Cambiar de día: mover la "realización" de una tarea a otra fecha, mantenendo
  // presionada la fila (ver TodayTaskRow). Qué significa "mover" depende del tipo:
  // - manual: se reasigna la fila entera (tenga o no tenga hecha) a la fecha nueva.
  // - nodo planeado (con plannedDate, no uno "extra" de Más): se reagenda su plannedDate,
  //   tenga o no tenga hecha — es lo mismo que ya se puede hacer desde el nodo en el árbol.
  // - hábito: solo si ya está confirmado ese día (si no, no hay ningún registro que mover —
  //   un hábito pendiente no tiene una fecha propia, es recurrente). Se descuenta el día viejo
  //   y se confirma en el nuevo.
  // - práctica de repetición espaciada: solo si ya está confirmada ese día. Se reescribe
  //   lastConfirmedAt con la fecha elegida (mismo horario del día), para que el próximo
  //   intervalo cuente efectivamente desde esa fecha, no desde el momento en que se tocó el
  //   botón — así lo pidió el usuario explícitamente.
  const updateHabitRecordMutation = useUpdateHabitRecord();

  const updatePracticeDateMutation = useMutation({
    mutationFn: async ({ id, lastConfirmedAt }: { id: string; lastConfirmedAt: string }) => {
      const res = await fetch(`/api/space-repetition/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastConfirmedAt }),
      });
      if (!res.ok) throw new Error("Failed to move practice");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["space-repetition"] });
    },
  });

  const [changeDayItem, setChangeDayItem] = useState<TodayItem | null>(null);
  const [changeDayValue, setChangeDayValue] = useState("");

  const canChangeDay = (item: TodayItem): boolean => {
    if (item.type === "manual") return true;
    if (item.type === "node") return !extraNodeIds.has(item.id);
    if (item.type === "habit") return item.done;
    if (item.type === "practice") return item.done;
    // "rewiring": cada fila es una repetición puntual dentro del historial de un tracker, no
    // algo con una fecha propia editable desde acá.
    return false;
  };

  const openChangeDayDialog = (item: TodayItem) => {
    setChangeDayItem(item);
    setChangeDayValue(effectiveDate);
  };

  const submitChangeDay = () => {
    const item = changeDayItem;
    const newDate = changeDayValue;
    setChangeDayItem(null);
    if (!item || !newDate || newDate === effectiveDate) return;

    if (item.type === "manual") {
      updateManualTask.mutate({ id: item.id, date: effectiveDate, updates: { date: newDate } });
      return;
    }
    if (item.type === "habit") {
      updateHabitRecordMutation.mutate({ habitId: item.id, date: effectiveDate, completed: 0 });
      updateHabitRecordMutation.mutate({ habitId: item.id, date: newDate, completed: 1 });
      clearTaskSlot.mutate({ date: effectiveDate, taskType: "habit", taskId: item.id });
      return;
    }
    if (item.type === "node") {
      const node = allPlannedNodes.find((n) => n.id === item.id);
      if (node?.kind === "sub") patchSubSkill.mutate({ id: item.id, updates: { plannedDate: newDate } });
      else if (node?.parentId && node.kind) {
        if (node.kind === "project") updateProjectSkill(node.parentId, item.id, { plannedDate: newDate });
        else updateSkill(node.parentId, item.id, { plannedDate: newDate });
      }
      clearTaskSlot.mutate({ date: effectiveDate, taskType: "node", taskId: item.id });
      return;
    }
    if (item.type === "practice") {
      const practice = (practicesData || []).find((p) => p.id === item.id);
      const origConfirmedAt = practice?.lastConfirmedAt || practice?.updatedAt;
      const moved = origConfirmedAt ? new Date(origConfirmedAt) : new Date();
      const [y, m, d] = newDate.split("-").map(Number);
      moved.setFullYear(y, m - 1, d);
      updatePracticeDateMutation.mutate({ id: item.id, lastConfirmedAt: moved.toISOString() });
      clearTaskSlot.mutate({ date: effectiveDate, taskType: "practice", taskId: item.id });
    }
  };

  // --- Asignar tiempo: el tiempo estimado ("· Xmin") se edita desde el menú de la tarea y se
  // guarda en el mismo campo que ya lo alimenta según el tipo: nodo → plannedDuration, hábito/
  // práctica → minMinutes (ojo: es del hábito/práctica, no solo de este día), manual → minutes.
  // Los rewirings no tienen un campo de duración propio, así que quedan afuera.
  const [timeItem, setTimeItem] = useState<TodayItem | null>(null);
  // Sub-paso al que se le está asignando tiempo (mismo diálogo que las tareas).
  const [timeSubstepId, setTimeSubstepId] = useState<string | null>(null);
  const [timeValue, setTimeValue] = useState("");

  const updateDurationMutation = useMutation({
    mutationFn: async ({ item, minutes }: { item: TodayItem; minutes: number | null }) => {
      const url = item.type === "habit" ? `/api/habits/${item.id}` : `/api/space-repetition/${item.id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minMinutes: minutes }),
      });
      if (!res.ok) throw new Error("Failed to update duration");
      return res.json();
    },
    onSuccess: (_, { item }) => {
      queryClient.invalidateQueries({ queryKey: [item.type === "habit" ? "habits" : "space-repetition"] });
    },
  });

  const canAssignTime = (item: TodayItem) => item.type !== "rewiring";

  const currentMinutes = (item: TodayItem): number | null | undefined => {
    if (item.type === "habit") return (habitsData || []).find((h) => h.id === item.id)?.minMinutes;
    if (item.type === "practice") return (practicesData || []).find((p) => p.id === item.id)?.minMinutes;
    if (item.type === "manual") return manualTasks.find((t) => t.id === item.id)?.minutes;
    if (item.type === "node") {
      return (
        allPlannedNodes.find((n) => n.id === item.id)?.plannedDuration ??
        extraNodes.find((n) => n.id === item.id)?.plannedDuration ??
        Array.from(subSkillsByNodeId.values()).flat().find((sub) => sub.id === item.id)?.plannedDuration
      );
    }
    return null;
  };

  const openTimeDialog = (item: TodayItem) => {
    const m = currentMinutes(item);
    setTimeValue(m ? String(m) : "");
    setTimeItem(item);
  };

  const openSubstepTimeDialog = (substepId: string, minutes: number | null | undefined) => {
    setTimeValue(minutes ? String(minutes) : "");
    setTimeSubstepId(substepId);
  };

  const submitTime = (raw: string = timeValue) => {
    const item = timeItem;
    const substepId = timeSubstepId;
    setTimeItem(null);
    setTimeSubstepId(null);
    const parsed = parseInt(raw, 10);
    const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    if (substepId) {
      updateSubstep.mutate({ id: substepId, date: effectiveDate, updates: { minutes } });
      return;
    }
    if (!item) return;
    if (minutes === (currentMinutes(item) ?? null)) return;

    if (item.type === "manual") {
      updateManualTask.mutate({ id: item.id, date: effectiveDate, updates: { minutes } });
      return;
    }
    if (item.type === "node") {
      const parent = findNodeParent(item.id);
      if (!parent) patchSubSkill.mutate({ id: item.id, updates: { plannedDuration: minutes } });
      else if (parent.kind === "project") updateProjectSkill(parent.parentId, item.id, { plannedDuration: minutes });
      else updateSkill(parent.parentId, item.id, { plannedDuration: minutes });
      return;
    }
    updateDurationMutation.mutate({ item, minutes });
  };

  // Mantener presionado el fondo (fuera de una tarea puntual) abre el diálogo para agregar
  // una tarea manual al día que se está viendo (hoy, o el día previsualizado), sin franja.
  const startBackgroundLongPress = () => {
    backgroundLongPressTimer.current = setTimeout(() => {
      setNewTaskTitle("");
      setNewTaskKind("task");
      setNewTaskParent("");
      setAddTaskTargetSlot(null);
      setAddTaskDialogOpen(true);
    }, LONG_PRESS_MS);
  };

  const cancelBackgroundLongPress = () => {
    if (backgroundLongPressTimer.current) {
      clearTimeout(backgroundLongPressTimer.current);
      backgroundLongPressTimer.current = null;
    }
  };

  // Mantener presionado el título de una franja horaria (La mañana/Mediodía/Tarde/Noche) abre
  // el mismo diálogo pero apuntado a esa franja, para que la tarea nueva caiga directo ahí en
  // vez de en "Sin asignar". stopPropagation evita que además dispare el long-press del fondo.
  const startSlotTitleLongPress = (e: React.MouseEvent | React.TouchEvent, slot: TaskSlotKey) => {
    e.stopPropagation();
    slotTitleLongPressFired.current = false;
    slotTitleLongPressTimer.current = setTimeout(() => {
      slotTitleLongPressFired.current = true;
      setNewTaskTitle("");
      setNewTaskKind("task");
      setNewTaskParent("");
      setAddTaskTargetSlot(slot);
      setAddTaskDialogOpen(true);
    }, LONG_PRESS_MS);
  };

  const cancelSlotTitleLongPress = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (slotTitleLongPressTimer.current) {
      clearTimeout(slotTitleLongPressTimer.current);
      slotTitleLongPressTimer.current = null;
    }
  };

  const submitNewTask = async () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    setAddTaskDialogOpen(false);
    if (newTaskKind === "event" && newTaskParent) {
      const [linkedKind, linkedParentId] = newTaskParent.split(":") as ["area" | "project", string];
      const created = await createManualTask.mutateAsync({ date: effectiveDate, title, kind: "event", linkedKind, linkedParentId });
      if (addTaskTargetSlot) {
        setTaskSlot.mutate({ date: effectiveDate, taskType: "manual", taskId: created.id, slot: addTaskTargetSlot });
      }
      // Si el evento es de hoy (o de un día ya pasado), su nodo se crea ya mismo.
      if (effectiveDate <= todayStr) {
        await materializePendingEventNodes();
        queryClient.invalidateQueries({ queryKey: ["manual-today-tasks", effectiveDate] });
      }
      return;
    }
    if (newTaskKind === "task" && newTaskParent) {
      const [parentKind, parentId] = newTaskParent.split(":") as ["area" | "project", string];
      const node = await addSkillInPlaceOfAvailable(parentKind, parentId, title, { plannedDate: effectiveDate });
      if (node && addTaskTargetSlot) {
        setTaskSlot.mutate({ date: effectiveDate, taskType: "node", taskId: node.id, slot: addTaskTargetSlot });
      }
      return;
    }
    const created = await createManualTask.mutateAsync({ date: effectiveDate, title, kind: newTaskKind });
    // Si el diálogo se abrió apuntado a una franja (long-press en su título), la tarea recién
    // creada se asigna directo ahí — queda última de la fila porque es la de updatedAt más
    // reciente entre las tareas no hechas de esa franja.
    if (addTaskTargetSlot) {
      // Se mete la franja en el cache al toque, antes de esperar la respuesta del POST: si no,
      // la consulta de tareas manuales (recién invalidada por createManualTask) puede volver
      // primero y la tarea nueva se ve, aunque sea un instante, en "Sin asignar" hasta que
      // llegue la respuesta de esta otra mutación.
      queryClient.setQueryData<TodayTaskSlot[]>(["today-task-slots", effectiveDate], (old) => [
        ...(old || []),
        {
          id: `optimistic:${created.id}`,
          userId: "",
          date: effectiveDate,
          taskType: "manual",
          taskId: created.id,
          slot: addTaskTargetSlot,
          sortOrder: 0,
          updatedAt: new Date(),
        },
      ]);
      setTaskSlot.mutate({ date: effectiveDate, taskType: "manual", taskId: created.id, slot: addTaskTargetSlot });
    }
  };

  // Agrega al día un hábito que no estaba programado para él: se guarda como una fila de franja
  // (la franja del título presionado, o "added" = sin franja si se presionó el fondo).
  const addHabitToDay = (habitId: string) => {
    setAddTaskDialogOpen(false);
    const slot: TaskSlotKey = addTaskTargetSlot ?? "added";
    // Mismo truco optimista que en submitNewTask: que aparezca al toque en su lugar.
    queryClient.setQueryData<TodayTaskSlot[]>(["today-task-slots", effectiveDate], (old) => [
      ...(old || []),
      {
        id: `optimistic:habit:${habitId}`,
        userId: "",
        date: effectiveDate,
        taskType: "habit",
        taskId: habitId,
        slot,
        sortOrder: 0,
        updatedAt: new Date(),
      },
    ]);
    setTaskSlot.mutate({ date: effectiveDate, taskType: "habit", taskId: habitId, slot });
  };

  // --- Agregar tarea desde el calendario de actividades: mantener presionado un día abre un
  // diálogo para crear una tarea/evento manual ahí, eligiendo su franja horaria (o sin
  // asignar), si va al principio o al final de esa franja, y opcionalmente más días en los que
  // se crea la misma tarea (una copia independiente por día).
  const [calAddOpen, setCalAddOpen] = useState(false);
  const [calAddTitle, setCalAddTitle] = useState("");
  const [calAddKind, setCalAddKind] = useState<"task" | "event">("task");
  const [calAddSlot, setCalAddSlot] = useState<TaskSlotKey | null>(null);
  const [calAddPosition, setCalAddPosition] = useState<"start" | "end">("end");
  const [calAddDates, setCalAddDates] = useState<string[]>([]);
  const [calAddPickerOpen, setCalAddPickerOpen] = useState(false);
  const [calAddPickerMonth, setCalAddPickerMonth] = useState(() => new Date());
  const dayLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Si el long-press de un día ya abrió el diálogo, el click que sigue al soltar no tiene que
  // además seleccionar ese día.
  const dayLongPressFired = useRef(false);

  const openCalendarAddDialog = (dateStr: string) => {
    setCalAddTitle("");
    setCalAddKind("task");
    setCalAddSlot(null);
    setCalAddPosition("end");
    setCalAddDates([dateStr]);
    setCalAddPickerOpen(false);
    setCalAddPickerMonth(new Date(dateStr + "T12:00:00"));
    setCalAddOpen(true);
  };

  const startDayLongPress = (dateStr: string) => {
    dayLongPressFired.current = false;
    dayLongPressTimer.current = setTimeout(() => {
      dayLongPressFired.current = true;
      openCalendarAddDialog(dateStr);
    }, LONG_PRESS_MS);
  };

  const cancelDayLongPress = () => {
    if (dayLongPressTimer.current) {
      clearTimeout(dayLongPressTimer.current);
      dayLongPressTimer.current = null;
    }
  };

  const toggleCalAddDate = (dateStr: string) => {
    setCalAddDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort()
    );
  };

  const submitCalendarAdd = async () => {
    const title = calAddTitle.trim();
    if (!title || calAddDates.length === 0) return;
    setCalAddOpen(false);
    const slot = calAddSlot;
    const position = calAddPosition;
    await Promise.all(
      calAddDates.map(async (date) => {
        const created = await createManualTask.mutateAsync({ date, title, kind: calAddKind });
        if (!slot) return;
        // Mismo truco optimista que en submitNewTask, solo si ese día ya está en cache (si no,
        // se crearía una lista de franjas incompleta para un día que nunca se cargó).
        queryClient.setQueryData<TodayTaskSlot[]>(["today-task-slots", date], (old) =>
          old
            ? [
                ...old,
                {
                  id: `optimistic:${created.id}`,
                  userId: "",
                  date,
                  taskType: "manual",
                  taskId: created.id,
                  slot,
                  sortOrder: position === "start" ? Number.MIN_SAFE_INTEGER : Number.MAX_SAFE_INTEGER,
                  updatedAt: new Date(),
                },
              ]
            : old
        );
        setTaskSlot.mutate({ date, taskType: "manual", taskId: created.id, slot, position });
      })
    );
  };

  const viewLabel = new Date(effectiveDate + "T12:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Calendar view: habit records for the whole displayed month
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const calDim = new Date(calYear, calMonth + 1, 0).getDate();
  const calMonthStart = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
  const calMonthEnd = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(calDim).padStart(2, "0")}`;

  const activeHabitsThisMonth = (habitsData || []).filter((h: Habit) => {
    if (!h.endDate) return true;
    return h.endDate >= calMonthStart;
  });

  const monthRecordQueries = useQueries({
    queries: activeHabitsThisMonth.map((h) => ({
      queryKey: ["habit-records", h.id, calMonthStart, calMonthEnd],
      queryFn: async () => {
        const res = await fetch(`/api/habit-records/${h.id}?startDate=${calMonthStart}&endDate=${calMonthEnd}`);
        if (!res.ok) throw new Error("Failed to fetch habit records");
        return res.json() as Promise<HabitRecord[]>;
      },
      enabled: open && viewMode === "calendar",
    })),
  });

  const habitDoneDatesByHabit = new Map<string, Set<string>>();
  activeHabitsThisMonth.forEach((h, i) => {
    const records = (monthRecordQueries[i]?.data as HabitRecord[] | undefined) || [];
    habitDoneDatesByHabit.set(h.id, new Set(records.filter((r) => r.completed === 1).map((r) => r.date)));
  });

  const nodesThisMonth = allPlannedNodes.filter(
    (n) => n.plannedDate >= calMonthStart && n.plannedDate <= calMonthEnd
  );

  // Nodos sin fecha planeada que se confirmaron dentro del mes mostrado (el equivalente de
  // "Más" pero para cualquier día del calendario, no solo hoy).
  const extraNodesThisMonth = [
    ...collectExtraCompletedNodes(Array.isArray(areas) ? areas : [], calMonthStart, calMonthEnd),
    ...collectExtraCompletedNodes(Array.isArray(projects) ? projects : [], calMonthStart, calMonthEnd),
    ...collectExtraCompletedSubNodes(calMonthStart, calMonthEnd),
  ];

  // Prácticas de repetición espaciada confirmadas dentro del mes mostrado. Solo se puede
  // saber la última confirmación de cada práctica (no hay historial completo), así que un
  // día pasado solo puede mostrar esa última confirmación si cae en ese día.
  const confirmedPracticesThisMonth = (practicesData || [])
    .map((p) => {
      const status = p.level === 2 ? calculateStatusL2(p) : calculateStatus(p);
      const pending = status === "expires_soon";
      const confirmedAt = p.lastConfirmedAt || p.updatedAt;
      if (pending || status === "loss" || status === "frozen" || !confirmedAt) return null;
      const dateStr = getDateStr(new Date(confirmedAt));
      if (dateStr < calMonthStart || dateStr > calMonthEnd) return null;
      return { practice: p, dateStr };
    })
    .filter((entry): entry is { practice: SpaceRepetitionPractice; dateStr: string } => entry !== null);

  // Tareas/eventos manuales del mes mostrado, incluidos los de días futuros — a diferencia del
  // resto, no tienen concepto de "programado recurrente": cada uno vive en un día puntual, así
  // que alcanza con traer el rango entero del mes para poder previsualizarlos en el calendario.
  const { data: monthManualTasksData } = useManualTasksRange(calMonthStart, calMonthEnd, open && viewMode === "calendar");
  const manualTasksThisMonth = monthManualTasksData || [];

  const offset = getFirstDayOfMonth(calendarDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openCalendar = () => {
    setCalendarDate(new Date());
    setSelectedDay(null);
    setViewMode("calendar");
  };

  const changeCalendarMonth = (delta: number) => {
    setCalendarDate(new Date(calYear, calMonth + delta, 1));
    setSelectedDay(null);
  };

  // Junta habitos/nodos/practicas de un día del calendario. Para hoy reusa exactamente los
  // mismos totales que la pestaña "Progreso" (incluye lo oculto/extra), para que ambas vistas
  // coincidan; para otros días del mes reconstruye lo mismo a partir del historial disponible.
  const getDayStats = (dateStr: string, dObj: Date) => {
    // El "fast path" reusa las variables en vivo de la pestaña Progreso, que están calculadas
    // para effectiveDate — solo son válidas para la celda de hoy cuando NO se está
    // previsualizando otro día (si no, hoy también tiene que reconstruirse abajo).
    // Tareas/eventos manuales de ese día puntual: no dependen del "fast path" de hoy (que
    // reusaría `manualTasks`, cargado para effectiveDate) porque acá se recorre TODO el mes,
    // incluidos días futuros que effectiveDate nunca cubre salvo que sea el día previsualizado.
    const manualThatDay = manualTasksThisMonth.filter((t) => t.date === dateStr);
    const manualDoneThatDay = manualThatDay.filter((t) => t.done === 1);

    if (dateStr === todayStr && !isPreview) {
      const todayHabitsDoneIds = new Set([
        ...visibleHabitItems.filter((h) => h.done).map((h) => h.id),
        ...extraHabits.map((h) => h.id),
      ]);
      return {
        habitsDone: activeHabitsThisMonth.filter((h) => todayHabitsDoneIds.has(h.id)),
        habitsScheduled: activeHabitsThisMonth.filter((h) => visibleHabitItems.some((v) => v.id === h.id)),
        nodesDone: [...visiblePlannedNodesForView.filter((n) => n.done), ...extraNodes],
        nodesScheduled: visiblePlannedNodesForView,
        practicesDone: visiblePracticesToday.filter(({ done }) => done).map(({ practice }) => practice),
        manualScheduled: manualThatDay,
        manualDone: manualDoneThatDay,
        totalForDay: total,
        doneForDay: completed,
      };
    }

    const habitsScheduledThatDay = activeHabitsThisMonth.filter((h) => {
      const days = h.scheduledDays?.length ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
      const dow = dObj.getDay() === 0 ? 6 : dObj.getDay() - 1;
      return days.includes(dow);
    });
    const habitsDoneThatDay = activeHabitsThisMonth.filter((h) => habitDoneDatesByHabit.get(h.id)?.has(dateStr));
    const extraHabitsDoneThatDay = habitsDoneThatDay.filter((h) => !habitsScheduledThatDay.includes(h));

    const nodesPlannedThatDay = nodesThisMonth.filter((n) => n.plannedDate === dateStr);
    const nodesPlannedDoneThatDay = nodesPlannedThatDay.filter((n) => n.done);
    const extraNodesThatDay = extraNodesThisMonth.filter((n) => n.plannedDate === dateStr);

    const practicesThatDay = confirmedPracticesThisMonth
      .filter((entry) => entry.dateStr === dateStr)
      .map((entry) => entry.practice);

    return {
      habitsDone: habitsDoneThatDay,
      habitsScheduled: habitsScheduledThatDay.filter((h) => !h.endDate || h.endDate >= dateStr),
      nodesDone: [...nodesPlannedDoneThatDay, ...extraNodesThatDay],
      nodesScheduled: nodesPlannedThatDay,
      practicesDone: practicesThatDay,
      manualScheduled: manualThatDay,
      manualDone: manualDoneThatDay,
      totalForDay: habitsScheduledThatDay.length + extraHabitsDoneThatDay.length + nodesPlannedThatDay.length + extraNodesThatDay.length + practicesThatDay.length + manualThatDay.length,
      doneForDay: habitsDoneThatDay.length + nodesPlannedDoneThatDay.length + extraNodesThatDay.length + practicesThatDay.length + manualDoneThatDay.length,
    };
  };

  const selectedDayDetails = selectedDay ? getDayStats(selectedDay, new Date(selectedDay + "T12:00:00")) : null;
  const selectedDayIsFuture = !!selectedDay && selectedDay > todayStr;

  // Lista del panel de detalle en el MISMO orden que la vista previa de ese día: primero
  // "Sin asignar", después La mañana → Mediodía → Tarde → Noche, al final "Más"; dentro de
  // cada una, las hechas primero y después el orden guardado (sortOrder/updatedAt) — mismo
  // criterio que itemBuckets más arriba. Usa las franjas guardadas de ese día (misma
  // queryKey que la vista previa, así que un reordenamiento ahí se refleja acá).
  const { data: selectedDaySlotsData } = useTodayTaskSlots(selectedDay ?? "", open && !!selectedDay);
  type DayListEntry = { key: string; done: boolean; node: React.ReactNode; fallback: "unassigned" | "more"; defaultSlot?: TaskSlotKey };
  const selectedDayList: React.ReactNode[] = (() => {
    if (!selectedDay || !selectedDayDetails) return [];
    const slotRows = new Map((selectedDaySlotsData || []).map((s) => [`${s.taskType}:${s.taskId}`, s]));
    const habitRow = (h: Habit) => (
      <div className="flex items-center gap-2 text-sm">
        <TaskDot emoji={h.emoji} color={HABIT_COLORS[activeHabitsThisMonth.indexOf(h) % HABIT_COLORS.length]} size="md" />
        <span>{h.name}</span>
      </div>
    );
    const manualRow = (t: { title: string; kind: string }) => (
      <div className="flex items-center gap-2 text-sm">
        <TaskDot emoji={extractLeadingEmoji(t.title)} color={t.kind === "event" ? EVENT_COLOR : TASK_COLOR} size="md" />
        <span>{stripLeadingEmoji(t.title)}</span>
      </div>
    );

    const entries: DayListEntry[] = [];
    if (selectedDayIsFuture) {
      // Hábitos agregados a mano a ese día (fila de franja que no sea "hidden") además de
      // los programados, igual que en la vista previa.
      const scheduledIds = new Set(selectedDayDetails.habitsScheduled.map((h) => h.id));
      const addedHabits = activeHabitsThisMonth.filter((h) => {
        const row = slotRows.get(`habit:${h.id}`);
        return !scheduledIds.has(h.id) && !!row && row.slot !== "hidden";
      });
      [...selectedDayDetails.habitsScheduled, ...addedHabits].forEach((h) =>
        entries.push({ key: `habit:${h.id}`, done: false, node: habitRow(h), fallback: "unassigned" })
      );
      selectedDayDetails.nodesScheduled.forEach((n) =>
        entries.push({ key: `node:${n.id}`, done: n.done, node: <NodeListRow node={n} />, fallback: "unassigned" })
      );
      selectedDayDetails.manualScheduled.forEach((t) =>
        entries.push({ key: `manual:${t.id}`, done: t.done === 1, node: manualRow(t), fallback: "unassigned" })
      );
    } else {
      const scheduledIds = new Set(selectedDayDetails.habitsScheduled.map((h) => h.id));
      selectedDayDetails.habitsDone.forEach((h) => {
        const row = slotRows.get(`habit:${h.id}`);
        const counted = scheduledIds.has(h.id) || (!!row && row.slot !== "hidden");
        entries.push({ key: `habit:${h.id}`, done: true, node: habitRow(h), fallback: counted ? "unassigned" : "more" });
      });
      selectedDayDetails.nodesDone.forEach((n) =>
        entries.push({
          key: `node:${n.id}`,
          done: true,
          node: <NodeListRow node={n} />,
          fallback: "unassigned",
          // Nodo "extra" (sin fecha planeada): cae en la franja del momento en que se confirmó.
          defaultSlot: n.completedAt ? getTimeSlotKeyForDate(new Date(n.completedAt)) : undefined,
        })
      );
      selectedDayDetails.practicesDone.forEach((p) =>
        entries.push({
          key: `practice:${p.id}`,
          done: true,
          node: (
            <div className="flex items-center gap-2 text-sm">
              <TaskDot emoji={p.emoji} color={PRACTICE_COLOR} size="md" />
              <span>{p.name}</span>
            </div>
          ),
          fallback: "unassigned",
        })
      );
      selectedDayDetails.manualDone.forEach((t) =>
        entries.push({ key: `manual:${t.id}`, done: true, node: manualRow(t), fallback: "unassigned" })
      );
    }

    const bucketOrder = ["unassigned", ...TIME_SLOTS.map((s) => s.key), "more"];
    const placed = entries
      // Ocultada ese día y sin hacer: tampoco aparece en la vista previa.
      .filter((e) => e.done || slotRows.get(e.key)?.slot !== "hidden")
      .map((e, baseIdx) => {
        const row = slotRows.get(e.key);
        const realSlot = row && TIME_SLOTS.some((t) => t.key === row.slot) ? (row.slot as TaskSlotKey) : undefined;
        const habitDefault = e.key.startsWith("habit:") ? habitDefaultSlotsById.get(e.key.slice(6))?.[0] : undefined;
        const bucket = realSlot ?? e.defaultSlot ?? habitDefault ?? e.fallback;
        return {
          e,
          baseIdx,
          bucketIdx: bucketOrder.indexOf(bucket),
          sortOrder: row?.sortOrder ?? 0,
          updatedAt: row ? new Date(row.updatedAt).getTime() : 0,
        };
      });
    placed.sort((a, b) => {
      if (a.bucketIdx !== b.bucketIdx) return a.bucketIdx - b.bucketIdx;
      if (a.e.done !== b.e.done) return Number(b.e.done) - Number(a.e.done);
      const isSlotBucket = a.bucketIdx > 0 && a.bucketIdx < bucketOrder.length - 1;
      if (isSlotBucket) {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
      }
      return a.baseIdx - b.baseIdx;
    });
    return placed.map(({ e }) => <React.Fragment key={e.key}>{e.node}</React.Fragment>);
  })();

  // Mini calendario del diálogo de agregar (para elegir más días).
  const pickerYear = calAddPickerMonth.getFullYear();
  const pickerMonth = calAddPickerMonth.getMonth();
  const pickerDim = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const pickerOffset = getFirstDayOfMonth(calAddPickerMonth);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border-none max-h-[85vh] overflow-y-auto minimal-scrollbar" showCloseButton={false}>
        <VisuallyHidden>
          <DialogTitle>Progreso de hoy</DialogTitle>
        </VisuallyHidden>

        {viewMode === "progress" ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                {isPreview && (
                  <button
                    onClick={() => setPreviewDate(null)}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors"
                    title="Volver a hoy"
                  >
                    <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                <div>
                  <h2 className="text-2xl font-bold">{isPreview ? "Vista previa" : "Hoy"}</h2>
                  <p className="text-sm text-muted-foreground capitalize">
                    {viewLabel.charAt(0).toUpperCase() + viewLabel.slice(1)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openPriorities}
                  className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors"
                  title="Prioridades del día"
                >
                  <Star
                    className={`h-4 w-4 ${priorityItems.length > 0 ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
                  />
                  {priorityItems.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white">
                      {priorityItems.filter((i) => i.done).length}/{priorityItems.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={openCalendar}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors"
                  title="Ver calendario de actividades"
                >
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Completado</span>
                <span className="text-sm font-semibold text-muted-foreground">
                  {completed}/{total}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {total > 0 ? (
                  Array.from({ length: total }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-3 flex-1 min-w-[3px] rounded-sm transition-colors duration-500 ${
                        i < completed ? "bg-emerald-500" : "bg-muted"
                      }`}
                    />
                  ))
                ) : (
                  <div className="h-3 flex-1 rounded-sm bg-muted" />
                )}
              </div>
            </div>

            <ScrollArea
              className="h-[40vh] pr-4"
              onMouseDown={startBackgroundLongPress}
              onMouseUp={cancelBackgroundLongPress}
              onMouseLeave={cancelBackgroundLongPress}
              onTouchStart={startBackgroundLongPress}
              onTouchEnd={cancelBackgroundLongPress}
              onTouchCancel={cancelBackgroundLongPress}
              onTouchMove={cancelBackgroundLongPress}
            >
              <div className="space-y-4">
                {total === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {isPreview
                      ? "No hay tareas configuradas para este día. Mantené presionado el fondo para agregar una."
                      : "No tenés tareas para hoy. Marcá una fecha en un nodo (mantené presionado su título) para que aparezca acá."}
                  </div>
                ) : (
                  <>
                    {hasSlotSection && (
                      <Accordion
                        type="multiple"
                        value={openSlotSections}
                        onValueChange={handleSlotSectionsChange}
                        className="space-y-1"
                      >
                        {itemBuckets.unassigned.length > 0 && (
                          <AccordionItem value="unassigned" className="border-0">
                            <AccordionTrigger className="py-1.5 hover:no-underline data-[state=closed]:opacity-40 transition-opacity">
                              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                Sin asignar ({itemBuckets.unassigned.length})
                              </h3>
                            </AccordionTrigger>
                            <AccordionContent className="pt-0 pb-1">
                              <div className="space-y-1.5">
                                {itemBuckets.unassigned.map((item) => (
                                  <React.Fragment key={item.key}>
                                  <TodayTaskRow
                                    item={item}
                                    pastDay={effectiveDate < todayStr}
                                    onMove={(slot) => moveItemToSlot(item, slot)}
                                    onHide={item.type !== "manual" || isDefaultManualTask(item.id) ? () => hideItemFromToday(item) : undefined}
                                    onDelete={item.type === "manual" && !isDefaultManualTask(item.id) ? () => deleteManualItem(item) : undefined}
                                    onDuplicate={canDuplicate(item) ? () => duplicateItem(item) : undefined}
                                    onToggleDone={canToggleDone(item) ? () => toggleItemDone(item) : undefined}
                                    onChangeDay={canChangeDay(item) ? () => openChangeDayDialog(item) : undefined}
                                    onAssignTime={canAssignTime(item) ? () => openTimeDialog(item) : undefined}
                                    onAddSubstep={!(item.type === "node" && item.done) ? () => openAddSubstepDialog(item) : undefined}
                                    {...priorityRowProps(item)}
                                  />
                                  {renderSubNodes(item, false)}
                                  {renderSubsteps(item, false)}
                                  </React.Fragment>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}

                        {TIME_SLOTS.map((s) => {
                          const isLocked = s.key === lockedSlotKey;
                          return (
                          <AccordionItem
                            key={s.key}
                            value={s.key}
                            className={
                              isLocked
                                ? "rounded-lg border-2 border-primary/60 bg-primary/10 px-2 shadow-[0_0_12px_-2px_hsl(var(--primary)/0.45)]"
                                : "border-0"
                            }
                          >
                            <AccordionTrigger
                              className={`py-1.5 hover:no-underline data-[state=closed]:opacity-40 transition-opacity ${isLocked ? "cursor-default [&>svg]:hidden" : ""}`}
                              onMouseDown={(e) => startSlotTitleLongPress(e, s.key)}
                              onMouseUp={cancelSlotTitleLongPress}
                              onMouseLeave={cancelSlotTitleLongPress}
                              onTouchStart={(e) => startSlotTitleLongPress(e, s.key)}
                              onTouchEnd={cancelSlotTitleLongPress}
                              onTouchCancel={cancelSlotTitleLongPress}
                              onTouchMove={cancelSlotTitleLongPress}
                              onClick={(e) => {
                                // El long-press ya abrió el diálogo: no dejar que el click que
                                // sigue al soltar también abra/cierre el acordeón.
                                if (slotTitleLongPressFired.current) e.preventDefault();
                              }}
                            >
                              <h3
                                className={
                                  isLocked
                                    ? "flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-primary"
                                    : "text-xs font-bold uppercase tracking-wide text-muted-foreground"
                                }
                              >
                                {s.label} ({itemBuckets[s.key].filter((i) => i.done).length}/{itemBuckets[s.key].length})
                                {isLocked && (
                                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-primary-foreground">
                                    Ahora
                                  </span>
                                )}
                              </h3>
                            </AccordionTrigger>
                            <AccordionContent className="pt-0 pb-1">
                              {itemBuckets[s.key].length === 0 ? (
                                <p className="text-xs text-muted-foreground py-1">Nada asignado a esta franja.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {(() => {
                                    // Solo en la franja horaria actual (la de la hora real de
                                    // ahora) la primera tarea sin hacer se destaca con opacidad
                                    // normal; las siguientes sin hacer de esa misma franja, y
                                    // TODAS las sin hacer del resto de las franjas (todavía no
                                    // les toca), quedan más tenues. En un día futuro previsualizado
                                    // no hay "hora real" que valga — ahí toda franja con algo
                                    // agendado se trata como activa, para que la tarea aparezca
                                    // destacada en vez de tenue.
                                    const isActiveSlot = isPreview ? itemBuckets[s.key].length > 0 : s.key === getCurrentTimeSlotKey();
                                    const firstUndoneIdx = isActiveSlot ? itemBuckets[s.key].findIndex((i) => !i.done) : -1;
                                    return itemBuckets[s.key].map((item, idx) => {
                                      // Nodo desbloqueado con sub-árbol: el destacado pasa a su
                                      // sub-nodo desbloqueado, que se muestra adentro de él.
                                      const isCurrent = !item.done && idx === firstUndoneIdx;
                                      return (
                                      <React.Fragment key={item.key}>
                                      <TodayTaskRow
                                        item={item}
                                        dimmed={idx !== firstUndoneIdx}
                                        current={isCurrent && !hasPendingSubsteps(item) && !hasPendingSubNodes(item)}
                                        pastDay={effectiveDate < todayStr}
                                        onMove={(slot) => moveItemToSlot(item, slot)}
                                        onClear={() => unassignItem(item)}
                                        onHide={item.type !== "manual" || isDefaultManualTask(item.id) ? () => hideItemFromToday(item) : undefined}
                                        onDelete={item.type === "manual" && !isDefaultManualTask(item.id) ? () => deleteManualItem(item) : undefined}
                                        onDuplicate={canDuplicate(item) ? () => duplicateItem(item) : undefined}
                                        onToggleDone={canToggleDone(item) ? () => toggleItemDone(item) : undefined}
                                        onChangeDay={canChangeDay(item) ? () => openChangeDayDialog(item) : undefined}
                                        onAssignTime={canAssignTime(item) ? () => openTimeDialog(item) : undefined}
                                        onAddSubstep={!(item.type === "node" && item.done) ? () => openAddSubstepDialog(item) : undefined}
                                        {...priorityRowProps(item)}
                                        onMoveUp={idx > 0 ? () => moveItemOrder(s.key, itemBuckets[s.key], idx, "up") : undefined}
                                        onMoveDown={idx < itemBuckets[s.key].length - 1 ? () => moveItemOrder(s.key, itemBuckets[s.key], idx, "down") : undefined}
                                      />
                                      {renderSubNodes(item, isCurrent && !isPreview)}
                                      {renderSubsteps(item, isCurrent)}
                                      </React.Fragment>
                                      );
                                    });
                                  })()}
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                          );
                        })}
                      </Accordion>
                    )}

                    {itemBuckets.more.length > 0 && (
                      <Accordion type="multiple" defaultValue={["more"]} className="space-y-1">
                        <AccordionItem value="more" className="border-0">
                          <AccordionTrigger className="py-1.5 hover:no-underline">
                            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                              Más ({itemBuckets.more.length})
                            </h3>
                          </AccordionTrigger>
                          <AccordionContent className="pt-0 pb-1">
                            <div className="space-y-1.5">
                              {itemBuckets.more.map((item) => (
                                <TodayTaskRow
                                  key={item.key}
                                  item={item}
                                  pastDay={effectiveDate < todayStr}
                                  onMove={(slot) => moveItemToSlot(item, slot)}
                                  onDuplicate={canDuplicate(item) ? () => duplicateItem(item) : undefined}
                                  onToggleDone={canToggleDone(item) ? () => toggleItemDone(item) : undefined}
                                  onChangeDay={canChangeDay(item) ? () => openChangeDayDialog(item) : undefined}
                                  onAssignTime={canAssignTime(item) ? () => openTimeDialog(item) : undefined}
                                  {...priorityRowProps(item)}
                                />
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode("progress")}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <h2 className="text-lg font-bold flex-1">Calendario de actividades</h2>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => changeCalendarMonth(-1)}
                className="flex h-8 w-8 items-center justify-center rounded border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <span className="font-bold text-sm text-foreground capitalize flex-1 text-center">
                {MONTHS[calMonth]} {calYear}
              </span>
              <button
                onClick={() => changeCalendarMonth(1)}
                className="flex h-8 w-8 items-center justify-center rounded border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DAY_LBLS.map((lbl) => (
                <div key={lbl} className="text-center text-xs font-medium text-muted-foreground uppercase mb-1">
                  {lbl}
                </div>
              ))}

              {Array.from({ length: offset }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {Array.from({ length: calDim }).map((_, d) => {
                const day = d + 1;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dObj = new Date(dateStr + "T12:00:00");
                dObj.setHours(0, 0, 0, 0);
                const isFuture = dObj > today;
                const isToday = dateStr === todayStr;

                const {
                  habitsDone: habitsDoneThatDay,
                  nodesDone: nodesDoneThatDay,
                  nodesScheduled: nodesScheduledThatDay,
                  practicesDone: practicesDoneThatDay,
                  manualScheduled: manualScheduledThatDay,
                  manualDone: manualDoneThatDay,
                  totalForDay,
                  doneForDay,
                } = getDayStats(dateStr, dObj);
                const allDone = totalForDay > 0 && doneForDay === totalForDay;
                // Un día futuro no puede tener nada "hecho" todavía: lo que se previsualiza ahí
                // es lo ya agendado (nodos con fecha planeada, tareas/eventos manuales). Los
                // hábitos recurrentes quedan afuera de esta cuenta — no son "agendado" para ese
                // día puntual, son rutina de todos los días.
                const futureScheduledCount = nodesScheduledThatDay.length + manualScheduledThatDay.length;
                const hasFutureContent = isFuture && futureScheduledCount > 0;

                let cellBg = "bg-muted/30";
                if (allDone) cellBg = "bg-emerald-500/20";
                else if (isFuture) cellBg = hasFutureContent ? "bg-amber-500/10" : "bg-muted/10 opacity-40";
                else if (isToday) cellBg = "bg-emerald-500/10";

                return (
                  <button
                    key={day}
                    // Tocar un día (pasado, hoy o futuro) muestra su lista de tareas en el
                    // panelcito de abajo; la vista previa completa se abre con el lápiz de ese
                    // panel. Mantener presionado abre el diálogo para agregarle una tarea.
                    onMouseDown={() => startDayLongPress(dateStr)}
                    onMouseUp={cancelDayLongPress}
                    onMouseLeave={cancelDayLongPress}
                    onTouchStart={() => startDayLongPress(dateStr)}
                    onTouchEnd={cancelDayLongPress}
                    onTouchCancel={cancelDayLongPress}
                    onTouchMove={cancelDayLongPress}
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={() => {
                      if (dayLongPressFired.current) {
                        dayLongPressFired.current = false;
                        return;
                      }
                      setSelectedDay((prev) => (prev === dateStr ? null : dateStr));
                    }}
                    className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all cursor-pointer select-none active:scale-95 ${cellBg} ${
                      isToday ? "ring-2 ring-emerald-500" : ""
                    } ${selectedDay === dateStr ? "ring-2 ring-foreground" : ""}`}
                  >
                    <div className={isToday ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-medium"}>
                      {day}
                    </div>
                    {allDone && !isFuture && (
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓✓</div>
                    )}
                    {!isFuture && doneForDay > 0 && !allDone && (
                      <div className="flex gap-1 flex-wrap justify-center max-w-full">
                        {habitsDoneThatDay.map((h) => (
                          <TaskDot
                            key={h.id}
                            emoji={h.emoji}
                            color={HABIT_COLORS[activeHabitsThisMonth.indexOf(h) % HABIT_COLORS.length]}
                          />
                        ))}
                        {nodesDoneThatDay.map((n) => (
                          <DoneNodeMark key={n.id} />
                        ))}
                        {practicesDoneThatDay.map((p) => (
                          <TaskDot key={p.id} emoji={p.emoji} color={PRACTICE_COLOR} />
                        ))}
                        {manualDoneThatDay.map((t) => (
                          <TaskDot key={t.id} emoji={extractLeadingEmoji(t.title)} color={t.kind === "event" ? EVENT_COLOR : TASK_COLOR} />
                        ))}
                      </div>
                    )}
                    {hasFutureContent && (
                      <div className="flex gap-1 flex-wrap justify-center max-w-full">
                        {nodesScheduledThatDay.map((n) =>
                          n.done ? (
                            <DoneNodeMark key={n.id} />
                          ) : (
                            <TaskDot key={n.id} emoji={extractLeadingEmoji(n.title)} color={NODE_COLOR} />
                          )
                        )}
                        {manualScheduledThatDay.map((t) => (
                          <TaskDot key={t.id} emoji={extractLeadingEmoji(t.title)} color={t.kind === "event" ? EVENT_COLOR : TASK_COLOR} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2.5 min-h-[3rem]">
              {!selectedDay ? (
                <p className="text-xs text-muted-foreground">Tocá un día para ver sus tareas. Mantenelo presionado para agregar una.</p>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {new Date(selectedDay + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    {/* Botón minimalista para abrir la vista completa de tareas de este día
                        (mismas 4 franjas horarias que "Hoy") y poder completar ahí lo que no se
                        marcó, o agregar tareas nuevas. */}
                    <button
                      onClick={() => {
                        setPreviewDate(selectedDay);
                        setViewMode("progress");
                        setSelectedDay(null);
                      }}
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors"
                      title="Ver y completar tareas de este día"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                  {selectedDayList.length > 0 ? (
                    <div className="space-y-1">{selectedDayList}</div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {selectedDayIsFuture ? "Nada agendado ese día." : "Nada completado ese día."}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Pop-up de la estrellita: las prioridades "no negociables" del día. Usa los mismos
        TodayItem y el mismo toggleItemDone que la lista, así que confirmar una tarea acá o en
        "Tareas de hoy" se refleja en los dos lados. */}
    <Dialog open={prioritiesOpen} onOpenChange={setPrioritiesOpen}>
      <DialogContent className="max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto minimal-scrollbar">
        <DialogTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
          {isPreview ? "Prioridades del día" : "Prioridades de hoy"}
        </DialogTitle>
        <p className="text-sm text-muted-foreground -mt-2">
          {prioritiesEditing
            ? `Elegí hasta ${MAX_TODAY_PRIORITIES} tareas no negociables (${priorityItems.length}/${MAX_TODAY_PRIORITIES}).`
            : "Tus no negociables del día."}
        </p>

        {prioritiesEditing ? (
          priorityCandidates.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hay tareas para este día todavía.
            </p>
          ) : (
            <div className="space-y-1">
              {priorityCandidates.map((item) => {
                const selected = priorityKeySet.has(itemBaseKey(item));
                const disabled = !selected && prioritiesFull;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => togglePriority(item)}
                    disabled={disabled}
                    className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors ${
                      selected
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-transparent hover:bg-muted active:bg-muted/60"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <Star
                      className={`h-4 w-4 flex-shrink-0 ${selected ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
                    />
                    <span className={`flex-1 ${item.done ? "text-yellow-600/60" : ""}`}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )
        ) : priorityItems.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Todavía no elegiste prioridades para este día.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              {priorityItems.map((item) => (
                <div
                  key={item.key}
                  className={`h-2 flex-1 rounded-sm transition-colors duration-500 ${item.done ? "bg-amber-500" : "bg-muted"}`}
                />
              ))}
            </div>
            {priorityItems.map((item) => {
              const canToggle = canToggleDone(item);
              return (
                <div
                  key={item.key}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    item.done ? "border-amber-500/40 bg-amber-500/10" : "border-border/40"
                  }`}
                >
                  <span
                    onClick={canToggle ? () => toggleItemDone(item) : undefined}
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      item.done ? "bg-yellow-600/70 border-yellow-600/70" : "border-border/60"
                    } ${canToggle ? "cursor-pointer" : ""}`}
                  >
                    {item.done && <Check className="h-3 w-3 text-yellow-900" strokeWidth={3} />}
                  </span>
                  <span className={`flex-1 ${item.done ? "text-yellow-600 line-through decoration-yellow-600/50" : "font-medium"}`}>
                    {item.label}
                  </span>
                </div>
              );
            })}
            {priorityItems.every((i) => i.done) && (
              <p className="pt-1 text-center text-sm font-semibold text-amber-600 dark:text-amber-400">
                ¡Cumpliste todas tus prioridades! ⭐
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          {prioritiesEditing ? (
            <button
              onClick={() => setPrioritiesEditing(false)}
              className="px-3 py-1.5 text-sm rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              Listo
            </button>
          ) : (
            <button
              onClick={() => setPrioritiesEditing(true)}
              className="px-3 py-1.5 text-sm rounded-md border border-border/40 hover:bg-muted transition-colors"
            >
              {priorityItems.length === 0 ? "Elegir prioridades" : "Editar prioridades"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={!!renameSubTarget} onOpenChange={(o) => { if (!o) setRenameSubTarget(null); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogTitle>{renameSubTarget?.kind === "node" ? "Cambiar nombre del sub-nodo" : "Cambiar nombre del sub-paso"}</DialogTitle>
        <Input
          autoFocus
          value={renameSubTitle}
          onChange={(e) => setRenameSubTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitRenameSub();
          }}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setRenameSubTarget(null)}
            className="px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submitRenameSub}
            disabled={!renameSubTitle.trim()}
            className="px-3 py-1.5 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Guardar
          </button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={!!addSubstepFor} onOpenChange={(o) => { if (!o) setAddSubstepFor(null); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogTitle>{addSubstepFor?.type === "node" ? "Nuevo sub-nodo" : "Nuevo sub-paso"}</DialogTitle>
        <Input
          autoFocus
          value={newSubstepTitle}
          onChange={(e) => setNewSubstepTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNewSubstep();
          }}
          placeholder="¿Cuál es el paso?"
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setAddSubstepFor(null)}
            className="px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submitNewSubstep}
            disabled={!newSubstepTitle.trim()}
            className="px-3 py-1.5 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Agregar
          </button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={addTaskDialogOpen} onOpenChange={setAddTaskDialogOpen}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogTitle>
          {addTaskTargetSlot
            ? `Nueva tarea para ${TIME_SLOTS.find((s) => s.key === addTaskTargetSlot)?.label}`
            : `Nueva tarea para ${isPreview ? "este día" : "hoy"}`}
        </DialogTitle>
        <div className="flex gap-2">
          {(["task", "event"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setNewTaskKind(k)}
              className={`flex-1 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                newTaskKind === k
                  ? "border-transparent text-white"
                  : "border-border/30 bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              style={newTaskKind === k ? { background: k === "event" ? EVENT_COLOR : TASK_COLOR } : undefined}
            >
              {k === "event" ? "Evento" : "Tarea"}
            </button>
          ))}
        </div>
        <Input
          autoFocus
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNewTask();
          }}
          placeholder={newTaskKind === "event" ? "¿Qué evento querés agregar?" : "¿Qué tarea querés agregar?"}
        />
        {(areas.length > 0 || projects.length > 0) && (
          <Select value={newTaskParent || "__none__"} onValueChange={(v) => setNewTaskParent(v === "__none__" ? "" : v)}>
            <SelectTrigger className="border-0 bg-muted/50 focus:ring-0">
              <SelectValue placeholder="Área o quest" />
            </SelectTrigger>
            <SelectContent className="border-0 minimal-scrollbar">
              <SelectItem value="__none__">Sin área ni quest</SelectItem>
              {areas.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Áreas</SelectLabel>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={`area:${a.id}`}>{a.name}</SelectItem>
                  ))}
                </SelectGroup>
              )}
              {projects.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Quests</SelectLabel>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={`project:${p.id}`}>{p.name}</SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setAddTaskDialogOpen(false)}
            className="px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submitNewTask}
            disabled={!newTaskTitle.trim()}
            className="px-3 py-1.5 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Agregar
          </button>
        </div>
        {/* Hábitos que no estaban programados para este día: tocar uno lo suma a las tareas
            del día (en la franja elegida, si el diálogo se abrió desde el título de una). */}
        {habitsAddableForView.length > 0 && (
          <div className="border-t border-border/30 pt-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">O agregá un hábito</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {habitsAddableForView.map((h) => (
                <button
                  key={h.id}
                  onClick={() => addHabitToDay(h.id)}
                  className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-muted active:bg-muted/60 transition-colors"
                >
                  {h.emoji} {h.name}
                  <MinutesSuffix minutes={h.minMinutes} />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={calAddOpen} onOpenChange={setCalAddOpen}>
      <DialogContent className="max-w-sm rounded-2xl max-h-[85vh] overflow-y-auto minimal-scrollbar">
        <DialogTitle>
          {calAddDates.length === 1
            ? `Nueva tarea · ${new Date(calAddDates[0] + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}`
            : `Nueva tarea · ${calAddDates.length} días`}
        </DialogTitle>
        <div className="flex gap-2">
          {(["task", "event"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setCalAddKind(k)}
              className={`flex-1 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                calAddKind === k
                  ? "border-transparent text-white"
                  : "border-border/30 bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              style={calAddKind === k ? { background: k === "event" ? EVENT_COLOR : TASK_COLOR } : undefined}
            >
              {k === "event" ? "Evento" : "Tarea"}
            </button>
          ))}
        </div>
        <Input
          autoFocus
          value={calAddTitle}
          onChange={(e) => setCalAddTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitCalendarAdd();
          }}
          placeholder={calAddKind === "event" ? "¿Qué evento querés agregar?" : "¿Qué tarea querés agregar?"}
        />

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Momento del día</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[{ key: null, label: "Sin asignar" } as { key: TaskSlotKey | null; label: string }, ...TIME_SLOTS].map((s) => (
              <button
                key={s.key ?? "none"}
                type="button"
                onClick={() => setCalAddSlot(s.key)}
                className={`px-2 py-1.5 text-sm rounded-md border transition-colors ${
                  calAddSlot === s.key
                    ? "border-emerald-500 bg-emerald-500/15 text-foreground"
                    : "border-border/30 bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {calAddSlot && (
            <div className="flex gap-1.5">
              {([["start", "Al principio"], ["end", "Al final"]] as const).map(([pos, label]) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setCalAddPosition(pos)}
                  className={`flex-1 px-2 py-1.5 text-sm rounded-md border transition-colors ${
                    calAddPosition === pos
                      ? "border-emerald-500 bg-emerald-500/15 text-foreground"
                      : "border-border/30 bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setCalAddPickerOpen((o) => !o)}
            className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            <span>Días ({calAddDates.length})</span>
            <span className="normal-case font-medium text-emerald-600 dark:text-emerald-400">
              {calAddPickerOpen ? "Listo" : "Seleccionar más días"}
            </span>
          </button>
          {calAddPickerOpen && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setCalAddPickerMonth(new Date(pickerYear, pickerMonth - 1, 1))}
                  className="flex h-7 w-7 items-center justify-center rounded border border-border/30 bg-muted hover:bg-muted/80"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>
                <span className="text-sm font-bold capitalize">{MONTHS[pickerMonth]} {pickerYear}</span>
                <button
                  type="button"
                  onClick={() => setCalAddPickerMonth(new Date(pickerYear, pickerMonth + 1, 1))}
                  className="flex h-7 w-7 items-center justify-center rounded border border-border/30 bg-muted hover:bg-muted/80"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {DAY_LBLS.map((lbl) => (
                  <div key={lbl} className="text-center text-[10px] font-medium text-muted-foreground uppercase">
                    {lbl}
                  </div>
                ))}
                {Array.from({ length: pickerOffset }).map((_, i) => (
                  <div key={`pempty-${i}`} />
                ))}
                {Array.from({ length: pickerDim }).map((_, d) => {
                  const dateStr = `${pickerYear}-${String(pickerMonth + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
                  const selected = calAddDates.includes(dateStr);
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => toggleCalAddDate(dateStr)}
                      className={`aspect-square rounded-md text-xs transition-colors ${
                        selected
                          ? "bg-emerald-500 text-white font-bold"
                          : dateStr === todayStr
                          ? "bg-muted/40 ring-1 ring-emerald-500"
                          : "bg-muted/30 hover:bg-muted/60"
                      }`}
                    >
                      {d + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setCalAddOpen(false)}
            className="px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submitCalendarAdd}
            disabled={!calAddTitle.trim() || calAddDates.length === 0}
            className="px-3 py-1.5 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Agregar
          </button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={!!changeDayItem} onOpenChange={(o) => !o && setChangeDayItem(null)}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogTitle>Cambiar de día</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Se va a mover: <span className="font-medium text-foreground">{changeDayItem?.label}</span>
        </p>
        <Input
          type="date"
          autoFocus
          value={changeDayValue}
          onChange={(e) => setChangeDayValue(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setChangeDayItem(null)}
            className="px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submitChangeDay}
            disabled={!changeDayValue || changeDayValue === effectiveDate}
            className="px-3 py-1.5 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Mover
          </button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={timeItem !== null || timeSubstepId !== null} onOpenChange={(o) => { if (!o) { setTimeItem(null); setTimeSubstepId(null); } }}>
      <DialogContent className="max-w-xs rounded-2xl">
        <DialogTitle>Asignar tiempo</DialogTitle>
        <div className="flex flex-col gap-3">
          {timeItem && (timeItem.type === "habit" || timeItem.type === "practice") && (
            <p className="text-xs text-muted-foreground">
              Se guarda en {timeItem.type === "habit" ? "el hábito" : "la práctica"}: aplica a todos los días.
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {[5, 10, 15, 30, 45, 60, 90].map((m) => (
              <button
                key={m}
                onClick={() => submitTime(String(m))}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  timeValue === String(m)
                    ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "border-border/50 hover:bg-muted"
                }`}
              >
                {m}min
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="Minutos"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitTime(); }}
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        </div>
        <div className="flex justify-between gap-2 pt-1">
          <button
            onClick={() => submitTime("")}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Quitar tiempo
          </button>
          <button
            onClick={() => submitTime()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Guardar
          </button>
        </div>
      </DialogContent>
    </Dialog>

    <MealTrackerModal
      open={mealPopupId !== null}
      onOpenChange={(o) => { if (!o) setMealPopupId(null); }}
      initialMealId={mealPopupId}
      initialDate={effectiveDate}
    />
    </>
  );
}

// Fila anidada adentro de una tarea: un sub-nodo de un nodo, o un sub-paso de una tarea que no
// es nodo. `current` le da el mismo destacado dorado que la tarea desbloqueada. Tocar el círculo
// la confirma; tocar el nombre abre su menú (subir/bajar, cambiar nombre, eliminar).
function TodaySubRow({
  title,
  done,
  current,
  dimmed,
  onToggleDone,
  onMoveUp,
  onMoveDown,
  onRename,
  onAssignTime,
  minutes,
  onDelete,
  deleteLabel = "sub-paso",
}: {
  title: string;
  done?: boolean;
  current?: boolean;
  dimmed?: boolean;
  onToggleDone?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRename?: () => void;
  // Abre el diálogo de tiempo estimado (sub-nodo: su plannedDuration; sub-paso: sus minutos del día).
  onAssignTime?: () => void;
  minutes?: number | null;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const hasMenu = !!(onMoveUp || onMoveDown || onRename || onAssignTime || onDelete);
  const titleNode = (
    <span
      className={`flex-1 ${hasMenu ? "cursor-pointer" : ""} ${done ? "text-yellow-600/60" : ""} ${
        current ? "text-[15px] font-semibold leading-snug" : ""
      }`}
    >
      {title}
      <MinutesSuffix minutes={minutes} />
    </span>
  );
  return (
    <>
      <div className={`ml-5 border-l-2 pl-3 transition-opacity ${current ? "border-amber-500/40" : "border-border/40"} ${dimmed ? "opacity-25" : ""}`}>
        <div
          className={`flex items-center gap-2 text-sm ${
            current
              ? "my-1.5 rounded-xl border-2 border-amber-500/80 bg-amber-500/10 px-3 py-2.5 shadow-[0_0_18px_-3px_rgba(245,158,11,0.65)]"
              : "py-0.5"
          }`}
        >
          <span
            onClick={onToggleDone}
            className={`flex flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
              done
                ? "h-3.5 w-3.5 bg-yellow-600/70 border-yellow-600/70"
                : current
                ? "h-5 w-5 border-amber-500 bg-amber-500/10"
                : "h-3.5 w-3.5 border-border/50"
            } ${onToggleDone ? "cursor-pointer" : ""}`}
          >
            {done && <Check className="h-2 w-2 text-yellow-900" strokeWidth={3} />}
          </span>
          {hasMenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>{titleNode}</DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onAssignTime && (
                  <>
                    <DropdownMenuItem onClick={onAssignTime}>
                      <Clock className="mr-2 h-4 w-4" />
                      Asignar tiempo
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {onMoveUp && <DropdownMenuItem onClick={onMoveUp}>Mover arriba</DropdownMenuItem>}
                {onMoveDown && <DropdownMenuItem onClick={onMoveDown}>Mover abajo</DropdownMenuItem>}
                {(onMoveUp || onMoveDown) && (onRename || onDelete) && <DropdownMenuSeparator />}
                {onRename && (
                  <DropdownMenuItem onClick={onRename}>Cambiar nombre</DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem onClick={() => setDeleteConfirmOpen(true)} className="text-destructive focus:text-destructive">
                    Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            titleNode
          )}
        </div>
      </div>

      {onDelete && (
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este {deleteLabel}?</AlertDialogTitle>
              <AlertDialogDescription>Se va a borrar. No se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

function TodayTaskRow({
  item,
  dimmed,
  current,
  pastDay,
  onMove,
  onClear,
  onHide,
  onDelete,
  onDuplicate,
  onToggleDone,
  onChangeDay,
  onMoveUp,
  onMoveDown,
  priority,
  priorityFull,
  onTogglePriority,
  onAssignTime,
  onAddSubstep,
}: {
  item: TodayItem;
  // Tarea que no es "la que sigue" (la primera pendiente de la franja horaria actual): se
  // muestra más tenue (solo opacidad, sin cambiar su color), esté hecha o pendiente, para que
  // la única que resalte sea la desbloqueada.
  dimmed?: boolean;
  // La tarea "desbloqueada" ahora mismo: la primera pendiente de la franja horaria actual.
  // Se pinta como una tarjeta dorada con brillo, para que quede claro que es LA tarea del
  // momento y el resto puede esperar.
  current?: boolean;
  // Se está viendo un día ya pasado (no hoy, no una previsualización futura): ahí una tarea
  // hecha se pinta en dorado pleno en vez de atenuado, porque no compite con nada pendiente.
  pastDay?: boolean;
  onMove: (slot: TaskSlotKey) => void;
  onClear?: () => void;
  onHide?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleDone?: () => void;
  // Abre el diálogo para mover esta tarea a otro día. undefined cuando el tipo/estado de la
  // tarea no tiene "de qué día" moverse (ver canChangeDay en el padre).
  onChangeDay?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  // Es una de las (hasta 3) prioridades del día: se destaca con una estrellita al lado.
  priority?: boolean;
  // Ya hay 3 prioridades elegidas: no se puede marcar otra sin sacar alguna antes.
  priorityFull?: boolean;
  onTogglePriority?: () => void;
  // Abre el diálogo para asignarle un tiempo estimado (minutos). undefined para los tipos que
  // no tienen dónde guardarlo (rewirings).
  onAssignTime?: () => void;
  // Abre el diálogo para agregarle un sub-paso (o un sub-nodo de su sub-árbol, si es un nodo).
  onAddSubstep?: () => void;
}) {
  const [hideConfirmOpen, setHideConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = React.useRef(false);

  // Mantener presionada la tarea abre el diálogo para cambiar su día (mover a otra fecha),
  // cuando aplica. Mismo timing (1500ms) que el long-press de SkillNode. "Sacar de
  // hoy"/"Eliminar" quedan en el menú de un click, no en el long-press.
  const canLongPress = !!onChangeDay;

  const startLongPress = (e: React.MouseEvent | React.TouchEvent) => {
    // No debe burbujear al fondo (que tiene su propio long-press para agregar una tarea).
    e.stopPropagation();
    if (!canLongPress) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onChangeDay?.();
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <>
      <div
        className={`flex items-center gap-2 text-sm touch-none select-none transition-opacity ${
          dimmed ? "opacity-25" : ""
        } ${
          current
            ? "my-1.5 rounded-xl border-2 border-amber-500/80 bg-amber-500/10 px-3 py-2.5 shadow-[0_0_18px_-3px_rgba(245,158,11,0.65)]"
            : ""
        }`}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
      >
        <span
          onClick={onToggleDone}
          className={`flex flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            item.done
              ? "h-3.5 w-3.5 bg-yellow-600/70 border-yellow-600/70"
              : current
              ? "h-5 w-5 border-amber-500 bg-amber-500/10"
              : "h-4 w-4 border-border/50"
          } ${onToggleDone ? "cursor-pointer" : ""}`}
        >
          {item.done && <Check className="h-2.5 w-2.5 text-yellow-900" strokeWidth={3} />}
        </span>
        {/* Mismo punto que el nodo/tarea/evento tiene en el calendario de actividades — su
            emoji si tiene uno (NODE_COLOR/TASK_COLOR/EVENT_COLOR si no) — para que la lista de
            "Hoy" y la "Vista previa" de un día futuro se vean consistentes con lo que ya se ve ahí.
            Sin emoji, un nodo ya no muestra el punto de color de respaldo (quedaba redundante
            con el círculo de "hecho", que también es dorado) — tarea/evento sí lo conservan. */}
        {item.dotColor && (item.dotEmoji || item.dotColor !== NODE_COLOR) && (
          <TaskDot emoji={item.dotEmoji} color={item.dotColor} size="md" />
        )}
        {/* Apretar una vez sobre la tarea abre el menú (franja / mover / quitar), en vez de
            un botón de reloj aparte — menos elementos visuales en la fila. */}
        <DropdownMenu
          open={menuOpen}
          onOpenChange={(next) => {
            if (next && isLongPress.current) return;
            setMenuOpen(next);
          }}
        >
          <DropdownMenuTrigger asChild>
            <span
              className={`flex-1 cursor-pointer ${item.done ? (pastDay ? "text-yellow-600 font-medium" : "text-yellow-600/60") : ""} ${
                current ? "text-[15px] font-semibold leading-snug" : ""
              }`}
            >
              {item.label}
              {priority && (
                <Star className="ml-1 inline h-3.5 w-3.5 -translate-y-px fill-amber-400 text-amber-500" aria-label="Prioridad" />
              )}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-[min(60vh,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto overscroll-contain minimal-scrollbar"
          >
            {onAssignTime && (
              <>
                <DropdownMenuItem onClick={onAssignTime}>
                  <Clock className="mr-2 h-4 w-4" />
                  Asignar tiempo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {onTogglePriority && (
              <>
                <DropdownMenuItem onClick={onTogglePriority} disabled={!priority && priorityFull}>
                  <Star className={`mr-2 h-4 w-4 ${priority ? "fill-amber-400 text-amber-500" : ""}`} />
                  {priority ? "Quitar de prioridades" : priorityFull ? "Prioridades completas (3/3)" : "Marcar como prioridad"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {onAddSubstep && (
              <>
                <DropdownMenuItem onClick={onAddSubstep}>
                  <Plus className="mr-2 h-4 w-4" />
                  {item.type === "node" ? "Agregar sub-nodo" : "Agregar sub-paso"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {TIME_SLOTS.map((s) => (
              <DropdownMenuItem key={s.key} onClick={() => onMove(s.key)}>
                {s.label}
              </DropdownMenuItem>
            ))}
            {onClear && (
              <DropdownMenuItem onClick={onClear}>Sin asignar</DropdownMenuItem>
            )}
            {(onMoveUp || onMoveDown) && <DropdownMenuSeparator />}
            {onMoveUp && <DropdownMenuItem onClick={onMoveUp}>Mover arriba</DropdownMenuItem>}
            {onMoveDown && <DropdownMenuItem onClick={onMoveDown}>Mover abajo</DropdownMenuItem>}
            {onDuplicate && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDuplicate}>Duplicar</DropdownMenuItem>
              </>
            )}
            {onChangeDay && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onChangeDay}>Cambiar de día</DropdownMenuItem>
              </>
            )}
            {(onHide || onDelete) && <DropdownMenuSeparator />}
            {onHide && (
              <DropdownMenuItem onClick={() => setHideConfirmOpen(true)} className="text-destructive focus:text-destructive">
                Sacar de hoy
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem onClick={() => setDeleteConfirmOpen(true)} className="text-destructive focus:text-destructive">
                Eliminar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {onHide && (
        <AlertDialog open={hideConfirmOpen} onOpenChange={setHideConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Sacar esta tarea de hoy?</AlertDialogTitle>
              <AlertDialogDescription>
                {item.type === "node"
                  ? "Se le va a borrar la fecha planeada: va a quedar sin fecha asignada en el árbol."
                  : "Dejará de aparecer en tareas de hoy."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onHide}>Sacar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {onDelete && (
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar esta tarea?</AlertDialogTitle>
              <AlertDialogDescription>
                Se va a borrar. No se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
