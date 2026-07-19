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

  const getStrokeForLevel = (currentLevel: number) => {
    if (currentLevel >= 5) return { stroke: "#ffe8a0", strokeWidth: 3.5 };
    if (currentLevel === 4) return { stroke: "#e8c97e", strokeWidth: 2.8 };
    if (currentLevel === 3) return { stroke: "#c8a96e", strokeWidth: 2 };
    if (currentLevel === 2) return { stroke: "#8a6a2a", strokeWidth: 1.4 };
    return { stroke: "#5a4a2a", strokeWidth: 0.8 };
  };

  const getProgressColorForLevel = (currentLevel: number) => {
    if (currentLevel >= 5) return "#39ff39";
    if (currentLevel === 4) return "#2ecc2e";
    if (currentLevel === 3) return "#24a024";
    if (currentLevel === 2) return "#1f7a1f";
    return "#1a5c1a";
  };

  const getFillOpacityForLevel = (currentLevel: number) => Math.min(0.3 + (currentLevel * 0.15), 1.0);

  // goalXp now represents LEVEL objective (not XP)
  // 0 = unlimited (no level cap)
  const goalLevel = skill.goalXp > 0 ? skill.goalXp : null;

  // Compute level progress values
  const currentLevel = skill.level || Math.floor(skill.currentXp / 100) + 1;
  const levelStart = cumulativeXpToLevelStart(currentLevel);
  const xpIntoCurrentLevel = Math.max(0, skill.currentXp - levelStart);
  const xpForThisLevel = Math.max(1, currentLevel * 100);
  const strokeStyle = getStrokeForLevel(currentLevel);
  const fillOpacity = getFillOpacityForLevel(currentLevel);
  const progressColor = getProgressColorForLevel(currentLevel);
  const nextLevelLabel = `Lv${currentLevel + 1}`;

  // Milestones: solo subidas de nivel reales, desde nivel 1 hasta el nivel actual (o la meta, si es mayor)
  const maxDisplayLevel = goalLevel ? Math.max(goalLevel, currentLevel) : currentLevel;
  const milestones = Array.from({ length: maxDisplayLevel }, (_, i) => {
    const lvl = i + 1;
    return { label: `Nivel ${lvl}`, done: currentLevel >= lvl };
  });

  const diamondSize = 56;
  const half = diamondSize / 2;
  const points = `${half},2 ${diamondSize - 2},${half} ${half},${diamondSize - 2} 2,${half}`;
  // Use areaColor for both unlocked and locked diamonds (same as preview)
  const diamondFill = areaColor;
  const diamondStroke = strokeStyle.stroke;
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
            fillOpacity={fillOpacity}
            stroke={diamondStroke}
            strokeWidth={strokeStyle.strokeWidth}
            opacity={0.96}
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
                {currentLevel}{goalLevel ? ` / ${goalLevel}` : ""}
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

          {/* XP Progress Bar */}
          <div className="mx-auto w-full max-w-[240px]">
            <div className="h-2 rounded-full bg-gray-900/90 border border-gray-700 overflow-hidden shadow-inner">
              <div
                className="h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: progressColor,
                }}
              />
            </div>
            <div className="flex justify-between mt-1 px-1">
              <span className="text-xs text-muted-foreground">
                {xpIntoCurrentLevel}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <span>{xpForThisLevel}</span>
                <span className="text-[9px] leading-none font-semibold whitespace-nowrap" style={{ color: "#c8a96e" }}>
                  {nextLevelLabel}
                </span>
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
