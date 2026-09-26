import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ManualTodayTask } from "@shared/schema";

function getLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Tareas por defecto de cada día (Desayuná/Almorzá/Merendá/Cená): el backend las crea al
// pedir la lista, con un id fijo que termina en ":default:<comida>".
export function isDefaultManualTask(id: string): boolean {
  return id.includes(":default:");
}

export function useManualTasks(date: string, enabled = true) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["manual-today-tasks", date],
    queryFn: async () => {
      // Solo hoy y días futuros reciben las tareas por defecto: un día pasado no debería
      // aparecer de golpe con comidas pendientes que nunca estuvieron ahí.
      const seed = date >= getLocalDateStr(new Date());
      const res = await fetch(`/api/manual-today-tasks?date=${date}${seed ? "&seedDefaults=1" : ""}`);
      if (!res.ok) throw new Error("Failed to fetch manual tasks");
      const tasks = (await res.json()) as ManualTodayTask[];
      // La siembra también crea la franja de cada comida: si la consulta de franjas llegó
      // antes, hay que refrescarla para que no se vean un instante en "Sin asignar".
      if (seed) queryClient.invalidateQueries({ queryKey: ["today-task-slots", date] });
      return tasks;
    },
    enabled,
  });
}

// Tareas/eventos manuales de todo un rango de fechas (el mes mostrado en el calendario de
// actividades), para poder previsualizar ahí lo agendado en días futuros.
export function useManualTasksRange(startDate: string, endDate: string, enabled = true) {
  return useQuery({
    queryKey: ["manual-today-tasks-range", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/manual-today-tasks?date=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error("Failed to fetch manual tasks range");
      return res.json() as Promise<ManualTodayTask[]>;
    },
    enabled,
  });
}

export function useCreateManualTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, title, kind }: { date: string; title: string; kind?: "task" | "event" }) => {
      const res = await fetch("/api/manual-today-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, title, kind }),
      });
      if (!res.ok) throw new Error("Failed to create manual task");
      return res.json() as Promise<ManualTodayTask>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["manual-today-tasks", variables.date] });
      queryClient.invalidateQueries({ queryKey: ["manual-today-tasks-range"] });
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
      // `updates.date` es el día NUEVO al que se mueve la tarea (mantener presionada una tarea
      // y elegir "Cambiar de día"); `date` arriba es el día ACTUAL bajo el que se la está
      // viendo, se usa solo para invalidar esa lista.
      updates: { title?: string; done?: 0 | 1; date?: string };
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
      queryClient.invalidateQueries({ queryKey: ["manual-today-tasks-range"] });
      if (variables.updates.date && variables.updates.date !== variables.date) {
        // Se movió de día: la lista del día nuevo también tiene que refrescarse, y la franja
        // horaria de la tarea (el server la borra del día viejo al moverla) también cambió.
        queryClient.invalidateQueries({ queryKey: ["manual-today-tasks", variables.updates.date] });
        queryClient.invalidateQueries({ queryKey: ["today-task-slots"] });
      }
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
      queryClient.invalidateQueries({ queryKey: ["manual-today-tasks-range"] });
      queryClient.invalidateQueries({ queryKey: ["today-task-slots"] });
    },
  });
}
