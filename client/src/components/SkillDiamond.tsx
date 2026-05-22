import React from "react";
import { cn } from "@/lib/utils";

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
  
  // Calculate opacity based on XP progress
  // Formula: 0.5 (no progress) + 0.5 * (xp / maxXp) = 1.0 (full progress)
  // Increased base opacity for better visibility
  // Level is provided by skill.level; derive other values for progressive XP (level * 100)
  const currentLevel = skill.level || Math.floor(skill.currentXp / 100) + 1;

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

  // Always use areaColor for the diamond fill, reduce opacity when locked
  const diamondFill = areaColor;
  const diamondStroke = areaColor;
  const strokeWidth = selected ? 2 : 1.5;
  const iconColor = isUnlocked ? "#fff" : "#2e2414";

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
            stroke={diamondStroke}
            strokeWidth={strokeWidth * 1.2}
            opacity={0.9}
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
                fill: "#0e0c0a",
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
      <div className="w-12 h-1 rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full transition-all duration-300 bg-green-500"
          style={{
            width: `${progressPercent}%`,
          }}
        />
      </div>

      {/* Skill name */}
      <span
        className="text-xs text-center leading-tight max-w-full px-0.5 line-clamp-2"
        style={{
          color: "#000",
        }}
      >
        {skill.title}
      </span>
    </div>
  );
}
