// Logros que el usuario registra EN TIEMPO REAL mientras responde un concepto.
//
// Es una capa independiente de la evaluación (lib/conceptLearning.ts): marcar un logro no cambia
// la comprensión, los indicadores, el nivel de ayuda ni el dominio. Se guarda en su propia
// columna (`practice.conceptAchievements`) apenas se marca, así sobrevive a una sesión
// interrumpida, a ediciones de la respuesta y a cambios de actividad.

import { newId, type ActivityType, type HelpLevel } from "@/lib/conceptLearning";

export type AchievementType =
  | "general_idea"
  | "recalled_info"
  | "knowledge_gap"
  | "recalled_points"
  | "recovered_forgotten"
  | "developed_point"
  | "related_points"
  | "custom";

export const ACHIEVEMENT_TYPES: { type: Exclude<AchievementType, "custom">; emoji: string; label: string }[] = [
  { type: "general_idea", emoji: "💬", label: "Pude expresar la idea general con mis propias palabras" },
  { type: "recalled_info", emoji: "🧠", label: "Pude recordar información que había estudiado" },
  { type: "knowledge_gap", emoji: "🔍", label: "Identifiqué una laguna en mi conocimiento" },
  { type: "recalled_points", emoji: "📌", label: "Pude recordar uno o varios puntos" },
  { type: "recovered_forgotten", emoji: "🔁", label: "Pude recuperar un punto que había olvidado" },
  { type: "developed_point", emoji: "✍️", label: "Pude desarrollar un punto con mis palabras" },
  { type: "related_points", emoji: "🔗", label: "Pude relacionar dos o más puntos" },
];

// Ayuda que se estaba usando cuando se registró el logro.
export type HelpContext = "free" | "hints" | "after_material";

export const HELP_CONTEXT_LABELS: Record<HelpContext, string> = {
  free: "sin pistas",
  hints: "con pistas",
  after_material: "después de consultar el material",
};

export interface ConceptAchievement {
  id: string;
  conceptId: string;
  sessionId: string;
  sessionNumber: number;
  type: AchievementType;
  at: string; // ISO, momento en que se marcó
  activity: ActivityType | null; // Actividad que se estaba haciendo
  helpContext: HelpContext;
  helpLevel: HelpLevel | null;
  description?: string; // Solo en "custom" (u opcional en los demás)
}

export function getAchievements(practice: { conceptAchievements?: unknown }): ConceptAchievement[] {
  const raw = practice.conceptAchievements;
  return Array.isArray(raw) ? (raw.filter((a) => a && typeof a === "object" && "type" in a) as ConceptAchievement[]) : [];
}

export function achievementLabel(a: Pick<ConceptAchievement, "type" | "description">): string {
  if (a.type === "custom") return a.description?.trim() || "Otro logro";
  return ACHIEVEMENT_TYPES.find((t) => t.type === a.type)?.label ?? a.type;
}

export function achievementEmoji(type: AchievementType): string {
  return type === "custom" ? "⭐" : ACHIEVEMENT_TYPES.find((t) => t.type === type)?.emoji ?? "⭐";
}

export function createAchievement(fields: Omit<ConceptAchievement, "id" | "at">): ConceptAchievement {
  return { ...fields, id: newId("a"), at: new Date().toISOString() };
}

// Marcar/desmarcar un logro predefinido dentro de una sesión: desmarcar quita el registro de esa
// sesión (los de otras sesiones no se tocan).
export function toggleAchievement(
  list: ConceptAchievement[],
  sessionId: string,
  type: Exclude<AchievementType, "custom">,
  create: () => ConceptAchievement,
): ConceptAchievement[] {
  const existing = list.find((a) => a.sessionId === sessionId && a.type === type);
  return existing ? list.filter((a) => a.id !== existing.id) : [...list, create()];
}
