/**
 * Level pemain, diturunkan dari total XP.
 *
 * Sengaja hanya matematika murni, tanpa "server-only" -- dipakai di server
 * (menghitung level untuk respons API) maupun klien (badge/progress bar),
 * dan levelnya sendiri tidak pernah disimpan di basis data: selalu dihitung
 * ulang dari `xp` supaya tidak ada dua sumber kebenaran yang bisa tidak
 * sinkron. Kurva dan konstantanya diambil apa adanya dari project Wordheat
 * sebelumnya.
 */

const XP_BASE = 50;

/** Total XP yang dibutuhkan untuk mencapai sebuah level. Level 1 = 0 XP. */
export function xpForLevel(level: number): number {
  return XP_BASE * (level - 1) * (level - 1);
}

/** Level saat ini dari total XP. Tidak ada batas atas. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export type XpProgress = {
  level: number;
  xp: number;
  /** Ambang XP level saat ini. */
  currentLevelXp: number;
  /** Ambang XP level berikutnya. */
  nextLevelXp: number;
  /** 0-1: seberapa jauh menuju level berikutnya. */
  progress: number;
};

export function xpProgress(xp: number): XpProgress {
  const level = levelForXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = nextLevelXp - currentLevelXp;
  return {
    level,
    xp,
    currentLevelXp,
    nextLevelXp,
    progress: span > 0 ? (xp - currentLevelXp) / span : 0,
  };
}
