import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { useSkillTree } from "@/lib/skill-context";
import { usePowerCelebration } from "@/lib/power-celebration-context";
import { queryClient } from "@/lib/queryClient";

// Mapa de habilidades radial: vive en /mapa-habilidades.html (JS propio, guarda en localStorage)
// y se muestra en un iframe. Las áreas del skill tree viajan en el hash para que el mapa solo
// deje elegir áreas que ya existen en vez de escribirlas a mano.
export function RadarSkillMapModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { areas, refreshSkillTrees } = useSkillTree();
  const { resolvedTheme } = useTheme();
  const { showPowerCelebration } = usePowerCelebration();

  // Al lograr un subskill el mapa crea un nodo SideQuest y un poder en el área y avisa para
  // recargar los árboles (y los poderes) y mostrar el pop-up de nuevo poder.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      // Habilidad agendada desde el mapa: el mapa ya creó la tarea manual de ese día, acá solo
      // se refrescan las listas de "Tareas de hoy" (y el calendario) para que aparezca.
      if (e.data?.type === "radar-task-scheduled") {
        queryClient.invalidateQueries({ queryKey: ["manual-today-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["manual-today-tasks-range"] });
        queryClient.invalidateQueries({ queryKey: ["today-task-slots"] });
        // Agendar una habilidad o actividad crea su nodo SideQuest pendiente, y completar una
        // actividad en el mapa lo confirma (o crea uno ya confirmado).
        if (e.data?.node) refreshSkillTrees();
        return;
      }
      if (e.data?.type !== "radar-side-quest") return;
      refreshSkillTrees();
      const powerName = e.data?.power?.name;
      if (typeof powerName === "string" && powerName) {
        queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/source-powers/") });
        showPowerCelebration({ name: powerName, kind: "confirmed" });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [refreshSkillTrees, showPowerCelebration]);

  const areaNames = (Array.isArray(areas) ? areas : [])
    .filter((a) => !a.upcoming)
    .map((a) => a.name.trim())
    .filter(Boolean);
  const areasKey = JSON.stringify(Array.from(new Set(areaNames)));
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  // Solo cambia (y recarga el iframe) si cambian los nombres de las áreas o el tema.
  const src = useMemo(
    () => `/mapa-habilidades.html#${new URLSearchParams({ areas: areasKey, theme }).toString()}`,
    [areasKey, theme]
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="radar-skill-map-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative overflow-hidden rounded-3xl border border-border/50 bg-background max-w-5xl w-full h-[90dvh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe key={src} src={src} title="Mapa de habilidades" className="flex-1 w-full border-0" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
