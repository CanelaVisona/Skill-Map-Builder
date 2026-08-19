import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSkillTree, type Area, type Project } from "@/lib/skill-context";
import { calculateLevelProgressPercentage, countMasteredSkillsInLevel, countSkillsInLevel } from "@/lib/area-progress";

interface ProgressItem {
  id: string;
  name: string;
  type: "area" | "project";
  level: number;
  subtitle?: string;
  masteredInLevel: number;
  totalInLevel: number;
}

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

// Áreas/quests con subtítulo cargado primero, para que lo relevante quede arriba
function sortBySubtitleFirst(items: ProgressItem[]): ProgressItem[] {
  return [...items.filter((item) => item.subtitle), ...items.filter((item) => !item.subtitle)];
}

function ProgressItemRow({ item, onGoToItem }: { item: ProgressItem; onGoToItem: (item: ProgressItem) => void }) {
  const totalBlocks = Math.max(item.totalInLevel, 1);
  const progress = calculateLevelProgressPercentage(item.masteredInLevel, item.totalInLevel);

  return (
    <div className="space-y-1 pb-4 border-b border-border/40 last:border-none">
      {/* Nombre del área/quest: referencia chica, no es lo protagonista */}
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">
        {item.name}
      </span>

      {/* Subtítulo del nivel actual: lo más visible, indica de qué es la barra de abajo.
          Clickeable: lleva directo al skill tree de esa área/quest.
          Si no hay subtítulo cargado, se avisa chico y en itálica en vez de simular uno. */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onGoToItem(item)}
          title={`Ir al skill tree de ${item.name}`}
          className={`truncate min-w-0 text-left hover:opacity-70 active:opacity-60 transition-opacity ${
            item.subtitle
              ? "text-base sm:text-lg font-semibold text-foreground"
              : "text-xs italic text-muted-foreground/70"
          }`}
        >
          {item.subtitle || "Sin subtítulo"}
        </button>
        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${getLevelColor(item.level)} text-gray-900 dark:text-black`}>
          Lvl {item.level}
        </span>
      </div>

      {/* Barra de progreso del subtítulo/nivel actual, en bloques (uno por nodo del nivel) */}
      <div className="flex items-center gap-1 mt-1.5" title={`${progress.toFixed(0)}%`}>
        {Array.from({ length: totalBlocks }).map((_, idx) => {
          const filled = item.totalInLevel > 0 && idx < item.masteredInLevel;
          return (
            <div
              key={idx}
              className={`h-3 flex-1 rounded-sm transition-colors duration-500 ${
                filled ? getLevelColor(item.level) : "bg-muted"
              }`}
            />
          );
        })}
      </div>

      {/* Completados / total del nivel actual */}
      <span className="block text-right text-xs font-semibold text-muted-foreground">
        {item.masteredInLevel}/{item.totalInLevel}
      </span>
    </div>
  );
}

function ProgressSection({
  title,
  items,
  onGoToItem,
}: {
  title: string;
  items: ProgressItem[];
  onGoToItem: (item: ProgressItem) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);

  if (items.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 py-1 group">
        <span className="text-sm font-bold uppercase tracking-wide text-foreground/80">
          {title} <span className="text-muted-foreground font-normal">({items.length})</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-5 pt-3">
        {items.map((item) => (
          <ProgressItemRow key={`${item.type}-${item.id}`} item={item} onGoToItem={onGoToItem} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ProgressModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { areas, projects, setActiveAreaId, setActiveProjectId } = useSkillTree();

  const buildProgressItem = (item: Area | Project, type: "area" | "project"): ProgressItem => {
    const level = item.unlockedLevel;
    const skills = item.skills || [];
    return {
      id: item.id,
      name: item.name,
      type,
      level,
      subtitle: item.levelSubtitles?.[level.toString()],
      masteredInLevel: countMasteredSkillsInLevel(skills, level),
      totalInLevel: countSkillsInLevel(skills, level),
    };
  };

  const areaItems = sortBySubtitleFirst(Array.isArray(areas) ? areas.map((area) => buildProgressItem(area, "area")) : []);

  const projectList = Array.isArray(projects) ? projects : [];
  const mainQuestItems = sortBySubtitleFirst(
    projectList.filter((p) => !p.questType || p.questType === "main").map((project) => buildProgressItem(project, "project"))
  );
  // Side, emergent y experience quests se agrupan juntos como "Side Quests"
  const sideQuestItems = sortBySubtitleFirst(
    projectList.filter((p) => p.questType && p.questType !== "main").map((project) => buildProgressItem(project, "project"))
  );

  const hasAnyItems = areaItems.length > 0 || mainQuestItems.length > 0 || sideQuestItems.length > 0;

  // Ir hasta el skill tree del área/quest correspondiente y cerrar el tracker
  const goToItem = (item: ProgressItem) => {
    if (item.type === "area") {
      setActiveAreaId(item.id);
    } else {
      setActiveProjectId(item.id);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-xl w-[calc(100vw-1.5rem)] sm:w-[min(92vw,36rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto minimal-scrollbar rounded-2xl border-none p-4 sm:p-6"
      >
        <VisuallyHidden>
          <DialogTitle>Progress Tracker</DialogTitle>
        </VisuallyHidden>
        <div className="flex flex-col gap-4">
          <h2 className="text-xl sm:text-2xl font-bold">Progress Tracker</h2>
          <div className="space-y-6">
            <ProgressSection title="Áreas" items={areaItems} onGoToItem={goToItem} />
            <ProgressSection title="Main Quest" items={mainQuestItems} onGoToItem={goToItem} />
            <ProgressSection title="Side Quest" items={sideQuestItems} onGoToItem={goToItem} />

            {!hasAnyItems && (
              <div className="text-center py-8 text-muted-foreground">
                No areas or projects yet. Start creating them to track your progress!
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
