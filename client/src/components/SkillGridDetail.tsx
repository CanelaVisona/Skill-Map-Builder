import React, { useEffect, useState } from "react";
import { getContrastColor } from "@/lib/utils";
import { X } from "lucide-react";

interface SkillData {
  id: string;
  title: string;
  level: number;
  status: "locked" | "available" | "mastered";
  currentXp: number;
  goalXp: number;
  areaName: string;
}

interface SkillGridDetailProps {
  skill: SkillData | null;
  areaColor: string;
  onClose?: () => void;
}

const TIER_NAMES = ["Fundamento", "Rama", "Maestría"];

export function SkillGridDetail({ skill, areaColor, onClose }: SkillGridDetailProps) {
  const [progressPercent, setProgressPercent] = useState(0);
  
  // Helper: cumulative XP required to reach the start of `level`
  const cumulativeXpToLevelStart = (level: number) => {
    // sum_{i=1}^{level-1} i*100 = 100 * (level-1)*level/2
    return 100 * ((level - 1) * level) / 2;
  };

  // Recalculate progress when skill changes (especially level)
  useEffect(() => {
    if (skill) {
      const currentLevel = skill.level || Math.floor(skill.currentXp / 100) + 1;
      const levelStart = cumulativeXpToLevelStart(currentLevel);
      const xpIntoCurrentLevel = Math.max(0, skill.currentXp - levelStart);
      const xpForThisLevel = Math.max(1, currentLevel * 100);
      const pct = Math.round((xpIntoCurrentLevel / xpForThisLevel) * 100);
      setProgressPercent(Math.max(0, Math.min(100, pct)));
    } else {
      setProgressPercent(0);
    }
  }, [skill?.id, skill?.level, skill?.currentXp, skill?.goalXp]);

  if (!skill) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Seleccioná<br />
          una habilidad
        </p>
      </div>
    );
  }

  const isLocked = skill.status === "locked";
  const isUnlocked = skill.status === "available" || skill.status === "mastered";

  // goalXp now represents LEVEL objective (not XP)
  // 0 = unlimited (no level cap)
  const goalLevel = skill.goalXp > 0 ? skill.goalXp : null;

  // Compute level progress values
  const currentLevel = skill.level || Math.floor(skill.currentXp / 100) + 1;
  const levelStart = cumulativeXpToLevelStart(currentLevel);
  const xpIntoCurrentLevel = Math.max(0, skill.currentXp - levelStart);
  const xpForThisLevel = Math.max(1, currentLevel * 100);

  // Milestones (high level, keep simple)
  const milestones = [
    { label: "Primeros pasos", done: skill.currentXp > 0 },
    { label: `Nivel ${currentLevel} alcanzado`, done: skill.level >= currentLevel },
    { label: goalLevel ? `Llegar a nivel ${goalLevel}` : "Sin meta de nivel", done: goalLevel ? skill.level >= goalLevel : false },
  ];

  const diamondSize = 56;
  const half = diamondSize / 2;
  const points = `${half},2 ${diamondSize - 2},${half} ${half},${diamondSize - 2} 2,${half}`;
  // Use areaColor for both unlocked and locked diamonds (same as preview)
  const diamondFill = areaColor;
  const diamondStroke = areaColor;
  const iconColor = isUnlocked ? "#fff" : "#2e2414";
  const xpPercent = xpIntoCurrentLevel / xpForThisLevel; // progress within current level
  const opacity = 1;

  return (
    <div className="flex flex-col h-full gap-3 overflow-y-auto">
      {/* Close button (mobile) */}
      <div className="flex justify-end md:hidden">
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Diamond */}
      <div className="flex justify-center" style={{ opacity }}>
        <svg
          viewBox={`0 0 ${diamondSize} ${diamondSize}`}
          width={diamondSize + 6}
          height={diamondSize + 6}
          overflow="visible"
        >
          <polygon
            points={points}
            fill={diamondFill}
            stroke={diamondStroke}
            strokeWidth="1.5"
            opacity={0.9}
          />
          {isUnlocked ? (
            <g transform={`translate(${half - 7.5},${half - 7.5})`}>
              <circle cx="8" cy="8" r="4" stroke={iconColor} fill="none" strokeWidth="1" />
            </g>
          ) : (
            <text
              x={half}
              y={half + 4}
              textAnchor="middle"
              style={{
                fontSize: "10px",
                fill: iconColor,
                fontWeight: 500,
              }}
            >
              ✦
            </text>
          )}
        </svg>
      </div>

      {/* Title & Area */}
      <div className="text-center">
        <div className="text-sm font-medium text-black dark:text-white">
          {skill.title}
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
          {skill.areaName}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-700" />

      {/* Stats Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-base font-bold" style={{ color: areaColor }}>
                {/* Show current level and goal level when present: "Lv.X / Y" */}
                Lv.{currentLevel}{goalLevel ? ` / ${goalLevel}` : ""}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                nivel
              </div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold" style={{ color: areaColor }}>
                {xpIntoCurrentLevel}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                XP
              </div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold" style={{ color: areaColor }}>
                {progressPercent}%
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                prog.
              </div>
            </div>
          </div>

          {/* XP Progress Bar - GREEN */}
          <div>
            <div className="w-full h-0.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300 bg-green-500"
                style={{
                  width: `${progressPercent}%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1 px-1">
              <span className="text-xs text-muted-foreground">
                {xpIntoCurrentLevel}
              </span>
              <span className="text-xs text-muted-foreground">
                {xpForThisLevel}
              </span>
            </div>
          </div>

          {/* Milestones */}
          <div className="space-y-1">
            <div className="text-xs font-medium text-amber-700 uppercase tracking-wider" style={{ color: areaColor }}>
              Hitos
            </div>
            {milestones.map((milestone, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-sm flex-shrink-0 mt-1"
                  style={{
                    backgroundColor: milestone.done ? areaColor : "#2a1e0e",
                  }}
                />
                <span
                  className="text-xs leading-relaxed"
                  style={{
                    color: milestone.done ? areaColor : "#2e2414",
                  }}
                >
                  {milestone.label}
                </span>
              </div>
            ))}
          </div>
    </div>
  );
}
