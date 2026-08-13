import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { SkillDiamond } from "./SkillDiamond";
import { usePopupPalette } from "@/lib/popup-theme";

// Same block count as the "+XP" gain popup (ExperienceGainPopup.tsx), so the two bars read
// as the same visual language.
const XP_BAR_BLOCKS = 15;

interface SkillData {
  id: string;
  title: string;
  level: number;
  status: "locked" | "available" | "mastered";
  currentXp: number;
  goalXp: number;
  areaName: string;
  description?: string;
}

interface SkillGridDetailProps {
  skill: SkillData | null;
  areaColor: string;
  onClose?: () => void;
}

export function SkillGridDetail({ skill, areaColor, onClose }: SkillGridDetailProps) {
  const [progressPercent, setProgressPercent] = useState(0);
  const palette = usePopupPalette();

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

  const getProgressColorForLevel = (currentLevel: number) => {
    if (currentLevel >= 5) return "#39ff39";
    if (currentLevel === 4) return "#2ecc2e";
    if (currentLevel === 3) return "#24a024";
    if (currentLevel === 2) return "#1f7a1f";
    return "#1a5c1a";
  };

  // goalXp now represents LEVEL objective (not XP)
  // 0 = unlimited (no level cap)
  const goalLevel = skill.goalXp > 0 ? skill.goalXp : null;

  // Compute level progress values
  const currentLevel = skill.level || Math.floor(skill.currentXp / 100) + 1;
  const levelStart = cumulativeXpToLevelStart(currentLevel);
  const xpIntoCurrentLevel = Math.max(0, skill.currentXp - levelStart);
  const xpForThisLevel = Math.max(1, currentLevel * 100);
  const progressColor = getProgressColorForLevel(currentLevel);
  const nextLevelLabel = `Lv${currentLevel + 1}`;

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
      <div className="flex justify-center">
        <SkillDiamond
          skill={{
            id: skill.id,
            title: skill.title,
            level: currentLevel,
            status: skill.status,
            currentXp: skill.currentXp,
            goalXp: skill.goalXp,
          }}
          areaColor={areaColor}
          size={64}
          hideMeta
        />
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

      {/* Description */}
      {skill.description && (
        <div className="text-xs text-center leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {skill.description}
        </div>
      )}

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

          {/* XP Progress Bar — blocky segments, matching the "+XP" gain popup's style */}
          <div className="mx-auto w-full max-w-[240px]">
            <div className="h-4 w-full flex gap-0.5 rounded-sm">
              {Array.from({ length: XP_BAR_BLOCKS }).map((_, index) => {
                const filledBlocks = Math.round((progressPercent / 100) * XP_BAR_BLOCKS);
                const isFilled = index < filledBlocks;
                return (
                  <div
                    key={index}
                    className="flex-1 h-full overflow-hidden rounded-sm transition-colors duration-300"
                    style={{ backgroundColor: isFilled ? progressColor : palette.blockEmpty }}
                  />
                );
              })}
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
    </div>
  );
}
