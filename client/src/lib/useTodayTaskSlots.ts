import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TodayTaskSlot } from "@shared/schema";

export type TaskSlotKey = "morning" | "midday" | "afternoon" | "night" | "hidden";
export type TaskType = "habit" | "node" | "practice";

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
