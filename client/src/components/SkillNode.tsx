import { motion } from "framer-motion";
import { type Skill, useSkillTree } from "@/lib/skill-context";
import { cn } from "@/lib/utils";
import { Check, Lock, Trash2, ChevronUp, ChevronDown, Pencil, Plus } from "lucide-react";
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
  const isFinalNode = skill.isFinalNode === 1;
  const isFinalMastered = isFinalNode && isMastered;
  const isFinalNotMastered = isFinalNode && !isMastered;
  
  const { 
    activeAreaId, 
    activeProjectId,
    activeParentSkillId,
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
    addSubSkillBelow
  } = useSkillTree();
  
  const isProject = !activeAreaId && !!activeProjectId;
  const activeId = activeAreaId || activeProjectId;
  const isSubSkillView = !!activeParentSkillId;
  const [isOpen, setIsOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(skill.title);
  const [editDescription, setEditDescription] = useState(skill.description || "");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

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
          className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer touch-none select-none"
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
            <div className="absolute right-14 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border">
              Level {skill.level}
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
              isLocked && !isFinalNotMastered && "bg-muted border-muted-foreground/20 text-muted-foreground/50",
              isLocked && isFinalNotMastered && "bg-muted border-amber-400 text-muted-foreground/50",
              !isLocked && !isMastered && !isFinalNotMastered && "bg-card border-border hover:border-foreground/50",
              !isLocked && !isMastered && isFinalNotMastered && "bg-card border-amber-400 hover:border-amber-300",
              isMastered && !isFinalMastered && "bg-foreground border-foreground text-background shadow-sm",
              isFinalMastered && "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/30"
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
                if (!isSubSkillView && !isLocked) {
                  e.stopPropagation();
                  enterSubSkillTree(skill.id, skill.title);
                }
              }}
              className={cn(
                !isSubSkillView && !isLocked && "cursor-pointer hover:underline"
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
  </>
  );
}


