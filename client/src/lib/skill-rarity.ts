// Rarity layer for the skill medallions (Journal → Skills grid). Rarity sits on top of the
// chosen material/shape and automatically drives extra ring(s), glow and small ornamental
// details — it never changes the base metal tone, only how much "flair" is layered over it.

export type RarityKey = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY_KEYS: RarityKey[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const RARITY_LABELS: Record<RarityKey, string> = {
  common: "Común",
  uncommon: "Poco común",
  rare: "Raro",
  epic: "Épico",
  legendary: "Legendario",
};

export interface RarityTokens {
  ringColor: string | null;
  ringCount: 0 | 1 | 2;
  glowColor: string | null;
  glowBlur: number; // px, used in a CSS drop-shadow()
  glowOpacity: number;
  /** Legendary-style pulsing glow, only meaningful once the skill is mastered. */
  pulses: boolean;
  /** Small rivet/gem pips at the shape's outer vertices. */
  cornerFlourish: boolean;
}

// Rare/epic use a conventional blue/violet ladder so "rarer" reads clearly without invading
// the amber palette that already means "level"/"mastery" elsewhere in the node. Legendary
// stays in that same gold family on purpose, so a legendary skill still feels like the top
// of *this app's* existing hierarchy rather than a clashing, generic "purple > gold" trope.
const RARITIES: Record<RarityKey, RarityTokens> = {
  common: { ringColor: null, ringCount: 0, glowColor: null, glowBlur: 0, glowOpacity: 0, pulses: false, cornerFlourish: false },
  uncommon: { ringColor: "#9db8a0", ringCount: 1, glowColor: null, glowBlur: 0, glowOpacity: 0, pulses: false, cornerFlourish: false },
  rare: { ringColor: "#4aa8d8", ringCount: 1, glowColor: "#4aa8d8", glowBlur: 6, glowOpacity: 0.45, pulses: false, cornerFlourish: false },
  epic: { ringColor: "#b06fe0", ringCount: 2, glowColor: "#b06fe0", glowBlur: 9, glowOpacity: 0.55, pulses: false, cornerFlourish: true },
  legendary: { ringColor: "#ffb84a", ringCount: 2, glowColor: "#ffcf6b", glowBlur: 14, glowOpacity: 0.7, pulses: true, cornerFlourish: true },
};

export function getRarityTokens(rarity: RarityKey | undefined): RarityTokens {
  return RARITIES[rarity ?? "common"] ?? RARITIES.common;
}

/** null/undefined glowOverride = auto (glows for rare and above); 0/1 forces it off/on. */
export function shouldGlow(rarity: RarityKey | undefined, glowOverride: 0 | 1 | null | undefined): boolean {
  if (glowOverride === 0) return false;
  if (glowOverride === 1) return true;
  const r = rarity ?? "common";
  return r === "rare" || r === "epic" || r === "legendary";
}
