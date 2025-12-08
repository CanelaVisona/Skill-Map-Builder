import { motion } from "framer-motion";
import { type Skill, useSkillTree } from "@/lib/skill-context";
import { cn } from "@/lib/utils";
import { Check, Lock, Trash2, ChevronUp, ChevronDown, Pencil, Plus, Star } from "lucide-react";
import { useState, useRef } from "react";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface SkillNodeProps {
  skill: Skill;
  areaColor: string;
  onClick: () => void;
  isFirstOfLevel?: boolean;
}

export function SkillNode({ skill, areaColor, onClick, isFirstOfLevel }: SkillNodeProps) {
  const isLocked = skill.status === "locked";
  const isMastered = skill.status === "mastered";
  const hasStar = skill.isFinalNode === 1; // Has the star activated (final final node)
  const isInicioNode = skill.title.toLowerCase() === "inicio"; // "inicio" nodes are text-only, not interactive
  
  const { 
    activeAreaId, 
    activeProjectId,
    activeParentSkillId,
    activeArea,
    activeProject,
    subSkills,
    deleteSkill, 
    toggleLock, 
    moveSkill, 
    updateSkill,
    deleteProjectSkill,
    toggleProjectLock,
    moveProjectSkill,
    updateProjectSkill,
    deleteSubSkill,
    toggleSubSkillLock,
    moveSubSkill,
    updateSubSkill,
    enterSubSkillTree,
    addSkillBelow,
    addProjectSkillBelow,
    addSubSkillBelow,
    updateLevelSubtitle,
    updateProjectLevelSubtitle,
    toggleFinalNode,
    toggleProjectFinalNode,
    toggleSubSkillFinalNode
  } = useSkillTree();
  
  const isProject = !activeAreaId && !!activeProjectId;
  const activeId = activeAreaId || activeProjectId;
  const isSubSkillView = !!activeParentSkillId;
  
  // Calculate if all nodes in this level are mastered
  const currentSkills = isSubSkillView 
    ? subSkills 
    : isProject 
      ? (activeProject?.skills || []) 
      : (activeArea?.skills || []);
  const skillsInLevel = currentSkills.filter(s => s.level === skill.level);
  const isLevelCompleted = skillsInLevel.length > 0 && skillsInLevel.every(s => s.status === "mastered");
  
  // Calculate if this node is the last node of its level (by Y position)
  const isLastNodeOfLevel = skillsInLevel.length > 0 && 
    skill.y === Math.max(...skillsInLevel.map(s => s.y));
  
  const [isOpen, setIsOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(skill.title);
  const [editDescription, setEditDescription] = useState(skill.description || "");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  
  const [isSubtitleDialogOpen, setIsSubtitleDialogOpen] = useState(false);
  const levelSubtitles = isProject ? (activeProject?.levelSubtitles || {}) : (activeArea?.levelSubtitles || {});
  const currentSubtitle = levelSubtitles[skill.level.toString()] || "";
  const [editSubtitle, setEditSubtitle] = useState(currentSubtitle);
  const levelLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLevelLongPressStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    levelLongPressTimer.current = setTimeout(() => {
      setEditSubtitle(currentSubtitle);
      setIsSubtitleDialogOpen(true);
    }, 500);
  };

  const handleLevelLongPressEnd = () => {
    if (levelLongPressTimer.current) {
      clearTimeout(levelLongPressTimer.current);
      levelLongPressTimer.current = null;
    }
  };

  const handleSubtitleSave = () => {
    if (isProject) {
      updateProjectLevelSubtitle(activeId, skill.level, editSubtitle);
    } else {
      updateLevelSubtitle(activeId, skill.level, editSubtitle);
    }
    setIsSubtitleDialogOpen(false);
  };

  const handleEditOpen = () => {
    setEditTitle(skill.title);
    setEditDescription(skill.description || "");
    setIsOpen(false);
    setIsEditDialogOpen(true);
  };

  const handleEditSave = () => {
    if (isSubSkillView) {
      updateSubSkill(skill.id, { 
        title: editTitle, 
        description: editDescription 
      });
    } else if (isProject) {
      updateProjectSkill(activeId, skill.id, { 
        title: editTitle, 
        description: editDescription 
      });
    } else {
      updateSkill(activeId, skill.id, { 
        title: editTitle, 
        description: editDescription 
      });
    }
    setIsEditDialogOpen(false);
  };

  const handleTouchStart = () => {
    if (isInicioNode) return; // "inicio" nodes are not interactive
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsOpen(true);
    }, 1500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isInicioNode) return; // "inicio" nodes are not interactive
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPress.current = false;
      return;
    }
    if (isLocked) {
      if (isSubSkillView) {
        toggleSubSkillLock(skill.id);
      } else if (isProject) {
        toggleProjectLock(activeId, skill.id);
      } else {
        toggleLock(activeId, skill.id);
      }
      return;
    }
    onClick();
  };

  const handleMouseDown = () => {
    if (isInicioNode) return; // "inicio" nodes are not interactive
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsOpen(true);
    }, 1500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setIsOpen(false);
      isLongPress.current = false;
    }
  };

  return (
    <>
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 z-20 touch-none select-none",
            isInicioNode ? "cursor-default" : "cursor-pointer"
          )}
          style={{ left: `${skill.x}%`, top: `${skill.y}px` }}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Level Marker */}
          {isFirstOfLevel && (
            <div 
              className="absolute right-14 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border cursor-pointer select-none"
              onTouchStart={handleLevelLongPressStart}
              onTouchEnd={handleLevelLongPressEnd}
              onTouchCancel={handleLevelLongPressEnd}
              onMouseDown={handleLevelLongPressStart}
              onMouseUp={handleLevelLongPressEnd}
              onMouseLeave={handleLevelLongPressEnd}
              onClick={(e) => e.stopPropagation()}
            >
              <div>Level {skill.level}</div>
              {currentSubtitle && (
                <div className="text-[10px] text-muted-foreground/70 text-center">{currentSubtitle}</div>
              )}
            </div>
          )}

          {/* Node Circle */}
          <motion.div
            initial={false}
            animate={{
              scale: isMastered ? 1.05 : 1,
            }}
            className={cn(
              "w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 relative",
              // Locked nodes
              isLocked && !isLastNodeOfLevel && "bg-muted border-muted-foreground/20 text-muted-foreground/50",
              isLocked && isLastNodeOfLevel && "bg-muted border-amber-400 text-muted-foreground/50",
              // Available nodes (not locked, not mastered)
              !isLocked && !isMastered && !isLastNodeOfLevel && "bg-card border-border hover:border-foreground/50",
              !isLocked && !isMastered && isLastNodeOfLevel && "bg-card border-amber-400 hover:border-amber-300",
              // Mastered nodes - not last node of level and level not completed
              isMastered && !isLastNodeOfLevel && !isLevelCompleted && "bg-foreground border-foreground text-background shadow-sm",
              // Mastered last node of level (always orange, whether level completed or not)
              isMastered && isLastNodeOfLevel && "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/30",
              // Level completed - all nodes turn orange
              isMastered && isLevelCompleted && "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/30"
            )}
          >
            {isLocked ? (
              <Lock size={14} />
            ) : isMastered ? (
              <Check size={18} strokeWidth={3} />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-foreground" />
            )}
          </motion.div>

          {/* Label */}
          <div className={cn(
            "absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-medium transition-colors",
            isLocked ? "text-muted-foreground" : "text-foreground",
            isMastered && "text-foreground"
          )}>
            <span
              onClick={(e) => {
                if (!isSubSkillView && !isLocked && !isInicioNode) {
                  e.stopPropagation();
                  enterSubSkillTree(skill.id, skill.title);
                }
              }}
              className={cn(
                !isSubSkillView && !isLocked && !isInicioNode && "cursor-pointer hover:underline"
              )}
              data-testid={`link-skill-title-${skill.id}`}
            >
              {skill.title}
            </span>
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent 
        side="top" 
        collisionPadding={16} 
        className="w-64 border-border bg-popover/95 backdrop-blur-xl shadow-xl p-4 z-50"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (isSubSkillView) {
                  moveSubSkill(skill.id, "up");
                } else if (isProject) {
                  moveProjectSkill(activeId, skill.id, "up");
                } else {
                  moveSkill(activeId, skill.id, "up");
                }
              }}
              data-testid="button-move-up"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">Mover</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (isSubSkillView) {
                  moveSubSkill(skill.id, "down");
                } else if (isProject) {
                  moveProjectSkill(activeId, skill.id, "down");
                } else {
                  moveSkill(activeId, skill.id, "down");
                }
              }}
              data-testid="button-move-down"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
            <h4 className="font-semibold leading-none mb-1.5">{skill.title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed break-words">
              {skill.description || "No description available."}
            </p>
          </div>
          
          <div className="pt-2 border-t border-border flex flex-wrap justify-end gap-2">
             <Button 
               variant="outline" 
               size="sm" 
               className="h-8 px-3 text-xs"
               onClick={handleEditOpen}
               data-testid="button-edit-skill"
             >
               <Pencil className="mr-2 h-3 w-3" />
               Editar
             </Button>

             <Button 
               variant="outline" 
               size="sm" 
               className="h-8 w-8 p-0 text-xs"
               onClick={() => {
                 if (isSubSkillView) {
                   addSubSkillBelow(skill.id);
                 } else if (isProject) {
                   addProjectSkillBelow(activeId, skill.id);
                 } else {
                   addSkillBelow(activeId, skill.id);
                 }
                 setIsOpen(false);
               }}
               data-testid="button-add-skill-below"
             >
               +
             </Button>

             {/* Star button - show for last node of level OR if node already has star (to allow removal) */}
             {(isLastNodeOfLevel || hasStar) && (
               <Button 
                 variant={hasStar ? "default" : "outline"}
                 size="sm" 
                 className={cn(
                   "h-8 w-8 p-0 text-xs",
                   hasStar && "bg-amber-500 hover:bg-amber-600 border-amber-500"
                 )}
                 onClick={() => {
                   if (isSubSkillView) {
                     toggleSubSkillFinalNode(skill.id);
                   } else if (isProject) {
                     toggleProjectFinalNode(activeId, skill.id);
                   } else {
                     toggleFinalNode(activeId, skill.id);
                   }
                   setIsOpen(false);
                 }}
                 data-testid="button-toggle-final"
                 title={hasStar ? "Quitar nodo final final" : "Marcar como nodo final final"}
               >
                 <Star className={cn("h-3 w-3", hasStar && "fill-white")} />
               </Button>
             )}

             {!isLocked && (
               <Button 
                 variant="outline" 
                 size="sm" 
                 className="h-8 px-3 text-xs"
                 onClick={() => {
                   if (isSubSkillView) {
                     toggleSubSkillLock(skill.id);
                   } else if (isProject) {
                     toggleProjectLock(activeId, skill.id);
                   } else {
                     toggleLock(activeId, skill.id);
                   }
                   setIsOpen(false);
                 }}
               >
                 <Lock className="mr-2 h-3 w-3" />
                 Lock
               </Button>
             )}

             {/* Delete button - hide for last node of level (can't delete) */}
             {!isLastNodeOfLevel && (
               <Button 
                 variant="secondary" 
                 size="sm" 
                 className="h-8 px-3 text-xs"
                 onClick={() => {
                   if (isSubSkillView) {
                     deleteSubSkill(skill.id);
                   } else if (isProject) {
                     deleteProjectSkill(activeId, skill.id);
                   } else {
                     deleteSkill(activeId, skill.id);
                   }
                   setIsOpen(false);
                 }}
               >
                 <Trash2 className="mr-2 h-3 w-3" />
                 Delete
               </Button>
             )}
          </div>
        </div>
      </PopoverContent>
    </Popover>

    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Habilidad</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-title">Título</Label>
            <Input
              id="edit-title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Nombre de la habilidad"
              data-testid="input-edit-title"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">Descripción</Label>
            <Textarea
              id="edit-description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Descripción de la habilidad"
              rows={4}
              data-testid="input-edit-description"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit">
            Cancelar
          </Button>
          <Button onClick={handleEditSave} data-testid="button-save-edit">
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isSubtitleDialogOpen} onOpenChange={setIsSubtitleDialogOpen}>
      <DialogContent className="sm:max-w-[350px]">
        <DialogHeader>
          <DialogTitle>Subtítulo del Nivel {skill.level}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-subtitle">Subtítulo</Label>
            <Input
              id="edit-subtitle"
              value={editSubtitle}
              onChange={(e) => setEditSubtitle(e.target.value)}
              placeholder="Ej: Fundamentos, Intermedio..."
              data-testid="input-edit-subtitle"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsSubtitleDialogOpen(false)} data-testid="button-cancel-subtitle">
            Cancelar
          </Button>
          <Button onClick={handleSubtitleSave} data-testid="button-save-subtitle">
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}


