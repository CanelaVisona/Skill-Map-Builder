import { useQueries, useQuery } from "@tanstack/react-query";
import { useSkillTree, type Area, type Project, type Skill } from "@/lib/skill-context";
import { useHabits } from "@/lib/useHabits";
import { useManualTasks } from "@/lib/useManualTasks";
import { useTodayTaskSlots } from "@/lib/useTodayTaskSlots";
import { calculateStatus, calculateStatusL2, type SpaceRepetitionPractice } from "@/components/SpaceRepetitionModal";
import type { HabitRecord } from "@shared/schema";

function getDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateStrToDayOfWeek(dateStr: string): number {
  const dow = new Date(dateStr + "T12:00:00").getDay();
  return dow === 0 ? 6 : dow - 1;
}

// Espejo simplificado (sin la "foto" de ocultos al abrir el modal, que solo tiene sentido
// durante una sesión del modal) del total/completado que muestra TodayProgressModal, pensado
// para poder observarse en segundo plano y detectar cuándo sube el completado, sin depender
// de que el modal esté abierto.
export function useTodayProgressSummary() {
  const { areas, projects } = useSkillTree();
  const { data: habitsData } = useHabits();
  const todayStr = getDateStr(new Date());
  const todayDayOfWeek = dateStrToDayOfWeek(todayStr);

  const habitsScheduledToday = (habitsData || []).filter((h) => {
    if (h.endDate && h.endDate < todayStr) return false;
    const days = h.scheduledDays?.length ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
    return days.includes(todayDayOfWeek);
  });
  const habitsNotScheduledToday = (habitsData || []).filter(
    (h) => !habitsScheduledToday.some((s) => s.id === h.id)
  );

  const scheduledRecordQueries = useQueries({
    queries: habitsScheduledToday.map((h) => ({
      queryKey: ["habit-records", h.id, todayStr, todayStr],
      queryFn: async () => {
        const res = await fetch(`/api/habit-records/${h.id}?startDate=${todayStr}&endDate=${todayStr}`);
        if (!res.ok) throw new Error("Failed to fetch habit records");
        return res.json() as Promise<HabitRecord[]>;
      },
    })),
  });

  const otherRecordQueries = useQueries({
    queries: habitsNotScheduledToday.map((h) => ({
      queryKey: ["habit-records", h.id, todayStr, todayStr],
      queryFn: async () => {
        const res = await fetch(`/api/habit-records/${h.id}?startDate=${todayStr}&endDate=${todayStr}`);
        if (!res.ok) throw new Error("Failed to fetch habit records");
        return res.json() as Promise<HabitRecord[]>;
      },
    })),
  });

  const habitItems = habitsScheduledToday.map((h, i) => ({
    id: h.id,
    done: !!(scheduledRecordQueries[i]?.data as HabitRecord[] | undefined)?.some(
      (r) => r.date === todayStr && r.completed === 1
    ),
  }));

  const extraHabitsDoneToday = habitsNotScheduledToday
    .map((h, i) => ({
      id: h.id,
      done: !!(otherRecordQueries[i]?.data as HabitRecord[] | undefined)?.some(
        (r) => r.date === todayStr && r.completed === 1
      ),
    }))
    .filter((h) => h.done);

  const { data: practicesData } = useQuery({
    queryKey: ["space-repetition"],
    queryFn: async () => {
      const res = await fetch("/api/space-repetition");
      if (!res.ok) throw new Error("Failed to fetch space repetition practices");
      return res.json() as Promise<SpaceRepetitionPractice[]>;
    },
  });

  const practicesToday = (practicesData || [])
    .map((p) => {
      const status = p.level === 2 ? calculateStatusL2(p) : calculateStatus(p);
      const pending = status === "expires_soon";
      const confirmedAt = p.lastConfirmedAt || p.updatedAt;
      const confirmedToday =
        !pending && status !== "loss" && status !== "frozen" && !!confirmedAt && getDateStr(new Date(confirmedAt)) === todayStr;
      return { id: p.id, done: confirmedToday, include: pending || confirmedToday };
    })
    .filter((entry) => entry.include);

  const collectPlannedNodes = (list: (Area | Project)[]) => {
    const result: { id: string; done: boolean }[] = [];
    list.forEach((parent) => {
      (parent.skills || []).forEach((skill: Skill) => {
        if (skill.plannedDate === todayStr) {
          result.push({ id: skill.id, done: skill.status === "mastered" });
        }
      });
    });
    return result;
  };

  const plannedNodesToday = [
    ...collectPlannedNodes(Array.isArray(areas) ? areas : []),
    ...collectPlannedNodes(Array.isArray(projects) ? projects : []),
  ];

  const collectExtraCompletedNodes = (list: (Area | Project)[]) => {
    const result: { id: string }[] = [];
    list.forEach((parent) => {
      (parent.skills || []).forEach((skill: Skill) => {
        if (skill.status === "mastered" && skill.completedAt && !skill.plannedDate) {
          const completedDateStr = getDateStr(new Date(skill.completedAt));
          if (completedDateStr === todayStr) {
            result.push({ id: skill.id });
          }
        }
      });
    });
    return result;
  };

  const extraNodesToday = [
    ...collectExtraCompletedNodes(Array.isArray(areas) ? areas : []),
    ...collectExtraCompletedNodes(Array.isArray(projects) ? projects : []),
  ];

  const { data: manualTasksData } = useManualTasks(todayStr, true);
  const manualTasks = manualTasksData || [];

  const { data: slotsData } = useTodayTaskSlots(todayStr, true);
  const isHidden = (key: string) => (slotsData || []).some((s) => `${s.taskType}:${s.taskId}` === key && s.slot === "hidden");

  const visibleHabits = habitItems.filter((h) => h.done || !isHidden(`habit:${h.id}`));
  const visibleNodes = plannedNodesToday.filter((n) => n.done || !isHidden(`node:${n.id}`));
  const visiblePractices = practicesToday.filter((p) => p.done || !isHidden(`practice:${p.id}`));

  const total =
    visibleHabits.length +
    visibleNodes.length +
    visiblePractices.length +
    manualTasks.length +
    extraHabitsDoneToday.length +
    extraNodesToday.length;

  const completed =
    visibleHabits.filter((h) => h.done).length +
    visibleNodes.filter((n) => n.done).length +
    visiblePractices.filter((p) => p.done).length +
    manualTasks.filter((t) => t.done === 1).length +
    extraHabitsDoneToday.length +
    extraNodesToday.length;

  return { total, completed };
}
