import { nanoid } from 'nanoid';
import type { ApiError, GameMode, Guess, PowerupInventory, SoloSessionState } from '@shared/types.ts';
import { compareGuesses } from '@shared/types.ts';
import { config } from '../config.ts';
import { getEngine } from '../semantic/engine.ts';
import { getInventory, usePowerup } from '../powerup/store.ts';
import { recordGameResult } from '../stats/store.ts';
import { creditWallet } from '../wallet/store.ts';
import { currentPuzzleDate, dailyWord, randomWord } from './words.ts';

interface SoloSession {
  id: string;
  mode: GameMode;
  secret: string;
  guesses: Guess[];
  solved: boolean;
  revealed: boolean;
  startedAt: number;
  finishedAt: number | null;
  lastTouched: number;
  puzzleDate?: string;
  letterRevealed: boolean;
}

const sessions = new Map<string, SoloSession>();

function toState(session: SoloSession): SoloSessionState {
  const finished = session.solved || session.revealed;
  return {
    sessionId: session.id,
    mode: session.mode,
    poolSize: getEngine().poolSize,
    // Riwayat selalu dikirim terurut dari yang paling dekat maknanya —
    // urutan kronologis tetap terbaca lewat field `order`.
    guesses: [...session.guesses].sort(compareGuesses),
    solved: session.solved,
    revealed: session.revealed,
    secret: finished ? session.secret : null,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    puzzleDate: session.puzzleDate,
    letterRevealed: session.letterRevealed,
  };
}

export function createSoloSession(mode: 'practice' | 'daily'): SoloSessionState {
  const now = Date.now();
  const puzzleDate = mode === 'daily' ? currentPuzzleDate() : undefined;
  const session: SoloSession = {
    id: nanoid(16),
    mode,
    secret: mode === 'daily' ? dailyWord(puzzleDate) : randomWord(),
    guesses: [],
    solved: false,
    revealed: false,
    startedAt: now,
    finishedAt: null,
    lastTouched: now,
    puzzleDate,
    letterRevealed: false,
  };
  sessions.set(session.id, session);
  return toState(session);
}

export function getSoloSession(id: string): SoloSessionState | null {
  const session = sessions.get(id);
  if (!session) return null;
  session.lastTouched = Date.now();
  return toState(session);
}

export type SoloGuessOutcome =
  | { ok: true; guess: Guess; state: SoloSessionState }
  | ApiError;

/** Coin makin banyak makin sedikit tebakan sampai menang — lantai 5 supaya menang tetap terasa dihargai. */
function winReward(guessCount: number): number {
  return Math.max(5, 20 - guessCount);
}

/**
 * Efek satu tebakan yang sudah tervalidasi (kata ada di kamus, belum pernah
 * ditebak, dst.) — dipakai bersama oleh tebakan manual dan powerup "Tebak
 * Terdekat" supaya keduanya menghasilkan efek yang sama persis.
 */
function applyGuess(session: SoloSession, word: string): Guess {
  const engine = getEngine();
  const guess = engine.toGuess(session.secret, word, session.guesses.length + 1);
  session.guesses.push(guess);
  if (guess.temperature === 'correct') {
    session.solved = true;
    session.finishedAt = Date.now();
  }
  return guess;
}

export async function submitSoloGuess(
  id: string,
  rawWord: string,
  userId?: string | null,
  profileId?: string | null,
  name?: string,
): Promise<SoloGuessOutcome & { balance?: number }> {
  const session = sessions.get(id);
  if (!session) {
    return { ok: false, code: 'not_found', message: 'Sesi permainan tidak ditemukan.' };
  }
  if (session.solved || session.revealed) {
    return { ok: false, code: 'finished', message: 'Permainan ini sudah selesai.' };
  }
  session.lastTouched = Date.now();

  const engine = getEngine();
  const word = engine.resolve(rawWord);
  if (!word) {
    return {
      ok: false,
      code: 'not_in_lexicon',
      message: `"${rawWord.trim()}" tidak ada di kamus permainan.`,
    };
  }
  if (engine.isBlocked(word)) {
    return { ok: false, code: 'blocked', message: 'Kata itu tidak bisa dipakai.' };
  }
  if (session.guesses.some((g) => g.word === word)) {
    return { ok: false, code: 'already_guessed', message: `"${word}" sudah kamu tebak.` };
  }
  if (session.guesses.length >= config.maxGuessesPerPlayer) {
    return { ok: false, code: 'finished', message: 'Batas tebakan tercapai.' };
  }

  const guess = applyGuess(session, word);
  let balance: number | undefined;
  if (guess.temperature === 'correct') {
    if (profileId) {
      const coins = winReward(session.guesses.length);
      void recordGameResult(
        profileId,
        { won: true, guessCount: session.guesses.length, xpEarned: coins * 2 },
        { userId, displayName: name },
      );
      balance = await creditWallet(profileId, coins);
    }
  }
  return { ok: true, guess, state: toState(session), balance };
}

export function revealSoloSecret(
  id: string,
  userId?: string | null,
  profileId?: string | null,
  name?: string,
): SoloSessionState | null {
  const session = sessions.get(id);
  if (!session) return null;
  if (!session.solved) {
    session.revealed = true;
    session.finishedAt ??= Date.now();
    if (profileId) {
      void recordGameResult(
        profileId,
        { won: false, guessCount: session.guesses.length },
        { userId, displayName: name },
      );
    }
  }
  session.lastTouched = Date.now();
  return toState(session);
}

/** Petunjuk: kata terdekat ke-n dari target yang belum pernah ditebak. */
export function soloHint(id: string): { word: string } | ApiError {
  const session = sessions.get(id);
  if (!session) {
    return { ok: false, code: 'not_found', message: 'Sesi permainan tidak ditemukan.' };
  }
  if (session.solved || session.revealed) {
    return { ok: false, code: 'finished', message: 'Permainan ini sudah selesai.' };
  }
  const engine = getEngine();
  const already = new Set(session.guesses.map((g) => g.word));
  // Petunjuk diambil dari peringkat 10 ke bawah, bukan peringkat 1, supaya
  // tetap menantang: pemain dapat arah, bukan jawaban.
  for (const neighbor of engine.neighbors(session.secret).slice(9, 40)) {
    if (!already.has(neighbor.word)) return { word: neighbor.word };
  }
  return { ok: false, code: 'invalid', message: 'Tidak ada petunjuk yang tersisa.' };
}

/**
 * Powerup: buka huruf pertama kata rahasia. Sekali beli per ronde — dicek
 * di server, bukan cuma di client, supaya tidak bisa dibeli berulang.
 */
export async function soloRevealLetter(
  id: string,
  profileId: string,
): Promise<{ letter: string; inventory: PowerupInventory } | ApiError> {
  const session = sessions.get(id);
  if (!session) {
    return { ok: false, code: 'not_found', message: 'Sesi permainan tidak ditemukan.' };
  }
  if (session.solved || session.revealed) {
    return { ok: false, code: 'finished', message: 'Permainan ini sudah selesai.' };
  }
  if (session.letterRevealed) {
    return { ok: false, code: 'invalid', message: 'Bocoran huruf sudah pernah dipakai di ronde ini.' };
  }
  const used = await usePowerup(profileId, 'letterReveal');
  if (!used) {
    return { ok: false, code: 'out_of_stock', message: 'Belum punya stok — beli dulu di Shop.' };
  }
  session.letterRevealed = true;
  session.lastTouched = Date.now();
  return { letter: session.secret[0], inventory: await getInventory(profileId) };
}

/**
 * Powerup: cari tetangga terdekat kata rahasia yang belum pernah ditebak,
 * lalu proses sebagai tebakan sungguhan lewat `applyGuess` — jaminan ini
 * SELALU tebakan sedekat mungkin, tapi tidak pernah otomatis menang karena
 * `engine.neighbors` mengecualikan kata target itu sendiri.
 */
export async function soloNearestGuessPowerup(
  id: string,
  profileId: string,
): Promise<SoloGuessOutcome & { inventory?: PowerupInventory }> {
  const session = sessions.get(id);
  if (!session) {
    return { ok: false, code: 'not_found', message: 'Sesi permainan tidak ditemukan.' };
  }
  if (session.solved || session.revealed) {
    return { ok: false, code: 'finished', message: 'Permainan ini sudah selesai.' };
  }
  const engine = getEngine();
  const already = new Set(session.guesses.map((g) => g.word));
  const nearest = engine.neighbors(session.secret).find((n) => !already.has(n.word));
  if (!nearest) {
    return { ok: false, code: 'invalid', message: 'Tidak ada kata tersisa untuk ditebak.' };
  }
  const used = await usePowerup(profileId, 'nearestGuess');
  if (!used) {
    return { ok: false, code: 'out_of_stock', message: 'Belum punya stok — beli dulu di Shop.' };
  }
  session.lastTouched = Date.now();
  const guess = applyGuess(session, nearest.word);
  const inventory = await getInventory(profileId);
  return { ok: true, guess, state: toState(session), inventory };
}

export function sweepSoloSessions(now = Date.now()): void {
  for (const [id, session] of sessions) {
    if (now - session.lastTouched > config.soloSessionTtlMs) sessions.delete(id);
  }
}
