import { motion } from "framer-motion";
import { type Skill, useSkillTree } from "@/lib/skill-context";
import { cn } from "@/lib/utils";
import { Check, Lock, Trash2, Unlock, ChevronUp, ChevronDown } from "lucide-react";
import { useState, useRef } from "react";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface SkillNodeProps {
  skill: Skill;
  areaColor: string;
  onClick: () => void;
  isFirstOfLevel?: boolean;
}

export function SkillNode({ skill, areaColor, onClick, isFirstOfLevel }: SkillNodeProps) {
  const isLocked = skill.status === "locked";
  const isMastered = skill.status === "mastered";
  const isFinalMastered = skill.isFinalNode === 1 && isMastered;
  
  const { activeAreaId, deleteSkill, toggleLock, moveSkill } = useSkillTree();
  const [isOpen, setIsOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

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
      toggleLock(activeAreaId, skill.id);
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
              "w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300 relative",
              isLocked ? "bg-muted border-muted-foreground/20 text-muted-foreground/50" : "bg-card border-border hover:border-foreground/50",
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
            {skill.title}
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
              onClick={() => moveSkill(activeAreaId, skill.id, "up")}
              data-testid="button-move-up"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">Mover</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => moveSkill(activeAreaId, skill.id, "down")}
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
          
          <div className="pt-2 border-t border-border flex justify-end gap-2">
             <Button 
               variant="outline" 
               size="sm" 
               className="h-8 px-3 text-xs"
               onClick={() => {
                 toggleLock(activeAreaId, skill.id);
                 setIsOpen(false);
               }}
             >
               {isLocked ? <Unlock className="mr-2 h-3 w-3" /> : <Lock className="mr-2 h-3 w-3" />}
               {isLocked ? "Unlock" : "Lock"}
             </Button>

             <Button 
               variant="secondary" 
               size="sm" 
               className="h-8 px-3 text-xs"
               onClick={() => {
                 deleteSkill(activeAreaId, skill.id);
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
  );
}


