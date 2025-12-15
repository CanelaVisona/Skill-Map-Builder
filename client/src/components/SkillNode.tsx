import { motion, AnimatePresence } from "framer-motion";
import { type Skill, useSkillTree } from "@/lib/skill-context";
import { cn } from "@/lib/utils";
import { Check, Lock, Trash2, ChevronUp, ChevronDown, Pencil, Plus, Star, ChevronRight, ChevronLeft, Wrench, Lightbulb } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface SkillNodeProps {
  skill: Skill;
  areaColor: string;
  onClick: () => void;
  isFirstOfLevel?: boolean;
  isOnboardingTarget?: boolean;
}

export function SkillNode({ skill, areaColor, onClick, isFirstOfLevel, isOnboardingTarget }: SkillNodeProps) {
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
  
  // Calculate effective locked state: final nodes (by position or star) should appear locked
  // if not all other nodes in level are mastered
  const isFinalNodeByPosition = isLastNodeOfLevel || hasStar;
  const otherNodesInLevel = skillsInLevel.filter(s => s.id !== skill.id);
  const allOthersMastered = otherNodesInLevel.every(s => s.status === "mastered");
  
  // Effective states: final nodes show as locked if others aren't mastered
  const shouldForceLock = isFinalNodeByPosition && skill.status !== "mastered" && !allOthersMastered;
  const isLocked = skill.status === "locked" || shouldForceLock;
  const isMastered = skill.status === "mastered";
  
  const [isOpen, setIsOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editStep, setEditStep] = useState(0);
  const [editTitle, setEditTitle] = useState(skill.title);
  const [editAction, setEditAction] = useState(skill.description?.split("\n\nWhen: ")[0] || "");
  const [editWhen, setEditWhen] = useState(skill.description?.split("\n\nWhen: ")[1] || "");
  const [editDescription, setEditDescription] = useState(skill.description || "");
  const [editFeedback, setEditFeedback] = useState(skill.feedback || "");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  
  const [isSubtitleDialogOpen, setIsSubtitleDialogOpen] = useState(false);
  const [isSubtaskConfirmOpen, setIsSubtaskConfirmOpen] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const levelSubtitles = isProject ? (activeProject?.levelSubtitles || {}) : (activeArea?.levelSubtitles || {});
  const currentSubtitle = levelSubtitles[skill.level.toString()] || "";
  const [editSubtitle, setEditSubtitle] = useState(currentSubtitle);
  const levelLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTitleLongPress = useRef(false);

  // Tools & Learnings form state
  const queryClient = useQueryClient();
  const [feedbackActiveTab, setFeedbackActiveTab] = useState<"thoughts" | "tools" | "learnings">("thoughts");
  const [toolTitle, setToolTitle] = useState("");
  const [toolSentence, setToolSentence] = useState("");
  const [learningTitle, setLearningTitle] = useState("");
  const [learningSentence, setLearningSentence] = useState("");
  const [showPlusOne, setShowPlusOne] = useState<{ visible: boolean; type: "tools" | "learnings" }>({ visible: false, type: "tools" });
  const [hasIncompleteSubtasks, setHasIncompleteSubtasks] = useState(false);

  useEffect(() => {
    const checkSubtasks = async () => {
      if (!isInicioNode) {
        try {
          const response = await fetch(`/api/skills/${skill.id}/subskills`);
          const subskills = await response.json();
          if (Array.isArray(subskills) && subskills.length > 0) {
            const hasIncomplete = subskills.some(s => s.status !== "mastered" || !s.isFinalNode);
            setHasIncompleteSubtasks(hasIncomplete);
          } else {
            setHasIncompleteSubtasks(false);
          }
        } catch {
          setHasIncompleteSubtasks(false);
        }
      }
    };
    checkSubtasks();
  }, [skill.id]);

  const hasUnlockedWithIncompleteSubtasks = !isLocked && !isMastered && hasIncompleteSubtasks;

  const createLearning = useMutation({
    mutationFn: async (data: { title: string; sentence: string }) => {
      const res = await fetch("/api/journal/learnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/learnings"] }),
  });

  const createTool = useMutation({
    mutationFn: async (data: { title: string; sentence: string }) => {
      const res = await fetch("/api/journal/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/tools"] }),
  });

  const handleAddTool = () => {
    if (!toolTitle.trim()) return;
    createTool.mutate({ title: toolTitle.trim(), sentence: toolSentence.trim() });
    setToolTitle("");
    setToolSentence("");
    setShowPlusOne({ visible: true, type: "tools" });
    setTimeout(() => setShowPlusOne({ visible: false, type: "tools" }), 1000);
  };

  const handleAddLearning = () => {
    if (!learningTitle.trim()) return;
    createLearning.mutate({ title: learningTitle.trim(), sentence: learningSentence.trim() });
    setLearningTitle("");
    setLearningSentence("");
    setShowPlusOne({ visible: true, type: "learnings" });
    setTimeout(() => setShowPlusOne({ visible: false, type: "learnings" }), 1000);
  };

  const handleTitleLongPressStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    isTitleLongPress.current = false;
    titleLongPressTimer.current = setTimeout(() => {
      isTitleLongPress.current = true;
      setEditTitle(skill.title);
      const descParts = (skill.description || "").split("\n\nWhen: ");
      setEditAction(descParts[0] || "");
      setEditWhen(descParts[1] || "");
      setEditFeedback(skill.feedback || "");
      setEditStep(0);
      setIsEditDialogOpen(true);
    }, 500);
  };

  const handleTitleLongPressEnd = () => {
    if (titleLongPressTimer.current) {
      clearTimeout(titleLongPressTimer.current);
      titleLongPressTimer.current = null;
    }
  };

  const handleTitleClick = async (e: React.MouseEvent) => {
    if (isTitleLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      isTitleLongPress.current = false;
      return;
    }
    if (!isSubSkillView && !isInicioNode) {
      e.stopPropagation();
      try {
        const response = await fetch(`/api/skills/${skill.id}/subskills`);
        const subskills = await response.json();
        if (subskills && subskills.length > 0) {
          enterSubSkillTree(skill.id, skill.title);
        } else {
          setIsSubtaskConfirmOpen(true);
        }
      } catch {
        setIsSubtaskConfirmOpen(true);
      }
    }
  };

  const handleConfirmSubtasks = () => {
    setIsSubtaskConfirmOpen(false);
    enterSubSkillTree(skill.id, skill.title);
  };

  const handleDeclineSubtasks = () => {
    setIsSubtaskConfirmOpen(false);
  };

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

  const handleFeedbackOpen = () => {
    setEditFeedback(skill.feedback || "");
    setIsOpen(false);
    setIsFeedbackDialogOpen(true);
  };

  const handleFeedbackSave = () => {
    if (isSubSkillView) {
      updateSubSkill(skill.id, { feedback: editFeedback });
    } else if (isProject) {
      updateProjectSkill(activeId, skill.id, { feedback: editFeedback });
    } else {
      updateSkill(activeId, skill.id, { feedback: editFeedback });
    }
    setIsFeedbackDialogOpen(false);
  };

  const handleEditSave = () => {
    const combinedDescription = editWhen.trim() 
      ? `${editAction}\n\nWhen: ${editWhen}` 
      : editAction;
    
    if (isSubSkillView) {
      updateSubSkill(skill.id, { 
        title: editTitle, 
        description: combinedDescription,
        feedback: editFeedback
      });
    } else if (isProject) {
      updateProjectSkill(activeId, skill.id, { 
        title: editTitle, 
        description: combinedDescription,
        feedback: editFeedback
      });
    } else {
      updateSkill(activeId, skill.id, { 
        title: editTitle, 
        description: combinedDescription,
        feedback: editFeedback
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
      return; // Locked nodes cannot be clicked - only unlock when previous node is mastered
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
          {...(isOnboardingTarget ? { "data-onboarding": "skill-node" } : {})}
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
            {hasUnlockedWithIncompleteSubtasks ? (
              <Lock size={14} className="text-white" />
            ) : isLocked ? (
              <Lock size={14} />
            ) : isMastered ? (
              <Check size={18} strokeWidth={3} />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-foreground" />
            )}
          </motion.div>

          {/* Label */}
          <div className={cn(
            "absolute left-14 top-1/2 -translate-y-1/2 max-w-[180px] font-medium transition-colors",
            isLocked ? "text-muted-foreground" : "text-foreground",
            isMastered && "text-foreground",
            skill.title.length > 20 ? "text-xs leading-tight" : "text-sm",
            skill.title.length > 30 ? "text-[10px]" : "",
            skill.title === "Next challenge" && "text-muted-foreground/50 font-normal italic"
          )}>
            <span
              onClick={handleTitleClick}
              onTouchStart={handleTitleLongPressStart}
              onTouchEnd={handleTitleLongPressEnd}
              onTouchCancel={handleTitleLongPressEnd}
              onMouseDown={handleTitleLongPressStart}
              onMouseUp={handleTitleLongPressEnd}
              onMouseLeave={handleTitleLongPressEnd}
              className={cn(
                "line-clamp-2 inline-block transition-transform duration-150",
                !isSubSkillView && !isLocked && !isInicioNode && "cursor-pointer hover:translate-y-0.5 active:translate-y-1",
                !isInicioNode && "cursor-pointer"
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
            {skill.feedback && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground font-medium mb-1">Thoughts:</p>
                <p className="text-sm text-foreground/80 leading-relaxed break-words italic">
                  {skill.feedback}
                </p>
              </div>
            )}
          </div>
          
          <div className="pt-2 border-t border-border flex flex-wrap justify-end gap-2">
             <Button 
               variant="ghost" 
               size="sm" 
               className="h-8 p-0 px-2 text-xs bg-muted/50 hover:bg-muted flex items-center gap-1"
               onClick={handleFeedbackOpen}
               data-testid="button-feedback-skill"
             >
               <Pencil className="h-3 w-3" />
               <span>Feedback</span>
             </Button>

             <Button 
               variant="ghost" 
               size="sm" 
               className="h-8 w-8 p-0 text-xs bg-muted/50 hover:bg-muted"
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
                 variant="ghost"
                 size="sm" 
                 className={cn(
                   "h-8 w-8 p-0 text-xs",
                   hasStar ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-muted/50 hover:bg-muted"
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

             {/* Delete button - hide for last node of level (can't delete) */}
             {!isLastNodeOfLevel && (
               <Button 
                 variant="ghost" 
                 size="sm" 
                 className="h-8 w-8 p-0 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
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
                 data-testid="button-delete"
               >
                 <Trash2 className="h-3 w-3" />
               </Button>
             )}
          </div>
        </div>
      </PopoverContent>
    </Popover>

    <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
      if (!open) setEditStep(0);
      setIsEditDialogOpen(open);
    }}>
      <DialogContent className="sm:max-w-[400px] border-0 shadow-2xl">
        <div className="min-h-[180px] flex flex-col">
          <AnimatePresence mode="wait">
            {editStep === 0 && (
              <motion.div
                key="step-action"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col gap-4"
              >
                <div>
                  <Label htmlFor="edit-action" className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">ACTION: What can you do to advance in this quest?</Label>
                  <Textarea
                    id="edit-action"
                    value={editAction}
                    onChange={(e) => setEditAction(e.target.value)}
                    placeholder="Describe your next action..."
                    rows={2}
                    className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                    data-testid="input-edit-action"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="edit-when" className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">When exactly?</Label>
                  <Input
                    id="edit-when"
                    value={editWhen}
                    onChange={(e) => setEditWhen(e.target.value)}
                    placeholder="Specify when..."
                    className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                    data-testid="input-edit-when"
                  />
                </div>
                <div className="flex justify-end mt-auto pt-4">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setEditStep(1)}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                    data-testid="button-next-step"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {editStep === 1 && (
              <motion.div
                key="step-name"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label htmlFor="edit-title" className="text-xs text-muted-foreground uppercase tracking-wide mb-3">NAME: Name this move (3 words max)</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => {
                    const words = e.target.value.split(/\s+/).filter(w => w.length > 0);
                    if (words.length <= 3) {
                      setEditTitle(e.target.value);
                    } else {
                      setEditTitle(words.slice(0, 3).join(" "));
                    }
                  }}
                  placeholder="Name your move..."
                  className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted text-lg"
                  data-testid="input-edit-title"
                  autoFocus
                />
                <div className="flex justify-between mt-auto pt-6">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setEditStep(0)}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                    data-testid="button-prev-step"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setEditStep(2)}
                    disabled={!editTitle.trim()}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                    data-testid="button-next-step-2"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {editStep === 2 && (
              <motion.div
                key="step-thoughts"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label htmlFor="edit-thoughts" className="text-xs text-muted-foreground uppercase tracking-wide mb-3">THOUGHTS</Label>
                <Textarea
                  id="edit-thoughts"
                  value={editFeedback}
                  onChange={(e) => setEditFeedback(e.target.value)}
                  placeholder="Your thoughts..."
                  rows={4}
                  className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none flex-1"
                  data-testid="input-edit-thoughts"
                  autoFocus
                />
                <div className="flex justify-between mt-auto pt-6">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setEditStep(1)}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                    data-testid="button-prev-step-2"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button 
                    onClick={handleEditSave}
                    className="border-0"
                    data-testid="button-save-edit"
                  >
                    Save
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isSubtitleDialogOpen} onOpenChange={setIsSubtitleDialogOpen}>
      <DialogContent className="sm:max-w-[350px] border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Subtítulo del Nivel {skill.level}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-subtitle" className="text-xs text-muted-foreground uppercase tracking-wide">Subtítulo</Label>
            <Input
              id="edit-subtitle"
              value={editSubtitle}
              onChange={(e) => setEditSubtitle(e.target.value)}
              placeholder="Ej: Fundamentos, Intermedio..."
              className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
              data-testid="input-edit-subtitle"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={() => setIsSubtitleDialogOpen(false)} className="flex-1 bg-muted/50 hover:bg-muted" data-testid="button-cancel-subtitle">
            Cancelar
          </Button>
          <Button onClick={handleSubtitleSave} className="flex-1 border-0" data-testid="button-save-subtitle">
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isSubtaskConfirmOpen} onOpenChange={setIsSubtaskConfirmOpen}>
      <DialogContent className="sm:max-w-[350px] border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">{skill.title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">¿Esta tarea necesita una red de subtareas?</p>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={handleDeclineSubtasks} className="flex-1 bg-muted/50 hover:bg-muted" data-testid="button-no-subtasks">
            No
          </Button>
          <Button onClick={handleConfirmSubtasks} className="flex-1 border-0" data-testid="button-yes-subtasks">
            Sí
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isFeedbackDialogOpen} onOpenChange={(open) => {
      if (!open) setFeedbackActiveTab("thoughts");
      setIsFeedbackDialogOpen(open);
    }}>
      <DialogContent className="sm:max-w-[400px] border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Feedback</DialogTitle>
        </DialogHeader>
        
        <Tabs value={feedbackActiveTab} onValueChange={(v) => setFeedbackActiveTab(v as "thoughts" | "tools" | "learnings")} className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-muted/50">
            <TabsTrigger value="thoughts" className="text-xs" data-testid="feedback-tab-thoughts">
              <Pencil className="h-3 w-3 mr-1" />
              Thoughts
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-xs" data-testid="feedback-tab-tools">
              <Wrench className="h-3 w-3 mr-1" />
              Tools
            </TabsTrigger>
            <TabsTrigger value="learnings" className="text-xs" data-testid="feedback-tab-learnings">
              <Lightbulb className="h-3 w-3 mr-1" />
              Learnings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="thoughts" className="mt-4">
            <Textarea
              value={editFeedback}
              onChange={(e) => setEditFeedback(e.target.value)}
              placeholder="Notas, comentarios o retroalimentación..."
              rows={4}
              className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
              data-testid="input-feedback"
              autoFocus
            />
            <div className="flex gap-2 pt-4">
              <Button variant="ghost" onClick={() => setIsFeedbackDialogOpen(false)} className="flex-1 bg-muted/50 hover:bg-muted" data-testid="button-cancel-feedback">
                Cancelar
              </Button>
              <Button onClick={handleFeedbackSave} className="flex-1 border-0" data-testid="button-save-feedback">
                Guardar
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="tools" className="mt-4 space-y-3 flex flex-col">
            <div className="flex-1">
              <Input
                placeholder="TITLE"
                value={toolTitle}
                onChange={(e) => setToolTitle(e.target.value.toUpperCase())}
                className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                data-testid="input-tool-title"
              />
              <Input
                placeholder="Description"
                value={toolSentence}
                onChange={(e) => setToolSentence(e.target.value)}
                className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted mt-2"
                data-testid="input-tool-sentence"
              />
            </div>
            <div className="flex justify-end items-center gap-2 pt-2">
              <div className="relative">
                <AnimatePresence>
                  {showPlusOne.visible && showPlusOne.type === "tools" && (
                    <motion.span
                      initial={{ opacity: 1, y: 0 }}
                      animate={{ opacity: 0, y: -20 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8 }}
                      className="absolute -top-6 -right-2 text-foreground font-medium text-sm pointer-events-none"
                    >
                      +1
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleAddTool}
                disabled={!toolTitle.trim()}
                className="bg-muted/50 hover:bg-muted"
                data-testid="button-new-tool"
              >
                <Plus className="h-3 w-3 mr-1" />
                New Tool
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="learnings" className="mt-4 space-y-3 flex flex-col">
            <div className="flex-1">
              <Input
                placeholder="TITLE"
                value={learningTitle}
                onChange={(e) => setLearningTitle(e.target.value.toUpperCase())}
                className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                data-testid="input-learning-title"
              />
              <Input
                placeholder="Description"
                value={learningSentence}
                onChange={(e) => setLearningSentence(e.target.value)}
                className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted mt-2"
                data-testid="input-learning-sentence"
              />
            </div>
            <div className="flex justify-end items-center gap-2 pt-2">
              <div className="relative">
                <AnimatePresence>
                  {showPlusOne.visible && showPlusOne.type === "learnings" && (
                    <motion.span
                      initial={{ opacity: 1, y: 0 }}
                      animate={{ opacity: 0, y: -20 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8 }}
                      className="absolute -top-6 -right-2 text-foreground font-medium text-sm pointer-events-none"
                    >
                      +1
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleAddLearning}
                disabled={!learningTitle.trim()}
                className="bg-muted/50 hover:bg-muted"
                data-testid="button-new-learning"
              >
                <Plus className="h-3 w-3 mr-1" />
                New Learning
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

  </>
  );
}


