import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Skill } from "@/lib/skill-context";
import { useAreaXpPopup } from "@/lib/area-xp-popup-context";
import { countMasteredSkillsInLevel, countSkillsInLevel } from "@/lib/area-progress";

interface ProgressBarProps {
  skills: Skill[];
  size?: "lg" | "sm";
  areaOrProjectId?: string;
  unlockedLevel: number;
}

export function ProgressBar({ skills, size = "lg", areaOrProjectId, unlockedLevel }: ProgressBarProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showLevelComplete, setShowLevelComplete] = useState(false);
  const { snapshot: areaXpSnapshot } = useAreaXpPopup();
  const isFirstRenderRef = useRef(true);
  const prevAreaIdRef = useRef<string | undefined>(areaOrProjectId);
  const prevMasteredRef = useRef(0);
  const prevLevelRef = useRef(unlockedLevel);

  const getLevelColor = (level: number): string => {
    const colors: { [key: number]: string } = {
      1: "bg-green-100 dark:bg-green-100",
      2: "bg-green-200 dark:bg-green-200",
      3: "bg-green-300 dark:bg-green-300",
      4: "bg-green-400 dark:bg-green-400",
      5: "bg-green-500 dark:bg-green-500",
      6: "bg-green-600 dark:bg-green-600",
      7: "bg-green-700 dark:bg-green-700",
      8: "bg-green-800 dark:bg-green-800",
    };
    return colors[level] || "bg-green-500 dark:bg-green-500";
  };

  const level = unlockedLevel;
  const totalInLevel = countSkillsInLevel(skills, level);
  const masteredInLevel = countMasteredSkillsInLevel(skills, level);
  const activeAreaXpSnapshot = areaXpSnapshot?.areaOrProjectId === areaOrProjectId ? areaXpSnapshot : null;
  const bonusWidth = activeAreaXpSnapshot ? Math.max(0, activeAreaXpSnapshot.progressAfterPct - activeAreaXpSnapshot.progressBeforePct) : 0;

  useEffect(() => {
    // En el primer render, solo inicializar sin animar
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevAreaIdRef.current = areaOrProjectId;
      prevMasteredRef.current = masteredInLevel;
      prevLevelRef.current = level;
      setIsAnimating(false);
      return;
    }

    // Si el área cambió, resetear sin animar
    if (areaOrProjectId !== prevAreaIdRef.current) {
      prevAreaIdRef.current = areaOrProjectId;
      prevMasteredRef.current = masteredInLevel;
      prevLevelRef.current = level;
      setIsAnimating(false);
      setShowLevelComplete(false);
      return;
    }

    const levelIncreased = level > prevLevelRef.current;
    const masteredIncreased = masteredInLevel > prevMasteredRef.current;

    // Si se completó un nodo del nivel actual, o se desbloqueó un nivel nuevo, animar
    if (levelIncreased || masteredIncreased) {
      setIsAnimating(true);
      prevMasteredRef.current = masteredInLevel;

      if (levelIncreased) {
        // Mostrar barra completa en amarillo inmediatamente
        setShowLevelComplete(true);

        // Mostrar "level up!" con delay para que aparezca después de "quest updated!" y "LEVEL"
        setTimeout(() => {
          setShowLevelUp(true);
          setTimeout(() => {
            setShowLevelUp(false);
            // Ocultar barra completa después de que desaparece el cartel
            setShowLevelComplete(false);
          }, 2000);
        }, 2500);
        prevLevelRef.current = level;
      }

      const timer = setTimeout(() => setIsAnimating(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [masteredInLevel, level, areaOrProjectId]);

  const containerClass = size === "lg" 
    ? "w-full" 
    : "w-20";
  
  const barHeight = size === "lg" 
    ? "h-5" 
    : "h-3";
  
  const textSize = size === "lg" 
    ? "text-xs" 
    : "text-[10px]";

  const levelColor = getLevelColor(level);
  const barColor = showLevelComplete 
    ? "bg-yellow-500 dark:bg-yellow-400" 
    : isAnimating 
      ? levelColor 
      : levelColor;

  return (
    <div className={`${containerClass} flex flex-col gap-1 relative`}>
      {/* Level up notification */}
      {showLevelUp && (
        <motion.div
          className="absolute -top-6 left-0 right-0 flex justify-center pointer-events-none"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <span className="text-sm font-bold tracking-widest uppercase text-yellow-500 dark:text-yellow-400 shadow-lg whitespace-nowrap">
            Level up!
          </span>
        </motion.div>
      )}
      
      {/* Bar container */}
      <div className={`${barHeight} relative rounded-sm overflow-hidden bg-gray-200 dark:bg-gray-700`}>
        {/* Progress fill as discrete blocks, one per skill del nivel */}
        <div className="absolute inset-0 flex gap-[2px] p-[1px]">
          {Array.from({ length: Math.max(totalInLevel, 1) }).map((_, index) => {
            const isFilled = showLevelComplete || index < masteredInLevel;
            const isLastFilled = !showLevelComplete && index === masteredInLevel - 1;

            return (
              <motion.div
                key={index}
                className={`h-full flex-1 rounded-[2px] transition-colors duration-300 ${isFilled ? barColor : "bg-gray-300 dark:bg-gray-600"}`}
                animate={isAnimating && isLastFilled ? { boxShadow: ["0 0 0 0 rgba(249, 115, 22, 0.7)", "0 0 0 8px rgba(249, 115, 22, 0)"] } : {}}
                transition={{ duration: 1.5 }}
              />
            );
          })}
        </div>

        <AnimatePresence>
          {activeAreaXpSnapshot && bonusWidth > 0 && (
            <motion.div
              key="area-progress-bonus"
              initial={{ opacity: 0, left: `${activeAreaXpSnapshot.progressBeforePct}%`, width: `${bonusWidth}%` }}
              animate={{ opacity: 0.75, left: `${activeAreaXpSnapshot.progressBeforePct}%`, width: `${bonusWidth}%` }}
              exit={{ opacity: 0, left: `${activeAreaXpSnapshot.progressBeforePct}%`, width: `${bonusWidth}%` }}
              transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
              className="absolute top-0 h-full pointer-events-none"
              style={{ backgroundColor: activeAreaXpSnapshot.areaColor, mixBlendMode: "screen" }}
            />
          )}
        </AnimatePresence>

        {/* Level text integrated inside bar -- blanco con sombra para que se lea sobre
            cualquier bloque (relleno o vacío) en ambos temas */}
        <div
          className={`absolute inset-0 flex items-center justify-center ${textSize} font-semibold text-white pointer-events-none`}
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
        >
          Lvl {level}
        </div>
      </div>
    </div>
  );
}