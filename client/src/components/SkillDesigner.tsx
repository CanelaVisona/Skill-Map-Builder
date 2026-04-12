import { useState, useRef } from "react";
import { useSkillTree, calculateDesignerLevelWindow } from "@/lib/skill-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronUp, ChevronDown, Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillDesignerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillDesigner({ open, onOpenChange }: SkillDesignerProps) {
  const { areas, projects, activeAreaId, activeProjectId, updateSkill, updateProjectSkill, updateLevelSubtitle, updateProjectLevelSubtitle, moveSkillToLevel, moveProjectSkillToLevel, reorderSkillWithinLevel, reorderProjectSkillWithinLevel, addSkillBelow, addProjectSkillBelow } = useSkillTree();
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingLevel, setEditingLevel] = useState<number | null>(null);
  const [isLockedNode, setIsLockedNode] = useState(false);
  
  // Subtitle editing state
  const [editingLevelSubtitle, setEditingLevelSubtitle] = useState<string>("");
  const [editingLevelSubtitleDescription, setEditingLevelSubtitleDescription] = useState<string>("");
  const [editingLevelData, setEditingLevelData] = useState<{ areaId: string | null; projectId: string | null; level: number } | null>(null);
  
  // Context menu state for moving skills
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [selectedSkillForMove, setSelectedSkillForMove] = useState<{ skillId: string; areaId: string | null; projectId: string | null; currentLevel: number } | null>(null);
  
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNodeLongPressStart = (skillId: string, currentName: string, areaId: string | null, projectId: string | null, level?: number, isLocked: boolean = false) => {
    longPressTimer.current = setTimeout(() => {
      setEditingSkillId(skillId);
      setEditingName(currentName);
      setEditingAreaId(areaId);
      setEditingProjectId(projectId);
      if (level) setEditingLevel(level);
      if (isLocked) setIsLockedNode(true);
    }, 500);
  };

  const handleNodeLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleSaveName = async () => {
    if (editingSkillId && editingName.trim()) {
      // Update existing skill
      if (editingAreaId) {
        updateSkill(editingAreaId, editingSkillId, { title: editingName });
      } else if (editingProjectId) {
        updateProjectSkill(editingProjectId, editingSkillId, { title: editingName });
      }
    }
    setEditingSkillId(null);
    setEditingName("");
    setEditingLevel(null);
    setIsLockedNode(false);
  };

  const handleEditLevelSubtitle = (level: number, currentSubtitle: string, currentDescription: string, areaId: string | null, projectId: string | null) => {
    setEditingLevelSubtitle(currentSubtitle);
    setEditingLevelSubtitleDescription(currentDescription);
    setEditingLevelData({ level, areaId, projectId });
  };

  const handleSaveLevelSubtitle = async () => {
    if (editingLevelData) {
      // Guardar el subtítulo y descripción (vacío o con contenido)
      if (editingLevelData.areaId) {
        await updateLevelSubtitle(editingLevelData.areaId, editingLevelData.level, editingLevelSubtitle.trim(), editingLevelSubtitleDescription.trim());
      } else if (editingLevelData.projectId) {
        await updateProjectLevelSubtitle(editingLevelData.projectId, editingLevelData.level, editingLevelSubtitle.trim(), editingLevelSubtitleDescription.trim());
      }
    }
    setEditingLevelSubtitle("");
    setEditingLevelSubtitleDescription("");
    setEditingLevelData(null);
  };

  const handleContextMenu = (e: React.MouseEvent, skillId: string, areaId: string | null, projectId: string | null, currentLevel: number) => {
    e.preventDefault();
    setSelectedSkillForMove({ skillId, areaId, projectId, currentLevel });
    setContextMenuOpen(true);
  };

  const handleMoveSkillToLevel = async (targetLevel: number) => {
    if (!selectedSkillForMove) return;

    if (selectedSkillForMove.areaId) {
      await moveSkillToLevel(selectedSkillForMove.areaId, selectedSkillForMove.skillId, targetLevel);
    } else if (selectedSkillForMove.projectId) {
      await moveProjectSkillToLevel(selectedSkillForMove.projectId, selectedSkillForMove.skillId, targetLevel);
    }

    setContextMenuOpen(false);
    setSelectedSkillForMove(null);
  };

  const handleReorderSkill = async (direction: "up" | "down", skillId: string, areaId: string | null, projectId: string | null, currentLevel: number) => {
    if (areaId) {
      await reorderSkillWithinLevel(areaId, skillId, direction);
    } else if (projectId) {
      await reorderProjectSkillWithinLevel(projectId, skillId, direction);
    }
  };

  const getAvailableLevelsForMove = (currentLevel: number, maxLevel: number): number[] => {
    const levels: number[] = [];
    for (let i = currentLevel + 1; i <= maxLevel + 3; i++) {
      levels.push(i);
    }
    return levels;
  };

  const canMoveUp = (skillsInLevel: any[], skillId: string): boolean => {
    const skill = skillsInLevel.find(s => s.id === skillId);
    if (!skill) return false;
    
    // Rule 1: Node 1 (levelPosition === 1) - disable both arrows
    if (skill.levelPosition === 1) return false;
    
    // Rule 3: First non-Node-1 (levelPosition === 2) - disable up arrow
    if (skill.levelPosition === 2) return false;
    
    const sorted = [...skillsInLevel].sort((a, b) => a.y - b.y);
    const index = sorted.findIndex(s => s.id === skillId);
    if (index <= 0) return false;
    
    const neighbor = sorted[index - 1];
    if (!neighbor) return false;
    
    // Disable button if mastered/available swap
    if ((skill.status === "mastered" && neighbor.status === "available") ||
        (skill.status === "available" && neighbor.status === "mastered")) {
      return false;
    }
    
    return true;
  };

  const canMoveDown = (skillsInLevel: any[], skillId: string): boolean => {
    const skill = skillsInLevel.find(s => s.id === skillId);
    if (!skill) return false;
    
    // Rule 1: Node 1 (levelPosition === 1) - disable both arrows
    if (skill.levelPosition === 1) return false;
    
    const sorted = [...skillsInLevel].sort((a, b) => a.y - b.y);
    const index = sorted.findIndex(s => s.id === skillId);
    if (index >= sorted.length - 1) return false;
    
    const neighbor = sorted[index + 1];
    if (!neighbor) return false;
    
    // Disable button if mastered/available swap
    if ((skill.status === "mastered" && neighbor.status === "available") ||
        (skill.status === "available" && neighbor.status === "mastered")) {
      return false;
    }
    
    return true;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Skill Designer</DialogTitle>
            <DialogDescription className="sr-only">
              Editar nombres de nodos y subtítulos de niveles.
            </DialogDescription>
          </DialogHeader>

          <Accordion type="single" collapsible className="w-full">
            {/* Areas */}
            {areas.map((area) => {
              const maxLevel = Math.max(...area.skills.map((s) => s.level));
              const levelsToShow = calculateDesignerLevelWindow(area.unlockedLevel, area.nextLevelToAssign, area.endOfAreaLevel);
              const visibleInSkillTree = area.endOfAreaLevel ?? (area.nextLevelToAssign + 2);
              const nodesInLastLevel = 4; // Show only 4 editable nodes (positions 2-5, hiding visual node)
              
              return (
                <AccordionItem key={area.id} value={`area-${area.id}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <span className="font-semibold">{area.name}</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Accordion type="single" collapsible className="w-full pl-4">
                      {/* Levels in Area */}
                      {levelsToShow.map((level) => {
                        const subtitle = area.levelSubtitles?.[level] || "";
                        const subtitleDescription = area.levelSubtitleDescriptions?.[level] || "";
                        const isBlocked = level > area.unlockedLevel;
                        const isNotYetVisibleInSkillTree = level > visibleInSkillTree;
                        
                        return (
                        <AccordionItem key={`${area.id}-level-${level}`} value={`${area.id}-level-${level}`} className={cn(isBlocked && "grayscale")}>
                          <AccordionTrigger className="hover:no-underline">
                            <span 
                              className={cn(isBlocked && "text-muted-foreground/50 cursor-pointer hover:text-foreground", isNotYetVisibleInSkillTree && "text-amber-600 dark:text-amber-500")}
                              onClick={(e) => {
                                if (isBlocked) {
                                  e.stopPropagation();
                                  handleEditLevelSubtitle(level, subtitle, subtitleDescription, area.id, null);
                                }
                              }}
                            >
                              Nivel {level}{subtitle && `: ${subtitle}`}
                              {isBlocked && " (Bloqueado)"}
                              {isNotYetVisibleInSkillTree && !isBlocked && <Lock className="inline-block ml-1.5 w-3.5 h-3.5" />}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 pl-4">
                              {level <= maxLevel ? (
                                (() => {
                                  const skillsInLevel = area.skills
                                    .filter((s) => s.level === level)
                                    .sort((a, b) => a.y - b.y)
                                    .filter((s) => s.isAutoComplete !== 1 && s.levelPosition !== 1);
                                  
                                  return skillsInLevel.map((skill) => {
                                    const canUp = canMoveUp(skillsInLevel, skill.id);
                                    const canDown = canMoveDown(skillsInLevel, skill.id);
                                    const availableLevels = getAvailableLevelsForMove(level, maxLevel);
                                    
                                    return (
                                      <div
                                        key={skill.id}
                                        className={cn("p-2 rounded border border-border bg-card/50 hover:bg-card transition-colors", skill.status === "locked" && "opacity-60")}
                                        onContextMenu={(e) => handleContextMenu(e, skill.id, area.id, null, level)}
                                      >
                                        <div className="flex items-center gap-2 justify-between">
                                          <div 
                                            className="flex items-center gap-2 flex-1 cursor-pointer"
                                            onClick={() => {
                                              setEditingSkillId(skill.id);
                                              setEditingName(skill.title || "");
                                              setEditingAreaId(area.id);
                                              setEditingProjectId(null);
                                              setEditingLevel(level);
                                            }}
                                          >
                                            <div className={cn("text-sm font-medium", skill.status === "available" && "text-amber-400")}>{!skill.title ? `Nodo ${skill.levelPosition}` : skill.title}</div>
                                            {skill.status === "available" && <span className="text-lg font-bold text-amber-400">!</span>}
                                          </div>
                                          <div className="flex flex-row gap-1">
                                              <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                disabled={!canMoveUp(skillsInLevel, skill.id)}
                                                onClick={() => handleReorderSkill("up", skill.id, area.id, null, level)} 
                                                className="h-8 w-8"
                                              >
                                                <ChevronUp className="w-4 h-4" />
                                              </Button>
                                              <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                disabled={!canMoveDown(skillsInLevel, skill.id)}
                                                onClick={() => handleReorderSkill("down", skill.id, area.id, null, level)}
                                                className="h-8 w-8"
                                              >
                                                <ChevronDown className="w-4 h-4" />
                                              </Button>
                                              <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                onClick={() => addSkillBelow(area.id, skill.id, '')}
                                                className="h-8 w-8"
                                                title="Añadir nodo debajo"
                                              >
                                                <Plus className="w-4 h-4" />
                                              </Button>
                                            </div>
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {skill.status === "mastered" && "✓ Completado"}
                                            {skill.status === "locked" && "Bloqueado"}
                                          </div>
                                        </div>
                                    );
                                  });
                                })()
                              ) : (
                                Array.from({ length: nodesInLastLevel }, (_, i) => (
                                  <div
                                    key={`locked-${level}-${i}`}
                                    className="p-2 rounded border border-border bg-card/50 cursor-pointer hover:bg-card/70 transition-colors opacity-60"
                                    onMouseDown={() => handleNodeLongPressStart(`locked_${area.id}_${level}_${i}`, `Nodo ${i + 1}`, area.id, null, level, true)}
                                    onMouseUp={handleNodeLongPressEnd}
                                    onMouseLeave={handleNodeLongPressEnd}
                                    onTouchStart={() => handleNodeLongPressStart(`locked_${area.id}_${level}_${i}`, `Nodo ${i + 1}`, area.id, null, level, true)}
                                    onTouchEnd={handleNodeLongPressEnd}
                                  >
                                    <div className="text-sm font-medium">Nodo {i + 1}</div>
                                    <div className="text-xs text-muted-foreground">Bloqueado</div>
                                  </div>
                                ))
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              );
            })}

            {/* Main Quests */}
            {projects
              .filter((p) => !p.questType || p.questType === "main")
              .map((project) => {
                const maxLevel = Math.max(...project.skills.map((s) => s.level));
                const levelsToShow = calculateDesignerLevelWindow(project.unlockedLevel, project.nextLevelToAssign, project.endOfAreaLevel);
                const visibleInSkillTree = project.endOfAreaLevel ?? (project.nextLevelToAssign + 2);
                const nodesInLastLevel = 4; // Show only 4 editable nodes (positions 2-5, hiding visual node)
                
                return (
                  <AccordionItem key={project.id} value={`project-${project.id}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <span className="font-semibold">{project.name} (Quest Principal)</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Accordion type="single" collapsible className="w-full pl-4">
                        {levelsToShow.map((level) => {
                          const subtitle = project.levelSubtitles?.[level] || "";
                          const subtitleDescription = project.levelSubtitleDescriptions?.[level] || "";
                          const isBlocked = level > project.unlockedLevel;
                          const isNotYetVisibleInSkillTree = level > visibleInSkillTree;
                          return (
                          <AccordionItem key={`${project.id}-level-${level}`} value={`${project.id}-level-${level}`} className={cn(isBlocked && "grayscale")}>
                            <AccordionTrigger className="hover:no-underline">
                              <span 
                                  className={cn(isBlocked && "text-muted-foreground/50 cursor-pointer hover:text-foreground", isNotYetVisibleInSkillTree && "text-amber-600 dark:text-amber-500")}
                                  onClick={(e) => {
                                    if (isBlocked) {
                                      e.stopPropagation();
                                      handleEditLevelSubtitle(level, subtitle, subtitleDescription, null, project.id);
                                    }
                                  }}
                                >
                                  Nivel {level}{subtitle && `: ${subtitle}`}
                                  {isBlocked && " (Bloqueado)"}
                                  {isNotYetVisibleInSkillTree && !isBlocked && <Lock className="inline-block ml-1.5 w-3.5 h-3.5" />}
                              </span>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pl-4">
                                {level <= maxLevel ? (
                                  (() => {
                                    const skillsInLevel = project.skills
                                      .filter((s) => s.level === level)
                                      .sort((a, b) => a.y - b.y)
                                      .filter((skill) => skill.isAutoComplete !== 1 && skill.levelPosition !== 1);
                                    
                                    return skillsInLevel.map((skill) => {
                                      const canUp = canMoveUp(skillsInLevel, skill.id);
                                      const canDown = canMoveDown(skillsInLevel, skill.id);
                                      const availableLevels = getAvailableLevelsForMove(level, maxLevel);
                                      
                                      return (
                                        <div
                                          key={skill.id}
                                          className={cn("p-2 rounded border border-border bg-card/50 hover:bg-card transition-colors", skill.status === "locked" && "opacity-60")}
                                          onContextMenu={(e) => handleContextMenu(e, skill.id, null, project.id, level)}
                                        >
                                          <div className="flex items-center gap-2 justify-between">
                                            <div 
                                              className="flex items-center gap-2 flex-1 cursor-pointer"
                                              onClick={() => {
                                                setEditingSkillId(skill.id);
                                                setEditingName(skill.title || "");
                                                setEditingAreaId(null);
                                                setEditingProjectId(project.id);
                                                setEditingLevel(level);
                                              }}
                                            >
                                              <div className={cn("text-sm font-medium", skill.status === "available" && "text-amber-400")}>{!skill.title ? `Nodo ${skill.levelPosition}` : skill.title}</div>
                                              {skill.status === "available" && <span className="text-lg font-bold text-amber-400">!</span>}
                                            </div>
                                            <div className="flex flex-row gap-1">
                                                <Button 
                                                  size="sm" 
                                                  variant="ghost" 
                                                  disabled={!canMoveUp(skillsInLevel, skill.id)}
                                                  onClick={() => handleReorderSkill("up", skill.id, null, project.id, level)} 
                                                  className="h-8 w-8"
                                                >
                                                  <ChevronUp className="w-4 h-4" />
                                                </Button>
                                                <Button 
                                                  size="sm" 
                                                  variant="ghost" 
                                                  disabled={!canMoveDown(skillsInLevel, skill.id)}
                                                  onClick={() => handleReorderSkill("down", skill.id, null, project.id, level)}
                                                  className="h-8 w-8"
                                                >
                                                  <ChevronDown className="w-4 h-4" />
                                                </Button>
                                                <Button 
                                                  size="sm" 
                                                  variant="ghost" 
                                                  onClick={() => addProjectSkillBelow(project.id, skill.id, '')}
                                                  className="h-8 w-8"
                                                  title="Añadir nodo debajo"
                                                >
                                                  <Plus className="w-4 h-4" />
                                                </Button>
                                              </div>
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {skill.status === "mastered" && "✓ Completado"}
                                            {skill.status === "locked" && "Bloqueado"}
                                          </div>
                                        </div>
                                      );
                                    });
                                  })()
                                ) : (
                                  Array.from({ length: nodesInLastLevel }, (_, i) => (
                                    <div
                                      key={`locked-${level}-${i}`}
                                      className="p-2 rounded border border-border bg-card/50 cursor-pointer hover:bg-card/70 transition-colors opacity-60"
                                      onMouseDown={() => handleNodeLongPressStart(`locked_${project.id}_${level}_${i}`, `Nodo ${i + 1}`, null, project.id, level, true)}
                                      onMouseUp={handleNodeLongPressEnd}
                                      onMouseLeave={handleNodeLongPressEnd}
                                      onTouchStart={() => handleNodeLongPressStart(`locked_${project.id}_${level}_${i}`, `Nodo ${i + 1}`, null, project.id, level, true)}
                                      onTouchEnd={handleNodeLongPressEnd}
                                    >
                                      <div className="text-sm font-medium">Nodo {i + 1}</div>
                                      <div className="text-xs text-muted-foreground">Bloqueado</div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            {projects
              .filter((p) => p.questType === "side")
              .map((project) => {
                const maxLevel = Math.max(...project.skills.map((s) => s.level));
                const levelsToShow = calculateDesignerLevelWindow(project.unlockedLevel, project.nextLevelToAssign, project.endOfAreaLevel);
                const visibleInSkillTree = project.endOfAreaLevel ?? (project.nextLevelToAssign + 2);
                const nodesInLastLevel = 4; // Show only 4 editable nodes (positions 2-5, hiding visual node)
                
                return (
                  <AccordionItem key={project.id} value={`project-${project.id}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <span className="font-semibold">{project.name} (Quest Secundaria)</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Accordion type="single" collapsible className="w-full pl-4">
                        {levelsToShow.map((level) => {
                          const subtitle = project.levelSubtitles?.[level] || "";
                          const subtitleDescription = project.levelSubtitleDescriptions?.[level] || "";
                          const isBlocked = level > project.unlockedLevel;
                          const isNotYetVisibleInSkillTree = level > visibleInSkillTree;
                          return (
                          <AccordionItem key={`${project.id}-level-${level}`} value={`${project.id}-level-${level}`} className={cn(isBlocked && "grayscale")}>
                            <AccordionTrigger className="hover:no-underline">
                              <span 
                                className={cn(isBlocked && "text-muted-foreground/50 cursor-pointer hover:text-foreground", isNotYetVisibleInSkillTree && "text-amber-600 dark:text-amber-500")}
                                onClick={(e) => {
                                  if (isBlocked) {
                                    e.stopPropagation();
                                    handleEditLevelSubtitle(level, subtitle, subtitleDescription, null, project.id);
                                  }
                                }}
                              >
                                Nivel {level}{subtitle && `: ${subtitle}`}
                                {isBlocked && " (Bloqueado)"}
                                {isNotYetVisibleInSkillTree && !isBlocked && <Lock className="inline-block ml-1.5 w-3.5 h-3.5" />}
                              </span>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pl-4">
                                {level <= maxLevel ? (
                                  (() => {
                                    const skillsInLevel = project.skills
                                      .filter((s) => s.level === level)
                                      .sort((a, b) => a.y - b.y)
                                      .filter((skill) => skill.isAutoComplete !== 1 && skill.levelPosition !== 1);
                                    
                                    return skillsInLevel.map((skill) => {
                                      const canUp = canMoveUp(skillsInLevel, skill.id);
                                      const canDown = canMoveDown(skillsInLevel, skill.id);
                                      const availableLevels = getAvailableLevelsForMove(level, maxLevel);
                                      
                                      return (
                                        <div
                                          key={skill.id}
                                          className={cn("p-2 rounded border border-border bg-card/50 hover:bg-card transition-colors", skill.status === "locked" && "opacity-60")}
                                          onContextMenu={(e) => handleContextMenu(e, skill.id, null, project.id, level)}
                                        >
                                          <div className="flex items-center gap-2 justify-between">
                                            <div 
                                              className="flex items-center gap-2 flex-1 cursor-pointer"
                                              onClick={() => {
                                                setEditingSkillId(skill.id);
                                                setEditingName(skill.title || "");
                                                setEditingAreaId(null);
                                                setEditingProjectId(project.id);
                                                setEditingLevel(level);
                                              }}
                                            >
                                              <div className={cn("text-sm font-medium", skill.status === "available" && "text-amber-400")}>{skill.isAutoComplete === 1 || skill.levelPosition === 1 ? "" : (!skill.title ? `Nodo ${skill.levelPosition}` : skill.title)}</div>
                                              {skill.status === "available" && <span className="text-lg font-bold text-amber-400">!</span>}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button 
                                                  size="sm" 
                                                  variant="ghost" 
                                                  disabled={!canUp}
                                                  onClick={() => handleReorderSkill("up", skill.id, null, project.id, level)} 
                                                >
                                                  <ChevronUp className="w-4 h-4" />
                                                </Button>
                                                <Button 
                                                  size="sm" 
                                                  variant="ghost" 
                                                  disabled={!canDown}
                                                  onClick={() => handleReorderSkill("down", skill.id, null, project.id, level)}
                                                >
                                                  <ChevronDown className="w-4 h-4" />
                                                </Button>
                                              </div>
                                              <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                onClick={() => addProjectSkillBelow(project.id, skill.id, '')}
                                                className="h-8 w-8"
                                                title="Añadir nodo debajo"
                                              >
                                                <Plus className="w-4 h-4" />
                                              </Button>
                                            </div>
                                          <div className="text-xs text-muted-foreground">
                                            {skill.status === "mastered" && "✓ Completado"}
                                            {skill.status === "locked" && "Bloqueado"}
                                          </div>
                                        </div>
                                      );
                                    });
                                  })()
                                ) : (
                                  Array.from({ length: nodesInLastLevel }, (_, i) => (
                                    <div
                                      key={`locked-${level}-${i}`}
                                      className="p-2 rounded border border-border bg-card/50 cursor-pointer hover:bg-card/70 transition-colors opacity-60"
                                      onMouseDown={() => handleNodeLongPressStart(`locked_${project.id}_${level}_${i}`, `Nodo ${i + 1}`, null, project.id, level, true)}
                                      onMouseUp={handleNodeLongPressEnd}
                                      onMouseLeave={handleNodeLongPressEnd}
                                      onTouchStart={() => handleNodeLongPressStart(`locked_${project.id}_${level}_${i}`, `Nodo ${i + 1}`, null, project.id, level, true)}
                                      onTouchEnd={handleNodeLongPressEnd}
                                    >
                                      <div className="text-sm font-medium">Nodo {i + 1}</div>
                                      <div className="text-xs text-muted-foreground">Bloqueado</div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}

            {/* Emergent Quests */}
            {projects
              .filter((p) => p.questType === "emergent")
              .map((project) => {
                const maxLevel = Math.max(...project.skills.map((s) => s.level));
                const levelsToShow = calculateDesignerLevelWindow(project.unlockedLevel, project.nextLevelToAssign, project.endOfAreaLevel);
                const visibleInSkillTree = project.endOfAreaLevel ?? (project.nextLevelToAssign + 2);
                const nodesInLastLevel = 4; // Show only 4 editable nodes (positions 2-5, hiding visual node)
                
                return (
                  <AccordionItem key={project.id} value={`project-${project.id}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <span className="font-semibold">{project.name} (Quest Emergente)</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Accordion type="single" collapsible className="w-full pl-4">
                        {levelsToShow.map((level) => {
                          const subtitle = project.levelSubtitles?.[level] || "";
                          const subtitleDescription = project.levelSubtitleDescriptions?.[level] || "";
                          const isBlocked = level > project.unlockedLevel;
                          const isNotYetVisibleInSkillTree = level > visibleInSkillTree;
                          return (
                          <AccordionItem key={`${project.id}-level-${level}`} value={`${project.id}-level-${level}`} className={cn(isBlocked && "grayscale")}>
                            <AccordionTrigger className="hover:no-underline">
                              <span 
                                className={cn(isBlocked && "text-muted-foreground/50 cursor-pointer hover:text-foreground", isNotYetVisibleInSkillTree && "text-amber-600 dark:text-amber-500")}
                                onClick={(e) => {
                                  if (isBlocked) {
                                    e.stopPropagation();
                                    handleEditLevelSubtitle(level, subtitle, subtitleDescription, null, project.id);
                                  }
                                }}
                              >
                                Nivel {level}{subtitle && `: ${subtitle}`}
                                {isBlocked && " (Bloqueado)"}
                                {isNotYetVisibleInSkillTree && !isBlocked && <Lock className="inline-block ml-1.5 w-3.5 h-3.5" />}
                              </span>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pl-4">
                                {level <= maxLevel ? (
                                  (() => {
                                    const skillsInLevel = project.skills
                                      .filter((s) => s.level === level)
                                      .sort((a, b) => a.y - b.y)
                                      .filter((skill) => skill.isAutoComplete !== 1 && skill.levelPosition !== 1);
                                    
                                    return skillsInLevel.map((skill) => (
                                      <div
                                        key={skill.id}
                                        className={cn("p-2 rounded border border-border bg-card/50 hover:bg-card transition-colors", skill.status === "locked" && "opacity-60")}
                                        onContextMenu={(e) => handleContextMenu(e, skill.id, null, project.id, level)}
                                      >
                                        <div className="flex items-center gap-2 justify-between">
                                          <div 
                                            className="flex items-center gap-2 flex-1 cursor-pointer"
                                            onClick={() => {
                                              setEditingSkillId(skill.id);
                                              setEditingName(skill.title || "");
                                              setEditingAreaId(null);
                                              setEditingProjectId(project.id);
                                              setEditingLevel(level);
                                            }}
                                          >
                                            <div className={cn("text-sm font-medium", skill.status === "available" && "text-amber-400")}>{skill.isAutoComplete === 1 || skill.levelPosition === 1 ? "" : (!skill.title ? `Nodo ${skill.levelPosition}` : skill.title)}</div>
                                            {skill.status === "available" && <span className="text-lg font-bold text-amber-400">!</span>}
                                          </div>
                                          <div className="flex flex-row gap-1"> 
                                            <Button
                                              size="sm" 
                                              variant="ghost" 
                                              disabled={!canMoveUp(skillsInLevel, skill.id)}
                                              onClick={() => handleReorderSkill("up", skill.id, null, project.id, level)} 
                                              className="h-8 w-8"
                                            >
                                              <ChevronUp className="w-4 h-4" />
                                            </Button>
                                            <Button 
                                              size="sm" 
                                              variant="ghost" 
                                              disabled={!canMoveDown(skillsInLevel, skill.id)}
                                              onClick={() => handleReorderSkill("down", skill.id, null, project.id, level)}
                                              className="h-8 w-8"
                                            >
                                              <ChevronDown className="w-4 h-4" />
                                            </Button>
                                            <Button 
                                              size="sm" 
                                              variant="ghost" 
                                              onClick={() => addProjectSkillBelow(project.id, skill.id, '')}
                                              className="h-8 w-8"
                                              title="Añadir nodo debajo"
                                            >
                                              <Plus className="w-4 h-4" />
                                            </Button>
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {skill.status === "mastered" && "✓ Completado"}
                                            {skill.status === "locked" && "Bloqueado"}
                                          </div>
                                        </div>
                                      </div>
                                    ));
                                  })()
                                ) : (
                                  <>
                                    {Array.from({ length: nodesInLastLevel }, (_, i) => (
                                      <div
                                        key={`locked-${level}-${i}`}
                                        className="p-2 rounded border border-border bg-card/50 cursor-pointer hover:bg-card/70 transition-colors opacity-60"
                                        onMouseDown={() => handleNodeLongPressStart(`locked_${project.id}_${level}_${i}`, `Nodo ${i + 1}`, null, project.id, level, true)}
                                        onMouseUp={handleNodeLongPressEnd}
                                        onMouseLeave={handleNodeLongPressEnd}
                                        onTouchStart={() => handleNodeLongPressStart(`locked_${project.id}_${level}_${i}`, `Nodo ${i + 1}`, null, project.id, level, true)}
                                        onTouchEnd={handleNodeLongPressEnd}
                                      >
                                        <div className="text-sm font-medium">Nodo {i + 1}</div>
                                        <div className="text-xs text-muted-foreground">Bloqueado</div>
                                      </div>
                                    ))}
                                  </>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
          </Accordion>
        </DialogContent>
      </Dialog>

      {/* Edit Name Dialog */}
      <Dialog open={editingSkillId !== null} onOpenChange={(isOpen) => !isOpen && setEditingSkillId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar nombre del nodo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Nombre del nodo"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveName();
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingSkillId(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveName}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Level Subtitle Dialog */}
      <Dialog open={editingLevelData !== null} onOpenChange={(isOpen) => !isOpen && setEditingLevelData(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar subtítulo del nivel</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="text-sm text-muted-foreground">
              Nivel {editingLevelData?.level}
            </div>
            <Input
              placeholder="Subtítulo del nivel"
              value={editingLevelSubtitle}
              onChange={(e) => setEditingLevelSubtitle(e.target.value)}
              autoFocus
            />
            <Textarea
              placeholder="Descripción del nivel..."
              value={editingLevelSubtitleDescription}
              onChange={(e) => setEditingLevelSubtitleDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingLevelData(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveLevelSubtitle}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
