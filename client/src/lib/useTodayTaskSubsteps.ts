import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TodayTaskSubstep } from "@shared/schema";

// Sub-pasos (checklist del día) de las tareas de "Tareas de hoy" que no son nodos.
export type SubstepTaskType = TodayTaskSubstep["taskType"];

export function useTodayTaskSubsteps(date: string, enabled = true) {
  return useQuery({
    queryKey: ["today-task-substeps", date],
    queryFn: async () => {
      const res = await fetch(`/api/today-task-substeps?date=${date}`);
      if (!res.ok) throw new Error("Failed to fetch today task substeps");
      return res.json() as Promise<TodayTaskSubstep[]>;
    },
    enabled,
  });
}

export function useCreateTodayTaskSubstep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { date: string; taskType: SubstepTaskType; taskId: string; title: string }) => {
      const res = await fetch("/api/today-task-substeps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create today task substep");
      return res.json() as Promise<TodayTaskSubstep>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["today-task-substeps", variables.date] });
    },
  });
}

export function useUpdateTodayTaskSubstep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; date: string; updates: { title?: string; done?: 0 | 1; sortOrder?: number; minutes?: number | null; minutesManual?: 0 | 1; deadline?: string | null } }) => {
      const res = await fetch(`/api/today-task-substeps/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update today task substep");
      return res.json() as Promise<TodayTaskSubstep>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["today-task-substeps", variables.date] });
    },
  });
}

export function useDeleteTodayTaskSubstep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; date: string }) => {
      const res = await fetch(`/api/today-task-substeps/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete today task substep");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["today-task-substeps", variables.date] });
    },
  });
}

// Sub-paso permanente de un hábito: se guarda en el hábito y aparece (sin confirmar) cada día que
// el hábito está en "Tareas de hoy". `date` crea ya la copia de ese día.
export function useCreateHabitSubstep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { habitId: string; title: string; date: string; minutes?: number | null }) => {
      const res = await fetch("/api/habit-substeps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create habit substep");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["today-task-substeps", variables.date] });
    },
  });
}

// Copia a los sub-pasos del día los sub-pasos permanentes de esos hábitos que todavía no estén.
export async function syncHabitSubsteps(date: string, habitIds: string[]): Promise<number> {
  const res = await fetch("/api/today-task-substeps/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, habitIds }),
  });
  if (!res.ok) return 0;
  const data = await res.json();
  return typeof data?.created === "number" ? data.created : 0;
}
