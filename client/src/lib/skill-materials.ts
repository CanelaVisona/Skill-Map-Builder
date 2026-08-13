// Metal/material palette for the skill medallions (Journal → Skills grid). A material sets
// the base tone of the plate + rim; the existing per-level brightness progression (see
// getRimColorForLevel) still lerps the rim from dim to bright on top of it, so leveling up
// stays a visible signal regardless of which material is chosen. areaColor is folded in as a
// light rim/glow tint (see tintWithAreaColor), not the dominant fill, so an area's identity
// stays recognizable at a glance without going back to a flat colored diamond.

export type MaterialKey = "iron" | "steel" | "silver" | "aged_gold" | "stone" | "leather" | "custom";

export const MATERIAL_KEYS: MaterialKey[] = ["iron", "steel", "silver", "aged_gold", "stone", "leather", "custom"];

export const MATERIAL_LABELS: Record<MaterialKey, string> = {
  iron: "Hierro",
  steel: "Acero",
  silver: "Plata",
  aged_gold: "Oro envejecido",
  stone: "Piedra",
  leather: "Cuero/metal",
  custom: "Personalizado",
};

export interface MaterialTokens {
  /** dark -> mid -> light stops for the plate's fill gradient */
  plateGradient: [string, string, string];
  /** rim color at level 1 (dim) */
  rimBase: string;
  /** rim color at level 5+ (bright) */
  rimHighlight: string;
  /** subtle backing tone drawn behind the icon */
  iconPlate: string;
}

const MATERIALS: Record<Exclude<MaterialKey, "custom">, MaterialTokens> = {
  iron: {
    plateGradient: ["#2b2823", "#4a463d", "#6b6559"],
    rimBase: "#5a4a2a",
    rimHighlight: "#ffe8a0",
    iconPlate: "#1f1c18",
  },
  steel: {
    plateGradient: ["#2c333b", "#4d5761", "#7c8994"],
    rimBase: "#5f6b74",
    rimHighlight: "#d9e2ea",
    iconPlate: "#232a30",
  },
  silver: {
    plateGradient: ["#3a3a3d", "#6e6e73", "#b8b8bd"],
    rimBase: "#7d7d85",
    rimHighlight: "#f2f2f6",
    iconPlate: "#28282b",
  },
  aged_gold: {
    plateGradient: ["#3a2a10", "#8a6a2a", "#c8a96e"],
    rimBase: "#8a6a2a",
    rimHighlight: "#ffe8a0",
    iconPlate: "#3a2a14",
  },
  stone: {
    plateGradient: ["#3a3833", "#5c584f", "#8a8579"],
    rimBase: "#5c584f",
    rimHighlight: "#c9c2b0",
    iconPlate: "#2a2823",
  },
  leather: {
    plateGradient: ["#3a2416", "#5c3b22", "#8a5c35"],
    rimBase: "#5c3b22",
    rimHighlight: "#d9a869",
    iconPlate: "#2a1a10",
  },
};

const DEFAULT_CUSTOM_COLOR = "#c8a96e";

/** Swatch options offered for material = 'custom', matching the palette already used
 *  elsewhere in the app (e.g. area/project creation) for visual consistency. */
export const AVAILABLE_ACCENT_COLORS = [
  "#c85a2a", "#7F77DD", "#378ADD", "#1D9E75", "#BA7517", "#D4537E", "#4aaa6a", "#5aaacc",
];

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num) || full.length !== 6) return [200, 169, 110]; // fallback ~ #c8a96e
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => clampByte(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Linear RGB lerp between two hex colors, t clamped to [0,1]. */
export function mixHex(a: string, b: string, t: number): string {
  const tt = Math.max(0, Math.min(1, t));
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * tt, g1 + (g2 - g1) * tt, b1 + (b2 - b1) * tt);
}

function shadeHex(hex: string, amount: number): string {
  // amount > 0 lightens toward white, amount < 0 darkens toward black
  return amount >= 0 ? mixHex(hex, "#ffffff", amount) : mixHex(hex, "#000000", -amount);
}

function deriveCustomTokens(accentColor?: string | null): MaterialTokens {
  const base = accentColor && /^#[0-9a-fA-F]{3,6}$/.test(accentColor) ? accentColor : DEFAULT_CUSTOM_COLOR;
  return {
    plateGradient: [shadeHex(base, -0.65), shadeHex(base, -0.25), shadeHex(base, 0.1)],
    rimBase: shadeHex(base, -0.35),
    rimHighlight: shadeHex(base, 0.35),
    iconPlate: shadeHex(base, -0.7),
  };
}

export function getMaterialTokens(material: MaterialKey | undefined, accentColor?: string | null): MaterialTokens {
  if (material === "custom") return deriveCustomTokens(accentColor);
  return MATERIALS[material ?? "iron"] ?? MATERIALS.iron;
}

// Index 0 = level 1 ... index 4 = level 5+, matching the existing getStrokeForLevel brackets.
const LEVEL_MIX = [0.05, 0.3, 0.55, 0.8, 1.0];

/** Interpolates the rim color from dim (level 1) to bright (level 5+) — preserves the
 *  "leveling up" visual signal that existed before materials were introduced. */
export function getRimColorForLevel(tokens: MaterialTokens, level: number): string {
  const idx = Math.max(1, Math.min(5, Math.floor(level || 1))) - 1;
  return mixHex(tokens.rimBase, tokens.rimHighlight, LEVEL_MIX[idx]);
}

/** Blends a light tint of the area's accent color into the rim so the area stays
 *  recognizable at a glance without the plate itself going back to a flat area color. */
export function tintWithAreaColor(rimColor: string, areaColor: string | undefined, amount = 0.15): string {
  if (!areaColor) return rimColor;
  return mixHex(rimColor, areaColor, amount);
}
