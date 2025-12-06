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
  const isAvailable = skill.status === "available";

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer"
            style={{ left: `${skill.x}%`, top: `${skill.y}%` }}
            onClick={!isLocked ? onClick : undefined}
          >
            {/* Glow Effect */}
            {!isLocked && (
              <motion.div
                initial={{ opacity: 0.5, scale: 0.8 }}
                animate={{ 
                  opacity: [0.4, 0.8, 0.4], 
                  scale: [0.9, 1.1, 0.9] 
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  ease: "easeInOut" 
                }}
                className={cn(
                  "absolute inset-0 rounded-full blur-md opacity-50",
                  isMastered ? "bg-white" : areaColor.replace("text-", "bg-")
                )}
                style={{ width: "140%", height: "140%", margin: "-20%" }}
              />
            )}

            {/* Node Circle */}
            <motion.div
              initial={false}
              animate={{
                scale: isMastered ? 1.1 : 1,
                borderColor: isMastered ? "white" : isLocked ? "#333" : "currentColor"
              }}
              className={cn(
                "w-12 h-12 rounded-full border-2 flex items-center justify-center bg-card transition-colors duration-300 relative",
                isLocked ? "border-muted text-muted-foreground bg-muted/20" : areaColor,
                isMastered && "bg-background border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
              )}
            >
              {isLocked ? (
                <Lock size={16} />
              ) : isMastered ? (
                <Check size={20} className="stroke-[3]" />
              ) : (
                <div className={cn("w-3 h-3 rounded-full", areaColor.replace("text-", "bg-"))} />
              )}
            </motion.div>

            {/* Label */}
            <div className={cn(
              "absolute top-14 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-display tracking-wider transition-colors px-2 py-0.5 rounded bg-background/80 backdrop-blur-sm border border-transparent",
              isLocked ? "text-muted-foreground" : "text-foreground border-white/10",
              isMastered && "text-white font-bold"
            )}>
              {skill.title}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] bg-card/90 border-white/10 backdrop-blur-md">
          <p className="font-bold mb-1 font-display text-primary">{skill.title}</p>
          <p className="text-xs text-muted-foreground">{skill.description}</p>
          {isLocked && <p className="text-[10px] text-red-400 mt-2 uppercase tracking-wider">Locked - Complete previous skills</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
