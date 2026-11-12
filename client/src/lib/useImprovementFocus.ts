import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Sección desplegable debajo de la barra de "Tareas de hoy", con dos preguntas por día:
// - text: "¿En qué estoy trabajando para mejorar hoy?"
// - mistakeText: "¿En qué voy a equivocarme hoy?"
// `previous` es la respuesta más reciente a la primera de un día anterior, para precargar el
// diálogo al responder (así se puede seguir con lo mismo o actualizarlo).
export function useImprovementFocus(date: string, enabled = true) {
  return useQuery({
    queryKey: ["improvement-focus", date],
    queryFn: async () => {
      const res = await fetch(`/api/improvement-focus?date=${date}`);
      if (!res.ok) throw new Error("Failed to fetch improvement focus");
      return (await res.json()) as { date: string; text: string; mistakeText: string; previous: string | null };
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
      return (await res.json()) as { date: string; text: string; mistakeText: string }[];
    },
    enabled,
  });
}

// Guarda solo la(s) respuesta(s) que se pasen.
export function useSetImprovementFocus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, text, mistakeText }: { date: string; text?: string; mistakeText?: string }) => {
      const res = await fetch("/api/improvement-focus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, text, mistakeText }),
      });
      if (!res.ok) throw new Error("Failed to save improvement focus");
      return (await res.json()) as { date: string; text: string; mistakeText: string };
    },
    onSuccess: (_data, { date }) => {
      queryClient.invalidateQueries({ queryKey: ["improvement-focus", date] });
      queryClient.invalidateQueries({ queryKey: ["improvement-focus-range"] });
    },
  });
}
