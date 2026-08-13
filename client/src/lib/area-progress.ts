import type { Skill } from "@/lib/skill-context";

export const AREA_PROGRESS_XP_INCREMENT = 1;

export function countMasteredSkills(skills: Skill[]): number {
  return skills.filter((skill) => skill.status === "mastered").length;
}

// Nodos que pertenecen a un nivel dado del árbol (área o quest). El umbral de la barra de
// nivel ya no es un número fijo (antes 15 nodos parejo para todas las áreas/quests) -- ahora
// depende de cuántos nodos tiene efectivamente el nivel actualmente desbloqueado, así que la
// barra sube distinto según el tamaño real de cada nivel.
export function countSkillsInLevel(skills: Skill[], level: number): number {
  return skills.filter((skill) => skill.level === level).length;
}

export function countMasteredSkillsInLevel(skills: Skill[], level: number): number {
  return skills.filter((skill) => skill.level === level && skill.status === "mastered").length;
}

export function calculateLevelProgressPercentage(masteredInLevel: number, totalInLevel: number): number {
  if (totalInLevel <= 0) return 0;
  return clampProgressPercentage((masteredInLevel / totalInLevel) * 100);
}

export function clampProgressPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}
