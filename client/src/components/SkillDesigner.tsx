import { useState, useRef } from "react";
import { useSkillTree, calculateDesignerLevelWindow } from "@/lib/skill-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Lock, Plus, Trash2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNodeTitleWordLimit, clampToWordLimit } from "@/lib/node-title-settings";
import { useToast } from "@/hooks/use-toast";

interface SkillDesignerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillDesigner({ open, onOpenChange }: SkillDesignerProps) {
  const { areas, projects, activeAreaId, activeProjectId, updateSkill, updateProjectSkill, updateLevelSubtitle, updateProjectLevelSubtitle, moveSkillToLevel, moveProjectSkillToLevel, changeSkillLevel, changeProjectSkillLevel, reorderSkillWithinLevel, reorderProjectSkillWithinLevel, swapAreaLevels, swapProjectLevels, addExtraAreaLevel, addExtraProjectLevel, deleteAreaLevel, deleteProjectLevel, addSkillBelow, addProjectSkillBelow, duplicateSkill, duplicateProjectSkill, deleteSkill, deleteProjectSkill, toggleFinalNode, toggleProjectFinalNode } = useSkillTree();
  const { toast } = useToast();
  const [addingLevelId, setAddingLevelId] = useState<string | null>(null);
  // Tracks which skill's "add node" popover (Agregar / hermano / duplicar) is open
  const [openAddMenuSkillId, setOpenAddMenuSkillId] = useState<string | null>(null);

  const handleAddExtraLevel = async (areaId: string | null, projectId: string | null) => {
    const key = areaId ?? projectId;
    if (!key || addingLevelId) return;
    setAddingLevelId(key);
    try {
      const success = areaId
        ? await addExtraAreaLevel(areaId)
        : projectId
          ? await addExtraProjectLevel(projectId)
          : false;
      if (!success) {
        toast({ title: "No se pudo agregar el nivel", description: "Intentá de nuevo en unos segundos.", variant: "destructive" });
      }
    } finally {
      setAddingLevelId(null);
    }
  };
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingLevel, setEditingLevel] = useState<number | null>(null);
  const [isLockedNode, setIsLockedNode] = useState(false);
  const [editingDescription, setEditingDescription] = useState("");
  const [editingPlannedDuration, setEditingPlannedDuration] = useState<number | null>(null);
  const [editingTargetLevel, setEditingTargetLevel] = useState<number | null>(null);
  const [isChangingLevel, setIsChangingLevel] = useState(false);

  // Global word limit applied to node titles (here and in the node's own edit dialog)
  const wordLimit = getNodeTitleWordLimit();

  // Subtitle editing state
  const [editingLevelSubtitle, setEditingLevelSubtitle] = useState<string>("");
  const [editingLevelSubtitleDescription, setEditingLevelSubtitleDescription] = useState<string>("");
  const [editingLevelData, setEditingLevelData] = useState<{ areaId: string | null; projectId: string | null; level: number } | null>(null);
  
  // Context menu state for moving skills
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [selectedSkillForMove, setSelectedSkillForMove] = useState<{ skillId: string; areaId: string | null; projectId: string | null; currentLevel: number } | null>(null);

  // Delete confirmation state
  const [skillPendingDelete, setSkillPendingDelete] = useState<{ skillId: string; areaId: string | null; projectId: string | null; title: string } | null>(null);
  const [levelPendingDelete, setLevelPendingDelete] = useState<{ areaId: string | null; projectId: string | null; level: number } | null>(null);
  const [isDeletingLevel, setIsDeletingLevel] = useState(false);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-open the accordion item for the area/project currently being viewed
  // in the Skill Tree, so the designer doesn't land on a fully collapsed list.
  const defaultAccordionValue = activeAreaId
    ? `area-${activeAreaId}`
    : activeProjectId
      ? `project-${activeProjectId}`
      : undefined;

  const handleNodeLongPressStart = (skillId: string, currentName: string, areaId: string | null, projectId: string | null, level?: number, isLocked: boolean = false) => {
    longPressTimer.current = setTimeout(() => {
      setEditingSkillId(skillId);
      setEditingName(currentName);
      setEditingDescription("");
      setEditingPlannedDuration(null);
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
      const updates = {
        title: editingName,
        description: editingDescription,
        plannedDuration: editingPlannedDuration,
      };
      if (editingAreaId) {
        updateSkill(editingAreaId, editingSkillId, updates);
      } else if (editingProjectId) {
        updateProjectSkill(editingProjectId, editingSkillId, updates);
      }
    }
    setEditingSkillId(null);
    setEditingName("");
    setEditingDescription("");
    setEditingPlannedDuration(null);
    setEditingLevel(null);
    setEditingTargetLevel(null);
    setIsLockedNode(false);
  };

  // Move the node currently open in the edit dialog to a different level.
  // The backend carries its confirmation state across the move: mastered nodes
  // stay mastered and land first in the target level; everything else (including
  // the currently unlocked/"available" node, which becomes locked) lands at the
  // end of the target level.
  const handleChangeSkillLevel = async () => {
    if (!editingSkillId || editingTargetLevel === null || isLockedNode || isChangingLevel) return;
    setIsChangingLevel(true);
    try {
      let success = false;
      if (editingAreaId) {
        success = await changeSkillLevel(editingAreaId, editingSkillId, editingTargetLevel);
      } else if (editingProjectId) {
        success = await changeProjectSkillLevel(editingProjectId, editingSkillId, editingTargetLevel);
      }
      if (success) {
        setEditingSkillId(null);
        setEditingName("");
        setEditingDescription("");
        setEditingPlannedDuration(null);
        setEditingLevel(null);
        setEditingTargetLevel(null);
      } else {
        toast({ title: "No se pudo mover el nodo de nivel", description: "Intentá de nuevo en unos segundos.", variant: "destructive" });
      }
    } finally {
      setIsChangingLevel(false);
    }
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

  const handleConfirmDeleteSkill = async () => {
    if (!skillPendingDelete) return;
    if (skillPendingDelete.areaId) {
      await deleteSkill(skillPendingDelete.areaId, skillPendingDelete.skillId);
    } else if (skillPendingDelete.projectId) {
      await deleteProjectSkill(skillPendingDelete.projectId, skillPendingDelete.skillId);
    }
    setSkillPendingDelete(null);
  };

  const handleConfirmDeleteLevel = async () => {
    if (!levelPendingDelete || isDeletingLevel) return;
    setIsDeletingLevel(true);
    try {
      if (levelPendingDelete.areaId) {
        await deleteAreaLevel(levelPendingDelete.areaId, levelPendingDelete.level);
      } else if (levelPendingDelete.projectId) {
        await deleteProjectLevel(levelPendingDelete.projectId, levelPendingDelete.level);
      }
    } finally {
      setIsDeletingLevel(false);
      setLevelPendingDelete(null);
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

  // Mastered/confirmed nodes can only be used as the source for adding a new node
  // if they're the one immediately before the currently unlocked ("available") node
  // in this level. Older confirmed nodes further back in the chain can't spawn new
  // nodes, since that would let the user branch off history instead of the frontier.
  const canAddFromNode = (skillsInLevel: any[], skillId: string): boolean => {
    const skill = skillsInLevel.find(s => s.id === skillId);
    if (!skill) return false;
    if (skill.status !== "mastered") return true;

    const availableSkill = skillsInLevel.find(s => s.status === "available");
    if (!availableSkill) return false;
    return skill.levelPosition === (availableSkill.levelPosition ?? 0) - 1;
  };

  // The star toggle only makes sense on the last node of a level - that's the
  // one whose confirmation can close out the whole area/project.
  const isLastNodeInLevel = (skillsInLevel: any[], skillId: string): boolean => {
    const skill = skillsInLevel.find(s => s.id === skillId);
    if (!skill) return false;
    const maxLevelPosition = Math.max(...skillsInLevel.map(s => s.levelPosition ?? 0));
    return skill.levelPosition === maxLevelPosition;
  };

  // Levels can be reordered (their whole contents swapped with the adjacent level) only
  // when both sides are still ahead of the currently unlocked level - swapping never
  // touches live progression - and the adjacent level already has real skill data to
  // swap with (not just an empty "locked" placeholder in the Designer's look-ahead window).
  const canSwapLevel = (level: number, direction: "up" | "down", unlockedLevel: number, maxLevel: number): boolean => {
    const otherLevel = direction === "up" ? level - 1 : level + 1;
    if (level <= unlockedLevel || otherLevel <= unlockedLevel) return false;
    if (otherLevel > maxLevel) return false;
    return true;
  };

  const handleSwapLevel = async (direction: "up" | "down", level: number, areaId: string | null, projectId: string | null) => {
    const otherLevel = direction === "up" ? level - 1 : level + 1;
    if (areaId) {
      await swapAreaLevels(areaId, level, otherLevel);
    } else if (projectId) {
      await swapProjectLevels(projectId, level, otherLevel);
    }
  };

  // A level can only be deleted whole when it's still ahead of the currently unlocked
  // level (never touches live progression) and it actually has generated skill data.
  const canDeleteLevel = (level: number, unlockedLevel: number, maxLevel: number): boolean => {
    return level > unlockedLevel && level <= maxLevel;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Skill Designer</DialogTitle>
            <DialogDescription className="sr-only">
              Editar nombres de nodos y subtítulos de niveles.
            </DialogDescription>
          </DialogHeader>

          <Accordion type="single" collapsible className="w-full" defaultValue={defaultAccordionValue}>
            {/* Areas */}
            {areas.map((area) => {
              const maxLevel = Math.max(...area.skills.map((s) => s.level));
              const levelsToShow = calculateDesignerLevelWindow(area.unlockedLevel, area.nextLevelToAssign, area.endOfAreaLevel, maxLevel);
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
                        
                        const canSwapUp = canSwapLevel(level, "up", area.unlockedLevel, maxLevel);
                        const canSwapDown = canSwapLevel(level, "down", area.unlockedLevel, maxLevel);
                        const canDelete = canDeleteLevel(level, area.unlockedLevel, maxLevel);
                        const isLastGeneratedLevel = level === maxLevel;
                        return (
                        <AccordionItem key={`${area.id}-level-${level}`} value={`${area.id}-level-${level}`} className={cn(isBlocked && "grayscale")}>
                          <div className="group flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <AccordionTrigger className="hover:no-underline justify-start gap-2">
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
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <Button size="sm" variant="ghost" className="h-7 w-7" disabled={!canSwapUp} onClick={() => handleSwapLevel("up", level, area.id, null)} title="Subir nivel">
                                <ChevronsUp className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7" disabled={!canSwapDown} onClick={() => handleSwapLevel("down", level, area.id, null)} title="Bajar nivel">
                                <ChevronsDown className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7" disabled={!canDelete} onClick={() => setLevelPendingDelete({ areaId: area.id, projectId: null, level })} title="Eliminar nivel completo">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                              {isLastGeneratedLevel && (
                                <Button size="sm" variant="ghost" className="h-7 w-7" disabled={addingLevelId === area.id} onClick={() => handleAddExtraLevel(area.id, null)} title="Agregar un nivel bloqueado nuevo">
                                  <Plus className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          </div>
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
                                    
                                    // Display status: if level is blocked, all nodes show as locked regardless of actual status
                                    const displayStatus = isBlocked ? "locked" : skill.status;
                                    
                                    return (
                                      <div
                                        key={skill.id}
                                        className={cn("p-2 rounded border border-border bg-card/50 hover:bg-card transition-colors", displayStatus === "locked" && "opacity-60")}
                                        onContextMenu={(e) => handleContextMenu(e, skill.id, area.id, null, level)}
                                      >
                                        <div className="flex items-center gap-2 justify-between">
                                          <div
                                            className="flex items-center gap-2 flex-1 cursor-pointer"
                                            onClick={() => {
                                              setEditingSkillId(skill.id);
                                              setEditingName(skill.title || "");
                                              setEditingDescription(skill.description || "");
                                              setEditingPlannedDuration(skill.plannedDuration ?? null);
                                              setEditingAreaId(area.id);
                                              setEditingProjectId(null);
                                              setEditingLevel(level);
                                              setEditingTargetLevel(null);
                                            }}
                                          >
                                            <div className={cn("text-sm font-medium", displayStatus === "available" && "text-amber-400")}>{!skill.title ? `Nodo ${skill.levelPosition}` : skill.title}</div>
                                            {displayStatus === "available" && <span className="text-lg font-bold text-amber-400">!</span>}
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
                                              <Popover open={openAddMenuSkillId === skill.id} onOpenChange={(o) => setOpenAddMenuSkillId(o ? skill.id : null)}>
                                                <PopoverTrigger asChild>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={!canAddFromNode(skillsInLevel, skill.id)}
                                                    className="h-8 w-8"
                                                    title="Añadir nodo debajo"
                                                  >
                                                    <Plus className="w-4 h-4" />
                                                  </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-1" align="center">
                                                  <div className="flex flex-col gap-0.5">
                                                    <Button variant="ghost" size="sm" className="h-7 px-3 text-xs justify-start font-normal" onClick={() => { addSkillBelow(area.id, skill.id, ''); setOpenAddMenuSkillId(null); }}>
                                                      Nodo vacío
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 px-3 text-xs justify-start font-normal" onClick={() => { duplicateSkill(area.id, skill); setOpenAddMenuSkillId(null); }}>
                                                      Duplicar nodo
                                                    </Button>
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                              {isLastNodeInLevel(skillsInLevel, skill.id) && (
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => toggleFinalNode(area.id, skill.id)}
                                                  className={cn("h-8 w-8", area.endOfAreaLevel === level && "bg-amber-500 hover:bg-amber-600")}
                                                  title={area.endOfAreaLevel === level ? "Quitar nodo final final" : "Marcar como nodo final final"}
                                                >
                                                  <Star className={cn("w-4 h-4", area.endOfAreaLevel === level ? "fill-white text-white" : "text-muted-foreground")} />
                                                </Button>
                                              )}
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setSkillPendingDelete({ skillId: skill.id, areaId: area.id, projectId: null, title: skill.title || `Nodo ${skill.levelPosition}` })}
                                                className="h-8 w-8"
                                                title="Eliminar nodo"
                                              >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                              </Button>
                                            </div>
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {displayStatus === "mastered" && "✓ Completado"}
                                            {displayStatus === "locked" && "Bloqueado"}
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
                const levelsToShow = calculateDesignerLevelWindow(project.unlockedLevel, project.nextLevelToAssign, project.endOfAreaLevel, maxLevel);
                const visibleInSkillTree = project.endOfAreaLevel ?? (project.nextLevelToAssign + 2);
                const nodesInLastLevel = 4; // Show only 4 editable nodes (positions 2-5, hiding visual node)
                
                return (
                  <AccordionItem key={project.id} value={`project-${project.id}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <span className="font-semibold">{project.name}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Accordion type="single" collapsible className="w-full pl-4">
                        {levelsToShow.map((level) => {
                          const subtitle = project.levelSubtitles?.[level] || "";
                          const subtitleDescription = project.levelSubtitleDescriptions?.[level] || "";
                          const isBlocked = level > project.unlockedLevel;
                          const isNotYetVisibleInSkillTree = level > visibleInSkillTree;
                          const canSwapUp = canSwapLevel(level, "up", project.unlockedLevel, maxLevel);
                          const canSwapDown = canSwapLevel(level, "down", project.unlockedLevel, maxLevel);
                          const canDelete = canDeleteLevel(level, project.unlockedLevel, maxLevel);
                          const isLastGeneratedLevel = level === maxLevel;
                          return (
                          <AccordionItem key={`${project.id}-level-${level}`} value={`${project.id}-level-${level}`} className={cn(isBlocked && "grayscale")}>
                            <div className="group flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <AccordionTrigger className="hover:no-underline justify-start gap-2">
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
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Button size="sm" variant="ghost" className="h-7 w-7" disabled={!canSwapUp} onClick={() => handleSwapLevel("up", level, null, project.id)} title="Subir nivel">
                                  <ChevronsUp className="w-4 h-4 text-muted-foreground" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7" disabled={!canSwapDown} onClick={() => handleSwapLevel("down", level, null, project.id)} title="Bajar nivel">
                                  <ChevronsDown className="w-4 h-4 text-muted-foreground" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7" disabled={!canDelete} onClick={() => setLevelPendingDelete({ areaId: null, projectId: project.id, level })} title="Eliminar nivel completo">
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                                {isLastGeneratedLevel && (
                                  <Button size="sm" variant="ghost" className="h-7 w-7" disabled={addingLevelId === project.id} onClick={() => handleAddExtraLevel(null, project.id)} title="Agregar un nivel bloqueado nuevo">
                                    <Plus className="w-4 h-4 text-muted-foreground" />
                                  </Button>
                                )}
                              </div>
                            </div>
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
                                      
                                      // Display status: if level is blocked, all nodes show as locked regardless of actual status
                                      const displayStatus = isBlocked ? "locked" : skill.status;
                                      
                                      return (
                                        <div
                                          key={skill.id}
                                          className={cn("p-2 rounded border border-border bg-card/50 hover:bg-card transition-colors", displayStatus === "locked" && "opacity-60")}
                                          onContextMenu={(e) => handleContextMenu(e, skill.id, null, project.id, level)}
                                        >
                                          <div className="flex items-center gap-2 justify-between">
                                            <div
                                              className="flex items-center gap-2 flex-1 cursor-pointer"
                                              onClick={() => {
                                                setEditingSkillId(skill.id);
                                                setEditingName(skill.title || "");
                                                setEditingDescription(skill.description || "");
                                                setEditingPlannedDuration(skill.plannedDuration ?? null);
                                                setEditingAreaId(null);
                                                setEditingProjectId(project.id);
                                                setEditingLevel(level);
                                                setEditingTargetLevel(null);
                                              }}
                                            >
                                              <div className={cn("text-sm font-medium", displayStatus === "available" && "text-amber-400")}>{!skill.title ? `Nodo ${skill.levelPosition}` : skill.title}</div>
                                              {displayStatus === "available" && <span className="text-lg font-bold text-amber-400">!</span>}
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
                                                <Popover open={openAddMenuSkillId === skill.id} onOpenChange={(o) => setOpenAddMenuSkillId(o ? skill.id : null)}>
                                                  <PopoverTrigger asChild>
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      disabled={!canAddFromNode(skillsInLevel, skill.id)}
                                                      className="h-8 w-8"
                                                      title="Añadir nodo debajo"
                                                    >
                                                      <Plus className="w-4 h-4" />
                                                    </Button>
                                                  </PopoverTrigger>
                                                  <PopoverContent className="w-auto p-1" align="center">
                                                    <div className="flex flex-col gap-0.5">
                                                      <Button variant="ghost" size="sm" className="h-7 px-3 text-xs justify-start font-normal" onClick={() => { addProjectSkillBelow(project.id, skill.id, ''); setOpenAddMenuSkillId(null); }}>
                                                        Nodo vacío
                                                      </Button>
                                                      <Button variant="ghost" size="sm" className="h-7 px-3 text-xs justify-start font-normal" onClick={() => { duplicateProjectSkill(project.id, skill); setOpenAddMenuSkillId(null); }}>
                                                        Duplicar nodo
                                                      </Button>
                                                    </div>
                                                  </PopoverContent>
                                                </Popover>
                                                {isLastNodeInLevel(skillsInLevel, skill.id) && (
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => toggleProjectFinalNode(project.id, skill.id)}
                                                    className={cn("h-8 w-8", project.endOfAreaLevel === level && "bg-amber-500 hover:bg-amber-600")}
                                                    title={project.endOfAreaLevel === level ? "Quitar nodo final final" : "Marcar como nodo final final"}
                                                  >
                                                    <Star className={cn("w-4 h-4", project.endOfAreaLevel === level ? "fill-white text-white" : "text-muted-foreground")} />
                                                  </Button>
                                                )}
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => setSkillPendingDelete({ skillId: skill.id, areaId: null, projectId: project.id, title: skill.title || `Nodo ${skill.levelPosition}` })}
                                                  className="h-8 w-8"
                                                  title="Eliminar nodo"
                                                >
                                                  <Trash2 className="w-4 h-4 text-destructive" />
                                                </Button>
                                              </div>
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {displayStatus === "mastered" && "✓ Completado"}
                                            {displayStatus === "locked" && "Bloqueado"}
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
                const levelsToShow = calculateDesignerLevelWindow(project.unlockedLevel, project.nextLevelToAssign, project.endOfAreaLevel, maxLevel);
                const visibleInSkillTree = project.endOfAreaLevel ?? (project.nextLevelToAssign + 2);
                const nodesInLastLevel = 4; // Show only 4 editable nodes (positions 2-5, hiding visual node)
                
                return (
                  <AccordionItem key={project.id} value={`project-${project.id}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <span className="font-semibold">{project.name}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Accordion type="single" collapsible className="w-full pl-4">
                        {levelsToShow.map((level) => {
                          const subtitle = project.levelSubtitles?.[level] || "";
                          const subtitleDescription = project.levelSubtitleDescriptions?.[level] || "";
                          const isBlocked = level > project.unlockedLevel;
                          const isNotYetVisibleInSkillTree = level > visibleInSkillTree;
                          const canSwapUp = canSwapLevel(level, "up", project.unlockedLevel, maxLevel);
                          const canSwapDown = canSwapLevel(level, "down", project.unlockedLevel, maxLevel);
                          const canDelete = canDeleteLevel(level, project.unlockedLevel, maxLevel);
                          const isLastGeneratedLevel = level === maxLevel;
                          return (
                          <AccordionItem key={`${project.id}-level-${level}`} value={`${project.id}-level-${level}`} className={cn(isBlocked && "grayscale")}>
                            <div className="group flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <AccordionTrigger className="hover:no-underline justify-start gap-2">
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
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Button size="sm" variant="ghost" className="h-7 w-7" disabled={!canSwapUp} onClick={() => handleSwapLevel("up", level, null, project.id)} title="Subir nivel">
                                  <ChevronsUp className="w-4 h-4 text-muted-foreground" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7" disabled={!canSwapDown} onClick={() => handleSwapLevel("down", level, null, project.id)} title="Bajar nivel">
                                  <ChevronsDown className="w-4 h-4 text-muted-foreground" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7" disabled={!canDelete} onClick={() => setLevelPendingDelete({ areaId: null, projectId: project.id, level })} title="Eliminar nivel completo">
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                                {isLastGeneratedLevel && (
                                  <Button size="sm" variant="ghost" className="h-7 w-7" disabled={addingLevelId === project.id} onClick={() => handleAddExtraLevel(null, project.id)} title="Agregar un nivel bloqueado nuevo">
                                    <Plus className="w-4 h-4 text-muted-foreground" />
                                  </Button>
                                )}
                              </div>
                            </div>
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
                                                setEditingDescription(skill.description || "");
                                                setEditingPlannedDuration(skill.plannedDuration ?? null);
                                                setEditingAreaId(null);
                                                setEditingProjectId(project.id);
                                                setEditingLevel(level);
                                                setEditingTargetLevel(null);
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
                                              <Popover open={openAddMenuSkillId === skill.id} onOpenChange={(o) => setOpenAddMenuSkillId(o ? skill.id : null)}>
                                                <PopoverTrigger asChild>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={!canAddFromNode(skillsInLevel, skill.id)}
                                                    className="h-8 w-8"
                                                    title="Añadir nodo debajo"
                                                  >
                                                    <Plus className="w-4 h-4" />
                                                  </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-1" align="center">
                                                  <div className="flex flex-col gap-0.5">
                                                    <Button variant="ghost" size="sm" className="h-7 px-3 text-xs justify-start font-normal" onClick={() => { addProjectSkillBelow(project.id, skill.id, ''); setOpenAddMenuSkillId(null); }}>
                                                      Nodo vacío
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 px-3 text-xs justify-start font-normal" onClick={() => { duplicateProjectSkill(project.id, skill); setOpenAddMenuSkillId(null); }}>
                                                      Duplicar nodo
                                                    </Button>
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                              {isLastNodeInLevel(skillsInLevel, skill.id) && (
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => toggleProjectFinalNode(project.id, skill.id)}
                                                  className={cn("h-8 w-8", project.endOfAreaLevel === level && "bg-amber-500 hover:bg-amber-600")}
                                                  title={project.endOfAreaLevel === level ? "Quitar nodo final final" : "Marcar como nodo final final"}
                                                >
                                                  <Star className={cn("w-4 h-4", project.endOfAreaLevel === level ? "fill-white text-white" : "text-muted-foreground")} />
                                                </Button>
                                              )}
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setSkillPendingDelete({ skillId: skill.id, areaId: null, projectId: project.id, title: skill.title || `Nodo ${skill.levelPosition}` })}
                                                className="h-8 w-8"
                                                title="Eliminar nodo"
                                              >
                                                <Trash2 className="w-4 h-4 text-destructive" />
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
                const levelsToShow = calculateDesignerLevelWindow(project.unlockedLevel, project.nextLevelToAssign, project.endOfAreaLevel, maxLevel);
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
                          const canSwapUp = canSwapLevel(level, "up", project.unlockedLevel, maxLevel);
                          const canSwapDown = canSwapLevel(level, "down", project.unlockedLevel, maxLevel);
                          const canDelete = canDeleteLevel(level, project.unlockedLevel, maxLevel);
                          const isLastGeneratedLevel = level === maxLevel;
                          return (
                          <AccordionItem key={`${project.id}-level-${level}`} value={`${project.id}-level-${level}`} className={cn(isBlocked && "grayscale")}>
                            <div className="group flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <AccordionTrigger className="hover:no-underline justify-start gap-2">
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
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Button size="sm" variant="ghost" className="h-7 w-7" disabled={!canSwapUp} onClick={() => handleSwapLevel("up", level, null, project.id)} title="Subir nivel">
                                  <ChevronsUp className="w-4 h-4 text-muted-foreground" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7" disabled={!canSwapDown} onClick={() => handleSwapLevel("down", level, null, project.id)} title="Bajar nivel">
                                  <ChevronsDown className="w-4 h-4 text-muted-foreground" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7" disabled={!canDelete} onClick={() => setLevelPendingDelete({ areaId: null, projectId: project.id, level })} title="Eliminar nivel completo">
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                                {isLastGeneratedLevel && (
                                  <Button size="sm" variant="ghost" className="h-7 w-7" disabled={addingLevelId === project.id} onClick={() => handleAddExtraLevel(null, project.id)} title="Agregar un nivel bloqueado nuevo">
                                    <Plus className="w-4 h-4 text-muted-foreground" />
                                  </Button>
                                )}
                              </div>
                            </div>
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
                                              setEditingDescription(skill.description || "");
                                              setEditingPlannedDuration(skill.plannedDuration ?? null);
                                              setEditingAreaId(null);
                                              setEditingProjectId(project.id);
                                              setEditingLevel(level);
                                              setEditingTargetLevel(null);
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
                                            <Popover open={openAddMenuSkillId === skill.id} onOpenChange={(o) => setOpenAddMenuSkillId(o ? skill.id : null)}>
                                              <PopoverTrigger asChild>
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  disabled={!canAddFromNode(skillsInLevel, skill.id)}
                                                  className="h-8 w-8"
                                                  title="Añadir nodo debajo"
                                                >
                                                  <Plus className="w-4 h-4" />
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-auto p-1" align="center">
                                                <div className="flex flex-col gap-0.5">
                                                  <Button variant="ghost" size="sm" className="h-7 px-3 text-xs justify-start font-normal" onClick={() => { addProjectSkillBelow(project.id, skill.id, ''); setOpenAddMenuSkillId(null); }}>
                                                    Nodo vacío
                                                  </Button>
                                                  <Button variant="ghost" size="sm" className="h-7 px-3 text-xs justify-start font-normal" onClick={() => { duplicateProjectSkill(project.id, skill); setOpenAddMenuSkillId(null); }}>
                                                    Duplicar nodo
                                                  </Button>
                                                </div>
                                              </PopoverContent>
                                            </Popover>
                                            {isLastNodeInLevel(skillsInLevel, skill.id) && (
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => toggleProjectFinalNode(project.id, skill.id)}
                                                className={cn("h-8 w-8", project.endOfAreaLevel === level && "bg-amber-500 hover:bg-amber-600")}
                                                title={project.endOfAreaLevel === level ? "Quitar nodo final final" : "Marcar como nodo final final"}
                                              >
                                                <Star className={cn("w-4 h-4", project.endOfAreaLevel === level ? "fill-white text-white" : "text-muted-foreground")} />
                                              </Button>
                                            )}
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => setSkillPendingDelete({ skillId: skill.id, areaId: null, projectId: project.id, title: skill.title || `Nodo ${skill.levelPosition}` })}
                                              className="h-8 w-8"
                                              title="Eliminar nodo"
                                            >
                                              <Trash2 className="w-4 h-4 text-destructive" />
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
      <Dialog
        open={editingSkillId !== null}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setEditingSkillId(null);
          setEditingTargetLevel(null);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar nodo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Nombre (máx. {wordLimit} palabras)</label>
              <Input
                placeholder="Nombre del nodo"
                value={editingName}
                onChange={(e) => setEditingName(clampToWordLimit(e.target.value, wordLimit))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveName();
                  }
                }}
                autoFocus
              />
            </div>
            {!isLockedNode && (
              <>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Background</label>
                  <Textarea
                    placeholder="Describe la acción del nodo..."
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Tiempo (minutos)</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Sin definir"
                    value={editingPlannedDuration ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingPlannedDuration(val === "" ? null : parseInt(val, 10));
                    }}
                    className="w-32"
                  />
                </div>
                {(() => {
                  const parentArea = editingAreaId ? areas.find(a => a.id === editingAreaId) : undefined;
                  const parentProject = editingProjectId ? projects.find(p => p.id === editingProjectId) : undefined;
                  const parentSkills = parentArea?.skills ?? parentProject?.skills ?? [];
                  const maxLevel = parentSkills.length > 0 ? Math.max(...parentSkills.map(s => s.level)) : (editingLevel ?? 1);
                  const levelOptions: number[] = [];
                  for (let lvl = 1; lvl <= maxLevel + 3; lvl++) {
                    if (lvl !== editingLevel) levelOptions.push(lvl);
                  }
                  return (
                    <div className="grid gap-2">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Nivel (actualmente {editingLevel})</label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={editingTargetLevel !== null ? String(editingTargetLevel) : undefined}
                          onValueChange={(v) => setEditingTargetLevel(parseInt(v, 10))}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Elegir nivel" />
                          </SelectTrigger>
                          <SelectContent>
                            {levelOptions.map((lvl) => (
                              <SelectItem key={lvl} value={String(lvl)}>Nivel {lvl}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={editingTargetLevel === null || isChangingLevel}
                          onClick={handleChangeSkillLevel}
                        >
                          {isChangingLevel ? "Moviendo..." : "Mover de nivel"}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setEditingSkillId(null); setEditingTargetLevel(null); }}>
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

      {/* Delete Skill Confirmation */}
      <AlertDialog open={skillPendingDelete !== null} onOpenChange={(isOpen) => !isOpen && setSkillPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{skillPendingDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el nodo y se reajustarán los nodos siguientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteSkill}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Level Confirmation */}
      <AlertDialog open={levelPendingDelete !== null} onOpenChange={(isOpen) => !isOpen && !isDeletingLevel && setLevelPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el Nivel {levelPendingDelete?.level} completo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los nodos de ese nivel y los niveles siguientes se correrán un lugar para no dejar un hueco en la numeración.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingLevel}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteLevel}
              disabled={isDeletingLevel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
