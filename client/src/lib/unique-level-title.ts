// Títulos de nivel únicos dentro de un mismo skill tree (área o proyecto).
// Si el título escrito ya existe en otro nivel, se sugiere el mismo nombre con el
// siguiente número romano: con "Pileta" y "Pileta I" ya usados, "Pileta" → "Pileta II".

const ROMAN_VALUES: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(n: number): string {
  let rest = n;
  let out = "";
  for (const [value, numeral] of ROMAN_VALUES) {
    while (rest >= value) {
      out += numeral;
      rest -= value;
    }
  }
  return out;
}

function fromRoman(numeral: string): number | null {
  let total = 0;
  let i = 0;
  for (const [value, symbol] of ROMAN_VALUES) {
    while (numeral.startsWith(symbol, i)) {
      total += value;
      i += symbol.length;
    }
  }
  // Round-trip check descarta secuencias inválidas como "IIII" o "VX"
  return i === numeral.length && total > 0 && toRoman(total) === numeral ? total : null;
}

// Separa "Pileta II" en { base: "Pileta", number: 2 }; sin numeral, number = 0.
// Solo I/V/X cuentan como numeral, para no leer "Vitamina C" como "Vitamina 100".
function splitTitle(title: string): { base: string; number: number } {
  const match = title.match(/^(.*\S)\s+([IVX]+)$/);
  if (match) {
    const n = fromRoman(match[2]);
    if (n !== null) return { base: match[1], number: n };
  }
  return { base: title, number: 0 };
}

const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase();

/**
 * Devuelve el título sugerido si `title` choca con alguno de `otherTitles`, o null si no
 * hay conflicto (o el título está vacío).
 */
export function getLevelTitleSuggestion(title: string, otherTitles: string[]): string | null {
  const trimmed = title.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  const others = otherTitles.map((t) => t.trim()).filter(Boolean);
  if (!others.some((t) => normalize(t) === normalize(trimmed))) return null;

  const { base } = splitTitle(trimmed);
  const baseKey = normalize(base);
  let maxNumber = 0;
  for (const other of others) {
    const parsed = splitTitle(other.replace(/\s+/g, " "));
    if (normalize(parsed.base) === baseKey) maxNumber = Math.max(maxNumber, parsed.number);
  }
  return `${base} ${toRoman(maxNumber + 1)}`;
}

/** Títulos de los demás niveles del mismo árbol (excluye el nivel que se está editando). */
export function getOtherLevelTitles(levelSubtitles: Record<string, string> | null | undefined, level: number): string[] {
  return Object.entries(levelSubtitles || {})
    .filter(([key]) => key !== level.toString())
    .map(([, value]) => value);
}

/** Título final a guardar: el escrito si es único, o la sugerencia con número romano. */
export function resolveUniqueLevelTitle(title: string, otherTitles: string[]): string {
  return getLevelTitleSuggestion(title, otherTitles) ?? title.trim();
}
