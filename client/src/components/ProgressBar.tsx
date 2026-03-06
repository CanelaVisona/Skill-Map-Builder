import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Skill } from "@/lib/skill-context";

interface ProgressBarProps {
  skills: Skill[];
  size?: "lg" | "sm";
  areaOrProjectId?: string;
}

export function ProgressBar({ skills, size = "lg", areaOrProjectId }: ProgressBarProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showLevelComplete, setShowLevelComplete] = useState(false);
  const isFirstRenderRef = useRef(true);
  const prevAreaIdRef = useRef<string | undefined>(areaOrProjectId);
  const prevCompletedRef = useRef(0);
  const prevLevelRef = useRef(1);

  const calculateLevel = (completedNodes: number): number => {
    return Math.floor(completedNodes / 15) + 1;
  };

  const calculateProgressPercentage = (completedNodes: number): number => {
    const nodesSinceLastLevel = completedNodes % 15;
    return (nodesSinceLastLevel / 15) * 100;
  };

  const total = skills.length;
  const completed = skills.filter(s => s.status === "mastered").length;
  const level = calculateLevel(completed);
  const progressPercentage = calculateProgressPercentage(completed);

  useEffect(() => {
    // En el primer render, solo inicializar sin animar
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevAreaIdRef.current = areaOrProjectId;
      prevCompletedRef.current = completed;
      prevLevelRef.current = level;
      setIsAnimating(false);
      return;
    }

    // Si el área cambió, resetear sin animar
    if (areaOrProjectId !== prevAreaIdRef.current) {
      prevAreaIdRef.current = areaOrProjectId;
      prevCompletedRef.current = completed;
      prevLevelRef.current = level;
      setIsAnimating(false);
      setShowLevelComplete(false);
      return;
    }

    // Si el progreso aumentó en la misma área, animar
    if (completed > prevCompletedRef.current) {
      setIsAnimating(true);
      prevCompletedRef.current = completed;
      
      // Detectar cambio de nivel
      if (level > prevLevelRef.current) {
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
  }, [completed, areaOrProjectId, level]);

  const containerClass = size === "lg" 
    ? "w-full" 
    : "w-20";
  
  const barHeight = size === "lg" 
    ? "h-5" 
    : "h-3";
  
  const textSize = size === "lg" 
    ? "text-xs" 
    : "text-[10px]";

  const displayWidth = showLevelComplete ? 100 : progressPercentage;
  const barColor = showLevelComplete 
    ? "bg-yellow-500 dark:bg-yellow-400" 
    : isAnimating 
      ? "bg-orange-500 dark:bg-orange-400" 
      : "bg-gray-700 dark:bg-gray-300";

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
        {/* Progress fill with animation */}
        <motion.div
          className={`h-full transition-all duration-300 ${barColor}`}
          style={{ width: `${displayWidth}%` }}
          animate={isAnimating && !showLevelComplete ? { boxShadow: ["0 0 0 0 rgba(249, 115, 22, 0.7)", "0 0 0 8px rgba(249, 115, 22, 0)"] } : {}}
          transition={{ duration: 1.5 }}
        />
        
        {/* Level text integrated inside bar */}
        <div className={`absolute inset-0 flex items-center justify-center ${textSize} font-semibold text-gray-900 dark:text-gray-100 pointer-events-none`}>
          Lvl {level}
        </div>
      </div>
    </div>
  );
}
