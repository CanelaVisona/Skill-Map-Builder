import { Skill } from "../data/skills";
import { cn } from "@/lib/utils";

interface SkillConnectionProps {
  start: Skill;
  end: Skill;
  active: boolean;
  areaColor: string;
}

export function SkillConnection({ start, end, active, areaColor }: SkillConnectionProps) {
  // Calculate SVG line coordinates (0-100 percentage based)
  const x1 = start.x;
  const y1 = start.y;
  const x2 = end.x;
  const y2 = end.y;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
      <defs>
        <linearGradient id={`grad-${start.id}-${end.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>
      
      {/* Background Line (Dim) */}
      <line
        x1={`${x1}%`}
        y1={`${y1}%`}
        x2={`${x2}%`}
        y2={`${y2}%`}
        className="stroke-muted/30"
        strokeWidth="2"
      />

      {/* Active Line (Glow) */}
      <line
        x1={`${x1}%`}
        y1={`${y1}%`}
        x2={`${x2}%`}
        y2={`${y2}%`}
        className={cn(
          "transition-all duration-1000 ease-out",
          active ? areaColor : "stroke-transparent"
        )}
        strokeWidth="2"
        strokeDasharray="4 4"
      />
    </svg>
  );
}
