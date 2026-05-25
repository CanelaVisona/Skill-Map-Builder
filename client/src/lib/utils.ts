import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Returns either '#000' or '#fff' depending on which has better contrast
export function getContrastColor(color: string): string {
  if (!color) return '#000';
  // Normalize rgb() to hex
  let r = 0, g = 0, b = 0;
  try {
    const trimmed = color.trim();
    if (trimmed.startsWith('#')) {
      const hex = trimmed.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0,2), 16);
        g = parseInt(hex.slice(2,4), 16);
        b = parseInt(hex.slice(4,6), 16);
      }
    } else if (trimmed.startsWith('rgb')) {
      const nums = trimmed.replace(/rgba?\(|\)/g, '').split(',').map(s => parseInt(s.trim(), 10));
      r = nums[0] || 0; g = nums[1] || 0; b = nums[2] || 0;
    } else {
      // unknown format - fallback
      return '#000';
    }
  } catch (e) {
    return '#000';
  }

  // Relative luminance per WCAG
  const srgb = [r/255, g/255, b/255].map((c) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];

  // Contrast ratio against white: (L1+0.05)/(L2+0.05)
  const contrastWithWhite = (1.0 + 0.05) / (L + 0.05);
  const contrastWithBlack = (L + 0.05) / (0.0 + 0.05);

  // Choose the one with higher contrast
  return contrastWithWhite >= contrastWithBlack ? '#fff' : '#000';
}
