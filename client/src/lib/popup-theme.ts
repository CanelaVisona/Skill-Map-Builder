import { useTheme } from "next-themes";

export interface PopupPalette {
  bg: string;
  border: string;
  text: string;
  textMuted: string;
  textDim: string;
  surfaceInset: string;
  blockEmpty: string;
  levelUpBg: string;
}

const DARK_PALETTE: PopupPalette = {
  bg: "#0e0c0a",
  border: "#3a2a14",
  text: "#c8a96e",
  textMuted: "#7a6942",
  textDim: "#5a4a2a",
  surfaceInset: "#15110b",
  blockEmpty: "#1e180e",
  levelUpBg: "#1a1208",
};

const LIGHT_PALETTE: PopupPalette = {
  bg: "#faf3e2",
  border: "#d9c69c",
  text: "#7a5322",
  textMuted: "#9c7d45",
  textDim: "#a68a54",
  surfaceInset: "#f0e6cc",
  blockEmpty: "#e6d9b8",
  levelUpBg: "#fff6e0",
};

export function usePopupPalette(): PopupPalette {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "light" ? LIGHT_PALETTE : DARK_PALETTE;
}
