import React from "react";
import { cn, getContrastColor } from "@/lib/utils";

interface SkillData {
  id: string;
  title: string;
  level: number;
  status: "locked" | "available" | "mastered";
  currentXp: number;
  goalXp: number;
  icon?: React.ReactNode;
}

interface SkillDiamondProps {
  skill: SkillData;
  areaColor: string;
  selected?: boolean;
  onClick?: () => void;
  size?: number;
}

export function SkillDiamond({
  skill,
  areaColor,
  selected = false,
  onClick,
  size = 56,
}: SkillDiamondProps) {
  const isLocked = skill.status === "locked";
  const isUnlocked = skill.status === "available" || skill.status === "mastered";
  const level = Math.max(1, skill.level || 1);

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
  
  // Calculate opacity based on XP progress
  // Formula: 0.5 (no progress) + 0.5 * (xp / maxXp) = 1.0 (full progress)
  // Increased base opacity for better visibility
  // Level is provided by skill.level; derive other values for progressive XP (level * 100)
  const currentLevel = level || Math.floor(skill.currentXp / 100) + 1;

  const cumulativeXpToLevelStart = (level: number) => 100 * ((level - 1) * level) / 2;
  const levelStart = cumulativeXpToLevelStart(currentLevel);
  const xpIntoCurrentLevel = Math.max(0, skill.currentXp - levelStart);
  const xpForThisLevel = Math.max(1, currentLevel * 100);

  // For opacity, use progress within current level (0-100%)
  const xpPercent = xpIntoCurrentLevel / xpForThisLevel;
  const opacity = 1;

  // Progress bar percent (0-100)
  const progressPercent = Math.round(Math.max(0, Math.min(100, (xpIntoCurrentLevel / xpForThisLevel) * 100)));

  const diamondSize = size;
  const half = diamondSize / 2;

  // SVG points for diamond shape
  const points = `${half},2 ${diamondSize - 2},${half} ${half},${diamondSize - 2} 2,${half}`;

  const strokeStyle = getStrokeForLevel(currentLevel);
  const fillOpacity = getFillOpacityForLevel(currentLevel);
  const diamondFill = areaColor;
  const diamondStroke = strokeStyle.stroke;
  const contrast = getContrastColor(areaColor || "#000");
  const iconColor = isUnlocked ? contrast : contrast;
  const progressColor = getProgressColorForLevel(currentLevel);
  const nextLevelLabel = `Lv${currentLevel + 1}`;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 cursor-pointer transition-opacity duration-200 hover:opacity-100",
        !isLocked && "hover:shadow-lg"
      )}
      style={{ opacity, minHeight: '96px', minWidth: '96px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClick}
    >
      {/* Diamond SVG */}
      <div className="relative flex items-center justify-center">
        <svg
          viewBox={`0 0 ${diamondSize} ${diamondSize}`}
          width={diamondSize + 10}
          height={diamondSize + 10}
          overflow="visible"
          className="transition-all duration-200"
        >
          {/* Diamond shape */}
          <polygon
            points={points}
            fill={diamondFill}
            fillOpacity={fillOpacity}
            stroke={diamondStroke}
            strokeWidth={strokeStyle.strokeWidth + (selected ? 0.5 : 0)}
            opacity={0.96}
          />

          {/* Icon or lock symbol */}
          {isUnlocked ? (
            <g transform={`translate(${half - 9},${half - 9})`}>
              <svg
                viewBox="4 4 20 20"
                width="18"
                height="18"
                style={{ color: iconColor }}
              >
                <g stroke={iconColor} fill="none" strokeWidth="1.2">
                  {skill.icon}
                </g>
              </svg>
            </g>
          ) : (
            <text
              x={half}
              y={half + 5}
              textAnchor="middle"
              style={{
                fontSize: "13px",
                fill: iconColor,
                fontWeight: 500,
              }}
            >
              ✦
            </text>
          )}

          {/* Level badge (top right) - only for unlocked */}
          {isUnlocked && (
            <text
              x={diamondSize - 10}
              y="12"
              textAnchor="middle"
              style={{
                fontSize: "8px",
                fill: "#fff",
                fontWeight: 500,
              }}
            >
              {skill.level}
            </text>
          )}
        </svg>

        {/* Selection highlight border - overlaid */}
        {selected && (
          <div
            className="absolute inset-0 rounded pointer-events-none"
            style={{
              border: `2px solid #c8a96e`,
              mask: `polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)`,
              WebkitMask: `polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)`,
            }}
          />
        )}
      </div>

      {/* XP Progress bar - GREEN */}
      <div className="relative mx-auto" style={{ width: `${diamondSize + 10}px` }}>
        <div
          className="h-2 w-full rounded-full bg-gray-900/90 border border-gray-700 overflow-hidden shadow-inner"
        >
          <div
            className="h-full transition-all duration-300 rounded-full"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: progressColor,
            }}
          />
        </div>
        <span
          className="absolute left-full ml-1 top-1/2 -translate-y-1/2 shrink-0 text-[9px] leading-none font-semibold whitespace-nowrap"
          style={{ color: "#c8a96e" }}
        >
          {nextLevelLabel}
        </span>
      </div>

      {/* Skill name */}
      <span className="text-xs text-center leading-tight max-w-full px-0.5 line-clamp-2 text-black dark:text-white">
        {skill.title}
      </span>
    </div>
  );
}
