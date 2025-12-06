import { motion } from "framer-motion";
import { Skill } from "../data/skills";
import { cn } from "@/lib/utils";
import { Check, Lock, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useSkillTree } from "@/lib/skill-context";

interface SkillNodeProps {
  skill: Skill;
  areaColor: string;
  onClick: () => void;
}

export function SkillNode({ skill, areaColor, onClick }: SkillNodeProps) {
  const isLocked = skill.status === "locked";
  const isMastered = skill.status === "mastered";
  
  const { activeAreaId, deleteSkill } = useSkillTree();
  const [isOpen, setIsOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const handleTouchStart = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsOpen(true);
    }, 500); // 500ms for long press
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!isLocked) {
      onClick();
    }
  };

  // Also support mouse down/up for desktop testing of "long press"
  const handleMouseDown = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsOpen(true);
    }, 500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer touch-none select-none"
          style={{ left: `${skill.x}%`, top: `${skill.y}px` }}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Node Circle */}
          <motion.div
            initial={false}
            animate={{
              scale: isMastered ? 1.05 : 1,
            }}
            className={cn(
              "w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300 relative",
              isLocked ? "bg-muted border-muted-foreground/20 text-muted-foreground/50" : "bg-card border-border hover:border-foreground/50",
              isMastered && "bg-foreground border-foreground text-background shadow-sm"
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
      </PopoverTrigger>
      <PopoverContent side="right" className="w-64 border-border bg-popover/95 backdrop-blur-xl shadow-xl p-4">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold leading-none mb-1.5">{skill.title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {skill.description || "No description available."}
            </p>
          </div>
          
          <div className="pt-2 border-t border-border flex justify-end">
             <Button 
               variant="destructive" 
               size="sm" 
               className="h-8 px-3 text-xs"
               onClick={() => {
                 deleteSkill(activeAreaId, skill.id);
                 setIsOpen(false);
               }}
             >
               <Trash2 className="mr-2 h-3 w-3" />
               Delete Node
             </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}


