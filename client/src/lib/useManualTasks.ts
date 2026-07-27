import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ManualTodayTask } from "@shared/schema";

export function useManualTasks(date: string, enabled = true) {
  return useQuery({
    queryKey: ["manual-today-tasks", date],
    queryFn: async () => {
      const res = await fetch(`/api/manual-today-tasks?date=${date}`);
      if (!res.ok) throw new Error("Failed to fetch manual tasks");
      return res.json() as Promise<ManualTodayTask[]>;
    },
    enabled,
  });
}

export function useCreateManualTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, title }: { date: string; title: string }) => {
      const res = await fetch("/api/manual-today-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, title }),
      });
      if (!res.ok) throw new Error("Failed to create manual task");
      return res.json() as Promise<ManualTodayTask>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["manual-today-tasks", variables.date] });
    },
  });
}

export function useUpdateManualTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      date,
      updates,
    }: {
      id: string;
      date: string;
      updates: { title?: string; done?: 0 | 1 };
    }) => {
      const res = await fetch(`/api/manual-today-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update manual task");
      return res.json() as Promise<ManualTodayTask>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["manual-today-tasks", variables.date] });
    },
  });
}

export function useDeleteManualTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; date: string }) => {
      const res = await fetch(`/api/manual-today-tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete manual task");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["manual-today-tasks", variables.date] });
      queryClient.invalidateQueries({ queryKey: ["today-task-slots"] });
    },
  });
}
