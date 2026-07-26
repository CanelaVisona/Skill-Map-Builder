import React, { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
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

  // Actividad extra: hábitos, nodos y rewirings hechos hoy que no estaban configurados
  // para hoy (hábito no programado ese día, nodo sin fecha planeada para hoy, o
  // cualquier rewiring, que no tiene concepto de "programado").
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

  const collectExtraCompletedNodes = (list: (Area | Project)[]): PlannedNode[] => {
    const result: PlannedNode[] = [];
    list.forEach((parent) => {
      (parent.skills || []).forEach((skill: Skill) => {
        // Si el nodo tiene una fecha planeada (sea hoy u otro día), pertenece a ese día
        // (columna "When exactly?") y no debe aparecer acá aunque se haya confirmado hoy.
        if (
          skill.status === "mastered" &&
          skill.completedAt &&
          getDateStr(new Date(skill.completedAt)) === todayStr &&
          !skill.plannedDate
        ) {
          result.push({
            id: skill.id,
            title: skill.title || "Sin nombre",
            parentName: parent.name,
            plannedDate: skill.plannedDate || "",
            done: true,
          });
        }
      });
    });
    return result;
  };

  const extraNodes = [
    ...collectExtraCompletedNodes(Array.isArray(areas) ? areas : []),
    ...collectExtraCompletedNodes(Array.isArray(projects) ? projects : []),
  ];

  const { data: rewiringTrackersData } = useQuery({
    queryKey: ["rewiring-trackers"],
    queryFn: async () => {
      const res = await fetch("/api/rewiring-trackers");
      if (!res.ok) throw new Error("Failed to fetch rewiring trackers");
      return res.json() as Promise<Array<{ id: string; name: string; archivedAt?: string | null; history: { timestamp: string }[] }>>;
    },
    enabled: open,
  });

  const extraRewirings = (rewiringTrackersData || []).filter(
    (t) => !t.archivedAt && (t.history || []).some((h) => getDateStr(new Date(h.timestamp)) === todayStr)
  );

  interface ExtraItem {
    key: string;
    label: React.ReactNode;
  }

  const extraItems: ExtraItem[] = [
    ...extraHabits.map((h) => ({ key: `xhabit:${h.id}`, label: h.label })),
    ...extraNodes.map((n) => ({
      key: `xnode:${n.id}`,
      label: (
        <>
          {n.title} <span className="text-muted-foreground">· {n.parentName}</span>
        </>
      ),
    })),
    ...extraRewirings.map((t) => ({ key: `xrewiring:${t.id}`, label: `🔄 ${t.name}` })),
  ];

  const totalHabits = habitItems.length;
  const completedHabits = habitItems.filter((h) => h.done).length;
  const totalNodes = plannedNodesToday.length;
  const completedNodes = plannedNodesToday.filter((n) => n.done).length;
  const totalPractices = practicesToday.length;
  const completedPractices = practicesToday.filter((p) => p.done).length;

  const total = totalHabits + totalNodes + totalPractices;
  const completed = completedHabits + completedNodes + completedPractices;
  const progressPct = total > 0 ? (completed / total) * 100 : 0;

  // Franjas horarias: cada tarea de hoy (hábito/nodo/práctica) puede asignarse a
  // mañana/mediodía/tarde/noche; la asignación es por día (queryKey incluye todayStr).
  const { data: slotsData } = useTodayTaskSlots(todayStr, open);
  const setTaskSlot = useSetTodayTaskSlot();
  const clearTaskSlot = useClearTodayTaskSlot();

  const slotByKey = new Map<string, TaskSlotKey>();
  (slotsData || []).forEach((s) => slotByKey.set(`${s.taskType}:${s.taskId}`, s.slot as TaskSlotKey));

  const todayItems: TodayItem[] = [
    ...habitItems.map((h) => ({ key: `habit:${h.id}`, type: "habit" as const, id: h.id, label: h.label, done: h.done })),
    ...plannedNodesToday.map((n) => ({
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
    ...practicesToday.map(({ practice: p, done }) => ({
      key: `practice:${p.id}`,
      type: "practice" as const,
      id: p.id,
      label: `${p.emoji} ${p.name}`,
      done,
    })),
  ];

  const itemBuckets: Record<string, TodayItem[]> = { unassigned: [] };
  TIME_SLOTS.forEach((s) => (itemBuckets[s.key] = []));
  todayItems.forEach((item) => {
    const slot = slotByKey.get(item.key);
    itemBuckets[slot ?? "unassigned"].push(item);
  });

  const moveItemToSlot = (item: TodayItem, slot: TaskSlotKey) => {
    setTaskSlot.mutate({ date: todayStr, taskType: item.type, taskId: item.id, slot });
  };

  const unassignItem = (item: TodayItem) => {
    clearTaskSlot.mutate({ date: todayStr, taskType: item.type, taskId: item.id });
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

  const selectedDayDetails = (() => {
    if (!selectedDay) return null;
    const habitsDone = activeHabitsThisMonth.filter((h) => habitDoneDatesByHabit.get(h.id)?.has(selectedDay));
    const nodesDone = nodesThisMonth.filter((n) => n.plannedDate === selectedDay && n.done);
    return { habitsDone, nodesDone };
  })();

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
                {total === 0 && extraItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No tenés tareas para hoy. Marcá una fecha en un nodo (mantené presionado su título) para que aparezca acá.
                  </div>
                ) : (
                  <>
                    {total > 0 && (
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
                                  <TodayTaskRow key={item.key} item={item} onMove={(slot) => moveItemToSlot(item, slot)} />
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
                                    />
                                  ))}
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}

                    {extraItems.length > 0 && (
                      <div className="space-y-1.5">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Más ({extraItems.length})
                        </h3>
                        <div className="space-y-1.5">
                          {extraItems.map((item) => (
                            <div key={item.key} className="flex items-center gap-2 text-sm">
                              <span className="h-4 w-4 flex-shrink-0 rounded-full border-2 bg-emerald-500 border-emerald-500" />
                              <span>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
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

                const habitsDoneThatDay = activeHabitsThisMonth.filter((h) =>
                  habitDoneDatesByHabit.get(h.id)?.has(dateStr)
                );
                const nodesThatDay = nodesThisMonth.filter((n) => n.plannedDate === dateStr);
                const nodesDoneThatDay = nodesThatDay.filter((n) => n.done);

                const habitsScheduledThatDay = activeHabitsThisMonth.filter((h) => {
                  const days = h.scheduledDays?.length ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
                  const dow = dObj.getDay() === 0 ? 6 : dObj.getDay() - 1;
                  return days.includes(dow);
                });

                const totalForDay = habitsScheduledThatDay.length + nodesThatDay.length;
                const doneForDay = habitsDoneThatDay.length + nodesDoneThatDay.length;
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
                  {selectedDayDetails && (selectedDayDetails.habitsDone.length > 0 || selectedDayDetails.nodesDone.length > 0) ? (
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

function TodayTaskRow({
  item,
  onMove,
  onClear,
}: {
  item: TodayItem;
  onMove: (slot: TaskSlotKey) => void;
  onClear?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
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
  );
}
