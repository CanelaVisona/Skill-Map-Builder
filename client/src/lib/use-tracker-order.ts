import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { loadProgressTrackerPrefs } from "@/lib/progress-tracker-settings";

const QUERY_KEY = ["/api/tracker-order"];
const EMPTY_ORDER: string[] = [];

// Orden manual del Progress Tracker, guardado en el servidor por usuario para que el
// tracker y el menú de áreas se vean igual en todos los dispositivos.
export function useTrackerOrder() {
  const queryClient = useQueryClient();

  const { data, isSuccess } = useQuery<string[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/tracker-order");
      const body = (await res.json()) as { order?: unknown };
      return Array.isArray(body.order) ? body.order.filter((k): k is string => typeof k === "string") : [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (order: string[]) => {
      await apiRequest("PUT", "/api/tracker-order", { order });
    },
    // Optimista: la fila se mueve al instante; si falla se vuelve a pedir al servidor.
    onMutate: (order) => {
      queryClient.setQueryData(QUERY_KEY, order);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  // Antes el orden vivía en localStorage: si el servidor todavía no tiene ninguno, se sube
  // el de este dispositivo una sola vez para no perder el orden que ya estaba armado.
  const migratedRef = useRef(false);
  useEffect(() => {
    if (!isSuccess || migratedRef.current) return;
    migratedRef.current = true;
    if (data && data.length > 0) return;
    const localOrder = loadProgressTrackerPrefs().order;
    if (localOrder.length > 0) mutation.mutate(localOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  return { order: data ?? EMPTY_ORDER, setOrder: mutation.mutate };
}
