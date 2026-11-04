import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TodayActivity } from "@shared/schema";

// Actividades: tareas ya armadas (título + skills globales) que se agregan a "Tareas de hoy"
// desde el acordeón "Actividades" del formulario de nueva tarea. El XP no se elige: completarla
// siempre suma 1 bloque (de los 10 de la barra) a cada skill.
export function useTodayActivities(enabled = true) {
  return useQuery({
    queryKey: ["today-activities"],
    queryFn: async () => {
      const res = await fetch("/api/today-activities");
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json() as Promise<TodayActivity[]>;
    },
    enabled,
  });
}

type ActivityFields = { title: string; skillIds: string[] };

export function useSaveTodayActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    // Con id la edita; sin id la crea.
    mutationFn: async ({ id, ...fields }: ActivityFields & { id?: string }) => {
      const res = await fetch(id ? `/api/today-activities/${id}` : "/api/today-activities", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error("Failed to save activity");
      return res.json() as Promise<TodayActivity>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["today-activities"] }),
  });
}

export function useDeleteTodayActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/today-activities/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete activity");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["today-activities"] }),
  });
}
