import React, { useEffect, useRef, useState } from "react";
import { isHabitScheduledOn } from "@shared/habitSchedule";
import { useQuery, useQueries, useQueryClient, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Pencil, Plus, Star } from "lucide-react";
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
import { addSubSkillFromToday, toggleSubSkillFromToday, masterWholeSubSkillTree, isSubSkillPlaceholder, moveSubSkillFromToday, renameSubSkill, deleteSubSkillFromToday, fetchSubSkills } from "@/lib/subskill-tree";
import { useTodayTaskSubsteps, useCreateTodayTaskSubstep, useUpdateTodayTaskSubstep, useDeleteTodayTaskSubstep, useCreateHabitSubstep, syncHabitSubsteps, type SubstepTaskType } from "@/lib/useTodayTaskSubsteps";
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
  // Registro de un día pasado: nodo padre que ese día tenía sub-nodos confirmados pero después
  // se pasó a otro día. Se muestra solo como texto (sin confirmar ni menú), con esos sub-nodos.
  traceSubs?: { id: string; title: string }[];
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

// "el martes" si fue en los 6 días anteriores a refDateStr, si no "el dd/mm".
const WEEKDAY_NAMES_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
function formatConfirmedDay(dateStr: string, refDateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const ref = new Date(refDateStr + "T12:00:00");
  const diffDays = Math.round((ref.getTime() - date.getTime()) / 86_400_000);
  if (diffDays >= 1 && diffDays <= 6) return `el ${WEEKDAY_NAMES_ES[date.getDay()]}`;
  return `el ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
  // Hora límite con la que se calcularon esos minutos (ver formatDeadline).
  plannedDeadline?: string | null;
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
// Los tiempos que se calculan solos (reparto del tiempo del padre entre sus hijos) se redondean
// siempre para arriba al múltiplo de 5: 11-14 → 15, 16-19 → 20.
function roundUpTo5(minutes: number): number {
  return Math.ceil(minutes / 5) * 5;
}

// Suma del tiempo propio de los hijos (sub-nodos o sub-pasos) de una tarea: es el tiempo que se
// le muestra a la tarea cuando no tiene uno propio. null si ningún hijo tiene tiempo.
function sumChildMinutes(childMinutes: (number | null | undefined)[]): number | null {
  const sum = childMinutes.reduce<number>((acc, m) => acc + (m && m > 0 ? m : 0), 0);
  return sum > 0 ? sum : null;
}

// "HH:MM" → "5pm" / "5:30pm" (como se escribe la hora límite junto al tiempo de una tarea).
function formatDeadline(deadline: string): string {
  const [h, m] = deadline.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour12}:${String(m).padStart(2, "0")}${suffix}` : `${hour12}${suffix}`;
}

// Minutos que faltan desde ahora hasta la hora límite de hoy ("HH:MM"). null si ya pasó.
function minutesUntilDeadline(deadline: string): number | null {
  const [h, m] = deadline.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const diff = Math.round((target.getTime() - Date.now()) / 60_000);
  return diff > 0 ? diff : null;
}

function MinutesSuffix({ minutes, deadline }: { minutes?: number | null; deadline?: string | null }) {
  if (!minutes) return null;
  return (
    <span className="text-muted-foreground">
      {" "}· {minutes}min{deadline ? ` (hasta ${formatDeadline(deadline)})` : ""}
    </span>
  );
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
  // Tiempo estimado elegido al crear la tarea ("" = sin tiempo).
  const [newTaskMinutes, setNewTaskMinutes] = useState("");
  // Hora límite al crear la tarea ("HH:MM", "" = ninguna): calcula newTaskMinutes desde ahora.
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  // Secciones desplegables del diálogo (cerradas por defecto): área/quest y agregar un hábito.
  const [newTaskParentOpen, setNewTaskParentOpen] = useState(false);
  const [newTaskHabitsOpen, setNewTaskHabitsOpen] = useState(false);
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
    return isHabitScheduledOn(h, effectiveDate);
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
            plannedDeadline: skill.plannedDeadline,
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
      return res.json() as Promise<{ id: string; title: string; status: string; plannedDate: string | null; plannedDuration: number | null; plannedDeadline: string | null; completedAt: string | null; parentName: string; parentSkillId: string; parentPlannedDate: string | null }[]>;
    },
    enabled: open,
    // Los sub-nodos se editan desde el sub-árbol sin invalidar esta consulta: se refresca
    // cada vez que se abre el modal.
    staleTime: 0,
    refetchOnMount: "always",
  });
  const datedSubSkills = datedSubSkillsData || [];

  // Registro de un día pasado: sub-nodos confirmados ese día cuyo nodo padre se pasó a otro día
  // (tiene fecha planeada, pero no es este día). En vez de verse sueltos como actividad extra, se
  // agrupan bajo su nodo padre, que queda solo como texto (ver traceSubs en TodayItem).
  const traceSubSkills = datedSubSkills.filter(
    (s) =>
      s.status === "mastered" &&
      !!s.completedAt &&
      !s.plannedDate &&
      getDateStr(new Date(s.completedAt)) === effectiveDate &&
      !!s.parentPlannedDate &&
      s.parentPlannedDate !== effectiveDate
  );
  const traceSubSkillIds = new Set(traceSubSkills.map((s) => s.id));
  const traceParents = new Map<string, { title: string; subs: { id: string; title: string }[]; firstAt: number }>();
  traceSubSkills.forEach((s) => {
    const at = new Date(s.completedAt!).getTime();
    const entry = traceParents.get(s.parentSkillId) ?? { title: s.parentName || "Sin nombre", subs: [], firstAt: at };
    entry.subs.push({ id: s.id, title: s.title || "Sin nombre" });
    entry.firstAt = Math.min(entry.firstAt, at);
    traceParents.set(s.parentSkillId, entry);
  });

  const plannedSubNodes: PlannedNode[] = datedSubSkills
    .filter((s) => !!s.plannedDate)
    .map((s) => ({
      id: s.id,
      title: s.title || "Sin nombre",
      parentName: s.parentName,
      plannedDate: s.plannedDate!,
      done: s.status === "mastered",
      plannedDuration: s.plannedDuration,
      plannedDeadline: s.plannedDeadline,
      kind: "sub",
    }));

  const allPlannedNodes = [
    ...collectPlannedNodes(Array.isArray(areas) ? areas : [], "area"),
    ...collectPlannedNodes(Array.isArray(projects) ? projects : [], "project"),
    ...plannedSubNodes,
  ];

  const patchSubSkill = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { plannedDate?: string | null; plannedDuration?: number | null; plannedDurationManual?: 0 | 1; plannedDeadline?: string | null; status?: string } }) => {
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
  const extraTopNodes = [
    ...collectExtraCompletedNodes(Array.isArray(areas) ? areas : [], effectiveDate, effectiveDate),
    ...collectExtraCompletedNodes(Array.isArray(projects) ? projects : [], effectiveDate, effectiveDate),
  ];
  // Un sub-nodo confirmado cuyo nodo padre ya está en la lista del día (planeado para hoy, actividad
  // extra o el padre que queda como texto en un día pasado) se ve adentro del padre (lista de
  // sub-nodos / desplegable): no se lo muestra además suelto como actividad extra.
  const nodeIdsShownInDay = new Set<string>([
    ...plannedNodesForView.map((n) => n.id),
    ...extraTopNodes.map((n) => n.id),
    ...Array.from(traceParents.keys()),
  ]);
  const parentIdBySubSkillId = new Map(datedSubSkills.map((s) => [s.id, s.parentSkillId]));
  const extraNodes = [
    ...extraTopNodes,
    ...collectExtraCompletedSubNodes(effectiveDate, effectiveDate).filter(
      (n) => !traceSubSkillIds.has(n.id) && !nodeIdsShownInDay.has(parentIdBySubSkillId.get(n.id) ?? "")
    ),
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
    // done: true para que nunca cuente como "la tarea desbloqueada" (no se puede confirmar acá).
    ...Array.from(traceParents.entries()).map(([parentId, t]) => ({
      key: `trace:${parentId}`,
      type: "node" as const,
      id: parentId,
      label: stripLeadingEmoji(t.title),
      done: true,
      dotColor: NODE_COLOR,
      dotEmoji: extractLeadingEmoji(t.title),
      defaultSlot: getTimeSlotKeyForDate(new Date(t.firstAt)),
      traceSubs: t.subs,
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
  // Actividad extra (nodos confirmados sin fecha para este día) que se sacó de hoy a mano: ya
  // estaba hecha cuando se la sacó, así que no vuelve a aparecer (ver hideItemFromToday).
  const isHiddenExtraNode = (i: TodayItem) => i.type === "node" && !i.traceSubs && isHidden(i.key);
  const visibleExtraItems = extraItems.filter((i) => !isHiddenExtraNode(i));

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
  const total = totalConfigured + visibleExtraItems.length;
  const completed = completedHabits + completedNodes + completedPractices + completedManual + visibleExtraItems.length;
  const todayItems: TodayItem[] = [
    ...visibleHabitItems.map((h) => ({ key: `habit:${h.id}`, type: "habit" as const, id: h.id, label: h.label, done: h.done })),
    ...visiblePlannedNodesForView.map((n) => ({
      key: `node:${n.id}`,
      type: "node" as const,
      id: n.id,
      label: (
        <>
          {stripLeadingEmoji(n.title)} <span className="text-muted-foreground">· {n.parentName}</span>
          <MinutesSuffix minutes={n.plannedDuration} deadline={n.plannedDeadline} />
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
          <MinutesSuffix minutes={t.minutes} deadline={t.deadline} />
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
  visibleExtraItems.forEach((item) => distributeItem(item, "more"));

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

  // Los nodos confirmados siempre van antes de la tarea desbloqueada (la primera sin hacer de la
  // franja activa): los que hayan quedado después de ella (confirmados desde el árbol, o antes de
  // que les tocara) se muestran justo antes, en el mismo orden relativo. Es una regla de cómo se
  // muestra la franja, así vale sin importar desde dónde se confirmó el nodo. Misma noción de
  // "franja activa" que el destacado: la de la hora actual, o cualquiera con algo en una vista previa.
  TIME_SLOTS.forEach((s) => {
    const bucket = itemBuckets[s.key];
    const isActiveSlot = isPreview ? bucket.length > 0 : s.key === getCurrentTimeSlotKey();
    if (!isActiveSlot) return;
    const firstUndone = bucket.findIndex((i) => !i.done);
    if (firstUndone === -1) return;
    const isConfirmedNode = (i: TodayItem) => i.type === "node" && i.done && !i.traceSubs;
    const lifted = bucket.slice(firstUndone + 1).filter(isConfirmedNode);
    if (lifted.length === 0) return;
    itemBuckets[s.key] = [
      ...bucket.slice(0, firstUndone),
      ...lifted,
      ...bucket.slice(firstUndone).filter((i) => !lifted.includes(i)),
    ];
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
        if (i.traceSubs) return false;
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
  // Nodos de hoy sin confirmar, más los padres que en el registro de un día pasado quedan solo
  // como texto (ver traceSubs): sus sub-nodos confirmados ese día se muestran como sub-nodos normales.
  // Los nodos ya confirmados también: si tienen sub-nodos, se pueden desplegar (ver expandedParents).
  const subTreeNodeIds = Array.from(new Set([
    ...todayItems.filter((i) => i.type === "node").map((i) => i.id),
    ...visibleExtraItems.filter((i) => i.type === "node" && !i.traceSubs).map((i) => i.id),
    ...Array.from(traceParents.keys()),
  ]));
  const subSkillQueries = useQueries({
    queries: subTreeNodeIds.map((id) => ({
      queryKey: ["node-subskills", id],
      queryFn: async () => {
        // withChildren=1: también los sub-nodos de cada sub-nodo, que se muestran anidados adentro
        // de él (en el árbol son su propio sub-árbol: no aparecen en el sub-árbol del nodo).
        const res = await fetch(`/api/skills/${id}/subskills?withChildren=1`);
        if (!res.ok) throw new Error("Failed to fetch sub-skills");
        return res.json() as Promise<Skill[]>;
      },
      enabled: open,
      staleTime: 0,
    })),
  });
  const bySubTreeOrder = (a: Skill, b: Skill) => (a.level - b.level) || ((a.levelPosition || 0) - (b.levelPosition || 0));
  const isRealSubNode = (sub: Skill) => (sub.levelPosition || 0) > 1 && !isSubSkillPlaceholder(sub);
  const subSkillsByNodeId = new Map<string, Skill[]>();
  // Sub-nodos de cada sub-nodo (por id del sub-nodo).
  const childSubSkillsBySubId = new Map<string, Skill[]>();
  subTreeNodeIds.forEach((id, idx) => {
    const rows = subSkillQueries[idx]?.data || [];
    subSkillsByNodeId.set(id, rows.filter((sub) => sub.parentSkillId === id && isRealSubNode(sub)).sort(bySubTreeOrder));
    rows
      .filter((sub) => sub.parentSkillId && sub.parentSkillId !== id)
      .forEach((sub) => {
        const list = childSubSkillsBySubId.get(sub.parentSkillId!) ?? [];
        list.push(sub);
        childSubSkillsBySubId.set(sub.parentSkillId!, list);
      });
  });
  childSubSkillsBySubId.forEach((list, key) => childSubSkillsBySubId.set(key, list.filter(isRealSubNode).sort(bySubTreeOrder)));
  const childSubNodesOf = (sub: Skill) => childSubSkillsBySubId.get(sub.id) || [];
  const hasPendingChildSubNodes = (sub: Skill) => childSubNodesOf(sub).some((c) => c.status !== "mastered");
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
      // Prefijo: incluye la lista del nodo de arriba cuando parentId es un sub-nodo.
      queryClient.invalidateQueries({ queryKey: ["node-subskills"] });
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
      // Prefijo: incluye la lista del nodo de arriba cuando parentId es un sub-nodo.
      queryClient.invalidateQueries({ queryKey: ["node-subskills"] });
      queryClient.invalidateQueries({ queryKey: ["dated-sub-skills"] });
      setSubNodeBusy(false);
    }
  };
  // onlyIds: mostrar solo esos sub-nodos (registro de un día pasado), pero con el mismo
  // comportamiento que en la lista completa (destildar el último confirmado, menú, etc.).
  const renderSubNodes = (item: TodayItem, parentIsCurrent: boolean, onlyIds?: Set<string>) => {
    const subs = subNodesFor(item);
    if (subs.length === 0) return null;
    // Nodo padre ya confirmado (con todo su sub-árbol): los sub-nodos quedan en una lista
    // desplegable, cerrada por defecto, y no se pueden destildar, mover ni borrar (el padre
    // confirmado exige el sub-árbol completo). El registro de un día pasado (traceSubs) no aplica:
    // ahí el padre todavía no se confirmó.
    const parentConfirmed = item.done && !item.traceSubs;
    if (parentConfirmed && !expandedParents.has(item.key)) return null;
    const firstUndone = subs.findIndex((sub) => sub.status !== "mastered");
    const lastDone = firstUndone === -1 ? subs.length - 1 : firstUndone - 1;

    // Sub-nodo confirmado otro día (p.ej. el padre se pasó del martes al miércoles): queda como
    // texto, marcado con el día en que se confirmó, sin confirmar/desconfirmar ni menú.
    const confirmedOtherDay = (sub: Skill) => {
      const day = sub.status === "mastered" && sub.completedAt ? getDateStr(new Date(sub.completedAt)) : null;
      return day && day !== effectiveDate ? day : null;
    };
    const renderOtherDayRow = (sub: Skill, day: string, depth: number) => (
      <TodaySubRow
        key={sub.id}
        title={`${stripLeadingEmoji(sub.title || "Sin nombre")} · confirmado ${formatConfirmedDay(day, effectiveDate)}`}
        done
        dimmed
        depth={depth}
      />
    );

    // Sub-nodos de un sub-nodo: anidados adentro de él, en orden. Un sub-nodo con sub-nodos
    // pendientes no se puede confirmar (igual que el nodo padre con los suyos); el destacado pasa
    // a su primer sub-nodo sin confirmar. No llevan tiempo ni sus propios sub-nodos.
    const renderChildren = (sub: Skill, subIsCurrent: boolean) => {
      const kids = childSubNodesOf(sub);
      const kidFirstUndone = kids.findIndex((k) => k.status !== "mastered");
      const kidLastDone = kidFirstUndone === -1 ? kids.length - 1 : kidFirstUndone - 1;
      return kids.map((kid, k) => {
        const day = confirmedOtherDay(kid);
        if (day) return renderOtherDayRow(kid, day, 1);
        const kidIsCurrent = subIsCurrent && k === kidFirstUndone;
        return (
          <TodaySubRow
            key={kid.id}
            depth={1}
            title={stripLeadingEmoji(kid.title || "Sin nombre")}
            done={kid.status === "mastered"}
            current={kidIsCurrent}
            dimmed={!kidIsCurrent}
            onToggleDone={
              !parentConfirmed && sub.status === "available" && (k === kidFirstUndone || k === kidLastDone)
                ? () => toggleSubNode(sub.id, kid)
                : undefined
            }
            onMoveUp={!parentConfirmed && kids[k - 1] ? () => runSubNodeOp(item.id, () => moveSubSkillFromToday(kid, kids[k - 1])) : undefined}
            onMoveDown={!parentConfirmed && kids[k + 1] ? () => runSubNodeOp(item.id, () => moveSubSkillFromToday(kid, kids[k + 1])) : undefined}
            onRename={() => {
              setRenameSubTitle(kid.title || "");
              setRenameSubTarget({ kind: "node", id: kid.id, parentId: item.id });
            }}
            onDelete={parentConfirmed ? undefined : () => runSubNodeOp(item.id, () => deleteSubSkillFromToday(sub.id, kid))}
            deleteLabel="sub-nodo"
          />
        );
      });
    };

    return subs.map((sub, i) => {
      if (onlyIds && !onlyIds.has(sub.id)) return null;
      const prev = subs[i - 1];
      const next = subs[i + 1];
      const day = confirmedOtherDay(sub);
      const pendingKids = hasPendingChildSubNodes(sub);
      const isCurrentSub = parentIsCurrent && i === firstUndone;
      return (
        <React.Fragment key={sub.id}>
          {day ? (
            renderOtherDayRow(sub, day, 0)
          ) : (
            <TodaySubRow
              title={stripLeadingEmoji(sub.title || "Sin nombre")}
              done={sub.status === "mastered"}
              current={isCurrentSub && !pendingKids}
              dimmed={!(isCurrentSub && !pendingKids)}
              onToggleDone={
                !parentConfirmed && !pendingKids && (i === firstUndone || i === lastDone)
                  ? () => toggleSubNode(item.id, sub)
                  : undefined
              }
              // Mover un sub-nodo mueve también sus sub-nodos (son su propio sub-árbol).
              onMoveUp={!parentConfirmed && prev && prev.level === sub.level ? () => runSubNodeOp(item.id, () => moveSubSkillFromToday(sub, prev)) : undefined}
              onMoveDown={!parentConfirmed && next && next.level === sub.level ? () => runSubNodeOp(item.id, () => moveSubSkillFromToday(sub, next)) : undefined}
              onAddChild={
                !parentConfirmed && sub.status !== "mastered"
                  ? () => {
                      setNewNestedTitle("");
                      setAddNestedTarget({ parentId: item.id, sub });
                    }
                  : undefined
              }
              onRename={() => {
                setRenameSubTitle(sub.title || "");
                setRenameSubTarget({ kind: "node", id: sub.id, parentId: item.id });
              }}
              minutes={sub.plannedDuration}
              deadline={sub.plannedDeadline}
              onAssignTime={() =>
                openTimeDialog(
                  { key: `node:${sub.id}`, type: "node", id: sub.id, label: sub.title, done: sub.status === "mastered" },
                  parentTimeRef(item, subs.map((x) => x.plannedDuration), i)
                )
              }
              // Eliminar un sub-nodo borra también sus sub-nodos (ver deleteSubSkillFromToday).
              onDelete={parentConfirmed ? undefined : () => runSubNodeOp(item.id, () => deleteSubSkillFromToday(item.id, sub))}
              deleteLabel="sub-nodo"
            />
          )}
          {renderChildren(sub, isCurrentSub)}
        </React.Fragment>
      );
    });
  };

  // Nodo padre en el registro de un día pasado (ver traceSubs): solo texto, con los sub-nodos que
  // se confirmaron ese día debajo, también solo como texto.
  // Nodos padre confirmados cuya lista de sub-nodos está desplegada (por key de la fila).
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const expandProps = (item: TodayItem) => {
    if (item.type !== "node" || !item.done || item.traceSubs || subNodesFor(item).length === 0) return {};
    return {
      expanded: expandedParents.has(item.key),
      onToggleExpand: () =>
        setExpandedParents((prev) => {
          const next = new Set(prev);
          if (next.has(item.key)) next.delete(item.key);
          else next.add(item.key);
          return next;
        }),
    };
  };

  // Solo el padre queda como texto (se va a confirmar otro día); sus sub-nodos confirmados ese
  // día se ven como sub-nodos normales. Mientras carga su sub-árbol, se muestran sin acciones.
  // Igual que un padre confirmado, sus sub-nodos van en una lista desplegable (cerrada por defecto).
  const renderTraceRow = (item: TodayItem) => {
    const loaded = subNodesFor(item).length > 0;
    const expanded = expandedParents.has(item.key);
    const toggleExpanded = () =>
      setExpandedParents((prev) => {
        const next = new Set(prev);
        if (next.has(item.key)) next.delete(item.key);
        else next.add(item.key);
        return next;
      });
    return (
      <React.Fragment key={item.key}>
        <div className="flex items-center gap-2 text-sm">
          {item.dotEmoji && (
            <span className="opacity-60">
              <TaskDot emoji={item.dotEmoji} color={item.dotColor || NODE_COLOR} size="md" />
            </span>
          )}
          <span className="flex-1 opacity-60">{item.label}</span>
          <button
            type="button"
            onClick={toggleExpanded}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            aria-label={expanded ? "Ocultar sub-nodos" : "Ver sub-nodos"}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
        {expanded &&
          (loaded
            ? renderSubNodes(item, false, new Set((item.traceSubs || []).map((sub) => sub.id)))
            : (item.traceSubs || []).map((sub) => <TodaySubRow key={sub.id} title={stripLeadingEmoji(sub.title)} done dimmed />))}
      </React.Fragment>
    );
  };

  // Diálogo para agregarle un sub-nodo a un sub-nodo (se muestra anidado adentro de él).
  const [addNestedTarget, setAddNestedTarget] = useState<{ parentId: string; sub: Skill } | null>(null);
  const [newNestedTitle, setNewNestedTitle] = useState("");
  const submitNewNested = () => {
    const title = newNestedTitle.trim();
    const target = addNestedTarget;
    if (!title || !target) return;
    setAddNestedTarget(null);
    runSubNodeOp(target.parentId, async () => {
      // Sub-nodo real del sub-nodo (su propio sub-árbol: se crea si no existe).
      await addSubSkillFromToday(target.sub.id, title);
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
  // Hábitos: el sub-paso puede ser solo de este día o permanente (se repite todos los días que el
  // hábito aparece en Tareas de hoy).
  const [newSubstepPermanent, setNewSubstepPermanent] = useState(false);
  const createHabitSubstep = useCreateHabitSubstep();
  const openAddSubstepDialog = (item: TodayItem) => {
    setNewSubstepTitle("");
    setNewSubstepPermanent(false);
    setAddSubstepFor(item);
  };

  // Sub-pasos permanentes de los hábitos del día: al ver hoy, se crean las copias que falten (sin
  // confirmar). Solo hoy: un día futuro las recibe cuando llega, con la plantilla ya actualizada.
  const habitIdsForSync = Array.from(new Set(todayItems.filter((i) => i.type === "habit").map((i) => i.id))).sort().join(",");
  useEffect(() => {
    if (!open || isPreview || effectiveDate !== todayStr || !habitIdsForSync) return;
    let cancelled = false;
    syncHabitSubsteps(effectiveDate, habitIdsForSync.split(","))
      .then((created) => {
        if (!cancelled && created > 0) queryClient.invalidateQueries({ queryKey: ["today-task-substeps", effectiveDate] });
      })
      .catch((error) => console.error("Error sincronizando sub-pasos de hábitos:", error));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isPreview, effectiveDate, todayStr, habitIdsForSync]);
  const submitNewSubstep = async () => {
    const title = newSubstepTitle.trim();
    if (!title || !addSubstepFor) return;
    const target = addSubstepFor;
    setAddSubstepFor(null);
    // Si la tarea tiene tiempo propio, al sumarse un hijo:
    // 1. Si queda tiempo libre (el del padre menos lo que ya tienen todos los demás hijos), el
    //    nuevo se lleva ese resto y los demás no cambian.
    // 2. Si no queda libre, el tiempo del padre (descontando lo de los confirmados) se vuelve a
    //    repartir en partes iguales entre los pendientes, el nuevo incluido.
    // 3. Si los confirmados ya ocupan todo, el nuevo entra sin tiempo: lo que se le asigne después
    //    supera el máximo disponible y, al aceptar el aviso, se le suma a la tarea padre.
    const parentMinutes = currentMinutes(target);
    const sumMinutes = (list: (number | null | undefined)[]) =>
      list.reduce<number>((acc, m) => acc + (m && m > 0 ? m : 0), 0);
    const assignTimeToNewChild = async (
      children: ChildForMinutes[],
      newId: string,
      setNewMinutes: (minutes: number) => Promise<unknown>
    ) => {
      if (!parentMinutes) return;
      const free = parentMinutes - sumMinutes(children.filter((c) => c.id !== newId).map((c) => c.minutes));
      if (free > 0) {
        // Redondeado a múltiplo de 5: si se pasa del tiempo libre, el padre sube en esa diferencia.
        const rounded = roundUpTo5(free);
        await setNewMinutes(rounded);
        if (rounded > free) saveItemMinutes(target, parentMinutes + (rounded - free), null);
        return;
      }
      const forPending = parentMinutes - sumMinutes(children.filter((c) => c.done || c.manual).map((c) => c.minutes));
      if (forPending > 0) {
        const total = distributeMinutesToChildren(target, parentMinutes, children);
        if (total > parentMinutes) saveItemMinutes(target, total, null);
      }
    };
    if (target.type === "node") {
      // Nodo: el "sub-paso" es un sub-nodo real de su sub-árbol (se crea el árbol si no existe).
      try {
        const created = await addSubSkillFromToday(target.id, title);
        if (parentMinutes && created) {
          const children = (await fetchSubSkills(target.id))
            .filter((sub) => (sub.levelPosition || 0) > 1 && !isSubSkillPlaceholder(sub))
            .sort((a, b) => (a.level - b.level) || ((a.levelPosition || 0) - (b.levelPosition || 0)))
            .map((sub) => ({ kind: "node" as const, id: sub.id, done: sub.status === "mastered", manual: sub.plannedDurationManual === 1, minutes: sub.plannedDuration }));
          await assignTimeToNewChild(children, created.id, (minutes) =>
            patchSubSkill.mutateAsync({ id: created.id, updates: { plannedDuration: minutes, plannedDurationManual: 0 } })
          );
        }
      } catch (error) {
        console.error("Error creando sub-nodo desde Tareas de hoy:", error);
      }
      queryClient.invalidateQueries({ queryKey: ["node-subskills", target.id] });
      return;
    }
    try {
      // Id de la copia del día: el sub-paso creado, o (permanente) la copia de la plantilla nueva.
      let createdId: string | null = null;
      let templateId: string | null = null;
      if (target.type === "habit" && newSubstepPermanent) {
        templateId = (await createHabitSubstep.mutateAsync({ habitId: target.id, title, date: effectiveDate }))?.id ?? null;
      } else {
        createdId = (await createSubstep.mutateAsync({ date: effectiveDate, taskType: target.type as SubstepTaskType, taskId: target.id, title })).id;
      }
      if (parentMinutes) {
        const res = await fetch(`/api/today-task-substeps?date=${effectiveDate}`);
        const all = res.ok
          ? ((await res.json()) as { id: string; taskType: string; taskId: string; done: number; minutes: number | null; minutesManual: number; sortOrder: number; templateId: string | null }[])
          : [];
        const siblings = all
          .filter((st) => st.taskType === target.type && st.taskId === target.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const created = siblings.find((st) => (createdId ? st.id === createdId : st.templateId === templateId));
        if (created) {
          await assignTimeToNewChild(
            siblings.map((st) => ({ kind: "step" as const, id: st.id, done: st.done === 1, manual: st.minutesManual === 1, minutes: st.minutes })),
            created.id,
            (minutes) => updateSubstep.mutateAsync({ id: created.id, date: effectiveDate, updates: { minutes, minutesManual: 0 } })
          );
        }
      }
    } catch (error) {
      console.error("Error creando sub-paso desde Tareas de hoy:", error);
    }
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
        deadline={st.deadline}
        onAssignTime={() => openSubstepTimeDialog(st.id, st.minutes, parentTimeRef(item, steps.map((x) => x.minutes), i), st.deadline)}
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

  // Un movimiento hecho a mano manda sobre el lugar que "Ahora" le iba a dar a su nodo: si ese
  // reacomodo todavía estaba pendiente para este día (ver nowPlacement), se cancela, así no pisa
  // la tarea que el usuario puso en el lugar de la desbloqueada.
  const cancelPendingNowPlacement = () => {
    if (nowPlacement && nowPlacement.date === effectiveDate) setNowPlacement(null);
  };

  // "Ahora" (menú de la tarea): la tarea pasa a la franja de la hora actual, ocupando el lugar de
  // la tarea desbloqueada (justo antes de la primera sin hacer), que queda como la siguiente.
  // Solo viendo hoy y para tareas sin hacer: en otro día no hay "ahora".
  const moveItemNow = (item: TodayItem) => {
    if (isPreview || item.done) return;
    cancelPendingNowPlacement();
    const slot = getCurrentTimeSlotKey();
    const sameTask = (i: TodayItem) => i.type === item.type && i.id === item.id;
    const bucket = (itemBuckets[slot] || []).filter((i) => !sameTask(i) && !i.traceSubs);
    const firstUndone = bucket.findIndex((i) => !i.done);
    const at = firstUndone === -1 ? bucket.length : firstUndone;
    const ordered = [...bucket.slice(0, at), item, ...bucket.slice(at)];
    // Una sola entrada por tarea (un hábito puede estar duplicado en varias franjas, keys "#slot").
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
  };
  // Tarea sin tiempo propio con hijos que sí tienen: muestra la suma (ver sumChildMinutes).
  const parentMinutesProps = (item: TodayItem) => {
    if (currentMinutes(item)) return {};
    const childMinutes = item.type === "node"
      ? subNodesFor(item).map((sub) => sub.plannedDuration)
      : substepsFor(item).map((st) => st.minutes);
    if (childMinutes.length === 0) return {};
    const sum = sumChildMinutes(childMinutes);
    return sum ? { derivedMinutes: sum } : {};
  };

  const nowProps = (item: TodayItem) =>
    !isPreview && !item.done && !item.traceSubs ? { onMoveNow: () => moveItemNow(item) } : {};

  const moveItemToSlot = (item: TodayItem, slot: TaskSlotKey) => {
    cancelPendingNowPlacement();
    setTaskSlot.mutate({ date: effectiveDate, taskType: item.type, taskId: item.id, slot });
  };

  // Recibe el orden visual completo de la franja (itemBuckets[slot], ya con el swap aplicado)
  // en vez de pedirle al backend que intercambie con el "vecino" guardado: así también
  // funciona para ítems que todavía no tienen fila propia (hábitos con franja por defecto,
  // actividad extra), que antes no se podían mover porque no había nada que swapear.
  const moveItemOrder = (slot: TaskSlotKey, bucket: TodayItem[], index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= bucket.length) return;
    cancelPendingNowPlacement();
    const newOrder = bucket.slice();
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    // Una sola entrada por tarea (un hábito puede estar duplicado en varias franjas, keys
    // "#slot"), y sin el padre que en un día pasado queda solo como texto (traceSubs): no es
    // una tarea con fila propia, y mandarlo le crearía una.
    const seen = new Set<string>();
    const order = newOrder
      .filter((it) => {
        if (it.traceSubs) return false;
        const k = `${it.type}:${it.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((it) => ({ taskType: it.type, taskId: it.id }));
    reorderTaskSlot.mutate({ date: effectiveDate, slot, order });
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
      // Ya confirmado: sin fecha pasaría a verse como actividad extra de este día (se confirmó
      // hoy), así que además se lo oculta en este día. Sin confirmar, solo se le borra la fecha
      // (si después se confirma, vuelve a aparecer como cualquier tarea hecha).
      if (item.done) setTaskSlot.mutate({ date: effectiveDate, taskType: "node", taskId: item.id, slot: "hidden" });
      else clearTaskSlot.mutate({ date: effectiveDate, taskType: "node", taskId: item.id });
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
  // Si la tarea desbloqueada de la franja actual es un nodo con sub-nodos pendientes (su sub-nodo
  // es el desbloqueado), confirmar una tarea que está después de él en esa franja la sube justo
  // antes del nodo padre: así no queda nada confirmado después de la tarea desbloqueada.
  const liftBeforeUnlockedParent = (item: TodayItem) => {
    if (isPreview || item.done) return;
    const slot = getCurrentTimeSlotKey();
    const bucket = itemBuckets[slot] || [];
    const currentIdx = bucket.findIndex((i) => !i.done);
    const current = bucket[currentIdx];
    if (!current || current.type !== "node" || !hasPendingSubNodes(current)) return;
    const itemIdx = bucket.findIndex((i) => i.key === item.key);
    if (itemIdx <= currentIdx) return;
    const reordered = bucket.filter((i) => i.key !== item.key);
    reordered.splice(currentIdx, 0, item);
    // Un hábito puede estar duplicado en varias franjas (keys "#slot"): una sola entrada por tarea.
    const seen = new Set<string>();
    const order = reordered
      .filter((i) => {
        if (i.traceSubs) return false;
        const k = `${i.type}:${i.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((i) => ({ taskType: i.type, taskId: i.id }));
    reorderTaskSlot.mutate({ date: effectiveDate, slot, order });
  };

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
    }
    liftBeforeUnlockedParent(item);
    if (item.type === "manual") {
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
  [...todayItems, ...visibleExtraItems].forEach((item) => {
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

  // Referencia al asignarle tiempo a un sub-nodo/sub-paso de una tarea que tiene tiempo propio:
  // cuánto queda del tiempo del padre descontando lo que ya tienen sus otros hijos. No se reparte
  // solo ni se impone: es para saber cuánto se puede asignar como máximo.
  type ParentTimeRef = { available: number; total: number; parent: TodayItem };
  const [timeMaxRef, setTimeMaxRef] = useState<ParentTimeRef | null>(null);
  const parentTimeRef = (
    parent: TodayItem,
    childMinutes: (number | null | undefined)[],
    index: number
  ): ParentTimeRef | null => {
    const total = currentMinutes(parent);
    if (!total || total <= 0) return null;
    const others = childMinutes.reduce<number>((acc, m, i) => acc + (i !== index && m && m > 0 ? m : 0), 0);
    return { available: Math.max(0, total - others), total, parent };
  };
  // Tiempo pedido para un hijo que supera el máximo disponible: se pide confirmación, y si se
  // acepta, la tarea padre aumenta su tiempo en lo que se pasó.
  const [timeOverflow, setTimeOverflow] = useState<{
    minutes: number;
    deadline: string | null;
    item: TodayItem | null;
    substepId: string | null;
    ref: ParentTimeRef;
  } | null>(null);

  // Hora límite elegida en "Asignar tiempo" ("HH:MM", "" = sin hora límite): los minutos se
  // calculan solos (desde ahora hasta esa hora) y se guardan junto con la hora.
  const [timeDeadline, setTimeDeadline] = useState("");
  const currentDeadline = (item: TodayItem): string | null => {
    if (item.type === "manual") return manualTasks.find((t) => t.id === item.id)?.deadline ?? null;
    if (item.type === "node") {
      return (
        allPlannedNodes.find((n) => n.id === item.id)?.plannedDeadline ??
        Array.from(subSkillsByNodeId.values()).flat().find((sub) => sub.id === item.id)?.plannedDeadline ??
        null
      );
    }
    return null;
  };

  const openTimeDialog = (item: TodayItem, maxRef: ParentTimeRef | null = null) => {
    const m = currentMinutes(item);
    setTimeValue(m ? String(m) : "");
    setTimeDeadline(currentDeadline(item) ?? "");
    setTimeMaxRef(maxRef);
    setTimeItem(item);
  };

  const openSubstepTimeDialog = (
    substepId: string,
    minutes: number | null | undefined,
    maxRef: ParentTimeRef | null = null,
    deadline: string | null = null
  ) => {
    setTimeValue(minutes ? String(minutes) : "");
    setTimeDeadline(deadline ?? "");
    setTimeMaxRef(maxRef);
    setTimeSubstepId(substepId);
  };

  const submitTime = (raw: string = timeValue) => {
    const item = timeItem;
    const substepId = timeSubstepId;
    const maxRef = timeMaxRef;
    setTimeItem(null);
    setTimeSubstepId(null);
    setTimeMaxRef(null);
    const parsed = parseInt(raw, 10);
    const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    // La hora límite solo vale si los minutos salieron de ella (elegir minutos a mano la borra).
    const deadline = minutes !== null && timeDeadline ? timeDeadline : null;
    setTimeDeadline("");
    if (maxRef && minutes !== null && minutes > maxRef.available) {
      setTimeOverflow({ minutes, deadline, item, substepId, ref: maxRef });
      return;
    }
    // Tiempo asignado a una tarea padre: se reparte en partes iguales entre sus hijos (redondeado
    // a múltiplos de 5), y el padre queda con el total resultante. Si el redondeo lo cambió, la
    // hora límite ya no corresponde y no se guarda.
    const finalMinutes = item && !substepId && minutes !== null ? distributeMinutesToChildren(item, minutes) : minutes;
    saveChildOrItemMinutes(item, substepId, finalMinutes, finalMinutes === minutes ? deadline : null);
  };

  // Reparte el tiempo de una tarea en partes iguales entre sus sub-nodos (si es un nodo) o sus
  // sub-pasos, guardándolo en cada uno. Los minutos que sobran de la división van a los primeros,
  // así la suma da justo. Solo al asignarle tiempo al padre desde "Asignar tiempo" (no cuando el
  // padre aumenta por aceptar que un hijo se pase del máximo).
  // Los hijos ya confirmados conservan su tiempo: entre los pendientes se reparte lo que queda del
  // tiempo del padre descontando lo de los confirmados. `children` permite pasar la lista recién
  // traída del server (al agregar un hijo, antes de que se refresque la lista en pantalla).
  // manual: el tiempo lo puso el usuario a mano (nunca lo toca un reparto automático).
  type ChildForMinutes = { kind: "node" | "step"; id: string; done: boolean; manual: boolean; minutes: number | null | undefined };
  const childrenForMinutes = (item: TodayItem): ChildForMinutes[] =>
    item.type === "node"
      ? subNodesFor(item)
          .map((sub) => ({ kind: "node" as const, id: sub.id, done: sub.status === "mastered", manual: sub.plannedDurationManual === 1, minutes: sub.plannedDuration }))
      : substepsFor(item).map((st) => ({ kind: "step" as const, id: st.id, done: st.done === 1, manual: st.minutesManual === 1, minutes: st.minutes }));
  // Devuelve el tiempo que tiene que quedar en el padre: el redondeo a múltiplos de 5 de los
  // hijos puede hacer que sumen más que el tiempo pedido, y ahí el padre sube a esa suma. No guarda
  // el padre: lo hace quien llama, así se guarda una sola vez con el valor final.
  const distributeMinutesToChildren = (item: TodayItem, minutes: number, children: ChildForMinutes[] = childrenForMinutes(item)): number => {
    // Se reparte solo entre los pendientes con tiempo automático; los confirmados y los puestos a
    // mano conservan el suyo y se descuentan del tiempo del padre.
    const pending = children.filter((c) => !c.done && !c.manual);
    if (pending.length === 0) return minutes;
    const reservedMinutes = children.reduce(
      (acc, c) => acc + ((c.done || c.manual) && c.minutes && c.minutes > 0 ? c.minutes : 0),
      0
    );
    const remaining = Math.max(0, minutes - reservedMinutes);
    const base = Math.floor(remaining / pending.length);
    let extra = remaining - base * pending.length;
    let assigned = 0;
    pending.forEach((child) => {
      const share = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra--;
      const value = share > 0 ? roundUpTo5(share) : null;
      assigned += value ?? 0;
      if (child.kind === "node") patchSubSkill.mutate({ id: child.id, updates: { plannedDuration: value, plannedDurationManual: 0, plannedDeadline: null } });
      else updateSubstep.mutate({ id: child.id, date: effectiveDate, updates: { minutes: value, minutesManual: 0, deadline: null } });
    });
    return Math.max(minutes, reservedMinutes + assigned);
  };

  const saveChildOrItemMinutes = (item: TodayItem | null, substepId: string | null, minutes: number | null, deadline: string | null) => {
    if (substepId) {
      // Puesto a mano desde "Asignar tiempo" del sub-paso (o "Quitar tiempo": vuelve a automático).
      updateSubstep.mutate({ id: substepId, date: effectiveDate, updates: { minutes, minutesManual: minutes ? 1 : 0, deadline } });
      return;
    }
    if (item) saveItemMinutes(item, minutes, deadline);
  };

  // Aceptar el aviso: el hijo queda con el tiempo pedido y la tarea padre suma lo que se pasó.
  const acceptTimeOverflow = () => {
    const o = timeOverflow;
    setTimeOverflow(null);
    if (!o) return;
    saveChildOrItemMinutes(o.item, o.substepId, o.minutes, o.deadline);
    saveItemMinutes(o.ref.parent, o.ref.total + (o.minutes - o.ref.available), null);
  };

  // deadline: hora límite con la que se calcularon los minutos (null = sin hora límite). Cuando el
  // tiempo cambia por otra razón (p.ej. el padre sube por el redondeo de sus hijos), se pasa null.
  const saveItemMinutes = (item: TodayItem, minutes: number | null, deadline: string | null) => {
    if (minutes === (currentMinutes(item) ?? null) && deadline === (currentDeadline(item) ?? null)) return;

    if (item.type === "manual") {
      updateManualTask.mutate({ id: item.id, date: effectiveDate, updates: { minutes, deadline } });
      return;
    }
    if (item.type === "node") {
      const parent = findNodeParent(item.id);
      // Sub-nodo (no está en el contexto): tiempo puesto a mano desde su "Asignar tiempo".
      if (!parent) patchSubSkill.mutate({ id: item.id, updates: { plannedDuration: minutes, plannedDurationManual: minutes ? 1 : 0, plannedDeadline: deadline } });
      else if (parent.kind === "project") updateProjectSkill(parent.parentId, item.id, { plannedDuration: minutes, plannedDeadline: deadline });
      else updateSkill(parent.parentId, item.id, { plannedDuration: minutes, plannedDeadline: deadline });
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
      setNewTaskMinutes("");
      setNewTaskDeadline("");
      setNewTaskParentOpen(false);
      setNewTaskHabitsOpen(false);
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
      setNewTaskMinutes("");
      setNewTaskDeadline("");
      setNewTaskParentOpen(false);
      setNewTaskHabitsOpen(false);
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
    const parsedMinutes = parseInt(newTaskMinutes, 10);
    const minutes = Number.isFinite(parsedMinutes) && parsedMinutes > 0 ? parsedMinutes : null;
    const deadline = minutes !== null && newTaskDeadline ? newTaskDeadline : null;
    setAddTaskDialogOpen(false);
    if (newTaskKind === "event" && newTaskParent) {
      const [linkedKind, linkedParentId] = newTaskParent.split(":") as ["area" | "project", string];
      const created = await createManualTask.mutateAsync({ date: effectiveDate, title, kind: "event", linkedKind, linkedParentId, minutes, deadline });
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
      const node = await addSkillInPlaceOfAvailable(parentKind, parentId, title, { plannedDate: effectiveDate, plannedDuration: minutes, plannedDeadline: deadline });
      if (node && addTaskTargetSlot) {
        setTaskSlot.mutate({ date: effectiveDate, taskType: "node", taskId: node.id, slot: addTaskTargetSlot });
      }
      return;
    }
    const created = await createManualTask.mutateAsync({ date: effectiveDate, title, kind: newTaskKind, minutes, deadline });
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
        nodesDone: [...visiblePlannedNodesForView.filter((n) => n.done), ...extraNodes.filter((n) => !isHidden(`node:${n.id}`))],
        nodesScheduled: visiblePlannedNodesForView,
        practicesDone: visiblePracticesToday.filter(({ done }) => done).map(({ practice }) => practice),
        manualScheduled: manualThatDay,
        manualDone: manualDoneThatDay,
        totalForDay: total,
        doneForDay: completed,
      };
    }

    const habitsScheduledThatDay = activeHabitsThisMonth.filter((h) => isHabitScheduledOn(h, dObj));
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
                                {itemBuckets.unassigned.map((item) => item.traceSubs ? renderTraceRow(item) : (
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
                                    {...expandProps(item)}
                                    {...nowProps(item)}
                                    {...parentMinutesProps(item)}
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
                                      if (item.traceSubs) return renderTraceRow(item);
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
                                    {...expandProps(item)}
                                    {...nowProps(item)}
                                    {...parentMinutesProps(item)}
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
                              {itemBuckets.more.map((item) => item.traceSubs ? renderTraceRow(item) : (
                                <React.Fragment key={item.key}>
                                <TodayTaskRow
                                  item={item}
                                  pastDay={effectiveDate < todayStr}
                                  onMove={(slot) => moveItemToSlot(item, slot)}
                                  onDuplicate={canDuplicate(item) ? () => duplicateItem(item) : undefined}
                                  onToggleDone={canToggleDone(item) ? () => toggleItemDone(item) : undefined}
                                  onChangeDay={canChangeDay(item) ? () => openChangeDayDialog(item) : undefined}
                                  onAssignTime={canAssignTime(item) ? () => openTimeDialog(item) : undefined}
                                  {...priorityRowProps(item)}
                                    {...expandProps(item)}
                                    {...nowProps(item)}
                                    {...parentMinutesProps(item)}
                                />
                                {renderSubNodes(item, false)}
                                </React.Fragment>
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

    <Dialog open={!!addNestedTarget} onOpenChange={(o) => { if (!o) setAddNestedTarget(null); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogTitle>
          {addNestedTarget ? `Nuevo sub-nodo de ${stripLeadingEmoji(addNestedTarget.sub.title || "Sin nombre")}` : "Nuevo sub-nodo"}
        </DialogTitle>
        <Input
          autoFocus
          value={newNestedTitle}
          onChange={(e) => setNewNestedTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNewNested();
          }}
          placeholder="¿Cuál es el paso?"
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setAddNestedTarget(null)}
            className="px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submitNewNested}
            disabled={!newNestedTitle.trim()}
            className="px-3 py-1.5 text-sm rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Agregar
          </button>
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
        {addSubstepFor?.type === "habit" && (
          <div className="flex gap-2">
            {([false, true] as const).map((permanent) => (
              <button
                key={String(permanent)}
                type="button"
                onClick={() => setNewSubstepPermanent(permanent)}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  newSubstepPermanent === permanent
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border/30 bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {permanent ? "Todos los días" : "Solo hoy"}
              </button>
            ))}
          </div>
        )}
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
        {/* Tiempo estimado: tocar un valor lo elige, tocarlo de nuevo lo saca. */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tiempo</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {[5, 10, 15, 30, 45, 60, 90].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setNewTaskDeadline("");
                  setNewTaskMinutes(newTaskMinutes === String(m) ? "" : String(m));
                }}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  newTaskMinutes === String(m)
                    ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "border-border/50 hover:bg-muted"
                }`}
              >
                {m}min
              </button>
            ))}
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="Otro"
              value={newTaskMinutes}
              onChange={(e) => {
                setNewTaskDeadline("");
                setNewTaskMinutes(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewTask();
              }}
              className="h-7 w-20 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">O hasta las</span>
            <Input
              type="time"
              value={newTaskDeadline}
              onChange={(e) => {
                const value = e.target.value;
                setNewTaskDeadline(value);
                const m = value ? minutesUntilDeadline(value) : null;
                setNewTaskMinutes(m ? String(m) : "");
              }}
              className="h-7 w-28 text-xs"
            />
            {newTaskDeadline && (
              <span className={`text-xs ${minutesUntilDeadline(newTaskDeadline) ? "text-muted-foreground" : "text-destructive"}`}>
                {minutesUntilDeadline(newTaskDeadline)
                  ? `${minutesUntilDeadline(newTaskDeadline)} minutos (hasta ${formatDeadline(newTaskDeadline)})`
                  : "Esa hora ya pasó"}
              </span>
            )}
          </div>
        </div>
        {(areas.length > 0 || projects.length > 0) && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setNewTaskParentOpen((o) => !o)}
              className="flex w-full items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {newTaskParentOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              Área o quest
              {newTaskParent && (
                <span className="ml-1 truncate font-normal normal-case tracking-normal text-foreground">
                  · {newTaskParent.startsWith("area:")
                    ? areas.find((a) => `area:${a.id}` === newTaskParent)?.name
                    : projects.find((pr) => `project:${pr.id}` === newTaskParent)?.name}
                </span>
              )}
            </button>
            {newTaskParentOpen && (
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
          </div>
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
            <button
              type="button"
              onClick={() => setNewTaskHabitsOpen((o) => !o)}
              className="flex w-full items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {newTaskHabitsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              O agregá un hábito
            </button>
            {newTaskHabitsOpen && (
            <div className="max-h-48 overflow-y-auto minimal-scrollbar space-y-1">
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
            )}
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

    <Dialog open={timeItem !== null || timeSubstepId !== null} onOpenChange={(o) => { if (!o) { setTimeItem(null); setTimeSubstepId(null); setTimeMaxRef(null); } }}>
      <DialogContent className="max-w-xs rounded-2xl">
        <DialogTitle>Asignar tiempo</DialogTitle>
        <div className="flex flex-col gap-3">
          {timeItem && (timeItem.type === "habit" || timeItem.type === "practice") && (
            <p className="text-xs text-muted-foreground">
              Se guarda en {timeItem.type === "habit" ? "el hábito" : "la práctica"}: aplica a todos los días.
            </p>
          )}
          {timeMaxRef && (
            <p
              className={`text-xs ${
                (parseInt(timeValue, 10) || 0) > timeMaxRef.available ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              Máximo disponible: {timeMaxRef.available}min (de {timeMaxRef.total}min de la tarea padre)
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {[5, 10, 15, 30, 45, 60, 90].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setTimeDeadline("");
                  submitTime(String(m));
                }}
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
              onChange={(e) => {
                setTimeDeadline("");
                setTimeValue(e.target.value);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") submitTime(); }}
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
          {/* Hora límite en vez de cantidad de tiempo: los minutos se calculan desde ahora hasta
              esa hora. Hábitos y prácticas no: su tiempo es de la configuración, no del día. */}
          {!(timeItem && (timeItem.type === "habit" || timeItem.type === "practice")) && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">O hasta las</span>
              <Input
                type="time"
                value={timeDeadline}
                onChange={(e) => {
                  const value = e.target.value;
                  setTimeDeadline(value);
                  const m = value ? minutesUntilDeadline(value) : null;
                  setTimeValue(m ? String(m) : "");
                }}
                onKeyDown={(e) => { if (e.key === "Enter") submitTime(); }}
                className="w-32"
              />
            </div>
          )}
          {timeDeadline && (
            <p className={`text-xs ${minutesUntilDeadline(timeDeadline) ? "text-muted-foreground" : "text-destructive"}`}>
              {minutesUntilDeadline(timeDeadline)
                ? `${minutesUntilDeadline(timeDeadline)} minutos (hasta ${formatDeadline(timeDeadline)})`
                : "Esa hora ya pasó"}
            </p>
          )}
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

    <AlertDialog open={!!timeOverflow} onOpenChange={(o) => { if (!o) setTimeOverflow(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supera el tiempo de la tarea padre</AlertDialogTitle>
          <AlertDialogDescription>
            {timeOverflow &&
              `Le quedan ${timeOverflow.ref.available}min disponibles y le estás asignando ${timeOverflow.minutes}min. Si aceptás, la tarea padre pasa de ${timeOverflow.ref.total}min a ${timeOverflow.ref.total + (timeOverflow.minutes - timeOverflow.ref.available)}min.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={acceptTimeOverflow}>Aceptar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

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
  deadline,
  onAddChild,
  depth = 0,
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
  // Hora límite con la que se calcularon los minutos (se muestra "(hasta 5pm)").
  deadline?: string | null;
  // Agregarle un sub-nodo a este sub-nodo (se muestra anidado adentro de él).
  onAddChild?: () => void;
  // 1 = sub-nodo de un sub-nodo: un nivel más de sangría.
  depth?: number;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const hasMenu = !!(onMoveUp || onMoveDown || onRename || onAssignTime || onAddChild || onDelete);
  const titleNode = (
    <span
      className={`flex-1 ${hasMenu ? "cursor-pointer" : ""} ${done ? "text-yellow-600/60" : ""} ${
        current ? "text-[15px] font-semibold leading-snug" : ""
      }`}
    >
      {title}
      <MinutesSuffix minutes={minutes} deadline={deadline} />
    </span>
  );
  return (
    <>
      <div className={`${depth > 0 ? "ml-10" : "ml-5"} border-l-2 pl-3 transition-opacity ${current ? "border-amber-500/40" : "border-border/40"} ${dimmed ? "opacity-25" : ""}`}>
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
                    <DropdownMenuItem onClick={onAssignTime}>Asignar tiempo</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {onAddChild && (
                  <>
                    <DropdownMenuItem onClick={onAddChild}>Agregar sub-nodo</DropdownMenuItem>
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
  expanded,
  onToggleExpand,
  onMoveNow,
  derivedMinutes,
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
  // Nodo confirmado con sub-nodos: flechita para desplegar/plegar su lista de sub-nodos.
  expanded?: boolean;
  onToggleExpand?: () => void;
  // "Ahora": pasa a ocupar el lugar de la tarea desbloqueada (solo viendo hoy, tareas sin hacer).
  onMoveNow?: () => void;
  // Suma del tiempo de sus sub-nodos/sub-pasos, cuando la tarea no tiene tiempo propio.
  derivedMinutes?: number;
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
              {derivedMinutes ? <MinutesSuffix minutes={derivedMinutes} /> : null}
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
            {onMoveNow && <DropdownMenuItem onClick={onMoveNow}>Ahora</DropdownMenuItem>}
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
        {onToggleExpand && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            aria-label={expanded ? "Ocultar sub-nodos" : "Ver sub-nodos"}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
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
