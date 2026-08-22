import "server-only";

import { randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { normalizeWord } from "@/lib/word";

/**
 * Akses sisi server ke data puzzle.
 *
 * Kata rahasia dan tabel peringkat tidak pernah dikirim ke browser -- klien
 * hanya menerima peringkat untuk kata yang benar-benar ditebak pemain.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const PUZZLE_DIR = path.join(DATA_DIR, "puzzles");

/** Puzzle harian berganti tengah malam WIB, bukan tengah malam server. */
const GAME_TIME_ZONE = "Asia/Jakarta";

export type PuzzleMeta = {
  id: number;
  date: string;
  word: string;
  wordIndex: number;
  neighbours: string[];
};

type Manifest = { vocabSize: number; puzzles: PuzzleMeta[] };

let vocabPromise: Promise<{ words: string[]; index: Map<string, number> }> | null = null;
let manifestPromise: Promise<Manifest> | null = null;
const rankCache = new Map<number, Promise<Uint16Array>>();

export function loadVocab() {
  vocabPromise ??= (async () => {
    const words: string[] = JSON.parse(
      await readFile(path.join(DATA_DIR, "vocab.json"), "utf8"),
    );
    const index = new Map<string, number>();
    words.forEach((word, i) => index.set(word, i));
    return { words, index };
  })();
  return vocabPromise;
}

export function loadManifest() {
  manifestPromise ??= (async () => {
    const raw = await readFile(path.join(PUZZLE_DIR, "manifest.json"), "utf8");
    return JSON.parse(raw) as Manifest;
  })();
  return manifestPromise;
}

function loadRanks(puzzleId: number) {
  let cached = rankCache.get(puzzleId);
  if (!cached) {
    cached = (async () => {
      const file = path.join(PUZZLE_DIR, `${String(puzzleId).padStart(4, "0")}.bin`);
      const buf = await readFile(file);
      return new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
    })();
    rankCache.set(puzzleId, cached);
  }
  return cached;
}

function todayInGameZone(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: GAME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Puzzle hari ini. Kalau tanggal sekarang melewati jadwal yang tersedia,
 * jadwalnya diputar ulang dari awal supaya permainan tidak pernah kosong.
 */
export async function getDailyPuzzle(): Promise<PuzzleMeta> {
  const { puzzles } = await loadManifest();
  const today = todayInGameZone();

  const exact = puzzles.find((p) => p.date === today);
  if (exact) return exact;

  const first = Date.parse(puzzles[0].date);
  const days = Math.floor((Date.parse(today) - first) / 86_400_000);
  const slot = ((days % puzzles.length) + puzzles.length) % puzzles.length;
  return puzzles[slot];
}

export async function getPuzzleById(id: number): Promise<PuzzleMeta | undefined> {
  const { puzzles } = await loadManifest();
  return puzzles.find((p) => p.id === id);
}

export type GuessResult = { word: string; rank: number };

/** Peringkat sebuah tebakan, atau null kalau katanya di luar kosakata. */
export async function rankGuess(
  puzzleId: number,
  rawWord: string,
): Promise<GuessResult | null> {
  const word = normalizeWord(rawWord);
  const { index } = await loadVocab();
  const vocabIndex = index.get(word);
  if (vocabIndex === undefined) return null;

  const ranks = await loadRanks(puzzleId);
  return { word, rank: ranks[vocabIndex] + 1 };
}

/**
 * Kosakata diurutkan menurut frekuensi, sehingga membatasi pencarian pada
 * bagian awalnya berarti petunjuk selalu berupa kata yang lazim dipakai.
 * Tanpa batas ini petunjuk bisa memunculkan lema kamus seperti
 * "menuanrumahi" -- benar peringkatnya, tetapi tidak menolong siapa pun.
 */
const HINT_VOCAB_LIMIT = 12_000;

/**
 * Petunjuk: kata yang peringkatnya kira-kira separuh jalan dari tebakan
 * terbaik pemain menuju jawaban. Membelah jarak seperti ini membuat petunjuk
 * tetap berguna di awal permainan tanpa langsung membocorkan jawabannya.
 */
export async function findHint(
  puzzleId: number,
  bestRank: number,
  alreadyGuessed: string[],
): Promise<GuessResult | null> {
  if (bestRank <= 2) return null;

  const { words } = await loadVocab();
  const ranks = await loadRanks(puzzleId);
  const taken = new Set(alreadyGuessed.map(normalizeWord));
  const target = Math.max(2, Math.floor(bestRank / 2));

  let best: GuessResult | null = null;
  let bestGap = Infinity;

  const searchLimit = Math.min(words.length, HINT_VOCAB_LIMIT);
  for (let i = 0; i < searchLimit; i++) {
    const rank = ranks[i] + 1;
    if (rank === 1 || rank >= bestRank || taken.has(words[i])) continue;
    const gap = Math.abs(rank - target);
    if (gap < bestGap) {
      bestGap = gap;
      best = { word: words[i], rank };
      if (gap === 0) break;
    }
  }
  return best;
}

/** Power-Up "Buka Huruf Awal": huruf pertama kata rahasia, plus panjangnya. */
export async function revealInitial(
  puzzleId: number,
): Promise<{ letter: string; length: number } | null> {
  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle) return null;
  return { letter: puzzle.word[0], length: puzzle.word.length };
}

/**
 * Power-Up "Buka Jumlah Huruf": panjang kata rahasia plus 1-2 huruf acak di
 * posisi acak (tidak pernah semua huruf, bahkan untuk kata pendek).
 */
export async function revealDigits(
  puzzleId: number,
): Promise<{ length: number; letters: { index: number; char: string }[] } | null> {
  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle) return null;

  const word = puzzle.word;
  const count = Math.min(2, Math.max(1, word.length - 1));
  const indices = new Set<number>();
  while (indices.size < count) {
    indices.add(randomInt(word.length));
  }

  const letters = [...indices]
    .sort((a, b) => a - b)
    .map((index) => ({ index, char: word[index] }));

  return { length: word.length, letters };
}

/**
 * Power-Up "Tebakan Terdekat": kata belum-pernah-ditebak dengan peringkat
 * paling kecil (paling dekat dengan jawaban), tanpa batas kosakata umum
 * seperti findHint -- ini memang dimaksudkan sebagai jalan pintas "curang",
 * bukan petunjuk ramah pemula.
 */
export async function findClosestGuess(
  puzzleId: number,
  alreadyGuessed: string[],
): Promise<GuessResult | null> {
  const { words } = await loadVocab();
  const ranks = await loadRanks(puzzleId);
  const taken = new Set(alreadyGuessed.map(normalizeWord));

  let best: GuessResult | null = null;
  for (let i = 0; i < words.length; i++) {
    const rank = ranks[i] + 1;
    if (rank === 1 || taken.has(words[i])) continue;
    if (!best || rank < best.rank) best = { word: words[i], rank };
  }
  return best;
}
