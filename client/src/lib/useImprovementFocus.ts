import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// "¿En qué estoy trabajando para mejorar hoy?" (debajo de la barra de "Tareas de hoy"): una
// respuesta por día. `previous` es la respuesta más reciente de un día anterior, para precargar
// el diálogo al responder (así se puede seguir con lo mismo o actualizarlo).
export function useImprovementFocus(date: string, enabled = true) {
  return useQuery({
    queryKey: ["improvement-focus", date],
    queryFn: async () => {
      const res = await fetch(`/api/improvement-focus?date=${date}`);
      if (!res.ok) throw new Error("Failed to fetch improvement focus");
      return (await res.json()) as { date: string; text: string; previous: string | null };
    },
    enabled,
  });
}

// Las respuestas de un rango de días (calendario del mes).
export function useImprovementFocusRange(startDate: string, endDate: string, enabled = true) {
  return useQuery({
    queryKey: ["improvement-focus-range", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/improvement-focus?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error("Failed to fetch improvement focus range");
      return (await res.json()) as { date: string; text: string }[];
    },
    enabled,
  });
}

export function useSetImprovementFocus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, text }: { date: string; text: string }) => {
      const res = await fetch("/api/improvement-focus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, text }),
      });
      if (!res.ok) throw new Error("Failed to save improvement focus");
      return (await res.json()) as { date: string; text: string };
    },
    onSuccess: (_data, { date }) => {
      queryClient.invalidateQueries({ queryKey: ["improvement-focus", date] });
      queryClient.invalidateQueries({ queryKey: ["improvement-focus-range"] });
    },
  });
}
