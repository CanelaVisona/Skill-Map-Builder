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
  const isFirstRenderRef = useRef(true);
  const prevAreaIdRef = useRef<string | undefined>(areaOrProjectId);
  const prevCompletedRef = useRef(0);

  const calculateLevel = (completedNodes: number): number => {
    return Math.floor(completedNodes / 30) + 1;
  };

  const calculateProgressPercentage = (completedNodes: number): number => {
    const nodesSinceLastLevel = completedNodes % 30;
    return (nodesSinceLastLevel / 30) * 100;
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
      setIsAnimating(false);
      return;
    }

    // Si el área cambió, resetear sin animar
    if (areaOrProjectId !== prevAreaIdRef.current) {
      prevAreaIdRef.current = areaOrProjectId;
      prevCompletedRef.current = completed;
      setIsAnimating(false);
      return;
    }

    // Si el progreso aumentó en la misma área, animar
    if (completed > prevCompletedRef.current) {
      setIsAnimating(true);
      prevCompletedRef.current = completed;
      const timer = setTimeout(() => setIsAnimating(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [completed, areaOrProjectId]);

  const containerClass = size === "lg" 
    ? "w-full" 
    : "w-20";
  
  const barHeight = size === "lg" 
    ? "h-5" 
    : "h-3";
  
  const textSize = size === "lg" 
    ? "text-xs" 
    : "text-[10px]";

  return (
    <div className={`${containerClass} flex flex-col gap-1`}>
      {/* Bar container */}
      <div className={`${barHeight} relative rounded-sm overflow-hidden bg-gray-200 dark:bg-gray-700`}>
        {/* Progress fill with animation */}
        <motion.div
          className={`h-full transition-all duration-300 ${
            isAnimating 
              ? "bg-orange-500 dark:bg-orange-400" 
              : "bg-gray-700 dark:bg-gray-300"
          }`}
          style={{ width: `${progressPercentage}%` }}
          animate={isAnimating ? { boxShadow: ["0 0 0 0 rgba(249, 115, 22, 0.7)", "0 0 0 8px rgba(249, 115, 22, 0)"] } : {}}
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
