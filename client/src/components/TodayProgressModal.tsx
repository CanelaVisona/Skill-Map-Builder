import { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useSkillTree, type Area, type Project, type Skill } from "@/lib/skill-context";
import { useHabits } from "@/lib/useHabits";
import { calculateStatus, calculateStatusL2, type SpaceRepetitionPractice } from "@/components/SpaceRepetitionModal";
import type { Habit, HabitRecord } from "@shared/schema";

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

  // Prácticas de repetición espaciada. El modelo no guarda una fecha por intervalo
  // confirmado, así que no hay forma exacta de saber "se confirmó hoy" — se aproxima con
  // updatedAt: si la práctica se tocó hoy y ya no está "expires_soon"/"loss"/"frozen" (o sea,
  // avanzó al siguiente intervalo), se cuenta como confirmada hoy. Esto puede dar algún falso
  // positivo si hoy se editó la práctica sin confirmar un intervalo, pero es el caso raro.
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
      const updatedToday = p.updatedAt ? getDateStr(new Date(p.updatedAt)) === todayStr : false;
      const confirmedToday = !pending && status !== "loss" && status !== "frozen" && updatedToday;
      return { practice: p, done: confirmedToday, include: pending || confirmedToday };
    })
    .filter((entry) => entry.include);

  const totalHabits = habitItems.length;
  const completedHabits = habitItems.filter((h) => h.done).length;
  const totalNodes = plannedNodesToday.length;
  const completedNodes = plannedNodesToday.filter((n) => n.done).length;
  const totalPractices = practicesToday.length;
  const completedPractices = practicesToday.filter((p) => p.done).length;

  const total = totalHabits + totalNodes + totalPractices;
  const completed = completedHabits + completedNodes + completedPractices;
  const progressPct = total > 0 ? (completed / total) * 100 : 0;

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
                {totalHabits > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Hábitos ({completedHabits}/{totalHabits})
                    </h3>
                    {habitItems.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 text-sm">
                        <span
                          className={`h-4 w-4 flex-shrink-0 rounded-full border-2 ${
                            h.done ? "bg-emerald-500 border-emerald-500" : "border-border/50"
                          }`}
                        />
                        <span className={h.done ? "line-through text-muted-foreground" : ""}>{h.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {totalNodes > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Nodos ({completedNodes}/{totalNodes})
                    </h3>
                    {plannedNodesToday.map((n) => (
                      <div key={n.id} className="flex items-center gap-2 text-sm">
                        <span
                          className={`h-4 w-4 flex-shrink-0 rounded-full border-2 ${
                            n.done ? "bg-emerald-500 border-emerald-500" : "border-border/50"
                          }`}
                        />
                        <span className={n.done ? "line-through text-muted-foreground" : ""}>
                          {n.title} <span className="text-muted-foreground">· {n.parentName}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {totalPractices > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Repaso espaciado ({completedPractices}/{totalPractices})
                    </h3>
                    {practicesToday.map(({ practice: p, done }) => (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <span
                          className={`h-4 w-4 flex-shrink-0 rounded-full border-2 ${
                            done ? "bg-emerald-500 border-emerald-500" : "border-border/50"
                          }`}
                        />
                        <span className={done ? "line-through text-muted-foreground" : ""}>{p.emoji} {p.name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {total === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No tenés tareas para hoy. Marcá una fecha en un nodo (mantené presionado su título) para que aparezca acá.
                  </div>
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
