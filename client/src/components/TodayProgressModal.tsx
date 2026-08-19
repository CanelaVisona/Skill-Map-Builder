import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Eye, ArrowLeft, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { useSkillTree, type Area, type Project, type Skill } from "@/lib/skill-context";
import { useHabits } from "@/lib/useHabits";
import { useTodayTaskSlots, useSetTodayTaskSlot, useClearTodayTaskSlot, useReorderTodayTaskSlot, getCurrentTimeSlotKey, getTimeSlotKeyForDate, type TaskSlotKey, type TaskType } from "@/lib/useTodayTaskSlots";
import { useManualTasks, useCreateManualTask, useUpdateManualTask, useDeleteManualTask } from "@/lib/useManualTasks";
import { calculateStatus, calculateStatusL2, type SpaceRepetitionPractice } from "@/components/SpaceRepetitionModal";
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
}

function getFirstDayOfMonth(date: Date) {
  const firstDow = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return firstDow === 0 ? 6 : firstDow - 1;
}

export function TodayProgressModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
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
  // Franja a la que se asigna la tarea que se está por crear: null = sin asignar (mantener
  // presionado el fondo). Mantener presionado el título de una franja horaria en vez del fondo
  // apunta la tarea nueva directo a esa franja, para que no caiga en "Sin asignar".
  const [addTaskTargetSlot, setAddTaskTargetSlot] = useState<TaskSlotKey | null>(null);
  const backgroundLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotTitleLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Si el long-press del título ya disparó el diálogo, el click que sigue al soltar no debe
  // además abrir/cerrar el acordeón de esa franja.
  const slotTitleLongPressFired = useRef(false);

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

  const extraHabits = habitsNotScheduledForView
    .map((h, i) => ({
      id: h.id,
      label: `${h.emoji} ${h.name}`,
      done: !!(otherHabitRecordQueries[i]?.data as HabitRecord[] | undefined)?.some(
        (r) => r.date === effectiveDate && r.completed === 1
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
              completedAt: skill.completedAt,
            });
          }
        }
      });
    });
    return result;
  };

  // Se usa effectiveDate (no todayStr) para que también aparezcan acá los nodos completados sin
  // fecha planeada de un día pasado que se esté editando; para un día futuro no hay nada
  // completado todavía, así que naturalmente da vacío.
  const extraNodes = [
    ...collectExtraCompletedNodes(Array.isArray(areas) ? areas : [], effectiveDate, effectiveDate),
    ...collectExtraCompletedNodes(Array.isArray(projects) ? projects : [], effectiveDate, effectiveDate),
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
      defaultSlot: n.completedAt ? getTimeSlotKeyForDate(new Date(n.completedAt)) : undefined,
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
    if (manual) return [manual];
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

  // Las tareas ya hechas siempre van antes que las que faltan, en cualquier bucket. Dentro de
  // cada franja horaria, entre tareas con el mismo estado de "hecha" se respeta el orden
  // guardado (sortOrder) — el que se puede cambiar de a pares con "Mover arriba"/"Mover abajo".
  // Desempata por updatedAt para que las franjas asignadas antes de tener esta columna (todas
  // con sortOrder 0) tengan igual un orden estable en vez de depender del orden de la consulta.
  const byDoneFirst = (a: TodayItem, b: TodayItem) => Number(b.done) - Number(a.done);
  itemBuckets.unassigned.sort(byDoneFirst);
  TIME_SLOTS.forEach((s) => {
    itemBuckets[s.key].sort((a, b) => {
      const doneDiff = byDoneFirst(a, b);
      if (doneDiff !== 0) return doneDiff;
      const diff = (sortOrderByKey.get(a.key) ?? 0) - (sortOrderByKey.get(b.key) ?? 0);
      if (diff !== 0) return diff;
      return (slotUpdatedAtByKey.get(a.key) ?? 0) - (slotUpdatedAtByKey.get(b.key) ?? 0);
    });
  });

  // El acordeón de franjas horarias solo se muestra si hay algo para agrupar ahí: tareas
  // configuradas para hoy, o actividad extra que ya se movió a una franja específica.
  const hasSlotSection = itemBuckets.unassigned.length > 0 || TIME_SLOTS.some((s) => itemBuckets[s.key].length > 0);

  // Si "Sin asignar" tiene alguna tarea todavía sin confirmar, tiene prioridad sobre la franja
  // horaria actual: es la única que arranca abierta (todas las franjas cerradas), sin importar
  // qué hora sea, porque son tareas que no tienen un momento del día asociado y conviene que se
  // vean primero. Si no hay pendientes ahí, se vuelve al comportamiento normal (Sin asignar +
  // franja actual abiertas).
  const hasPendingUnassigned = itemBuckets.unassigned.some((item) => !item.done);

  // Sección de franjas que debe estar abierta: "Sin asignar" tiene prioridad mientras tenga
  // pendientes; si no (vacía, o solo con tareas ya hechas), se cierra siempre y se abre la
  // franja horaria actual en su lugar. Es excluyente: nunca hay más de una sección abierta a
  // la vez, así el resto queda visualmente "de fondo" (ver data-[state=closed] en el trigger).
  const defaultOpenSlotSection: string = hasPendingUnassigned ? "unassigned" : getCurrentTimeSlotKey();
  const [manualOpenSlotSection, setManualOpenSlotSection] = useState<string | null>(null);
  // Al cambiar de día (previsualización) se descarta la elección manual y se vuelve a calcular
  // la sección por defecto para ese día — abrir "Sin asignar" en un día no tiene por qué seguir
  // abierto al pasar a previsualizar otro.
  const [lastSlotSectionDate, setLastSlotSectionDate] = useState(effectiveDate);
  if (effectiveDate !== lastSlotSectionDate) {
    setLastSlotSectionDate(effectiveDate);
    setManualOpenSlotSection(null);
  }
  const openSlotSection = manualOpenSlotSection ?? defaultOpenSlotSection;

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

  // Duplicar una tarea manual repite su título tal cual. Duplicar un hábito crea, en cambio,
  // una tarea manual suelta (no ligada al hábito) con su nombre: la copia no marca el hábito
  // como hecho al confirmarla, sino que se tilda a mano como cualquier tarea manual.
  const duplicateManualItem = (item: TodayItem) => {
    const task = manualTasks.find((t) => t.id === item.id);
    if (!task) return;
    createManualTask.mutate({ date: effectiveDate, title: task.title });
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

  // Mantener presionado el fondo (fuera de una tarea puntual) abre el diálogo para agregar
  // una tarea manual al día que se está viendo (hoy, o el día previsualizado), sin franja.
  const startBackgroundLongPress = () => {
    backgroundLongPressTimer.current = setTimeout(() => {
      setNewTaskTitle("");
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
    const created = await createManualTask.mutateAsync({ date: effectiveDate, title });
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
                        type="single"
                        value={openSlotSection}
                        onValueChange={(v) => v && setManualOpenSlotSection(v)}
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
                                  <TodayTaskRow
                                    key={item.key}
                                    item={item}
                                    onMove={(slot) => moveItemToSlot(item, slot)}
                                    onHide={item.type !== "manual" ? () => hideItemFromToday(item) : undefined}
                                    onDelete={item.type === "manual" ? () => deleteManualItem(item) : undefined}
                                    onDuplicate={canDuplicate(item) ? () => duplicateItem(item) : undefined}
                                    onToggleDone={item.type === "manual" ? () => toggleManualDone(item) : undefined}
                                  />
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}

                        {TIME_SLOTS.map((s) => (
                          <AccordionItem key={s.key} value={s.key} className="border-0">
                            <AccordionTrigger
                              className="py-1.5 hover:no-underline data-[state=closed]:opacity-40 transition-opacity"
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
                              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                {s.label} ({itemBuckets[s.key].filter((i) => i.done).length}/{itemBuckets[s.key].length})
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
                                    // les toca), quedan más tenues.
                                    const isActiveSlot = s.key === getCurrentTimeSlotKey();
                                    const firstUndoneIdx = isActiveSlot ? itemBuckets[s.key].findIndex((i) => !i.done) : -1;
                                    return itemBuckets[s.key].map((item, idx) => (
                                      <TodayTaskRow
                                        key={item.key}
                                        item={item}
                                        dimmed={!item.done && idx !== firstUndoneIdx}
                                        onMove={(slot) => moveItemToSlot(item, slot)}
                                        onClear={() => unassignItem(item)}
                                        onHide={item.type !== "manual" ? () => hideItemFromToday(item) : undefined}
                                        onDelete={item.type === "manual" ? () => deleteManualItem(item) : undefined}
                                        onDuplicate={canDuplicate(item) ? () => duplicateItem(item) : undefined}
                                        onToggleDone={item.type === "manual" ? () => toggleManualDone(item) : undefined}
                                        onMoveUp={idx > 0 ? () => moveItemOrder(s.key, itemBuckets[s.key], idx, "up") : undefined}
                                        onMoveDown={idx < itemBuckets[s.key].length - 1 ? () => moveItemOrder(s.key, itemBuckets[s.key], idx, "down") : undefined}
                                      />
                                    ));
                                  })()}
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
                                <TodayTaskRow
                                  key={item.key}
                                  item={item}
                                  onMove={(slot) => moveItemToSlot(item, slot)}
                                  onDuplicate={canDuplicate(item) ? () => duplicateItem(item) : undefined}
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
        <DialogTitle>
          {addTaskTargetSlot
            ? `Nueva tarea para ${TIME_SLOTS.find((s) => s.key === addTaskTargetSlot)?.label}`
            : `Nueva tarea para ${isPreview ? "este día" : "hoy"}`}
        </DialogTitle>
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
  dimmed,
  onMove,
  onClear,
  onHide,
  onDelete,
  onDuplicate,
  onToggleDone,
  onMoveUp,
  onMoveDown,
}: {
  item: TodayItem;
  // Tarea sin hacer que no es "la que sigue" (la primera pendiente de la franja horaria
  // actual): se muestra más tenue. Incluye tanto a las pendientes de más abajo en la franja
  // activa como a todas las pendientes de las demás franjas, que todavía no les toca.
  dimmed?: boolean;
  onMove: (slot: TaskSlotKey) => void;
  onClear?: () => void;
  onHide?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
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
  // "Sacar de hoy" también está disponible en el menú (mismo diálogo de confirmación).
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
        className={`flex items-center gap-2 text-sm touch-none select-none transition-opacity ${
          dimmed ? "opacity-45" : ""
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
            {onDuplicate && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDuplicate}>Duplicar</DropdownMenuItem>
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
