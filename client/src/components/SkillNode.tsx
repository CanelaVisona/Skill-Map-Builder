import { motion } from "framer-motion";
import { Skill } from "../data/skills";
import { cn } from "@/lib/utils";
import { Check, Lock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SkillNodeProps {
  skill: Skill;
  areaColor: string;
  onClick: () => void;
}

export function SkillNode({ skill, areaColor, onClick }: SkillNodeProps) {
  const isLocked = skill.status === "locked";
  const isMastered = skill.status === "mastered";
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer"
            style={{ left: `${skill.x}%`, top: `${skill.y}px` }}
            onClick={!isLocked ? onClick : undefined}
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
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px] border-border bg-popover text-popover-foreground shadow-lg rounded-md p-3">
          <p className="font-semibold mb-1 text-sm">{skill.title}</p>
          <p className="text-xs text-muted-foreground">{skill.description}</p>
          {isLocked && <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">Locked</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

