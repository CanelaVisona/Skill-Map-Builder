import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useSkillTree, type Area, type Project } from "@/lib/skill-context";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProgressItem {
  id: string;
  name: string;
  icon?: string;
  type: "area" | "project";
  completedNodes: number;
  totalNodes: number;
  level: number;
}

export function ProgressModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { areas, projects } = useSkillTree();

  const calculateProgress = (skills: Array<{ status: string }>): { completed: number; total: number } => {
    const total = skills.length;
    const completed = skills.filter(s => s.status === "mastered").length;
    return { completed, total };
  };

  const calculateLevel = (completedNodes: number): number => {
    return Math.floor(completedNodes / 15) + 1;
  };

  const calculateProgressPercentage = (completedNodes: number): number => {
    const nodesSinceLastLevel = completedNodes % 15;
    return (nodesSinceLastLevel / 15) * 100;
  };

  const progressItems: ProgressItem[] = [];

  // Add areas
  if (Array.isArray(areas)) {
    areas.forEach((area: Area) => {
      const { completed, total } = calculateProgress(area.skills || []);
      progressItems.push({
        id: area.id,
        name: area.name,
        icon: area.icon,
        type: "area",
        completedNodes: completed,
        totalNodes: total,
        level: calculateLevel(completed),
      });
    });
  }

  // Add projects
  if (Array.isArray(projects)) {
    projects.forEach((project: Project) => {
      const { completed, total } = calculateProgress(project.skills || []);
      progressItems.push({
        id: project.id,
        name: project.name,
        icon: project.icon,
        type: "project",
        completedNodes: completed,
        totalNodes: total,
        level: calculateLevel(completed),
      });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl border-none">
        <VisuallyHidden>
          <DialogTitle>Progress Tracker</DialogTitle>
        </VisuallyHidden>
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">Progress Tracker</h2>
          <ScrollArea className="h-[50vh] pr-4">
            <div className="space-y-4">
              {progressItems.map((item) => {
                const nodesSinceLastLevel = item.completedNodes % 30;
                const progress = calculateProgressPercentage(item.completedNodes);

                return (
                  <div key={`${item.type}-${item.id}`} className="space-y-2 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">{item.name}</span>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-primary/20 text-primary">
                          Lvl {item.level}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {nodesSinceLastLevel}/15
                      </span>
                    </div>

                    <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-lime-400 via-green-500 to-emerald-700 transition-all duration-500"
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
