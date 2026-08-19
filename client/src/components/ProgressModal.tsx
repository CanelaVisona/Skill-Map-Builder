import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useSkillTree, type Area, type Project } from "@/lib/skill-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { calculateLevelProgressPercentage, countMasteredSkillsInLevel, countSkillsInLevel } from "@/lib/area-progress";

interface ProgressItem {
  id: string;
  name: string;
  icon?: string;
  type: "area" | "project";
  level: number;
  subtitle?: string;
  masteredInLevel: number;
  totalInLevel: number;
}

export function ProgressModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { areas, projects } = useSkillTree();

  const getLevelColor = (level: number): string => {
    const colors: { [key: number]: string } = {
      1: "bg-green-100 dark:bg-green-100",
      2: "bg-green-200 dark:bg-green-200",
      3: "bg-green-300 dark:bg-green-300",
      4: "bg-green-400 dark:bg-green-400",
      5: "bg-green-500 dark:bg-green-500",
      6: "bg-green-600 dark:bg-green-600",
      7: "bg-green-700 dark:bg-green-700",
      8: "bg-green-800 dark:bg-green-800",
    };
    return colors[level] || "bg-green-500 dark:bg-green-500";
  };

  const buildProgressItem = (item: Area | Project, type: "area" | "project"): ProgressItem => {
    const level = item.unlockedLevel;
    const skills = item.skills || [];
    return {
      id: item.id,
      name: item.name,
      icon: item.icon,
      type,
      level,
      subtitle: item.levelSubtitles?.[level.toString()],
      masteredInLevel: countMasteredSkillsInLevel(skills, level),
      totalInLevel: countSkillsInLevel(skills, level),
    };
  };

  const progressItems: ProgressItem[] = [
    ...(Array.isArray(areas) ? areas.map((area) => buildProgressItem(area, "area")) : []),
    ...(Array.isArray(projects) ? projects.map((project) => buildProgressItem(project, "project")) : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl border-none">
        <VisuallyHidden>
          <DialogTitle>Progress Tracker</DialogTitle>
        </VisuallyHidden>
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">Progress Tracker</h2>
          <ScrollArea className="h-[50vh] pr-4">
            <div className="space-y-5">
              {progressItems.map((item) => {
                const progress = calculateLevelProgressPercentage(item.masteredInLevel, item.totalInLevel);

                return (
                  <div key={`${item.type}-${item.id}`} className="space-y-1.5 pb-4 border-b border-border/40 last:border-none">
                    {/* Nombre + nivel */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.icon && <span className="text-base leading-none">{item.icon}</span>}
                        <span className="text-lg font-semibold truncate">{item.name}</span>
                        <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${getLevelColor(item.level)} text-gray-900 dark:text-black`}>
                          Lvl {item.level}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-muted-foreground">
                        {item.masteredInLevel}/{item.totalInLevel}
                      </span>
                    </div>

                    {/* Subtítulo del nivel actual: aclara de qué es la barra de abajo.
                        Si no hay subtítulo cargado, se deja el renglón vacío (mismo alto) en vez de texto de relleno. */}
                    <p className="text-sm text-muted-foreground/80 italic truncate min-h-[1.25rem]">
                      {item.subtitle || " "}
                    </p>

                    {/* Barra de progreso del subtítulo/nivel actual */}
                    <div className="w-full bg-muted rounded-full h-3 overflow-hidden mt-1.5">
                      <div
                        className={`h-full transition-all duration-500 ${getLevelColor(item.level)}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {progressItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No areas or projects yet. Start creating them to track your progress!
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
