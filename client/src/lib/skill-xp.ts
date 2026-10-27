// Cada nivel de un skill se completa con 10 sumas de xp (cada suma son 10 xp), igual en todos
// los niveles: 100 xp por nivel. Se muestra en "cuadraditos": 1 por suma, 10 por nivel.
// Misma fórmula que calculateLevel en server/storage.ts.
export const XP_PER_LEVEL = 100;
export const XP_PER_BLOCK = 10;
export const BLOCKS_PER_LEVEL = XP_PER_LEVEL / XP_PER_BLOCK;

export function levelFromXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

// Cuadraditos llenos del nivel `level`. El nivel puede quedar topeado por el nivel desbloqueado
// del área (y los xp seguir sumando), así que se recorta a los 10 del nivel.
export function blocksInLevel(xp: number, level: number): number {
  const into = Math.max(0, xp - (level - 1) * XP_PER_LEVEL);
  return Math.min(BLOCKS_PER_LEVEL, Math.floor(into / XP_PER_BLOCK));
}
