import type { Skill } from "@/lib/skill-context";

export const AREA_NODES_PER_LEVEL = 15;
export const AREA_PROGRESS_XP_INCREMENT = 1;

export function countMasteredSkills(skills: Skill[]): number {
  return skills.filter((skill) => skill.status === "mastered").length;
}

export function calculateAreaLevel(completedNodes: number): number {
  return Math.floor(completedNodes / AREA_NODES_PER_LEVEL) + 1;
}

export function calculateAreaProgressPercentage(completedNodes: number): number {
  const nodesSinceLastLevel = completedNodes % AREA_NODES_PER_LEVEL;
  return (nodesSinceLastLevel / AREA_NODES_PER_LEVEL) * 100;
}

export function clampProgressPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}
