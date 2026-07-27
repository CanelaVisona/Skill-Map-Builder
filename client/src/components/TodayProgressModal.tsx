import React, { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Eye, ArrowLeft, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useSkillTree, type Area, type Project, type Skill } from "@/lib/skill-context";
import { useHabits } from "@/lib/useHabits";
import { useTodayTaskSlots, useSetTodayTaskSlot, useClearTodayTaskSlot, type TaskSlotKey, type TaskType } from "@/lib/useTodayTaskSlots";
import { calculateStatus, calculateStatusL2, type SpaceRepetitionPractice } from "@/components/SpaceRepetitionModal";
import type { Habit, HabitRecord } from "@shared/schema";

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

  const todayStr = getDateStr(new Date());
  const todayDayOfWeek = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  const habitsScheduledToday = (habitsData || []).filter((h) => {
    if (h.endDate && h.endDate < todayStr) return false;
    const days = h.scheduledDays?.length ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
    return days.includes(todayDayOfWeek);
  });

  const todayRecordQueries = useQueries({
    queries: habitsScheduledToday.map((h) => ({
      queryKey: ["habit-records", h.id, todayStr, todayStr],
      queryFn: async () => {
        const res = await fetch(`/api/habit-records/${h.id}?startDate=${todayStr}&endDate=${todayStr}`);
        if (!res.ok) throw new Error("Failed to fetch habit records");
        return res.json() as Promise<HabitRecord[]>;
      },
      enabled: open,
    })),
  });

  const habitItems = habitsScheduledToday.map((h, i) => ({
    id: h.id,
    label: `${h.emoji} ${h.name}`,
    done: !!(todayRecordQueries[i]?.data as HabitRecord[] | undefined)?.some(
      (r) => r.date === todayStr && r.completed === 1
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

  const plannedNodesToday = allPlannedNodes.filter((n) => n.plannedDate === todayStr);

  // Prácticas de repetición espaciada que vencían hoy ("expires_soon") o que se confirmaron
  // hoy (lastConfirmedAt cae en la fecha de hoy y ya avanzaron a otro estado).
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
      const pending = status === "expires_soon";
      const confirmedAt = p.lastConfirmedAt || p.updatedAt;
      const confirmedToday = !pending && status !== "loss" && status !== "frozen" && !!confirmedAt && getDateStr(new Date(confirmedAt)) === todayStr;
      return { practice: p, done: confirmedToday, include: pending || confirmedToday };
    })
    .filter((entry) => entry.include);

  // Actividad extra: hábitos y nodos hechos hoy que no estaban configurados para hoy
  // (hábito no programado ese día, o nodo sin fecha planeada para hoy).
  const habitsNotScheduledToday = (habitsData || []).filter(
    (h) => !habitsScheduledToday.some((s) => s.id === h.id)
  );

  const otherHabitRecordQueries = useQueries({
    queries: habitsNotScheduledToday.map((h) => ({
      queryKey: ["habit-records", h.id, todayStr, todayStr],
      queryFn: async () => {
        const res = await fetch(`/api/habit-records/${h.id}?startDate=${todayStr}&endDate=${todayStr}`);
        if (!res.ok) throw new Error("Failed to fetch habit records");
        return res.json() as Promise<HabitRecord[]>;
      },
      enabled: open,
    })),
  });

  const extraHabits = habitsNotScheduledToday
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

  const extraNodes = [
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

  // Franjas horarias: cada tarea de hoy (hábito/nodo/práctica) puede asignarse a
  // mañana/mediodía/tarde/noche, o marcarse "hidden" (mantener presionada una tarea no hecha)
  // para que deje de contar como tarea de hoy. La asignación es por día (queryKey incluye
  // todayStr).
  const { data: slotsData } = useTodayTaskSlots(todayStr, open);
  const setTaskSlot = useSetTodayTaskSlot();
  const clearTaskSlot = useClearTodayTaskSlot();

  const slotByKey = new Map<string, TaskSlotKey>();
  (slotsData || []).forEach((s) => slotByKey.set(`${s.taskType}:${s.taskId}`, s.slot as TaskSlotKey));
  // "hidden" solo oculta mientras la tarea sigue sin hacer: si después se confirma, tiene
  // que volver a aparecer en tareas de hoy (ya como hecha), no quedar oculta para siempre.
  const isHidden = (key: string) => slotByKey.get(key) === "hidden";

  const visibleHabitItems = habitItems.filter((h) => h.done || !isHidden(`habit:${h.id}`));
  const visiblePlannedNodesToday = plannedNodesToday.filter((n) => n.done || !isHidden(`node:${n.id}`));
  const visiblePracticesToday = practicesToday.filter(({ practice: p, done }) => done || !isHidden(`practice:${p.id}`));

  const totalHabits = visibleHabitItems.length;
  const completedHabits = visibleHabitItems.filter((h) => h.done).length;
  const totalNodes = visiblePlannedNodesToday.length;
  const completedNodes = visiblePlannedNodesToday.filter((n) => n.done).length;
  const totalPractices = visiblePracticesToday.length;
  const completedPractices = visiblePracticesToday.filter((p) => p.done).length;

  // Tareas configuradas para hoy (usado para decidir si se muestra el acordeón de franjas
  // horarias, que no debe aparecer si lo único que hay es actividad extra en "Más").
  const totalConfigured = totalHabits + totalNodes + totalPractices;

  // Los ítems de "Más" ya están todos hechos (son actividad extra detectada como completada
  // hoy), así que suman por igual a total y a completed.
  const total = totalConfigured + extraItems.length;
  const completed = completedHabits + completedNodes + completedPractices + extraItems.length;
  const progressPct = total > 0 ? (completed / total) * 100 : 0;

  const todayItems: TodayItem[] = [
    ...visibleHabitItems.map((h) => ({ key: `habit:${h.id}`, type: "habit" as const, id: h.id, label: h.label, done: h.done })),
    ...visiblePlannedNodesToday.map((n) => ({
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

  // El acordeón de franjas horarias solo se muestra si hay algo para agrupar ahí: tareas
  // configuradas para hoy, o actividad extra que ya se movió a una franja específica.
  const hasSlotSection = itemBuckets.unassigned.length > 0 || TIME_SLOTS.some((s) => itemBuckets[s.key].length > 0);

  const moveItemToSlot = (item: TodayItem, slot: TaskSlotKey) => {
    setTaskSlot.mutate({ date: todayStr, taskType: item.type, taskId: item.id, slot });
  };

  const unassignItem = (item: TodayItem) => {
    clearTaskSlot.mutate({ date: todayStr, taskType: item.type, taskId: item.id });
  };

  const hideItemFromToday = (item: TodayItem) => {
    setTaskSlot.mutate({ date: todayStr, taskType: item.type, taskId: item.id, slot: "hidden" });
  };

  const todayLabel = new Date().toLocaleDateString("es-AR", {
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
    if (dateStr === todayStr) {
      const todayHabitsDoneIds = new Set([
        ...visibleHabitItems.filter((h) => h.done).map((h) => h.id),
        ...extraHabits.map((h) => h.id),
      ]);
      return {
        habitsDone: activeHabitsThisMonth.filter((h) => todayHabitsDoneIds.has(h.id)),
        nodesDone: [...visiblePlannedNodesToday.filter((n) => n.done), ...extraNodes],
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border-none max-h-[85vh] overflow-y-auto minimal-scrollbar" showCloseButton={false}>
        <VisuallyHidden>
          <DialogTitle>Progreso de hoy</DialogTitle>
        </VisuallyHidden>

        {viewMode === "progress" ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-2xl font-bold">Hoy</h2>
                <p className="text-sm text-muted-foreground capitalize">
                  {todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}
                </p>
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

            <ScrollArea className="h-[40vh] pr-4">
              <div className="space-y-4">
                {total === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No tenés tareas para hoy. Marcá una fecha en un nodo (mantené presionado su título) para que aparezca acá.
                  </div>
                ) : (
                  <>
                    {hasSlotSection && (
                      <Accordion
                        type="multiple"
                        defaultValue={["unassigned", ...TIME_SLOTS.map((s) => s.key)]}
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
                                    onHide={() => hideItemFromToday(item)}
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
                                  {itemBuckets[s.key].map((item) => (
                                    <TodayTaskRow
                                      key={item.key}
                                      item={item}
                                      onMove={(slot) => moveItemToSlot(item, slot)}
                                      onClear={() => unassignItem(item)}
                                      onHide={() => hideItemFromToday(item)}
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
                    onClick={() => setSelectedDay((prev) => (prev === dateStr ? null : dateStr))}
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
  );
}

const HIDE_LONG_PRESS_MS = 1500;

function TodayTaskRow({
  item,
  onMove,
  onClear,
  onHide,
}: {
  item: TodayItem;
  onMove: (slot: TaskSlotKey) => void;
  onClear?: () => void;
  onHide?: () => void;
}) {
  const [confirmHideOpen, setConfirmHideOpen] = useState(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = React.useRef(false);

  // Mantener presionada una tarea no hecha ofrece sacarla de tareas de hoy (item.done ya
  // completado no necesita esto). Mismo timing (1500ms) que el long-press de SkillNode.
  const canHide = !item.done && !!onHide;

  const startLongPress = () => {
    if (!canHide) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setConfirmHideOpen(true);
    }, HIDE_LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
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
          className={`h-4 w-4 flex-shrink-0 rounded-full border-2 ${
            item.done ? "bg-emerald-500 border-emerald-500" : "border-border/50"
          }`}
        />
        <span className={`flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.label}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full hover:bg-muted transition-colors"
              title="Asignar franja horaria"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {canHide && (
        <AlertDialog open={confirmHideOpen} onOpenChange={setConfirmHideOpen}>
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
    </>
  );
}
