// Curated icon vocabulary for the skill medallions (Journal → Skills grid). Uses lucide-react
// directly rather than hand-drawn SVG paths — it's already this app's icon set (SkillTree.tsx
// imports Swords/Shield/Scroll/Skull/Gem/etc.) and lucide icons are just React components, so
// theming them (color/size) inside the medallion is trivial and every icon stays visually
// consistent by construction — the medallion's frame/material does the styling work, not the
// glyph itself.
import {
  Sword, Shield, ShieldCheck, Eye, Brain, BrainCircuit, Heart, Flame, BookOpen,
  FlaskConical, Dumbbell, Sparkles, MessageCircle, Coins, Music, PenTool, Users,
  Waves, Home, Circle, type LucideIcon,
} from "lucide-react";

export const SKILL_ICON_REGISTRY: Record<string, LucideIcon> = {
  espada: Sword,
  escudo: Shield,
  resiliencia: ShieldCheck,
  ojo: Eye,
  cerebro: Brain,
  inteligencia: BrainCircuit,
  corazon: Heart,
  fuego: Flame,
  libro: BookOpen,
  alquimia: FlaskConical,
  fuerza: Dumbbell,
  meditacion: Sparkles,
  comunicacion: MessageCircle,
  dinero: Coins,
  musica: Music,
  escritura: PenTool,
  relaciones: Users,
  agua: Waves,
  hogar: Home,
};

export const SKILL_ICON_LABELS: Record<string, string> = {
  espada: "Espada",
  escudo: "Escudo",
  resiliencia: "Resiliencia",
  ojo: "Ojo",
  cerebro: "Cerebro",
  inteligencia: "Inteligencia",
  corazon: "Corazón",
  fuego: "Fuego",
  libro: "Libro",
  alquimia: "Alquimia",
  fuerza: "Fuerza",
  meditacion: "Meditación",
  comunicacion: "Comunicación",
  dinero: "Dinero",
  musica: "Música",
  escritura: "Escritura",
  relaciones: "Relaciones",
  agua: "Agua",
  hogar: "Hogar",
};

export const SKILL_ICON_KEYS: string[] = Object.keys(SKILL_ICON_REGISTRY);

// Keyword auto-match, migrated 1:1 from the old SKILL_ICONS/getIconForSkill in
// SkillsGridJournal.tsx (raw SVG paths remapped to registry keys above). Used as the fallback
// when a skill has no explicit `icon` set, so existing skills keep a sensible icon.
const AUTO_MATCH: Array<[keyword: string, iconKey: string]> = [
  ["musica", "musica"],
  ["guitarra", "musica"],
  ["piano", "musica"],
  ["flame", "fuego"],
  ["meditacion", "meditacion"],
  ["respiracion", "meditacion"],
  ["olas", "agua"],
  ["surf", "agua"],
  ["lectura", "libro"],
  ["intelecto", "inteligencia"],
  ["escritura", "escritura"],
  ["casa", "hogar"],
  ["limpieza", "hogar"],
  ["organizacion", "cerebro"],
];

export function getAutoIconKey(title: string): string {
  const lower = (title || "").toLowerCase();
  for (const [keyword, iconKey] of AUTO_MATCH) {
    if (lower.includes(keyword)) return iconKey;
  }
  return "cerebro";
}

/** Explicit iconKey > keyword auto-match on the title > defensive fallback. */
export function resolveSkillIcon(iconKey: string | null | undefined, title: string): LucideIcon {
  if (iconKey && SKILL_ICON_REGISTRY[iconKey]) return SKILL_ICON_REGISTRY[iconKey];
  const autoKey = getAutoIconKey(title);
  return SKILL_ICON_REGISTRY[autoKey] ?? Circle;
}
