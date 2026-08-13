import React from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { cn, getContrastColor } from "@/lib/utils";
import {
  getShapeGeometry,
  getShapeGeometryAtScale,
  getOuterVertices,
  type ShapeKey,
  type ShapeGeometry,
} from "@/lib/skill-shapes";
import { getMaterialTokens, getRimColorForLevel, getMaterialForLevel, tintWithAreaColor, type MaterialKey } from "@/lib/skill-materials";
import { getRarityTokens, shouldGlow, type RarityKey } from "@/lib/skill-rarity";

interface SkillData {
  id: string;
  title: string;
  level: number;
  status: "locked" | "available" | "mastered";
  currentXp: number;
  goalXp: number;
}

interface SkillDiamondProps {
  skill: SkillData;
  areaColor: string;
  selected?: boolean;
  onClick?: () => void;
  size?: number;
  /** Renders only the medallion itself, without the name label / mini XP bar below it —
   *  used by callers (e.g. SkillGridDetail) that already show their own name/progress UI. */
  hideMeta?: boolean;
}

// Every skill now renders at the "large" size — no longer a per-skill choice.
const LARGE_NODE_SCALE = 1.2;

function renderShapeEl(geom: ShapeGeometry, props: React.SVGProps<SVGPolygonElement> & React.SVGProps<SVGCircleElement>) {
  if (geom.kind === "circle") {
    return <circle cx={geom.cx} cy={geom.cy} r={geom.r} {...(props as React.SVGProps<SVGCircleElement>)} />;
  }
  return <polygon points={geom.points} {...(props as React.SVGProps<SVGPolygonElement>)} />;
}

export function SkillDiamond({
  skill,
  areaColor,
  selected = false,
  onClick,
  size = 56,
  hideMeta = false,
}: SkillDiamondProps) {
  const isLocked = skill.status === "locked";
  const isUnlocked = skill.status === "available" || skill.status === "mastered";
  const isAvailable = skill.status === "available";
  const isMastered = skill.status === "mastered";
  const level = Math.max(1, skill.level || 1);

  const getStrokeWidthForLevel = (currentLevel: number) => {
    if (currentLevel >= 5) return 3.5;
    if (currentLevel === 4) return 2.8;
    if (currentLevel === 3) return 2;
    if (currentLevel === 2) return 1.4;
    return 0.8;
  };

  const getFillOpacityForLevel = (currentLevel: number) => Math.min(0.3 + currentLevel * 0.15, 1.0);

  const getProgressColorForLevel = (currentLevel: number) => {
    if (currentLevel >= 5) return "#39ff39";
    if (currentLevel === 4) return "#2ecc2e";
    if (currentLevel === 3) return "#24a024";
    if (currentLevel === 2) return "#1f7a1f";
    return "#1a5c1a";
  };

  const currentLevel = level || Math.floor(skill.currentXp / 100) + 1;
  const cumulativeXpToLevelStart = (lvl: number) => (100 * ((lvl - 1) * lvl)) / 2;
  const levelStart = cumulativeXpToLevelStart(currentLevel);
  const xpIntoCurrentLevel = Math.max(0, skill.currentXp - levelStart);
  const xpForThisLevel = Math.max(1, currentLevel * 100);
  const progressPercent = Math.round(Math.max(0, Math.min(100, (xpIntoCurrentLevel / xpForThisLevel) * 100)));
  const progressColor = getProgressColorForLevel(currentLevel);
  const nextLevelLabel = `Lv${currentLevel + 1}`;

  // Every skill is a uniform legendary-tier diamond whose material automatically upgrades
  // with level — a locked skill just stays plain dim iron/common until it actually unlocks.
  const effectiveShape: ShapeKey = "diamond_classic";
  const effectiveMaterial: MaterialKey = isLocked ? "iron" : getMaterialForLevel(currentLevel);
  const effectiveRarity: RarityKey = isLocked ? "common" : "legendary";

  const renderSize = size * LARGE_NODE_SCALE;
  const svgBox = renderSize + 10; // matches the +10 padding the diamond always had, for stroke/ring bleed

  const materialTokens = getMaterialTokens(effectiveMaterial);
  const rarityTokens = getRarityTokens(effectiveRarity);
  const glowOn = !isLocked && shouldGlow(effectiveRarity, null);

  const strokeWidth = getStrokeWidthForLevel(currentLevel) + (selected ? 0.5 : 0);
  const fillOpacity = getFillOpacityForLevel(currentLevel);
  const rimColor = tintWithAreaColor(getRimColorForLevel(materialTokens, currentLevel), areaColor);
  const contrast = getContrastColor(areaColor || "#000");

  const rawId = React.useId();
  const gradId = `skillGrad-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  // All geometry is computed relative to the renderSize box, then centered with a 5px margin
  // inside the svgBox (renderSize + 10) — same total padding the original diamond used.
  const plateGeom = getShapeGeometry(effectiveShape, renderSize);
  const shadowGeom = getShapeGeometryAtScale(effectiveShape, renderSize, 1.05);
  const bevelGeom = getShapeGeometryAtScale(effectiveShape, renderSize, 0.92);
  const rarityRing1Geom = getShapeGeometryAtScale(effectiveShape, renderSize, 1.12);
  const rarityRing2Geom = getShapeGeometryAtScale(effectiveShape, renderSize, 1.2);
  const prestigeRingGeom = getShapeGeometryAtScale(effectiveShape, renderSize, 1.28);
  // Selection ring is a separate overlay div sized to the *full* svgBox, so its clip-path is
  // computed directly against that box (scale = renderSize/svgBox) to line up with the plate.
  const selectionGeom = getShapeGeometryAtScale(effectiveShape, svgBox, renderSize / svgBox);
  const outerVertices = getOuterVertices(effectiveShape, renderSize);

  const isMaxed = isMastered && skill.goalXp > 0 && currentLevel >= skill.goalXp;
  const lockIconSize = renderSize * 0.34;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 cursor-pointer transition-opacity duration-200 hover:opacity-100",
        !isLocked && "hover:shadow-lg"
      )}
      style={{ minHeight: "96px", minWidth: "96px", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClick}
    >
      {/* Medallion */}
      <div className="relative flex items-center justify-center">
        <motion.div
          animate={isAvailable ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={isAvailable ? { duration: 2.2, repeat: Infinity, repeatType: "loop" } : { duration: 0.2 }}
          style={{
            opacity: isLocked ? 0.55 : 1,
            filter: glowOn ? `drop-shadow(0 0 ${rarityTokens.glowBlur}px ${rarityTokens.glowColor})` : undefined,
          }}
        >
          <svg viewBox={`0 0 ${svgBox} ${svgBox}`} width={svgBox} height={svgBox} overflow="visible" className="transition-all duration-200">
            <defs>
              <linearGradient id={gradId} x1="15%" y1="0%" x2="85%" y2="100%">
                <stop offset="0%" stopColor={materialTokens.plateGradient[0]} />
                <stop offset="55%" stopColor={materialTokens.plateGradient[1]} />
                <stop offset="100%" stopColor={materialTokens.plateGradient[2]} />
              </linearGradient>
            </defs>
            <g transform="translate(5,5)">
              {/* Rarity ring(s) — sit behind the plate, only for unlocked skills */}
              {!isLocked && rarityTokens.ringCount >= 2 &&
                renderShapeEl(rarityRing2Geom, { fill: "none", stroke: rarityTokens.ringColor ?? undefined, strokeWidth: 1, opacity: 0.5 })}
              {!isLocked && rarityTokens.ringCount >= 1 &&
                renderShapeEl(rarityRing1Geom, { fill: "none", stroke: rarityTokens.ringColor ?? undefined, strokeWidth: 1.3, opacity: 0.8 })}
              {/* Prestige ring — mastered at (or past) the skill's max level, independent of rarity */}
              {isMaxed &&
                renderShapeEl(prestigeRingGeom, { fill: "none", stroke: "#ffe8a0", strokeWidth: 1.4, strokeDasharray: "3 2", opacity: 0.9 })}
              {/* Fake depth: a slightly larger dark copy behind the plate, no SVG filters */}
              {renderShapeEl(shadowGeom, { fill: "#000", opacity: 0.35, transform: "translate(0,1.2)" })}
              {/* Plate */}
              {renderShapeEl(plateGeom, {
                fill: `url(#${gradId})`,
                fillOpacity,
                stroke: rimColor,
                strokeWidth,
                opacity: 0.98,
              })}
              {/* Bevel highlight: thin inset lighter stroke, fakes a specular edge */}
              {renderShapeEl(bevelGeom, { fill: "none", stroke: materialTokens.rimHighlight, strokeWidth: 0.6, opacity: 0.3 })}
              {/* Corner flourish / rivets — epic & legendary only */}
              {!isLocked && rarityTokens.cornerFlourish &&
                outerVertices.map((v, i) => (
                  <circle key={i} cx={v.x} cy={v.y} r={1.4} fill={rarityTokens.ringColor ?? materialTokens.rimHighlight} opacity={0.85} />
                ))}
              {/* Level badge, unlocked only */}
              {isUnlocked && (
                <text x={renderSize - 10} y="12" textAnchor="middle" style={{ fontSize: "8px", fill: "#fff", fontWeight: 500 }}>
                  {skill.level}
                </text>
              )}
            </g>
          </svg>
        </motion.div>

        {/* Lock glyph — the only overlay glyph left; unlocked/mastered skills show no icon */}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: 0.85 }}>
            <Lock size={lockIconSize} color={contrast} strokeWidth={1.6} style={{ filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.5))" }} />
          </div>
        )}

        {/* Selection highlight, clipped to the actual chosen shape */}
        {selected && (
          <div
            className="absolute inset-0 rounded pointer-events-none"
            style={{
              border: "2px solid #c8a96e",
              clipPath: selectionGeom.clipPath,
              WebkitClipPath: selectionGeom.clipPath,
            }}
          />
        )}
      </div>

      {!hideMeta && (
        <>
          {/* XP Progress bar — unchanged */}
          <div className="relative mx-auto" style={{ width: `${renderSize + 10}px` }}>
            <div className="h-2 w-full rounded-full bg-gray-900/90 border border-gray-700 overflow-hidden shadow-inner">
              <div
                className="h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%`, backgroundColor: progressColor }}
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
        </>
      )}
    </div>
  );
}
