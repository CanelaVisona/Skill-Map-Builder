import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { useSkillTree } from "@/lib/skill-context";

// Mapa de habilidades radial: vive en /mapa-habilidades.html (JS propio, guarda en localStorage)
// y se muestra en un iframe. Las áreas del skill tree viajan en el hash para que el mapa solo
// deje elegir áreas que ya existen en vez de escribirlas a mano.
export function RadarSkillMapModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { areas } = useSkillTree();
  const { resolvedTheme } = useTheme();

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
