import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Eye, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useSkillTree, type Area, type Project, type Skill } from "@/lib/skill-context";
import { useHabits } from "@/lib/useHabits";
import { useTodayTaskSlots, useSetTodayTaskSlot, useClearTodayTaskSlot, useReorderTodayTaskSlot, type TaskSlotKey, type TaskType } from "@/lib/useTodayTaskSlots";
import { useManualTasks, useCreateManualTask, useUpdateManualTask, useDeleteManualTask } from "@/lib/useManualTasks";
import { calculateStatus, calculateStatusL2, type SpaceRepetitionPractice } from "@/components/SpaceRepetitionModal";
import type { Habit, HabitRecord } from "@shared/schema";

const LONG_PRESS_MS = 1500;

const TIME_SLOTS: { key: TaskSlotKey; label: string }[] = [
  { key: "morning", label: "La mañana" },
  { key: "midday", label: "Mediodía" },
  { key: "afternoon", label: "Tarde" },
  { key: "night", label: "Noche" },
];

// Mañana 6-11, mediodía 12-16, tarde 17-20, noche 21-23 y también las horas de
// madrugada (0-5), que caen dentro del tramo nocturno del día anterior.
function getCurrentTimeSlotKey(): TaskSlotKey {
  const hour = new Date().getHours();
  if (hour >= 6 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 16) return "midday";
  if (hour >= 17 && hour <= 20) return "afternoon";
  return "night";
}

interface TodayItem {
  key: string;
  type: TaskType;
  id: string;
  label: React.ReactNode;
  done: boolean;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const DAY_LBLS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const HABIT_COLORS = ["#534AB7", "#1D9E75", "#D85A30", "#185FA5"];
const NODE_COLOR = "#f59e0b";
const PRACTICE_COLOR = "#e11d48";

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
}

function getFirstDayOfMonth(date: Date) {
  const firstDow = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return firstDow === 0 ? 6 : firstDow - 1;
}

export function TodayProgressModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { areas, projects } = useSkillTree();
  const { data: habitsData } = useHabits();
  const [viewMode, setViewMode] = useState<"progress" | "calendar">("progress");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // Previsualización de un día futuro (se entra tocando ese día en el calendario). null = se
  // está viendo el día real de hoy.
  const [previewDate, setPreviewDate] = useState<string | null>(null);
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const backgroundLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    }
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

  const habitItems = habitsScheduledForView.map((h, i) => ({
    id: h.id,
    label: `${h.emoji} ${h.name}`,
    done: !!(viewRecordQueries[i]?.data as HabitRecord[] | undefined)?.some(
      (r) => r.date === effectiveDate && r.completed === 1
    ),
  }));

  const collectPlannedNodes = (list: (Area | Project)[]): PlannedNode[] => {
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
          });
        }
      });
    });
    return result;
  };

  const allPlannedNodes = [
    ...collectPlannedNodes(Array.isArray(areas) ? areas : []),
    ...collectPlannedNodes(Array.isArray(projects) ? projects : []),
  ];

  const plannedNodesForView = allPlannedNodes.filter((n) => n.plannedDate === effectiveDate);

  // Prácticas de repetición espaciada que vencían hoy ("expires_soon") o que se confirmaron
  // hoy (lastConfirmedAt cae en la fecha de hoy y ya avanzaron a otro estado). No aplica al
  // previsualizar un día futuro: el "vencimiento" es relativo a ahora, no a un día futuro.
  const { data: practicesData } = useQuery({
    queryKey: ["space-repetition"],
    queryFn: async () => {
      const res = await fetch("/api/space-repetition");
      if (!res.ok) throw new Error("Failed to fetch space repetition practices");
      return res.json() as Promise<SpaceRepetitionPractice[]>;
    },
    enabled: open,
  });

  const practicesToday = isPreview ? [] : (practicesData || [])
    .map((p) => {
      const status = p.level === 2 ? calculateStatusL2(p) : calculateStatus(p);
      const pending = status === "expires_soon";
      const confirmedAt = p.lastConfirmedAt || p.updatedAt;
      const confirmedToday = !pending && status !== "loss" && status !== "frozen" && !!confirmedAt && getDateStr(new Date(confirmedAt)) === todayStr;
      return { practice: p, done: confirmedToday, include: pending || confirmedToday };
    })
    .filter((entry) => entry.include);

  // Actividad extra: hábitos y nodos hechos hoy que no estaban configurados para hoy
  // (hábito no programado ese día, o nodo sin fecha planeada para hoy). Tampoco aplica a la
  // previsualización: es actividad ya ocurrida, y un día futuro todavía no tiene nada hecho.
  const habitsNotScheduledForView = isPreview ? [] : (habitsData || []).filter(
    (h) => !habitsScheduledForView.some((s) => s.id === h.id)
  );

  const otherHabitRecordQueries = useQueries({
    queries: habitsNotScheduledForView.map((h) => ({
      queryKey: ["habit-records", h.id, todayStr, todayStr],
      queryFn: async () => {
        const res = await fetch(`/api/habit-records/${h.id}?startDate=${todayStr}&endDate=${todayStr}`);
        if (!res.ok) throw new Error("Failed to fetch habit records");
        return res.json() as Promise<HabitRecord[]>;
      },
      enabled: open,
    })),
  });

  const extraHabits = habitsNotScheduledForView
    .map((h, i) => ({
      id: h.id,
      label: `${h.emoji} ${h.name}`,
      done: !!(otherHabitRecordQueries[i]?.data as HabitRecord[] | undefined)?.some(
        (r) => r.date === todayStr && r.completed === 1
      ),
    }))
    .filter((h) => h.done);

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
            });
          }
        }
      });
    });
    return result;
  };

  const extraNodes = isPreview ? [] : [
    ...collectExtraCompletedNodes(Array.isArray(areas) ? areas : [], todayStr, todayStr),
    ...collectExtraCompletedNodes(Array.isArray(projects) ? projects : [], todayStr, todayStr),
  ];

  const extraItems: TodayItem[] = [
    ...extraHabits.map((h) => ({ key: `habit:${h.id}`, type: "habit" as const, id: h.id, label: h.label, done: true })),
    ...extraNodes.map((n) => ({
      key: `node:${n.id}`,
      type: "node" as const,
      id: n.id,
      label: (
        <>
          {n.title} <span className="text-muted-foreground">· {n.parentName}</span>
        </>
      ),
      done: true,
    })),
  ];

  // Tareas manuales agregadas a mano (mantener presionado el fondo). Existen para cualquier
  // día (hoy o un día futuro previsualizado) y no aparecen en el calendario de actividades.
  const { data: manualTasksData } = useManualTasks(effectiveDate, open);
  const manualTasks = manualTasksData || [];
  const createManualTask = useCreateManualTask();
  const updateManualTask = useUpdateManualTask();
  const deleteManualTask = useDeleteManualTask();

  // Franjas horarias: cada tarea (hábito/nodo/práctica/manual) puede asignarse a
  // mañana/mediodía/tarde/noche, o marcarse "hidden" (mantener presionada una tarea no hecha)
  // para que deje de contar como tarea de ese día. La asignación es por día (queryKey incluye
  // effectiveDate), lo que también permite ordenar tareas de días futuros previsualizados.
  const { data: slotsData } = useTodayTaskSlots(effectiveDate, open);
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

  const totalHabits = habitItems.filter((h) => h.done || !wasHiddenAtOpen(`habit:${h.id}`)).length;
  const completedHabits = habitItems.filter((h) => h.done).length;
  const totalNodes = plannedNodesForView.filter((n) => n.done || !wasHiddenAtOpen(`node:${n.id}`)).length;
  const completedNodes = plannedNodesForView.filter((n) => n.done).length;
  const totalPractices = practicesToday.filter(({ practice: p, done }) => done || !wasHiddenAtOpen(`practice:${p.id}`)).length;
  const completedPractices = practicesToday.filter((p) => p.done).length;
  const totalManual = manualTasks.length;
  const completedManual = manualTasks.filter((t) => t.done === 1).length;

  // Tareas configuradas para hoy (usado para decidir si se muestra el acordeón de franjas
  // horarias, que no debe aparecer si lo único que hay es actividad extra en "Más").
  const totalConfigured = totalHabits + totalNodes + totalPractices + totalManual;

  // Los ítems de "Más" ya están todos hechos (son actividad extra detectada como completada
  // hoy), así que suman por igual a total y a completed.
  const total = totalConfigured + extraItems.length;
  const completed = completedHabits + completedNodes + completedPractices + completedManual + extraItems.length;
  const progressPct = total > 0 ? (completed / total) * 100 : 0;

  const todayItems: TodayItem[] = [
    ...visibleHabitItems.map((h) => ({ key: `habit:${h.id}`, type: "habit" as const, id: h.id, label: h.label, done: h.done })),
    ...visiblePlannedNodesForView.map((n) => ({
      key: `node:${n.id}`,
      type: "node" as const,
      id: n.id,
      label: (
        <>
          {n.title} <span className="text-muted-foreground">· {n.parentName}</span>
        </>
      ),
      done: n.done,
    })),
    ...visiblePracticesToday.map(({ practice: p, done }) => ({
      key: `practice:${p.id}`,
      type: "practice" as const,
      id: p.id,
      label: `${p.emoji} ${p.name}`,
      done,
    })),
    ...manualTasks.map((t) => ({
      key: `manual:${t.id}`,
      type: "manual" as const,
      id: t.id,
      label: t.title,
      done: t.done === 1,
    })),
  ];

  // "more" agrupa la actividad extra (sección "Más") que todavía no tiene franja horaria
  // asignada. En cuanto se le asigna una (con el reloj), pasa a vivir en el bucket de esa
  // franja junto con las tareas configuradas, igual que cualquier otra tarea de hoy.
  const itemBuckets: Record<string, TodayItem[]> = { unassigned: [], more: [] };
  TIME_SLOTS.forEach((s) => (itemBuckets[s.key] = []));
  todayItems.forEach((item) => {
    const slot = slotByKey.get(item.key);
    // "hidden" no es una franja real: puede llegar acá si la tarea se ocultó y después se
    // confirmó (vuelve a aparecer, ya hecha), así que cae a "Sin asignar" igual que si nunca
    // hubiera tenido franja.
    const isTimeSlot = !!slot && TIME_SLOTS.some((s) => s.key === slot);
    itemBuckets[isTimeSlot ? (slot as TaskSlotKey) : "unassigned"].push(item);
  });
  extraItems.forEach((item) => {
    const slot = slotByKey.get(item.key);
    const isTimeSlot = !!slot && TIME_SLOTS.some((s) => s.key === slot);
    itemBuckets[isTimeSlot ? (slot as TaskSlotKey) : "more"].push(item);
  });

  // Dentro de cada franja horaria, respeta el orden guardado (sortOrder) — el que se puede
  // cambiar de a pares con "Mover arriba"/"Mover abajo", sin agregar ningún elemento visual.
  // Desempata por updatedAt para que las franjas asignadas antes de tener esta columna (todas
  // con sortOrder 0) tengan igual un orden estable en vez de depender del orden de la consulta.
  TIME_SLOTS.forEach((s) => {
    itemBuckets[s.key].sort((a, b) => {
      const diff = (sortOrderByKey.get(a.key) ?? 0) - (sortOrderByKey.get(b.key) ?? 0);
      if (diff !== 0) return diff;
      return (slotUpdatedAtByKey.get(a.key) ?? 0) - (slotUpdatedAtByKey.get(b.key) ?? 0);
    });
  });

  // El acordeón de franjas horarias solo se muestra si hay algo para agrupar ahí: tareas
  // configuradas para hoy, o actividad extra que ya se movió a una franja específica.
  const hasSlotSection = itemBuckets.unassigned.length > 0 || TIME_SLOTS.some((s) => itemBuckets[s.key].length > 0);

  const moveItemToSlot = (item: TodayItem, slot: TaskSlotKey) => {
    setTaskSlot.mutate({ date: effectiveDate, taskType: item.type, taskId: item.id, slot });
  };

  const moveItemOrder = (item: TodayItem, direction: "up" | "down") => {
    reorderTaskSlot.mutate({ date: effectiveDate, taskType: item.type, taskId: item.id, direction });
  };

  const unassignItem = (item: TodayItem) => {
    clearTaskSlot.mutate({ date: effectiveDate, taskType: item.type, taskId: item.id });
  };

  const hideItemFromToday = (item: TodayItem) => {
    setTaskSlot.mutate({ date: effectiveDate, taskType: item.type, taskId: item.id, slot: "hidden" });
  };

  const toggleManualDone = (item: TodayItem) => {
    const task = manualTasks.find((t) => t.id === item.id);
    if (!task) return;
    updateManualTask.mutate({ id: item.id, date: effectiveDate, updates: { done: task.done === 1 ? 0 : 1 } });
  };

  const deleteManualItem = (item: TodayItem) => {
    deleteManualTask.mutate({ id: item.id, date: effectiveDate });
  };

  // Mantener presionado el fondo (fuera de una tarea puntual) abre el diálogo para agregar
  // una tarea manual al día que se está viendo (hoy, o el día previsualizado).
  const startBackgroundLongPress = () => {
    backgroundLongPressTimer.current = setTimeout(() => {
      setNewTaskTitle("");
      setAddTaskDialogOpen(true);
    }, LONG_PRESS_MS);
  };

  const cancelBackgroundLongPress = () => {
    if (backgroundLongPressTimer.current) {
      clearTimeout(backgroundLongPressTimer.current);
      backgroundLongPressTimer.current = null;
    }
  };

  const submitNewTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    createManualTask.mutate({ date: effectiveDate, title });
    setAddTaskDialogOpen(false);
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
    if (dateStr === todayStr && !isPreview) {
      const todayHabitsDoneIds = new Set([
        ...visibleHabitItems.filter((h) => h.done).map((h) => h.id),
        ...extraHabits.map((h) => h.id),
      ]);
      return {
        habitsDone: activeHabitsThisMonth.filter((h) => todayHabitsDoneIds.has(h.id)),
        nodesDone: [...visiblePlannedNodesForView.filter((n) => n.done), ...extraNodes],
        practicesDone: visiblePracticesToday.filter(({ done }) => done).map(({ practice }) => practice),
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
      nodesDone: [...nodesPlannedDoneThatDay, ...extraNodesThatDay],
      practicesDone: practicesThatDay,
      totalForDay: habitsScheduledThatDay.length + extraHabitsDoneThatDay.length + nodesPlannedThatDay.length + extraNodesThatDay.length + practicesThatDay.length,
      doneForDay: habitsDoneThatDay.length + nodesPlannedDoneThatDay.length + extraNodesThatDay.length + practicesThatDay.length,
    };
  };

  const selectedDayDetails = selectedDay ? getDayStats(selectedDay, new Date(selectedDay + "T12:00:00")) : null;

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
              <button
                onClick={openCalendar}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors"
                title="Ver calendario de actividades"
              >
                <Eye className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Completado</span>
                <span className="text-sm font-semibold text-muted-foreground">
                  {completed}/{total}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
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
                        defaultValue={["unassigned", getCurrentTimeSlotKey()]}
                        className="space-y-1"
                      >
                        {itemBuckets.unassigned.length > 0 && (
                          <AccordionItem value="unassigned" className="border-0">
                            <AccordionTrigger className="py-1.5 hover:no-underline">
                              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                Sin asignar ({itemBuckets.unassigned.length})
                              </h3>
                            </AccordionTrigger>
                            <AccordionContent className="pt-0 pb-1">
                              <div className="space-y-1.5">
                                {itemBuckets.unassigned.map((item) => (
                                  <TodayTaskRow
                                    key={item.key}
                                    item={item}
                                    onMove={(slot) => moveItemToSlot(item, slot)}
                                    onHide={item.type !== "manual" ? () => hideItemFromToday(item) : undefined}
                                    onDelete={item.type === "manual" ? () => deleteManualItem(item) : undefined}
                                    onToggleDone={item.type === "manual" ? () => toggleManualDone(item) : undefined}
                                  />
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}

                        {TIME_SLOTS.map((s) => (
                          <AccordionItem key={s.key} value={s.key} className="border-0">
                            <AccordionTrigger className="py-1.5 hover:no-underline">
                              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                {s.label} ({itemBuckets[s.key].filter((i) => i.done).length}/{itemBuckets[s.key].length})
                              </h3>
                            </AccordionTrigger>
                            <AccordionContent className="pt-0 pb-1">
                              {itemBuckets[s.key].length === 0 ? (
                                <p className="text-xs text-muted-foreground py-1">Nada asignado a esta franja.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {itemBuckets[s.key].map((item, idx) => (
                                    <TodayTaskRow
                                      key={item.key}
                                      item={item}
                                      onMove={(slot) => moveItemToSlot(item, slot)}
                                      onClear={() => unassignItem(item)}
                                      onHide={item.type !== "manual" ? () => hideItemFromToday(item) : undefined}
                                      onDelete={item.type === "manual" ? () => deleteManualItem(item) : undefined}
                                      onToggleDone={item.type === "manual" ? () => toggleManualDone(item) : undefined}
                                      onMoveUp={idx > 0 ? () => moveItemOrder(item, "up") : undefined}
                                      onMoveDown={idx < itemBuckets[s.key].length - 1 ? () => moveItemOrder(item, "down") : undefined}
                                    />
                                  ))}
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
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
                                <TodayTaskRow key={item.key} item={item} onMove={(slot) => moveItemToSlot(item, slot)} />
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

                const { habitsDone: habitsDoneThatDay, nodesDone: nodesDoneThatDay, practicesDone: practicesDoneThatDay, totalForDay, doneForDay } = getDayStats(dateStr, dObj);
                const allDone = totalForDay > 0 && doneForDay === totalForDay;

                return (
                  <button
                    key={day}
                    onClick={() => {
                      // Un día futuro abre la previsualización de "Tareas de hoy" para ese día
                      // (con las 4 franjas horarias); hoy y días pasados siguen mostrando el
                      // panelcito de detalle de abajo.
                      if (isFuture) {
                        setPreviewDate(dateStr);
                        setViewMode("progress");
                        setSelectedDay(null);
                      } else {
                        setSelectedDay((prev) => (prev === dateStr ? null : dateStr));
                      }
                    }}
                    className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all cursor-pointer active:scale-95 ${
                      allDone ? "bg-emerald-500/20" : isFuture ? "opacity-20" : "bg-muted/30"
                    } ${isToday ? "ring-2 ring-emerald-500" : ""} ${
                      selectedDay === dateStr ? "ring-2 ring-foreground" : ""
                    }`}
                  >
                    <div className={isToday ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium"}>
                      {day}
                    </div>
                    {allDone && !isFuture && (
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓✓</div>
                    )}
                    {doneForDay > 0 && !allDone && !isFuture && (
                      <div className="flex gap-1 flex-wrap justify-center max-w-full">
                        {habitsDoneThatDay.map((h) => (
                          <div
                            key={h.id}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: HABIT_COLORS[activeHabitsThisMonth.indexOf(h) % HABIT_COLORS.length] }}
                          />
                        ))}
                        {nodesDoneThatDay.map((n) => (
                          <div key={n.id} className="h-1.5 w-1.5 rounded-full" style={{ background: NODE_COLOR }} />
                        ))}
                        {practicesDoneThatDay.map((p) => (
                          <div key={p.id} className="h-1.5 w-1.5 rounded-full" style={{ background: PRACTICE_COLOR }} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2.5 min-h-[3rem]">
              {!selectedDay ? (
                <p className="text-xs text-muted-foreground">Tocá un día para ver qué se hizo.</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {new Date(selectedDay + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  {selectedDayDetails && (selectedDayDetails.habitsDone.length > 0 || selectedDayDetails.nodesDone.length > 0 || selectedDayDetails.practicesDone.length > 0) ? (
                    <div className="space-y-1">
                      {selectedDayDetails.habitsDone.map((h) => (
                        <div key={h.id} className="flex items-center gap-2 text-sm">
                          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: HABIT_COLORS[activeHabitsThisMonth.indexOf(h) % HABIT_COLORS.length] }} />
                          <span>{h.emoji} {h.name}</span>
                        </div>
                      ))}
                      {selectedDayDetails.nodesDone.map((n) => (
                        <div key={n.id} className="flex items-center gap-2 text-sm">
                          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: NODE_COLOR }} />
                          <span>{n.title} <span className="text-muted-foreground">· {n.parentName}</span></span>
                        </div>
                      ))}
                      {selectedDayDetails.practicesDone.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 text-sm">
                          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: PRACTICE_COLOR }} />
                          <span>{p.emoji} {p.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nada completado ese día.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <Dialog open={addTaskDialogOpen} onOpenChange={setAddTaskDialogOpen}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogTitle>Nueva tarea para {isPreview ? "este día" : "hoy"}</DialogTitle>
        <Input
          autoFocus
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNewTask();
          }}
          placeholder="¿Qué tarea querés agregar?"
        />
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
      </DialogContent>
    </Dialog>
    </>
  );
}

function TodayTaskRow({
  item,
  onMove,
  onClear,
  onHide,
  onDelete,
  onToggleDone,
  onMoveUp,
  onMoveDown,
}: {
  item: TodayItem;
  onMove: (slot: TaskSlotKey) => void;
  onClear?: () => void;
  onHide?: () => void;
  onDelete?: () => void;
  onToggleDone?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [hideConfirmOpen, setHideConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = React.useRef(false);

  // Mantener presionada una tarea no hecha ofrece sacarla de tareas de hoy (item.done ya
  // completado no necesita esto). Mismo timing (1500ms) que el long-press de SkillNode.
  // Eliminar (tareas manuales) vive en el menú, no en el long-press.
  const canLongPress = !item.done && !!onHide;

  const startLongPress = (e: React.MouseEvent | React.TouchEvent) => {
    // No debe burbujear al fondo (que tiene su propio long-press para agregar una tarea).
    e.stopPropagation();
    if (!canLongPress) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setHideConfirmOpen(true);
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
        className="flex items-center gap-2 text-sm touch-none select-none"
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
      >
        <span
          onClick={onToggleDone}
          className={`h-4 w-4 flex-shrink-0 rounded-full border-2 ${
            item.done ? "bg-emerald-500 border-emerald-500" : "border-border/50"
          } ${onToggleDone ? "cursor-pointer" : ""}`}
        />
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
              className={`flex-1 cursor-pointer ${item.done ? "line-through text-muted-foreground" : ""}`}
            >
              {item.label}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDeleteConfirmOpen(true)} className="text-destructive focus:text-destructive">
                  Eliminar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {canLongPress && (
        <AlertDialog open={hideConfirmOpen} onOpenChange={setHideConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Sacar esta tarea de hoy?</AlertDialogTitle>
              <AlertDialogDescription>
                Dejará de aparecer en tareas de hoy.
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
