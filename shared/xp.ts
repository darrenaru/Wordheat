/**
 * Kurva level XP — dihitung ulang dari total XP tiap kali dibutuhkan,
 * bukan disimpan sebagai kolom terpisah, supaya tidak ada dua sumber
 * kebenaran yang bisa tidak sinkron.
 *
 * Kuadratik: level 2 di 50 XP, level 3 di 200, level 4 di 450, level 5 di
 * 800, dst — makin tinggi level makin banyak XP yang dibutuhkan.
 */
const XP_BASE = 50;

export function xpForLevel(level: number): number {
  return XP_BASE * (level - 1) * (level - 1);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export interface XpProgress {
  level: number;
  xp: number;
  /** Ambang XP awal level saat ini. */
  currentLevelXp: number;
  /** Ambang XP untuk naik ke level berikutnya. */
  nextLevelXp: number;
  /** Posisi di dalam level saat ini, 0..1. */
  progress: number;
}

export function xpProgress(xp: number): XpProgress {
  const level = levelForXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = nextLevelXp - currentLevelXp;
  const progress = span > 0 ? (xp - currentLevelXp) / span : 1;
  return { level, xp, currentLevelXp, nextLevelXp, progress };
}
