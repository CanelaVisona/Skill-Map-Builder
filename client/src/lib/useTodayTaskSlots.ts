import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TodayTaskSlot } from "@shared/schema";

export type TaskSlotKey = "morning" | "midday" | "afternoon" | "night" | "hidden";
export type TaskType = "habit" | "node" | "practice" | "manual";

// Mañana 6-11, mediodía 12-16, tarde 17-20, noche 21-23 y también las horas de
// madrugada (0-5), que caen dentro del tramo nocturno del día anterior.
export function getCurrentTimeSlotKey(): "morning" | "midday" | "afternoon" | "night" {
  const hour = new Date().getHours();
  if (hour >= 6 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 16) return "midday";
  if (hour >= 17 && hour <= 20) return "afternoon";
  return "night";
}

export function useTodayTaskSlots(date: string, enabled = true) {
  return useQuery({
    queryKey: ["today-task-slots", date],
    queryFn: async () => {
      const res = await fetch(`/api/today-task-slots?date=${date}`);
      if (!res.ok) throw new Error("Failed to fetch today task slots");
      return res.json() as Promise<TodayTaskSlot[]>;
    },
    enabled,
  });
}

export function useSetTodayTaskSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      date,
      taskType,
      taskId,
      slot,
    }: {
      date: string;
      taskType: TaskType;
      taskId: string;
      slot: TaskSlotKey;
    }) => {
      const res = await fetch("/api/today-task-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, taskType, taskId, slot }),
      });
      if (!res.ok) throw new Error("Failed to set today task slot");
      return res.json() as Promise<TodayTaskSlot>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["today-task-slots", variables.date] });
    },
  });
}

export function useReorderTodayTaskSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      date,
      taskType,
      taskId,
      direction,
    }: {
      date: string;
      taskType: TaskType;
      taskId: string;
      direction: "up" | "down";
    }) => {
      const res = await fetch("/api/today-task-slots/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, taskType, taskId, direction }),
      });
      if (!res.ok) throw new Error("Failed to reorder today task slot");
      return res.json() as Promise<TodayTaskSlot[]>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["today-task-slots", variables.date] });
    },
  });
}

export function useClearTodayTaskSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      date,
      taskType,
      taskId,
    }: {
      date: string;
      taskType: TaskType;
      taskId: string;
    }) => {
      const res = await fetch(
        `/api/today-task-slots?date=${date}&taskType=${taskType}&taskId=${taskId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to clear today task slot");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["today-task-slots", variables.date] });
    },
  });
}
