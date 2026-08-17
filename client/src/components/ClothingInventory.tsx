import { useState, useEffect, useRef, useCallback, useId } from "react";
import type { PointerEvent as ReactPointerEvent, CSSProperties, ReactNode } from "react";
import { useTheme } from "next-themes";
import { Check, ShoppingCart, Lock } from "lucide-react";

const CLOTHING_STORAGE_KEY = "skill-map-clothing-inventory-v2";

type ClothingStatus = "have" | "missing";

type ClothingStyle = "deporte" | "casual" | "salida";

const STYLE_META: Record<ClothingStyle, { label: string; emoji: string; color: string }> = {
  deporte: { label: "Deporte", emoji: "🏃", color: "#2563eb" },
  casual: { label: "Casual", emoji: "😎", color: "#d97706" },
  salida: { label: "Salida", emoji: "✨", color: "#7c3aed" },
};
const STYLE_ORDER: ClothingStyle[] = ["deporte", "casual", "salida"];

function isValidStyle(value: unknown): value is ClothingStyle {
  return value === "deporte" || value === "casual" || value === "salida";
}

type GarmentGroup = "Superior" | "Inferior" | "Calzado" | "Accesorios" | "Otros";

type GarmentType =
  | "remera"
  | "mangalarga"
  | "polera"
  | "musculosa"
  | "camisa"
  | "buzo"
  | "buzosincapucha"
  | "sweter"
  | "campera"
  | "abrigo"
  | "tapado"
  | "jean"
  | "pantalon"
  | "short"
  | "jogger"
  | "bombacha"
  | "zapatilla"
  | "bota"
  | "botin"
  | "sandalia"
  | "media"
  | "collar"
  | "reloj"
  | "lentes"
  | "gorra"
  | "bufanda"
  | "mochila"
  | "tote"
  | "rinonera"
  | "cinturon"
  | "anillo"
  | "otro";

const GARMENT_META: Record<GarmentType, { label: string; group: GarmentGroup }> = {
  remera: { label: "Remera", group: "Superior" },
  mangalarga: { label: "Remera manga larga", group: "Superior" },
  polera: { label: "Polera", group: "Superior" },
  musculosa: { label: "Musculosa", group: "Superior" },
  camisa: { label: "Camisa", group: "Superior" },
  buzo: { label: "Buzo", group: "Superior" },
  buzosincapucha: { label: "Bucito", group: "Superior" },
  sweter: { label: "Suéter", group: "Superior" },
  campera: { label: "Campera", group: "Superior" },
  abrigo: { label: "Abrigo", group: "Superior" },
  tapado: { label: "Tapado", group: "Superior" },
  jean: { label: "Jean", group: "Inferior" },
  pantalon: { label: "Pantalón", group: "Inferior" },
  short: { label: "Short", group: "Inferior" },
  jogger: { label: "Jogger", group: "Inferior" },
  bombacha: { label: "Bombacha", group: "Inferior" },
  zapatilla: { label: "Zapatilla", group: "Calzado" },
  bota: { label: "Bota", group: "Calzado" },
  botin: { label: "Botín", group: "Calzado" },
  sandalia: { label: "Sandalia", group: "Calzado" },
  media: { label: "Medias", group: "Calzado" },
  collar: { label: "Collar", group: "Accesorios" },
  reloj: { label: "Reloj", group: "Accesorios" },
  lentes: { label: "Lentes", group: "Accesorios" },
  gorra: { label: "Gorra", group: "Accesorios" },
  bufanda: { label: "Bufanda", group: "Accesorios" },
  mochila: { label: "Mochila", group: "Accesorios" },
  tote: { label: "Tote bag", group: "Accesorios" },
  rinonera: { label: "Riñonera", group: "Accesorios" },
  cinturon: { label: "Cinturón", group: "Accesorios" },
  anillo: { label: "Anillo", group: "Accesorios" },
  otro: { label: "Otro", group: "Otros" },
};

const GARMENT_TYPE_ORDER = Object.keys(GARMENT_META) as GarmentType[];
const GROUP_ORDER: GarmentGroup[] = ["Superior", "Inferior", "Calzado", "Accesorios", "Otros"];
const GROUP_ICON_TYPE: Record<GarmentGroup, GarmentType> = {
  Superior: "remera",
  Inferior: "jean",
  Calzado: "zapatilla",
  Accesorios: "collar",
  Otros: "otro",
};

function isGarmentType(value: unknown): value is GarmentType {
  return typeof value === "string" && value in GARMENT_META;
}

type ClothingItem = {
  id: number;
  name: string;
  type: GarmentType;
  color: string;
  status: ClothingStatus;
  style: ClothingStyle;
  // 1-5 "bloquecitos" ratings — comfort (how good it feels), condition (how
  // worn/new the piece is) and styleScore (how "estilosa" it is, aka "Estilo").
  // Named "styleScore" (not "style") to avoid clashing with the deporte/casual/salida
  // category above. Additive fields, same backward-compat story as "style".
  comfort: number;
  condition: number;
  styleScore: number;
};

const now = Date.now();

const INITIAL_ITEMS: ClothingItem[] = [
  { id: now - 9, name: "Remera blanca", type: "remera", color: "#f3f4f6", status: "have", style: "casual", comfort: 4, condition: 4, styleScore: 3 },
  { id: now - 8, name: "Remera negra", type: "remera", color: "#1f2937", status: "missing", style: "salida", comfort: 3, condition: 3, styleScore: 3 },
  { id: now - 7, name: "Campera de jean", type: "campera", color: "#3b5b8c", status: "have", style: "casual", comfort: 4, condition: 5, styleScore: 5 },
  { id: now - 6, name: "Jean azul", type: "jean", color: "#3b5b8c", status: "have", style: "casual", comfort: 5, condition: 4, styleScore: 4 },
  { id: now - 5, name: "Cargo verde", type: "pantalon", color: "#4d7c0f", status: "missing", style: "deporte", comfort: 3, condition: 3, styleScore: 3 },
  { id: now - 4, name: "Campera de abrigo", type: "abrigo", color: "#4b5563", status: "missing", style: "salida", comfort: 3, condition: 3, styleScore: 3 },
  { id: now - 3, name: "Zapatillas", type: "zapatilla", color: "#1f2937", status: "have", style: "deporte", comfort: 5, condition: 3, styleScore: 4 },
  { id: now - 2, name: "Botas de cuero", type: "bota", color: "#78350f", status: "missing", style: "salida", comfort: 3, condition: 3, styleScore: 3 },
  { id: now - 1, name: "Cadena plateada", type: "collar", color: "#9ca3af", status: "have", style: "salida", comfort: 5, condition: 5, styleScore: 5 },
];

function isValidStatus(value: unknown): value is ClothingStatus {
  return value === "have" || value === "missing";
}

function isValidRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

function sanitizeItems(input: unknown): ClothingItem[] | null {
  if (!Array.isArray(input)) return null;

  const items = input
    .map((item) => {
      const raw = item as Partial<ClothingItem>;
      if (
        typeof raw.id !== "number" ||
        typeof raw.name !== "string" ||
        !isGarmentType(raw.type) ||
        typeof raw.color !== "string" ||
        !isValidStatus(raw.status)
      ) {
        return null;
      }
      // "style", "comfort", "condition" and "styleScore" are additive on top of
      // the original schema — default them instead of dropping the item, so
      // prendas saved before these fields existed still load.
      return {
        id: raw.id,
        name: raw.name,
        type: raw.type,
        color: raw.color,
        status: raw.status,
        style: isValidStyle(raw.style) ? raw.style : "casual",
        comfort: isValidRating(raw.comfort) ? raw.comfort : 3,
        condition: isValidRating(raw.condition) ? raw.condition : 3,
        styleScore: isValidRating(raw.styleScore) ? raw.styleScore : 3,
      } satisfies ClothingItem;
    })
    .filter((item): item is ClothingItem => item !== null);

  return items;
}

function loadStoredItems(): ClothingItem[] {
  if (typeof window === "undefined") return INITIAL_ITEMS;

  try {
    const raw = window.localStorage.getItem(CLOTHING_STORAGE_KEY);
    if (!raw) return INITIAL_ITEMS;

    const parsed = sanitizeItems(JSON.parse(raw));
    return parsed && parsed.length > 0 ? parsed : INITIAL_ITEMS;
  } catch {
    return INITIAL_ITEMS;
  }
}

function hexToRgbObj(hex: string) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = parseInt(full, 16);
  if (Number.isNaN(value) || full.length !== 6) return { r: 148, g: 163, b: 184 };
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function hexToRgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgbObj(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function relativeBrightness(hex: string) {
  const { r, g, b } = hexToRgbObj(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 / 255;
}

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

// Auto-shades a garment's own color for its outline/shadow lines, the way a game
// re-tints one base mesh per dye color instead of needing hand-painted art per shade.
function shadeHex(hex: string, amt: number) {
  const { r, g, b } = hexToRgbObj(hex);
  const adjust = (c: number) => (amt < 0 ? clampByte(c * (1 + amt)) : clampByte(c + (255 - c) * amt));
  return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
}

function getOutline(hex: string) {
  return relativeBrightness(hex) > 0.55 ? shadeHex(hex, -0.45) : shadeHex(hex, 0.5);
}

function getDetailStroke(hex: string) {
  return relativeBrightness(hex) > 0.55 ? "rgba(0,0,0,0.32)" : "rgba(255,255,255,0.38)";
}

// Renders a small illustration silhouette per garment type, tinted with the item's
// own color through a light-to-shadow gradient (instead of a flat fill) plus a soft
// highlight/shadow sheen clipped to its shape — giving it some volume without
// needing per-item hand-painted art, and still working for any color the user picks.
function GarmentGlyph({ type, color, size = 32 }: { type: GarmentType; color: string; size?: number }) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, "");
  const gradId = `cg-${uid}`;
  const clipId = `cc-${uid}`;

  const outline = getOutline(color);
  const detail = getDetailStroke(color);
  const isLight = relativeBrightness(color) > 0.55;
  const gradFrom = shadeHex(color, 0.4);
  const gradTo = shadeHex(color, -0.32);
  const fillProps = { fill: `url(#${gradId})`, stroke: outline, strokeWidth: 1.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const clipProps = { fill: "#000" };

  const shirtBody = "M16 6 L9 10 L6 16 L11 19 L14 16 V41 H34 V16 L37 19 L42 16 L39 10 L32 6 C32 6 30 11 24 11 C18 11 16 6 16 6 Z";
  // Same set-in shoulder as shirtBody, but the sleeve runs all the way down to a
  // wrist cuff instead of stopping short — shared by "mangalarga" and "polera".
  const longSleeveBody =
    "M16 6 L8 9 L4 14 L4 32 L10 34 L13 20 V41 H35 V20 L38 34 L44 32 L44 14 L40 9 L32 6 C32 6 30 11 24 11 C18 11 16 6 16 6 Z";
  const coatBody =
    "M14 5 L7 10 L4 17 L9 20 L12 17 V43 H36 V17 L39 20 L44 17 L41 10 L34 5 C34 5 31 10 24 10 C17 10 14 5 14 5 Z";
  const tapadoBody =
    "M13 4 L6 9 L3 17 L8 20 L11 17 V46 H37 V17 L40 20 L45 17 L42 9 L35 4 C35 4 32 10 24 10 C16 10 13 4 13 4 Z";
  // Raglan-cut hoodie/jacket silhouette shared by "buzo" and "campera" — the sleeve
  // seam runs diagonally straight out from the neckline instead of a set-in notch.
  const hoodieBody =
    "M17 9 L8 11 L4 17 L4 31 L10 33 L13 23 V41 H35 V23 L38 33 L44 31 L44 17 L40 11 L31 9 C31 9 29 12 24 12 C19 12 17 9 17 9 Z";
  const pantsBody = "M15 6 H33 L34 14 L32 16 L30 42 H25.2 L24 24 L22.8 42 H18 L16 16 L14 14 Z";
  const shortBody = "M15 6 H33 L34 14 L32 16 L31 27 H25.4 L24 20 L22.6 27 H17 L16 16 L14 14 Z";
  const joggerBody = "M15 6 H33 L34 14 L32 16 L30.5 40 H25.2 L24 24 L22.8 40 H17.5 L16 16 L14 14 Z";
  // Waistband with a raised center gusset between the two leg openings.
  const bombachaBody = "M9 8 H39 L36 19 Q24 15 12 19 Z";
  const sneakerBody = "M6 33 H13 L18 27 L30 25 L38 29 L42 33 V38 H6 Z";
  const bootBody = "M14 7 H27 V25 L35 29 L41 34 V38 H14 Z";
  const botinBody = "M14 16 H26 V30 L34 33 L40 36 V40 H14 Z";
  const sandalBody = "M6 33 Q24 28 42 33 V38 H6 Z";
  // Sock: a soft tube with a heel bend, shorter and simpler than a boot.
  const mediaBody = "M17 6 H27 V24 L34 27 L40 32 V36 H17 Z";
  const scarfBody = "M5 13 Q15 6 24 13 T43 13 L41 20 Q31 15 24 20 T7 20 Z";
  const toteBody = "M9 15 H39 L41 42 H7 Z";
  const rinoneraBody = "M10 20 Q10 14 16 14 H32 Q38 14 38 20 V28 Q38 34 32 34 H16 Q10 34 10 28 Z";

  let fillNodes: ReactNode = null;
  let clipNodes: ReactNode = null;
  let details: ReactNode = null;

  switch (type) {
    case "remera":
      fillNodes = <path d={shirtBody} {...fillProps} />;
      clipNodes = <path d={shirtBody} {...clipProps} />;
      details = <path d="M18 8 C19 11.5 21 13 24 13 C27 13 29 11.5 30 8" fill="none" stroke={detail} strokeWidth="1.3" />;
      break;
    case "mangalarga":
      // Long-sleeve tee: same crew neckline as "remera", sleeves reach the wrist.
      fillNodes = <path d={longSleeveBody} {...fillProps} />;
      clipNodes = <path d={longSleeveBody} {...clipProps} />;
      details = (
        <>
          <path d="M18 8 C19 11.5 21 13 24 13 C27 13 29 11.5 30 8" fill="none" stroke={detail} strokeWidth="1.3" />
          <line x1="5" y1="32.5" x2="9.5" y2="34.5" stroke={outline} strokeWidth="1.8" opacity="0.5" />
          <line x1="43" y1="32.5" x2="38.5" y2="34.5" stroke={outline} strokeWidth="1.8" opacity="0.5" />
        </>
      );
      break;
    case "polera":
      // "Cuellito": same long-sleeve body, but a small stand/mock collar instead
      // of the open crew neckline — the little upright collar the user described.
      fillNodes = (
        <>
          <path d={longSleeveBody} {...fillProps} />
          <path d="M18 7 Q24 3 30 7 L29 10.5 Q24 7.5 19 10.5 Z" {...fillProps} />
        </>
      );
      clipNodes = (
        <>
          <path d={longSleeveBody} {...clipProps} />
          <path d="M18 7 Q24 3 30 7 L29 10.5 Q24 7.5 19 10.5 Z" {...clipProps} />
        </>
      );
      details = (
        <>
          <path d="M19.5 8.3 Q24 6 28.5 8.3" fill="none" stroke={detail} strokeWidth="0.8" opacity="0.6" />
          <line x1="5" y1="32.5" x2="9.5" y2="34.5" stroke={outline} strokeWidth="1.8" opacity="0.5" />
          <line x1="43" y1="32.5" x2="38.5" y2="34.5" stroke={outline} strokeWidth="1.8" opacity="0.5" />
        </>
      );
      break;
    case "musculosa":
      fillNodes = (
        <>
          <rect x="15" y="13" width="18" height="27" rx="2" {...fillProps} />
          <rect x="17" y="6" width="3.5" height="9" rx="1.5" {...fillProps} />
          <rect x="27.5" y="6" width="3.5" height="9" rx="1.5" {...fillProps} />
        </>
      );
      clipNodes = (
        <>
          <rect x="15" y="13" width="18" height="27" rx="2" {...clipProps} />
          <rect x="17" y="6" width="3.5" height="9" rx="1.5" {...clipProps} />
          <rect x="27.5" y="6" width="3.5" height="9" rx="1.5" {...clipProps} />
        </>
      );
      break;
    case "camisa":
      fillNodes = <path d={shirtBody} {...fillProps} />;
      clipNodes = <path d={shirtBody} {...clipProps} />;
      details = (
        <>
          <path d="M20 9 L24 18 L28 9" fill="none" stroke={detail} strokeWidth="1.3" />
          <line x1="24" y1="18" x2="24" y2="38" stroke={detail} strokeWidth="1.1" />
          <circle cx="24" cy="23" r="0.9" fill={detail} />
          <circle cx="24" cy="29" r="0.9" fill={detail} />
          <circle cx="24" cy="35" r="0.9" fill={detail} />
        </>
      );
      break;
    case "buzo":
      // Hoodie: raglan body, a hood laying flat around the neck with a hang tag,
      // two drawstrings hanging down, and a trapezoid kangaroo pocket up front.
      fillNodes = (
        <>
          <path d={hoodieBody} {...fillProps} />
          <path d="M12 11 Q24 25 36 11 Q34 4 24 5 Q14 4 12 11 Z" {...fillProps} />
        </>
      );
      clipNodes = (
        <>
          <path d={hoodieBody} {...clipProps} />
          <path d="M12 11 Q24 25 36 11 Q34 4 24 5 Q14 4 12 11 Z" {...clipProps} />
        </>
      );
      details = (
        <>
          <rect x="22" y="2" width="4" height="3" rx="1" fill="none" stroke={detail} strokeWidth="0.8" />
          <circle cx="19" cy="17" r="0.8" fill={detail} />
          <circle cx="29" cy="17" r="0.8" fill={detail} />
          <line x1="19" y1="17" x2="18.5" y2="28" stroke={detail} strokeWidth="1.2" strokeLinecap="round" />
          <line x1="29" y1="17" x2="29.5" y2="28" stroke={detail} strokeWidth="1.2" strokeLinecap="round" />
          <ellipse cx="18.5" cy="29" rx="1.2" ry="1.8" fill={detail} />
          <ellipse cx="29.5" cy="29" rx="1.2" ry="1.8" fill={detail} />
          <path d="M18 30 L30 30 L32.5 40 L15.5 40 Z" fill="none" stroke={detail} strokeWidth="1.1" />
          <line x1="4" y1="31" x2="9" y2="32.5" stroke={outline} strokeWidth="2" opacity="0.5" />
          <line x1="44" y1="31" x2="39" y2="32.5" stroke={outline} strokeWidth="2" opacity="0.5" />
          <line x1="14" y1="40" x2="34" y2="40" stroke={outline} strokeWidth="1.6" opacity="0.4" />
        </>
      );
      break;
    case "buzosincapucha":
      // Crewneck sweatshirt: same raglan/dropped-shoulder body as "buzo", but no
      // hood, drawstrings or pocket — just a ribbed crew neck, cuffs and hem.
      fillNodes = <path d={hoodieBody} {...fillProps} />;
      clipNodes = <path d={hoodieBody} {...clipProps} />;
      details = (
        <>
          <path d="M17 9 Q24 15.5 31 9" fill="none" stroke={detail} strokeWidth="1.7" />
          <path d="M18.3 10.4 Q24 16 29.7 10.4" fill="none" stroke={detail} strokeWidth="0.9" opacity="0.55" />
          <line x1="4" y1="31" x2="9" y2="32.5" stroke={outline} strokeWidth="2" opacity="0.5" />
          <line x1="44" y1="31" x2="39" y2="32.5" stroke={outline} strokeWidth="2" opacity="0.5" />
          <line x1="14" y1="40" x2="34" y2="40" stroke={outline} strokeWidth="1.6" opacity="0.4" />
        </>
      );
      break;
    case "sweter":
      // Knit pullover: set-in sleeves (no hood, no zipper), a ribbed crew neckline,
      // ribbed cuffs/hem, and a cable-knit chevron pattern down the front.
      fillNodes = <path d={shirtBody} {...fillProps} />;
      clipNodes = <path d={shirtBody} {...clipProps} />;
      details = (
        <>
          <path d="M17 8 Q24 14 31 8" fill="none" stroke={detail} strokeWidth="1.6" />
          <path d="M18 9.3 Q24 14.6 30 9.3" fill="none" stroke={detail} strokeWidth="0.8" opacity="0.6" />
          <path d="M24 17 L21 20 L24 23 L27 20 Z" fill="none" stroke={detail} strokeWidth="0.9" opacity="0.55" />
          <path d="M24 24 L21 27 L24 30 L27 27 Z" fill="none" stroke={detail} strokeWidth="0.9" opacity="0.55" />
          <path d="M24 31 L21 34 L24 37 L27 34 Z" fill="none" stroke={detail} strokeWidth="0.9" opacity="0.55" />
          <line x1="9.5" y1="17.5" x2="13" y2="19.5" stroke={outline} strokeWidth="2" opacity="0.5" />
          <line x1="38.5" y1="17.5" x2="35" y2="19.5" stroke={outline} strokeWidth="2" opacity="0.5" />
          <line x1="14" y1="39" x2="34" y2="39" stroke={outline} strokeWidth="1.6" opacity="0.4" />
        </>
      );
      break;
    case "campera":
      // Zip hoodie/jacket: raglan body, open shawl collar, full center zipper,
      // diagonal welt pockets and a hint of the raglan fold lines on the sleeves.
      fillNodes = (
        <>
          <path d={hoodieBody} {...fillProps} />
          <path d="M14 10 Q24 20 34 10 Q32 5 24 6 Q16 5 14 10 Z" {...fillProps} />
        </>
      );
      clipNodes = (
        <>
          <path d={hoodieBody} {...clipProps} />
          <path d="M14 10 Q24 20 34 10 Q32 5 24 6 Q16 5 14 10 Z" {...clipProps} />
        </>
      );
      details = (
        <>
          <line x1="24" y1="14" x2="24" y2="40" stroke={detail} strokeWidth="1.4" />
          <circle cx="24" cy="17" r="1.1" fill={detail} />
          <path d="M9 20 Q12 24 9 28" fill="none" stroke={detail} strokeWidth="0.9" opacity="0.6" />
          <path d="M39 20 Q36 24 39 28" fill="none" stroke={detail} strokeWidth="0.9" opacity="0.6" />
          <path d="M15 30 L21 34" stroke={detail} strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <path d="M27 34 L33 30" stroke={detail} strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <line x1="4" y1="31" x2="9" y2="32.5" stroke={outline} strokeWidth="2" opacity="0.5" />
          <line x1="44" y1="31" x2="39" y2="32.5" stroke={outline} strokeWidth="2" opacity="0.5" />
          <line x1="14" y1="40" x2="34" y2="40" stroke={outline} strokeWidth="1.6" opacity="0.4" />
        </>
      );
      break;
    case "abrigo":
      fillNodes = <path d={coatBody} {...fillProps} />;
      clipNodes = <path d={coatBody} {...clipProps} />;
      details = (
        <>
          <path d="M18 8 L24 20 L30 8" fill="none" stroke={detail} strokeWidth="1.4" />
          <circle cx="24" cy="26" r="0.9" fill={detail} />
          <circle cx="24" cy="32" r="0.9" fill={detail} />
        </>
      );
      break;
    case "tapado":
      // Longer, belted overcoat — reads distinct from "abrigo" via its length and belt.
      fillNodes = <path d={tapadoBody} {...fillProps} />;
      clipNodes = <path d={tapadoBody} {...clipProps} />;
      details = (
        <>
          <path d="M17 7 L24 22 L31 7" fill="none" stroke={detail} strokeWidth="1.5" />
          <line x1="14" y1="30" x2="34" y2="30" stroke={detail} strokeWidth="1.2" opacity="0.6" />
          <rect x="20.5" y="28" width="7" height="4" rx="1" fill="none" stroke={detail} strokeWidth="1" opacity="0.6" />
        </>
      );
      break;
    case "jean":
    case "pantalon":
      fillNodes = <path d={pantsBody} {...fillProps} />;
      clipNodes = <path d={pantsBody} {...clipProps} />;
      details = <line x1="24" y1="16" x2="24" y2="24" stroke={detail} strokeWidth="1" />;
      break;
    case "short":
      fillNodes = <path d={shortBody} {...fillProps} />;
      clipNodes = <path d={shortBody} {...clipProps} />;
      details = <line x1="24" y1="16" x2="24" y2="20" stroke={detail} strokeWidth="1" />;
      break;
    case "jogger":
      fillNodes = <path d={joggerBody} {...fillProps} />;
      clipNodes = <path d={joggerBody} {...clipProps} />;
      details = (
        <>
          <rect x="17" y="39" width="7" height="3.2" rx="1.6" fill={outline} opacity="0.55" />
          <rect x="24" y="39" width="7" height="3.2" rx="1.6" fill={outline} opacity="0.55" />
          <line x1="24" y1="16" x2="24" y2="24" stroke={detail} strokeWidth="1" />
        </>
      );
      break;
    case "bombacha":
      fillNodes = <path d={bombachaBody} {...fillProps} />;
      clipNodes = <path d={bombachaBody} {...clipProps} />;
      details = (
        <>
          <line x1="9.5" y1="9" x2="38.5" y2="9" stroke={detail} strokeWidth="1.2" opacity="0.6" />
          <path d="M14 19.5 Q24 17 34 19.5" fill="none" stroke={detail} strokeWidth="0.8" opacity="0.45" />
        </>
      );
      break;
    case "zapatilla":
      fillNodes = <path d={sneakerBody} {...fillProps} />;
      clipNodes = <path d={sneakerBody} {...clipProps} />;
      details = (
        <>
          <path d="M15 33 L19 28 M21 33 L25 27.5 M27 33 L31 26.5" stroke={detail} strokeWidth="1" fill="none" />
          <line x1="6" y1="38" x2="42" y2="38" stroke={detail} strokeWidth="1.4" />
        </>
      );
      break;
    case "bota":
      fillNodes = <path d={bootBody} {...fillProps} />;
      clipNodes = <path d={bootBody} {...clipProps} />;
      details = (
        <>
          <line x1="14" y1="38" x2="41" y2="38" stroke={detail} strokeWidth="1.4" />
          <circle cx="18" cy="13" r="0.8" fill={detail} />
          <circle cx="18" cy="18" r="0.8" fill={detail} />
          <circle cx="18" cy="23" r="0.8" fill={detail} />
        </>
      );
      break;
    case "botin":
      // Ankle boot: shorter shaft than "bota", no lace eyelets, a pull-tab loop instead.
      fillNodes = <path d={botinBody} {...fillProps} />;
      clipNodes = <path d={botinBody} {...clipProps} />;
      details = (
        <>
          <line x1="14" y1="40" x2="40" y2="40" stroke={detail} strokeWidth="1.4" />
          <rect x="15" y="13" width="4" height="3.5" rx="1" fill="none" stroke={detail} strokeWidth="0.9" />
          <line x1="26" y1="18" x2="26" y2="28" stroke={detail} strokeWidth="0.9" opacity="0.5" />
        </>
      );
      break;
    case "sandalia":
      fillNodes = <path d={sandalBody} {...fillProps} />;
      clipNodes = <path d={sandalBody} {...clipProps} />;
      details = <path d="M14 33 V22 M24 33 V20 M32 33 V23" stroke={color} strokeWidth="1.6" fill="none" />;
      break;
    case "media":
      fillNodes = <path d={mediaBody} {...fillProps} />;
      clipNodes = <path d={mediaBody} {...clipProps} />;
      details = (
        <>
          <line x1="17" y1="10" x2="27" y2="10" stroke={outline} strokeWidth="2" opacity="0.5" />
          <line x1="17" y1="13.5" x2="27" y2="13.5" stroke={outline} strokeWidth="1.4" opacity="0.4" />
          <path d="M27 24 L34 27" fill="none" stroke={detail} strokeWidth="0.9" opacity="0.5" />
        </>
      );
      break;
    case "collar":
      fillNodes = <path d="M21 25 L24 32 L27 25 Z" {...fillProps} />;
      clipNodes = <path d="M21 25 L24 32 L27 25 Z" {...clipProps} />;
      details = <path d="M12 8 Q24 24 36 8" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />;
      break;
    case "reloj":
      fillNodes = (
        <>
          <rect x="20" y="4" width="8" height="9" rx="2" {...fillProps} />
          <rect x="20" y="35" width="8" height="9" rx="2" {...fillProps} />
          <circle cx="24" cy="24" r="10" {...fillProps} />
        </>
      );
      clipNodes = (
        <>
          <rect x="20" y="4" width="8" height="9" rx="2" {...clipProps} />
          <rect x="20" y="35" width="8" height="9" rx="2" {...clipProps} />
          <circle cx="24" cy="24" r="10" {...clipProps} />
        </>
      );
      details = (
        <>
          <circle cx="24" cy="24" r="6.5" fill="none" stroke={detail} strokeWidth="1" />
          <line x1="24" y1="24" x2="24" y2="19" stroke={detail} strokeWidth="1.1" />
          <line x1="24" y1="24" x2="27" y2="24" stroke={detail} strokeWidth="1.1" />
        </>
      );
      break;
    case "lentes":
      details = (
        <>
          <circle cx="15" cy="23" r="7.5" fill="none" stroke={color} strokeWidth="2.6" />
          <circle cx="33" cy="23" r="7.5" fill="none" stroke={color} strokeWidth="2.6" />
          <line x1="22.5" y1="22" x2="25.5" y2="22" stroke={color} strokeWidth="2.6" />
          <line x1="7.5" y1="21" x2="3" y2="18" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="40.5" y1="21" x2="45" y2="18" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </>
      );
      break;
    case "gorra":
      fillNodes = (
        <>
          <path d="M9 27 A15 13 0 0 1 39 27 Z" {...fillProps} />
          <ellipse cx="35" cy="28" rx="9.5" ry="3.2" {...fillProps} />
        </>
      );
      clipNodes = (
        <>
          <path d="M9 27 A15 13 0 0 1 39 27 Z" {...clipProps} />
          <ellipse cx="35" cy="28" rx="9.5" ry="3.2" {...clipProps} />
        </>
      );
      details = (
        <>
          <path d="M24 12 V27" stroke={detail} strokeWidth="1" />
          <circle cx="24" cy="13" r="1.5" fill={color} stroke={outline} strokeWidth="0.8" />
        </>
      );
      break;
    case "bufanda":
      fillNodes = <path d={scarfBody} {...fillProps} />;
      clipNodes = <path d={scarfBody} {...clipProps} />;
      details = (
        <>
          <line x1="10" y1="20" x2="8" y2="33" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <line x1="15" y1="20" x2="14" y2="35" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </>
      );
      break;
    case "mochila":
      fillNodes = <rect x="11" y="14" width="26" height="27" rx="6" {...fillProps} />;
      clipNodes = <rect x="11" y="14" width="26" height="27" rx="6" {...clipProps} />;
      details = (
        <>
          <path d="M15 15 V10 Q24 3 33 10 V15" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
          <rect x="16" y="23" width="16" height="10" rx="2.5" fill="none" stroke={detail} strokeWidth="1.2" />
        </>
      );
      break;
    case "tote":
      fillNodes = <path d={toteBody} {...fillProps} />;
      clipNodes = <path d={toteBody} {...clipProps} />;
      details = (
        <>
          <path d="M15 15 Q15 5 22 5" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M26 5 Q33 5 33 15" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </>
      );
      break;
    case "rinonera":
      fillNodes = <path d={rinoneraBody} {...fillProps} />;
      clipNodes = <path d={rinoneraBody} {...clipProps} />;
      details = (
        <>
          <line x1="4" y1="24" x2="10" y2="24" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
          <line x1="38" y1="24" x2="44" y2="24" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
          <line x1="15" y1="24" x2="33" y2="24" stroke={detail} strokeWidth="1" opacity="0.5" />
          <rect x="22" y="22" width="4" height="4" rx="1" fill="none" stroke={detail} strokeWidth="0.9" opacity="0.6" />
        </>
      );
      break;
    case "cinturon":
      fillNodes = <rect x="4" y="20" width="40" height="8" rx="2" {...fillProps} />;
      clipNodes = <rect x="4" y="20" width="40" height="8" rx="2" {...clipProps} />;
      details = (
        <>
          <rect x="19" y="17.5" width="10" height="13" rx="2" fill="none" stroke={detail} strokeWidth="1.4" />
          <circle cx="24" cy="24" r="1.4" fill={detail} />
        </>
      );
      break;
    case "anillo":
      fillNodes = <path d="M24 11 L28.5 18 L24 23 L19.5 18 Z" {...fillProps} />;
      clipNodes = <path d="M24 11 L28.5 18 L24 23 L19.5 18 Z" {...clipProps} />;
      details = <circle cx="24" cy="29" r="10" fill="none" stroke={color} strokeWidth="3.6" />;
      break;
    default:
      details = (
        <>
          <circle cx="24" cy="7" r="2.4" fill="none" stroke={color} strokeWidth="2.2" />
          <path d="M24 9.5 V13 M7 30 L24 15 L41 30 L35 35 H13 Z" fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        </>
      );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ overflow: "visible", flexShrink: 0 }}>
      {fillNodes && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={gradFrom} />
            <stop offset="55%" stopColor={color} />
            <stop offset="100%" stopColor={gradTo} />
          </linearGradient>
          <clipPath id={clipId}>{clipNodes}</clipPath>
        </defs>
      )}
      {fillNodes}
      {fillNodes && (
        <>
          {/* Soft light/shadow sheen clipped to the silhouette, echoing the gradient's light source. */}
          <ellipse cx="15" cy="14" rx="9" ry="13" fill="#ffffff" opacity={isLight ? 0.14 : 0.18} clipPath={`url(#${clipId})`} transform="rotate(-18 15 14)" />
          <ellipse cx="33" cy="34" rx="9" ry="12" fill="#000000" opacity="0.14" clipPath={`url(#${clipId})`} transform="rotate(-18 33 34)" />
        </>
      )}
      {details}
    </svg>
  );
}

function useLongPress<T extends HTMLElement>(onLongPress: () => void, { delay = 600, moveTolerance = 10 } = {}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const triggeredRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pointerIdRef.current = null;
    startPointRef.current = null;
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<T>) => {
    pointerIdRef.current = e.pointerId;
    startPointRef.current = { x: e.clientX, y: e.clientY };
    triggeredRef.current = false;
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      onLongPress();
      cancel();
    }, delay);
  }, [cancel, delay, onLongPress]);

  const onPointerMove = useCallback((e: ReactPointerEvent<T>) => {
    if (pointerIdRef.current !== e.pointerId || !startPointRef.current) return;
    const dx = Math.abs(e.clientX - startPointRef.current.x);
    const dy = Math.abs(e.clientY - startPointRef.current.y);
    if (dx > moveTolerance || dy > moveTolerance) cancel();
  }, [cancel, moveTolerance]);

  const onPointerUp = useCallback((e: ReactPointerEvent<T>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    cancel();
  }, [cancel]);

  const consumeClick = useCallback(() => {
    if (triggeredRef.current) {
      triggeredRef.current = false;
      return true;
    }
    return false;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onPointerLeave: onPointerUp, consumeClick };
}

type ItemFormState = {
  name: string;
  type: GarmentType;
  color: string;
  status: ClothingStatus;
  style: ClothingStyle;
  comfort: number;
  condition: number;
  styleScore: number;
};

const EMPTY_FORM: ItemFormState = {
  name: "",
  type: "remera",
  color: "#4ade80",
  status: "have",
  style: "casual",
  comfort: 3,
  condition: 3,
  styleScore: 3,
};

// Single shared color for every rating widget — the "bloquecitos" on the card,
// the ones in the add/edit popup, and the summary bars all use this same green
// so color never has to carry meaning; text labels do that instead.
const RATING_COLOR = "#22c55e";

// The "bloquecitos" rating widget: 5 clickable blocks, filled up to the current
// value — used for both "Comodidad" and "Estado" (condition) per prenda.
function RatingBlocks({
  value,
  onChange,
  color,
  isDark,
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
  isDark: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: "5px" }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            title={`${n}/5`}
            style={{
              flex: 1,
              height: "20px",
              borderRadius: "4px",
              border: filled ? "1px solid transparent" : isDark ? "1px solid #325a32" : "1px solid #86efac",
              background: filled ? color : "transparent",
              cursor: "pointer",
              padding: 0,
            }}
          />
        );
      })}
    </div>
  );
}

// Compact, read-only version of RatingBlocks for the inventory card — small
// dots instead of buttons, just enough to read the score at a glance.
function MiniRatingBlocks({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{
            flex: 1,
            height: "3px",
            borderRadius: "1px",
            background: n <= value ? color : "rgba(148,163,184,0.35)",
          }}
        />
      ))}
    </div>
  );
}

const COLOR_SWATCHES = [
  "#111827", "#4b5563", "#9ca3af", "#f3f4f6",
  "#78350f", "#a16207", "#facc15", "#fb923c",
  "#7f1d1d", "#dc2626", "#f472b6", "#a21caf",
  "#1e3a8a", "#2563eb", "#0891b2", "#0f766e",
  "#166534", "#4d7c0f", "#65a30d", "#ffffff",
];

function ColorPalette({
  value,
  onChange,
  colors,
  isDark,
}: {
  value: string;
  onChange: (color: string) => void;
  colors: Record<string, string>;
  isDark: boolean;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {COLOR_SWATCHES.map((c) => {
        const active = value.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "7px",
              background: c,
              border: active ? "2px solid #22c55e" : isDark ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(0,0,0,0.15)",
              boxShadow: active ? "0 0 0 2px rgba(34,197,94,0.35)" : "none",
              cursor: "pointer",
              padding: 0,
            }}
          />
        );
      })}
      <label
        title="Color personalizado"
        style={{
          width: "26px",
          height: "26px",
          borderRadius: "7px",
          cursor: "pointer",
          position: "relative",
          border: isDark ? "1px dashed rgba(255,255,255,0.4)" : "1px dashed rgba(0,0,0,0.3)",
          background: "conic-gradient(from 0deg, #f87171, #facc15, #4ade80, #38bdf8, #a78bfa, #f472b6, #f87171)",
          display: "block",
        }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
        />
      </label>
      <span style={{ alignSelf: "center", fontSize: "10px", color: colors.subtitle }}>{value}</span>
    </div>
  );
}

function TypePicker({
  value,
  onChange,
  colors,
  isDark,
}: {
  value: GarmentType;
  onChange: (type: GarmentType) => void;
  colors: Record<string, string>;
  isDark: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {GROUP_ORDER.map((group) => {
        const types = GARMENT_TYPE_ORDER.filter((t) => GARMENT_META[t].group === group);
        if (types.length === 0) return null;
        return (
          <div key={group}>
            <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: colors.subtitle, marginBottom: "4px" }}>
              {group}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))", gap: "6px" }}>
              {types.map((t) => {
                const active = value === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onChange(t)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "3px",
                      padding: "6px 2px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      position: "relative",
                      border: active ? "1px solid #4ade80" : colors.chipBorder,
                      background: active ? (isDark ? "rgba(74,222,128,0.12)" : "#ecfdf3") : isDark ? "#0f1a0f" : "#ffffff",
                    }}
                  >
                    {active && (
                      <span
                        style={{
                          position: "absolute",
                          top: "2px",
                          right: "2px",
                          width: "12px",
                          height: "12px",
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #16a34a, #22c55e)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Check size={8} color="#052e16" strokeWidth={3} />
                      </span>
                    )}
                    <GarmentGlyph type={t} color={active ? "#4ade80" : isDark ? "#6b7280" : "#94a3b8"} size={22} />
                    <span style={{ fontSize: "8.5px", fontWeight: 600, color: active ? colors.title : colors.subtitle, textAlign: "center", lineHeight: 1.1 }}>
                      {GARMENT_META[t].label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ItemForm({
  form,
  onChange,
  colors,
  isDark,
}: {
  form: ItemFormState;
  onChange: (next: ItemFormState) => void;
  colors: Record<string, string>;
  isDark: boolean;
}) {
  const inputStyle: CSSProperties = {
    height: "34px",
    borderRadius: "8px",
    border: isDark ? "1px solid #325a32" : "1px solid #86efac",
    background: isDark ? "#0f1a0f" : "#ffffff",
    color: colors.title,
    padding: "0 10px",
    fontSize: "12px",
    width: "100%",
  };

  const labelStyle: CSSProperties = {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: colors.subtitle,
    marginBottom: "6px",
  };

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      <div>
        <div style={labelStyle}>Nombre de la prenda</div>
        <input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="Ej: Campera de jean"
          style={inputStyle}
        />
      </div>

      <div>
        <div style={labelStyle}>Tipo de prenda</div>
        <TypePicker value={form.type} onChange={(type) => onChange({ ...form, type })} colors={colors} isDark={isDark} />
      </div>

      <div>
        <div style={labelStyle}>Color</div>
        <ColorPalette value={form.color} onChange={(color) => onChange({ ...form, color })} colors={colors} isDark={isDark} />
      </div>

      <div>
        <div style={labelStyle}>Categoría</div>
        <div style={{ display: "flex", gap: "6px" }}>
          {STYLE_ORDER.map((style) => {
            const active = form.style === style;
            const meta = STYLE_META[style];
            return (
              <button
                key={style}
                type="button"
                onClick={() => onChange({ ...form, style })}
                style={{
                  flex: 1,
                  height: "30px",
                  borderRadius: "8px",
                  border: active ? "1px solid transparent" : isDark ? "1px solid #325a32" : "1px solid #86efac",
                  background: active ? meta.color : "transparent",
                  color: active ? "#ffffff" : colors.subtitle,
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                }}
              >
                <span>{meta.emoji}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={labelStyle}>Disponibilidad</div>
        <div style={{ display: "flex", gap: "6px" }}>
          {(["have", "missing"] as ClothingStatus[]).map((status) => {
            const active = form.status === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => onChange({ ...form, status })}
                style={{
                  flex: 1,
                  height: "30px",
                  borderRadius: "8px",
                  border: active ? "1px solid transparent" : isDark ? "1px solid #325a32" : "1px solid #86efac",
                  background: active
                    ? status === "have"
                      ? "linear-gradient(135deg, #16a34a, #22c55e)"
                      : "linear-gradient(135deg, #c2410c, #fb923c)"
                    : "transparent",
                  color: active ? "#052e16" : colors.subtitle,
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {status === "have" ? "Ya la tengo" : "Falta comprar"}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
          <span>Comodidad</span>
          <span style={{ color: RATING_COLOR }}>{form.comfort}/5</span>
        </div>
        <RatingBlocks value={form.comfort} onChange={(comfort) => onChange({ ...form, comfort })} color={RATING_COLOR} isDark={isDark} />
      </div>

      <div>
        <div style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
          <span>Estado</span>
          <span style={{ color: RATING_COLOR }}>{form.condition}/5</span>
        </div>
        <RatingBlocks value={form.condition} onChange={(condition) => onChange({ ...form, condition })} color={RATING_COLOR} isDark={isDark} />
      </div>

      <div>
        <div style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
          <span>Estilo</span>
          <span style={{ color: RATING_COLOR }}>{form.styleScore}/5</span>
        </div>
        <RatingBlocks value={form.styleScore} onChange={(styleScore) => onChange({ ...form, styleScore })} color={RATING_COLOR} isDark={isDark} />
      </div>
    </div>
  );
}

function GarmentPreview({
  type,
  color,
  colors,
  isDark,
}: {
  type: GarmentType;
  color: string;
  colors: Record<string, string>;
  isDark: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
      <div
        style={{
          width: "84px",
          height: "84px",
          borderRadius: "50%",
          background: hexToRgba(color, isDark ? 0.18 : 0.12),
          border: `2px solid ${hexToRgba(color, 0.55)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isDark ? "0 0 20px rgba(0,0,0,0.35)" : "0 4px 14px rgba(15,23,42,0.1)",
        }}
      >
        <GarmentGlyph type={type} color={color} size={56} />
      </div>
      <span style={{ fontSize: "10px", fontWeight: 700, color: colors.subtitle, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {GARMENT_META[type].label}
      </span>
    </div>
  );
}

// Rendered as a fixed, centered popup (not inline in the page flow) so adding or
// editing a prenda always shows up as a dedicated dialog with a live preview.
function ItemPopup({
  heading,
  form,
  onChange,
  colors,
  isDark,
  onCancel,
  onSubmit,
  submitLabel,
  onDelete,
}: {
  heading: string;
  form: ItemFormState;
  onChange: (next: ItemFormState) => void;
  colors: Record<string, string>;
  isDark: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  onDelete?: () => void;
}) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onCancel}
      className="cloth-popup-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="cloth-popup-panel"
        style={{
          width: "100%",
          maxWidth: "360px",
          maxHeight: "100%",
          overflowY: "auto",
          background: colors.cardBg,
          border: colors.cardBorder,
          borderRadius: "14px",
          padding: "16px",
          boxShadow: isDark ? "0 20px 50px rgba(0,0,0,0.55)" : "0 20px 50px rgba(15,23,42,0.28)",
        }}
      >
        <div
          style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: colors.title,
            marginBottom: "12px",
            textAlign: "center",
          }}
        >
          {heading}
        </div>
        <GarmentPreview type={form.type} color={form.color} colors={colors} isDark={isDark} />
        <ItemForm form={form} onChange={onChange} colors={colors} isDark={isDark} />
        <div style={{ display: "flex", gap: "8px", justifyContent: onDelete ? "space-between" : "flex-end", marginTop: "12px" }}>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              style={{
                height: "30px",
                borderRadius: "8px",
                border: "1px solid #991b1b",
                background: "transparent",
                color: "#f87171",
                padding: "0 10px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Eliminar
            </button>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                height: "30px",
                borderRadius: "8px",
                border: colors.chipBorder,
                background: "transparent",
                color: colors.subtitle,
                padding: "0 10px",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSubmit}
              style={{
                height: "30px",
                borderRadius: "8px",
                border: "none",
                background: "linear-gradient(135deg, #16a34a, #22c55e)",
                color: "#052e16",
                padding: "0 10px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClothingCard({
  item,
  colors,
  isDark,
  onConfirmPurchase,
  onStartEdit,
}: {
  item: ClothingItem;
  colors: Record<string, string>;
  isDark: boolean;
  onConfirmPurchase: (id: number) => void;
  onStartEdit: (item: ClothingItem) => void;
}) {
  const longPress = useLongPress<HTMLDivElement>(() => onStartEdit(item), { delay: 600 });
  const isHave = item.status === "have";

  return (
    <div
      className="cloth-card"
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
      onPointerLeave={longPress.onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      title={`${item.name} · ${STYLE_META[item.style].label} · Comodidad ${item.comfort}/5 · Estado ${item.condition}/5 · Estilo ${item.styleScore}/5 · long press para editar`}
      style={{
        position: "relative",
        borderRadius: "10px",
        // Ownership state drives the card chrome now — gold for anything you have,
        // neutral gray for locked/missing items — instead of the garment's own color.
        border: isHave ? "1px solid rgba(212,175,55,0.6)" : isDark ? "1px solid #23291f" : "1px solid #dde1e8",
        background: isHave ? (isDark ? "rgba(212,175,55,0.13)" : "rgba(212,175,55,0.1)") : isDark ? "#12140f" : "#eef0f3",
        padding: "10px 6px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "4px",
          left: "4px",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: STYLE_META[item.style].color,
          boxShadow: "0 0 0 2px " + colors.cardBg,
        }}
      />

      {isHave ? (
        <span
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #16a34a, #22c55e)",
            boxShadow: "0 0 0 2px " + colors.cardBg,
          }}
        >
          <Check size={10} color="#052e16" strokeWidth={3} />
        </span>
      ) : (
        <span
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isDark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.16)",
            boxShadow: "0 0 0 2px " + colors.cardBg,
          }}
        >
          <Lock size={9} color={isDark ? "#9ca3af" : "#64748b"} strokeWidth={2.5} />
        </span>
      )}

      {/* Grayed/dimmed only around the garment itself — kept off the badge and the
          "Comprar" button below, so the purchase action still reads in full color. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
          width: "100%",
          filter: isHave ? "none" : "grayscale(0.9)",
          opacity: isHave ? 1 : 0.5,
        }}
      >
        <div style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "2px" }}>
          <GarmentGlyph type={item.type} color={item.color} size={38} />
        </div>

        <span
          style={{
            fontSize: "10px",
            fontWeight: 600,
            textAlign: "center",
            color: isHave ? colors.title : colors.subtitle,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {item.name}
        </span>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%", padding: "0 3px" }}>
          <div>
            <span style={{ fontSize: "6.5px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: colors.subtitle, display: "block", marginBottom: "1.5px" }}>
              Comodidad
            </span>
            <MiniRatingBlocks value={item.comfort} color={RATING_COLOR} />
          </div>
          <div>
            <span style={{ fontSize: "6.5px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: colors.subtitle, display: "block", marginBottom: "1.5px" }}>
              Estado
            </span>
            <MiniRatingBlocks value={item.condition} color={RATING_COLOR} />
          </div>
          <div>
            <span style={{ fontSize: "6.5px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: colors.subtitle, display: "block", marginBottom: "1.5px" }}>
              Estilo
            </span>
            <MiniRatingBlocks value={item.styleScore} color={RATING_COLOR} />
          </div>
        </div>
      </div>

      {!isHave && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onConfirmPurchase(item.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            marginTop: "2px",
            height: "22px",
            borderRadius: "12px",
            border: "none",
            padding: "0 9px",
            fontSize: "9.5px",
            fontWeight: 700,
            letterSpacing: "0.02em",
            cursor: "pointer",
            background: "linear-gradient(135deg, #c2410c, #fb923c)",
            color: "#1c0a02",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <ShoppingCart size={10} strokeWidth={2.5} />
          Comprar
        </button>
      )}
    </div>
  );
}

// Compradas primero, pendientes de compra despues — nunca intercaladas.
function sortHaveFirst(items: ClothingItem[]) {
  return [...items].sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === "have" ? -1 : 1;
  });
}

function TypeSection({
  type,
  items,
  colors,
  isDark,
  onConfirmPurchase,
  onStartEdit,
}: {
  type: GarmentType;
  items: ClothingItem[];
  colors: Record<string, string>;
  isDark: boolean;
  onConfirmPurchase: (id: number) => void;
  onStartEdit: (item: ClothingItem) => void;
}) {
  const haveCount = items.filter((i) => i.status === "have").length;
  const orderedItems = sortHaveFirst(items);

  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
        <GarmentGlyph type={type} color={colors.subtitle} size={13} />
        <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: colors.subtitle }}>
          {GARMENT_META[type].label}
        </span>
        <span style={{ fontSize: "9.5px", color: colors.subtitle, opacity: 0.8 }}>
          ({haveCount}/{items.length})
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(78px, 1fr))", gap: "8px" }}>
        {orderedItems.map((item) => (
          <ClothingCard key={item.id} item={item} colors={colors} isDark={isDark} onConfirmPurchase={onConfirmPurchase} onStartEdit={onStartEdit} />
        ))}
      </div>
    </div>
  );
}

function GroupSection({
  group,
  items,
  colors,
  isDark,
  onConfirmPurchase,
  onStartEdit,
}: {
  group: GarmentGroup;
  items: ClothingItem[];
  colors: Record<string, string>;
  isDark: boolean;
  onConfirmPurchase: (id: number) => void;
  onStartEdit: (item: ClothingItem) => void;
}) {
  const haveCount = items.filter((i) => i.status === "have").length;
  // Subdivide tambien por tipo de prenda dentro de la categoria, en el orden fijo
  // del catalogo de tipos — no solo agrupado por categoria general.
  const typesPresent = GARMENT_TYPE_ORDER.filter((t) => items.some((i) => i.type === t));

  return (
    <div style={{ marginBottom: "16px" }} onPointerDown={(e) => e.stopPropagation()}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          paddingBottom: "8px",
          marginBottom: "14px",
          borderBottom: isDark ? "1px solid #1e2d1e" : "1px solid #e2e8f0",
        }}
      >
        <GarmentGlyph type={GROUP_ICON_TYPE[group]} color={colors.subtitle} size={16} />
        <span
          style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: colors.title,
          }}
        >
          {group}
        </span>
        <span style={{ fontSize: "10px", color: colors.subtitle }}>
          ({haveCount}/{items.length})
        </span>
      </div>
      {typesPresent.map((type) => (
        <TypeSection
          key={type}
          type={type}
          items={items.filter((i) => i.type === type)}
          colors={colors}
          isDark={isDark}
          onConfirmPurchase={onConfirmPurchase}
          onStartEdit={onStartEdit}
        />
      ))}
    </div>
  );
}

export default function ClothingInventory() {
  const { theme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";

  const colors = {
    pageBg: isDark ? "#0d1117" : "#f5f7fb",
    shellBorder: isDark ? "1px solid #1e2d1e" : "1px solid #d7dce6",
    shellShadow: isDark ? "0 0 40px rgba(74,222,128,0.07)" : "0 8px 30px rgba(17,24,39,0.08)",
    title: isDark ? "#f0fdf4" : "#0f172a",
    subtitle: isDark ? "#6b7280" : "#64748b",
    cardBg: isDark ? "#0f1a0f" : "#ffffff",
    cardBorder: isDark ? "1px solid #1e3a1e" : "1px solid #d7dce6",
    chipBg: isDark ? "#112011" : "#f0fdf4",
    chipBorder: isDark ? "1px solid #2d4a2d" : "1px solid #86efac",
  };

  const [items, setItems] = useState<ClothingItem[]>(() => loadStoredItems());
  const [groupFilter, setGroupFilter] = useState<"Todas" | GarmentGroup>("Todas");
  const [styleFilter, setStyleFilter] = useState<"Todas" | ClothingStyle>("Todas");
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [remoteSyncEnabled, setRemoteSyncEnabled] = useState(true);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [addForm, setAddForm] = useState<ItemFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ItemFormState>(EMPTY_FORM);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRemoteItems = async () => {
      try {
        const response = await fetch("/api/clothing-inventory/items");

        if (response.status === 401) {
          if (!cancelled) {
            setRemoteSyncEnabled(false);
            setRemoteLoaded(true);
          }
          return;
        }

        if (!response.ok) {
          if (!cancelled) setRemoteLoaded(true);
          return;
        }

        const data = (await response.json()) as unknown;
        const safeItems = sanitizeItems(data);
        if (safeItems && safeItems.length > 0 && !cancelled) {
          setItems(safeItems);
        }

        if (!cancelled) setRemoteLoaded(true);
      } catch {
        if (!cancelled) setRemoteLoaded(true);
      }
    };

    void loadRemoteItems();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CLOTHING_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (!remoteLoaded || !remoteSyncEnabled) return;

    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);

    saveDebounceRef.current = setTimeout(() => {
      void fetch("/api/clothing-inventory/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
    }, 400);

    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, [remoteLoaded, remoteSyncEnabled, items]);

  // "Categoría" (deporte/casual/salida) filters the visible set on top of the
  // group filter — it's a separate axis, not a replacement for Superior/Inferior/etc.
  const styleFilteredItems = styleFilter === "Todas" ? items : items.filter((i) => i.style === styleFilter);
  const groupsPresent = GROUP_ORDER.filter((g) => styleFilteredItems.some((i) => GARMENT_META[i.type].group === g));

  const openAddForm = () => {
    setEditingId(null);
    setAddForm(EMPTY_FORM);
    setIsAddFormOpen(true);
  };

  const backgroundLongPress = useLongPress<HTMLDivElement>(openAddForm, { delay: 600 });

  const createItem = useCallback(() => {
    const cleanName = addForm.name.trim();
    if (!cleanName) {
      window.alert("El nombre no puede estar vacio.");
      return;
    }

    const nextItem: ClothingItem = {
      id: Date.now(),
      name: cleanName,
      type: addForm.type,
      color: addForm.color,
      status: addForm.status,
      style: addForm.style,
      comfort: addForm.comfort,
      condition: addForm.condition,
      styleScore: addForm.styleScore,
    };

    setItems((prev) => [nextItem, ...prev]);
    setIsAddFormOpen(false);
    setAddForm(EMPTY_FORM);
  }, [addForm]);

  const startEdit = useCallback((item: ClothingItem) => {
    setIsAddFormOpen(false);
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      type: item.type,
      color: item.color,
      status: item.status,
      style: item.style,
      comfort: item.comfort,
      condition: item.condition,
      styleScore: item.styleScore,
    });
  }, []);

  const saveEdit = useCallback(() => {
    if (editingId === null) return;
    const cleanName = editForm.name.trim();
    if (!cleanName) {
      window.alert("El nombre no puede estar vacio.");
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === editingId
          ? {
              ...item,
              name: cleanName,
              type: editForm.type,
              color: editForm.color,
              status: editForm.status,
              style: editForm.style,
              comfort: editForm.comfort,
              condition: editForm.condition,
              styleScore: editForm.styleScore,
            }
          : item,
      ),
    );
    setEditingId(null);
  }, [editForm, editingId]);

  const deleteEditingItem = useCallback(() => {
    if (editingId === null) return;
    setItems((prev) => prev.filter((item) => item.id !== editingId));
    setEditingId(null);
  }, [editingId]);

  // Confirms a purchase (missing -> have) via the explicit "Comprar" button. Going the
  // other way (undoing a purchase) is intentionally not exposed here — that only
  // happens through the edit popup, so it can't happen from a stray click.
  const confirmPurchase = useCallback((id: number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: "have" } : item)));
  }, []);

  const editingItem = editingId !== null ? items.find((i) => i.id === editingId) ?? null : null;
  const visibleGroups = groupFilter === "Todas" ? groupsPresent : groupsPresent.filter((g) => g === groupFilter);

  const totalHave = items.filter((i) => i.status === "have").length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? (totalHave / totalCount) * 100 : 0;

  // "Comodidad", "Estado" y "Estilo" resumen, en promedio, los puntajes en
  // bloquecitos de las prendas que ya tenés — las que faltan comprar no tienen
  // un puntaje real todavía.
  const haveItems = items.filter((i) => i.status === "have");
  const avgOf = (pick: (i: ClothingItem) => number) =>
    haveItems.length > 0 ? haveItems.reduce((sum, i) => sum + pick(i), 0) / haveItems.length : 0;
  const avgComfort = avgOf((i) => i.comfort);
  const avgCondition = avgOf((i) => i.condition);
  const avgStyleScore = avgOf((i) => i.styleScore);

  return (
    <>
      <style>{`
        .cloth-card { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .cloth-card:hover { transform: translateY(-1px); }
        .cloth-chip { cursor: pointer; user-select: none; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 5px; }
        .cloth-bg-area { touch-action: manipulation; }
        @keyframes cloth-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cloth-pop-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
        .cloth-popup-backdrop { animation: cloth-fade-in 0.15s ease-out; }
        .cloth-popup-panel { animation: cloth-pop-in 0.16s ease-out; }
      `}</style>

      <div
        style={{
          fontFamily: "'Exo 2', 'Segoe UI', sans-serif",
          background: colors.pageBg,
          borderRadius: "14px",
          border: colors.shellBorder,
          boxShadow: colors.shellShadow,
          width: "100%",
          padding: "16px",
        }}
        className="cloth-bg-area"
        onPointerDown={backgroundLongPress.onPointerDown}
        onPointerMove={backgroundLongPress.onPointerMove}
        onPointerUp={backgroundLongPress.onPointerUp}
        onPointerCancel={backgroundLongPress.onPointerCancel}
        onPointerLeave={backgroundLongPress.onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
      >
        <h1
          style={{
            fontFamily: "'Orbitron', monospace",
            fontSize: "15px",
            fontWeight: 700,
            color: colors.title,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            margin: 0,
            marginBottom: "4px",
          }}
        >
          Inventario de Ropa
        </h1>
        <p style={{ color: colors.subtitle, fontSize: "11px", marginBottom: "12px" }}>
          Apreta Comprar para confirmar una compra. Long press sobre una prenda para editarla (ahi tambien podes deshacer una compra). Long press en el fondo para agregar una nueva.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }} onPointerDown={(e) => e.stopPropagation()}>
          {(["Todas", ...groupsPresent] as ("Todas" | GarmentGroup)[]).map((g) => {
            const active = groupFilter === g;
            return (
              <span
                key={g}
                className="cloth-chip"
                onClick={() => setGroupFilter(g)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: active ? "1px solid transparent" : colors.chipBorder,
                  background: active ? "linear-gradient(135deg, #16a34a, #22c55e)" : colors.chipBg,
                  color: active ? "#052e16" : colors.subtitle,
                }}
              >
                {g !== "Todas" && <GarmentGlyph type={GROUP_ICON_TYPE[g]} color={active ? "#052e16" : colors.subtitle} size={12} />}
                {g}
              </span>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }} onPointerDown={(e) => e.stopPropagation()}>
          {(["Todas", ...STYLE_ORDER] as ("Todas" | ClothingStyle)[]).map((s) => {
            const active = styleFilter === s;
            const meta = s !== "Todas" ? STYLE_META[s] : null;
            return (
              <span
                key={s}
                className="cloth-chip"
                onClick={() => setStyleFilter(s)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 600,
                  border: active ? "1px solid transparent" : colors.chipBorder,
                  background: active ? meta?.color ?? "linear-gradient(135deg, #16a34a, #22c55e)" : colors.chipBg,
                  color: active ? "#ffffff" : colors.subtitle,
                }}
              >
                {meta && <span>{meta.emoji}</span>}
                {meta ? meta.label : "Todas"}
              </span>
            );
          })}
        </div>

        {isAddFormOpen && (
          <ItemPopup
            heading="Nueva prenda"
            form={addForm}
            onChange={setAddForm}
            colors={colors}
            isDark={isDark}
            onCancel={() => setIsAddFormOpen(false)}
            onSubmit={createItem}
            submitLabel="Agregar"
          />
        )}

        {editingItem && (
          <ItemPopup
            heading={`Editando "${editingItem.name}"`}
            form={editForm}
            onChange={setEditForm}
            colors={colors}
            isDark={isDark}
            onCancel={() => setEditingId(null)}
            onSubmit={saveEdit}
            submitLabel="Guardar"
            onDelete={deleteEditingItem}
          />
        )}

        {visibleGroups.length === 0 && (
          <p style={{ color: colors.subtitle, fontSize: "11px" }}>No hay prendas todavia. Long press en el fondo para agregar la primera.</p>
        )}

        {visibleGroups.map((group) => (
          <GroupSection
            key={group}
            group={group}
            items={styleFilteredItems.filter((i) => GARMENT_META[i.type].group === group)}
            colors={colors}
            isDark={isDark}
            onConfirmPurchase={confirmPurchase}
            onStartEdit={startEdit}
          />
        ))}

        {totalCount > 0 && (
          <div
            style={{
              marginTop: "6px",
              paddingTop: "12px",
              borderTop: isDark ? "1px solid #1e2d1e" : "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span style={{ fontSize: "10px", color: colors.subtitle, whiteSpace: "nowrap" }}>
              {totalHave}/{totalCount} prendas
            </span>
            <div
              style={{
                flex: 1,
                height: "6px",
                background: isDark ? "#0d1a0d" : "#e5e7eb",
                borderRadius: "3px",
                overflow: "hidden",
                border: isDark ? "1px solid #1a2a1a" : "1px solid #d1d5db",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  borderRadius: "3px",
                  background: "linear-gradient(90deg, #16a34a, #4ade80)",
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          </div>
        )}

        {haveItems.length > 0 && (
          <div style={{ marginTop: "10px", display: "grid", gap: "8px" }} onPointerDown={(e) => e.stopPropagation()}>
            {(
              [
                { label: "Comodidad", value: avgComfort },
                { label: "Estado", value: avgCondition },
                { label: "Estilo", value: avgStyleScore },
              ] as const
            ).map(({ label, value }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "10px", color: colors.subtitle, whiteSpace: "nowrap", width: "62px" }}>
                  {label}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "6px",
                    background: isDark ? "#0d1a0d" : "#e5e7eb",
                    borderRadius: "3px",
                    overflow: "hidden",
                    border: isDark ? "1px solid #1a2a1a" : "1px solid #d1d5db",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(value / 5) * 100}%`,
                      borderRadius: "3px",
                      background: "linear-gradient(90deg, #16a34a, #4ade80)",
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
                <span style={{ fontSize: "10px", color: colors.subtitle, whiteSpace: "nowrap" }}>
                  {value.toFixed(1)}/5
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
