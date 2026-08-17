import type { Skill } from "@/lib/skill-context";

export const AREA_PROGRESS_XP_INCREMENT = 1;

export function countMasteredSkills(skills: Skill[]): number {
  return skills.filter((skill) => skill.status === "mastered").length;
}

// Nodos que pertenecen a un nivel dado del árbol (área o quest). El umbral de la barra de
// nivel ya no es un número fijo (antes 15 nodos parejo para todas las áreas/quests) -- ahora
// depende de cuántos nodos tiene efectivamente el nivel actualmente desbloqueado, así que la
// barra sube distinto según el tamaño real de cada nivel.
//
// El nodo levelPosition === 1 ("skeleton") es siempre mastered de entrada -- no es una skill
// real, es puramente el punto de partida visual del nivel -- así que se excluye del conteo
// para no inflar el total ni sumar un mastered gratis a la barra de progreso.
function isRealLevelSkill(skill: Skill): boolean {
  return skill.levelPosition !== 1;
}

export function countSkillsInLevel(skills: Skill[], level: number): number {
  return skills.filter((skill) => skill.level === level && isRealLevelSkill(skill)).length;
}

export function countMasteredSkillsInLevel(skills: Skill[], level: number): number {
  return skills.filter((skill) => skill.level === level && isRealLevelSkill(skill) && skill.status === "mastered").length;
}

export function calculateLevelProgressPercentage(masteredInLevel: number, totalInLevel: number): number {
  if (totalInLevel <= 0) return 0;
  return clampProgressPercentage((masteredInLevel / totalInLevel) * 100);
}

export function clampProgressPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}
