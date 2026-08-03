import { config } from '../config.ts';
import { getEngine } from '../semantic/engine.ts';

/** Tanggal acuan kata harian (WIB), format YYYY-MM-DD. */
export function currentPuzzleDate(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + config.dailyTimezoneOffsetHours * 3600_000);
  return shifted.toISOString().slice(0, 10);
}

/** PRNG deterministik dari string — dipakai agar kata harian sama untuk semua. */
function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Kata untuk tanggal tertentu. Deterministik: server mana pun, kapan pun
 * dijalankan, menghasilkan kata yang sama untuk tanggal yang sama.
 */
export function dailyWord(date: string = currentPuzzleDate()): string {
  const engine = getEngine();
  // Awalan seed sengaja memakai nama lama permainan. Ini bukan teks yang
  // ditampilkan, melainkan bagian dari fungsi hash — mengubahnya akan
  // memetakan ulang setiap tanggal ke kata yang berbeda, termasuk hari ini.
  const rng = mulberry32(hashSeed(`panas-dingin:${date}`));
  return engine.randomTarget(rng);
}

export function randomWord(): string {
  return getEngine().randomTarget();
}
