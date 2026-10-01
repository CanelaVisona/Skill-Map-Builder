import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Prioridades del día ("no negociables"): hasta 3 tareas de "Tareas de hoy" destacadas con la
// estrellita. Cada una se identifica con la misma key que usa TodayProgressModal para sus
// ítems: `${taskType}:${taskId}`.
export const MAX_TODAY_PRIORITIES = 3;

export function useTodayPriorities(date: string, enabled = true) {
  return useQuery({
    queryKey: ["today-priorities", date],
    queryFn: async () => {
      const res = await fetch(`/api/today-priorities?date=${date}`);
      if (!res.ok) throw new Error("Failed to fetch today priorities");
      const data = (await res.json()) as { date: string; taskKeys: string[] };
      return data.taskKeys;
    },
    enabled,
  });
}

export function useSetTodayPriorities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, taskKeys }: { date: string; taskKeys: string[] }) => {
      const res = await fetch("/api/today-priorities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, taskKeys }),
      });
      if (!res.ok) throw new Error("Failed to set today priorities");
      const data = (await res.json()) as { date: string; taskKeys: string[] };
      return data.taskKeys;
    },
    // Optimista: la estrellita de la fila y el pop-up se actualizan al toque.
    onMutate: async ({ date, taskKeys }) => {
      await queryClient.cancelQueries({ queryKey: ["today-priorities", date] });
      const previous = queryClient.getQueryData<string[]>(["today-priorities", date]);
      queryClient.setQueryData<string[]>(["today-priorities", date], taskKeys);
      return { previous };
    },
    onError: (_err, { date }, context) => {
      queryClient.setQueryData(["today-priorities", date], context?.previous);
    },
    onSettled: (_data, _err, { date }) => {
      queryClient.invalidateQueries({ queryKey: ["today-priorities", date] });
    },
  });
}
