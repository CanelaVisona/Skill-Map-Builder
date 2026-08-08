// Global (client-only) setting controlling how many words a node's title/name can hold.
// Used both by the node's own edit dialog (SkillNode.tsx) and by the Skill Designer, which
// lets the word limit itself be edited. Stored in localStorage since it's a personal display
// preference, not app data that needs to sync anywhere.
const NODE_TITLE_WORD_LIMIT_KEY = "skillNodeTitleWordLimit";
export const DEFAULT_NODE_TITLE_WORD_LIMIT = 8;

export function getNodeTitleWordLimit(): number {
  if (typeof window === "undefined") return DEFAULT_NODE_TITLE_WORD_LIMIT;
  const raw = window.localStorage.getItem(NODE_TITLE_WORD_LIMIT_KEY);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_NODE_TITLE_WORD_LIMIT;
}

export function setNodeTitleWordLimit(limit: number): void {
  if (typeof window === "undefined") return;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_NODE_TITLE_WORD_LIMIT;
  window.localStorage.setItem(NODE_TITLE_WORD_LIMIT_KEY, String(safeLimit));
}

// Clamps free-typed text down to the configured word limit, keeping whole words only.
export function clampToWordLimit(value: string, limit: number): string {
  const words = value.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= limit) return value;
  return words.slice(0, limit).join(" ");
}
