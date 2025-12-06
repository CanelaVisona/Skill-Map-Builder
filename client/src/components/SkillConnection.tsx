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
      
      {/* Background Line (Dim) */}
      <line
        x1={`${x1}%`}
        y1={y1}
        x2={`${x2}%`}
        y2={y2}
        className="stroke-muted"
        strokeWidth="1"
      />

      {/* Active Line */}
      <line
        x1={`${x1}%`}
        y1={y1}
        x2={`${x2}%`}
        y2={y2}
        className={cn(
          "transition-all duration-500 ease-in-out",
          active ? "stroke-foreground" : "stroke-transparent"
        )}
        strokeWidth="1.5"
      />
    </svg>
  );
}

