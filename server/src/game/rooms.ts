import type {
  AvatarConfig,
  Guess,
  PlayerPublicState,
  PowerupInventory,
  RoomGuess,
  RoomSettings,
  RoomState,
  RoomStatus,
  ServerMessage,
} from '@shared/types.ts';
import { compareGuesses, DEFAULT_ROOM_SETTINGS } from '@shared/types.ts';
import { config } from '../config.ts';
import { getEngine } from '../semantic/engine.ts';
import { getInventory, usePowerup } from '../powerup/store.ts';
import { recordGameResult } from '../stats/store.ts';
import { creditWallet } from '../wallet/store.ts';
import { randomWord } from './words.ts';

/** Alasan penutupan yang tidak boleh dicoba sambung ulang oleh klien. */
export type CloseReason = 'superseded' | 'kicked';

/** Kanal keluar ke satu pemain. Sengaja minimal agar modul ini bebas dari `ws`. */
export interface PlayerChannel {
  send(message: ServerMessage): void;
  close(reason?: CloseReason): void;
}

interface RoomPlayer {
  id: string;
  name: string;
  avatar: AvatarConfig;
  isHost: boolean;
  channel: PlayerChannel | null;
  joinedAt: number;
  /** Riwayat ronde berjalan — ikut ditampilkan ke semua pemain lewat `toRoomGuesses`. */
  guesses: Guess[];
  solved: boolean;
  gaveUp: boolean;
  solvedInMs: number | null;
  placement: number | null;
  score: number;
  /** Id Supabase kalau pemain login — dipakai mencatat statistik pribadi. Tidak pernah dibagikan ke pemain lain. */
  userId: string | null;
  /** Powerup "Bocoran Huruf" cuma bisa dibeli sekali per ronde. */
  letterRevealed: boolean;
}

interface Room {
  code: string;
  status: RoomStatus;
  settings: RoomSettings;
  players: Map<string, RoomPlayer>;
  order: string[];
  secret: string | null;
  round: number;
  startedAt: number | null;
  /** Epoch ms kapan hitung mundur "starting" berakhir. `null` di luar fase itu. */
  startsAt: number | null;
  deadline: number | null;
  timer: NodeJS.Timeout | null;
  lastActivity: number;
}

/** Lama hitung mundur sebelum ronde benar-benar mulai (3, 2, 1). */
const START_COUNTDOWN_MS = 3000;

export type JoinResult =
  | { ok: true; room: Room }
  | { ok: false; message: string };

// Huruf yang mudah dibaca dan diucapkan — tanpa O/0, I/1, dan sejenisnya,
// karena kode ini akan sering dibacakan lewat suara atau diketik ulang.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

const rooms = new Map<string, Room>();

function generateCode(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error('gagal membuat kode ruang yang unik');
}

function toPublicPlayer(player: RoomPlayer): PlayerPublicState {
  // Suhu terbaik dihitung dari riwayat, bukan disimpan terpisah, agar tidak
  // mungkin melenceng dari tebakan yang benar-benar dikirim pemain.
  let bestCloseness = 0;
  let bestTemperature: PlayerPublicState['bestTemperature'] = null;
  for (const guess of player.guesses) {
    if (bestTemperature === null || guess.closeness >= bestCloseness) {
      bestCloseness = guess.closeness;
      bestTemperature = guess.temperature;
    }
  }
  return {
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    connected: player.channel !== null,
    isHost: player.isHost,
    guessCount: player.guesses.length,
    bestTemperature,
    bestCloseness,
    solved: player.solved,
    gaveUp: player.gaveUp,
    solvedInMs: player.solvedInMs,
    placement: player.placement,
    score: player.score,
  };
}

/**
 * Papan tebakan bersama: gabungan tebakan semua pemain, diurut paling dekat
 * di atas lewat `compareGuesses` yang sama dipakai riwayat solo — kata rahasia
 * sendiri tetap tidak ikut terbawa, cuma tebakan-tebakan menuju ke sana.
 *
 * Dikelompokkan per kata: kalau beberapa pemain kebetulan menebak kata yang
 * sama persis, itu jadi satu baris dengan beberapa nama pemain, bukan baris
 * terduplikasi dengan rank/suhu yang identik.
 */
function toRoomGuesses(room: Room): RoomGuess[] {
  const byWord = new Map<string, RoomGuess>();
  for (const player of room.players.values()) {
    for (const guess of player.guesses) {
      const existing = byWord.get(guess.word);
      if (existing) {
        existing.players.push({ id: player.id, name: player.name });
      } else {
        byWord.set(guess.word, { ...guess, players: [{ id: player.id, name: player.name }] });
      }
    }
  }
  const all = [...byWord.values()];
  all.sort(compareGuesses);
  return all;
}

export function toRoomState(room: Room): RoomState {
  const hostId = room.order.find((id) => room.players.get(id)?.isHost) ?? room.order[0] ?? '';
  return {
    code: room.code,
    status: room.status,
    settings: room.settings,
    hostId,
    players: room.order
      .map((id) => room.players.get(id))
      .filter((p): p is RoomPlayer => Boolean(p))
      .map(toPublicPlayer),
    round: room.round,
    poolSize: getEngine().poolSize,
    startedAt: room.startedAt,
    startsAt: room.startsAt,
    deadline: room.deadline,
    secret: room.status === 'finished' ? room.secret : null,
    guesses: toRoomGuesses(room),
  };
}

export function broadcast(room: Room, message: ServerMessage): void {
  for (const player of room.players.values()) {
    player.channel?.send(message);
  }
}

function broadcastRoom(room: Room): void {
  broadcast(room, { type: 'room', room: toRoomState(room) });
}

export function createRoom(settings: Partial<RoomSettings> = {}): Room {
  if (rooms.size >= config.maxRooms) {
    throw new Error('Server sedang penuh. Coba lagi sebentar lagi.');
  }
  const room: Room = {
    code: generateCode(),
    status: 'lobby',
    settings: { ...DEFAULT_ROOM_SETTINGS, ...sanitizeSettings(settings) },
    players: new Map(),
    order: [],
    secret: null,
    round: 0,
    startedAt: null,
    startsAt: null,
    deadline: null,
    timer: null,
    lastActivity: Date.now(),
  };
  rooms.set(room.code, room);
  return room;
}

export function getRoom(code: string): Room | null {
  return rooms.get(code.trim().toUpperCase()) ?? null;
}

export function sanitizeSettings(patch: Partial<RoomSettings>): Partial<RoomSettings> {
  const out: Partial<RoomSettings> = {};
  if (typeof patch.timeLimit === 'number' && Number.isFinite(patch.timeLimit)) {
    out.timeLimit = Math.min(3600, Math.max(0, Math.round(patch.timeLimit)));
  }
  if (typeof patch.maxGuesses === 'number' && Number.isFinite(patch.maxGuesses)) {
    out.maxGuesses = Math.min(500, Math.max(0, Math.round(patch.maxGuesses)));
  }
  return out;
}

export function joinRoom(
  room: Room,
  playerId: string,
  name: string,
  avatar: AvatarConfig,
  channel: PlayerChannel,
  userId: string | null = null,
): JoinResult {
  room.lastActivity = Date.now();
  const existing = room.players.get(playerId);

  if (existing) {
    // Sambung ulang: pemain yang jaringannya putus kembali ke kursinya sendiri,
    // lengkap dengan riwayat tebakan ronde berjalan.
    existing.channel?.close('superseded');
    existing.channel = channel;
    existing.name = name;
    existing.avatar = avatar;
    existing.userId = userId;
    return { ok: true, room };
  }

  if (room.players.size >= config.maxPlayersPerRoom) {
    return { ok: false, message: `Ruang sudah penuh (maksimal ${config.maxPlayersPerRoom} pemain).` };
  }
  if (room.status === 'playing' || room.status === 'starting') {
    return { ok: false, message: 'Ronde sedang berjalan. Tunggu sampai ronde ini selesai.' };
  }

  // Disiarkan ke pemain yang SUDAH ada di ruang — pemain yang baru bergabung
  // ini belum masuk `room.players`, jadi otomatis tidak melihat notice
  // tentang dirinya sendiri.
  broadcast(room, { type: 'notice', level: 'info', message: `${name} bergabung ke ruang.` });

  const player: RoomPlayer = {
    id: playerId,
    name,
    avatar,
    isHost: room.players.size === 0,
    channel,
    joinedAt: Date.now(),
    guesses: [],
    solved: false,
    gaveUp: false,
    solvedInMs: null,
    placement: null,
    score: 0,
    userId,
    letterRevealed: false,
  };
  room.players.set(playerId, player);
  room.order.push(playerId);
  return { ok: true, room };
}

export function leaveRoom(room: Room, playerId: string, channel: PlayerChannel): void {
  const player = room.players.get(playerId);
  if (!player) return;

  // Socket lama yang baru menutup SETELAH pemain menyambung ulang tidak boleh
  // mencabut koneksi baru yang sudah menggantikannya. Tanpa penjagaan ini,
  // setiap reconnect langsung menendang dirinya sendiri keluar dari ruang.
  if (player.channel !== channel) return;

  player.channel = null;
  room.lastActivity = Date.now();

  // Di lobi, pemain yang pergi benar-benar dilepas. Saat ronde berjalan
  // kursinya ditahan supaya bisa menyambung lagi tanpa kehilangan riwayat.
  if (room.status === 'lobby') {
    room.players.delete(playerId);
    room.order = room.order.filter((id) => id !== playerId);
    if (player.isHost) promoteNewHost(room);
  }

  if ([...room.players.values()].every((p) => p.channel === null) && room.status !== 'playing') {
    // Biarkan sweeper yang membuang; pemain mungkin sedang me-reload halaman.
    return;
  }
  broadcastRoom(room);
  if (room.status === 'playing') maybeEndRound(room);
}

function promoteNewHost(room: Room): void {
  const next = room.order.map((id) => room.players.get(id)).find((p) => p?.channel);
  if (next) next.isHost = true;
  else {
    const fallback = room.order.map((id) => room.players.get(id)).find(Boolean);
    if (fallback) fallback.isHost = true;
  }
}

export function kickPlayer(room: Room, hostId: string, targetId: string): string | null {
  const host = room.players.get(hostId);
  if (!host?.isHost) return 'Hanya host yang bisa mengeluarkan pemain.';
  if (hostId === targetId) return 'Host tidak bisa mengeluarkan dirinya sendiri.';
  const target = room.players.get(targetId);
  if (!target) return 'Pemain tidak ditemukan.';

  target.channel?.close('kicked');
  room.players.delete(targetId);
  room.order = room.order.filter((id) => id !== targetId);
  broadcastRoom(room);
  return null;
}

/**
 * Diklik host: pemain di-reset dan status masuk `starting` supaya papan
 * pemain langsung terlihat bersih selagi hitung mundur 3-2-1 berjalan.
 * Kata rahasia baru sungguhan dipilih belakangan, di `beginPlaying`.
 */
export function startRound(room: Room, requesterId: string): string | null {
  const requester = room.players.get(requesterId);
  if (!requester?.isHost) return 'Hanya host yang bisa memulai ronde.';
  if (room.status === 'playing' || room.status === 'starting') return 'Ronde sudah berjalan.';
  if (room.players.size < 1) return 'Butuh minimal satu pemain.';

  room.status = 'starting';
  room.startsAt = Date.now() + START_COUNTDOWN_MS;
  room.lastActivity = Date.now();

  for (const player of room.players.values()) {
    player.guesses = [];
    player.solved = false;
    player.gaveUp = false;
    player.solvedInMs = null;
    player.placement = null;
    player.letterRevealed = false;
  }

  clearRoomTimer(room);
  room.timer = setTimeout(() => beginPlaying(room), START_COUNTDOWN_MS);

  broadcastRoom(room);
  return null;
}

/** Dipanggil otomatis begitu hitung mundur `starting` habis — ronde sungguhan mulai. */
function beginPlaying(room: Room): void {
  room.status = 'playing';
  room.round += 1;
  room.secret = randomWord();
  room.startedAt = Date.now();
  room.startsAt = null;
  room.deadline = room.settings.timeLimit > 0 ? room.startedAt + room.settings.timeLimit * 1000 : null;
  room.lastActivity = Date.now();

  clearRoomTimer(room);
  if (room.deadline) {
    room.timer = setTimeout(() => endRound(room, 'Waktu habis.'), room.deadline - Date.now());
  }

  broadcastRoom(room);
  broadcast(room, { type: 'notice', level: 'info', message: `Ronde ${room.round} dimulai!` });
}

export type RoomGuessOutcome =
  | { ok: true; guess: Guess; guesses: Guess[]; balance?: number }
  | { ok: false; message: string };

/**
 * Efek satu tebakan yang sudah tervalidasi (kata ada di kamus, belum pernah
 * ditebak, dst.) — dipakai bersama oleh tebakan manual dan powerup "Tebak
 * Terdekat" supaya keduanya menghasilkan efek yang sama persis (placement,
 * skor, siaran ke seluruh ruang). Mengembalikan saldo baru kalau tebakan ini
 * kebetulan kemenangan, supaya pemanggil bisa mengabari client — tanpa ini
 * chip saldo di header tidak pernah tahu dia baru saja dapat coin.
 */
async function applyRoomGuess(
  room: Room,
  player: RoomPlayer,
  word: string,
): Promise<{ guess: Guess; balance?: number }> {
  const engine = getEngine();
  const guess = engine.toGuess(room.secret!, word, player.guesses.length + 1);
  player.guesses.push(guess);

  let balance: number | undefined;
  if (guess.temperature === 'correct') {
    player.solved = true;
    player.solvedInMs = Date.now() - (room.startedAt ?? Date.now());
    player.placement = countFinishers(room);
    player.score += scoreFor(player);
    void recordGameResult(
      player.id,
      { won: true, guessCount: player.guesses.length },
      { userId: player.userId, displayName: player.name, avatar: player.avatar },
    );
    balance = await creditWallet(player.id, roomWinReward(player));
    broadcast(room, {
      type: 'notice',
      level: 'info',
      message: `${player.name} menemukan katanya!`,
    });
  } else if (room.settings.maxGuesses > 0 && player.guesses.length >= room.settings.maxGuesses) {
    player.gaveUp = true;
    void recordGameResult(
      player.id,
      { won: false, guessCount: player.guesses.length },
      { userId: player.userId, displayName: player.name, avatar: player.avatar },
    );
  }
  return { guess, balance };
}

export async function submitRoomGuess(
  room: Room,
  playerId: string,
  rawWord: string,
): Promise<RoomGuessOutcome> {
  const player = room.players.get(playerId);
  if (!player) return { ok: false, message: 'Kamu tidak ada di ruang ini.' };
  if (room.status !== 'playing' || !room.secret) {
    return { ok: false, message: 'Ronde belum dimulai.' };
  }
  if (player.solved || player.gaveUp) {
    return { ok: false, message: 'Kamu sudah menyelesaikan ronde ini.' };
  }
  if (room.settings.maxGuesses > 0 && player.guesses.length >= room.settings.maxGuesses) {
    return { ok: false, message: 'Jatah tebakanmu sudah habis.' };
  }
  if (player.guesses.length >= config.maxGuessesPerPlayer) {
    return { ok: false, message: 'Jatah tebakanmu sudah habis.' };
  }

  const engine = getEngine();
  const word = engine.resolve(rawWord);
  if (!word) return { ok: false, message: `"${rawWord.trim()}" tidak ada di kamus permainan.` };
  if (engine.isBlocked(word)) return { ok: false, message: 'Kata itu tidak bisa dipakai.' };
  if (player.guesses.some((g) => g.word === word)) {
    return { ok: false, message: `"${word}" sudah kamu tebak.` };
  }

  room.lastActivity = Date.now();
  const { guess, balance } = await applyRoomGuess(room, player, word);
  const sorted = [...player.guesses].sort(compareGuesses);
  broadcastRoom(room);
  maybeEndRound(room);
  return { ok: true, guess, guesses: sorted, balance };
}

/** Powerup: cari tetangga terdekat kata rahasia yang belum pernah ditebak
 *  pemain ini, proses lewat `applyRoomGuess` — hasilnya ikut disiarkan ke
 *  seluruh ruang persis seperti tebakan manual, transparan untuk pemain lain. */
export async function useRoomNearestGuess(room: Room, playerId: string): Promise<RoomGuessOutcome> {
  const player = room.players.get(playerId);
  if (!player) return { ok: false, message: 'Kamu tidak ada di ruang ini.' };
  if (room.status !== 'playing' || !room.secret) {
    return { ok: false, message: 'Ronde belum dimulai.' };
  }
  if (player.solved || player.gaveUp) {
    return { ok: false, message: 'Kamu sudah menyelesaikan ronde ini.' };
  }
  const engine = getEngine();
  const already = new Set(player.guesses.map((g) => g.word));
  const nearest = engine.neighbors(room.secret).find((n) => !already.has(n.word));
  if (!nearest) return { ok: false, message: 'Tidak ada kata tersisa untuk ditebak.' };

  const used = await usePowerup(player.id, 'nearestGuess');
  if (!used) return { ok: false, message: 'Belum punya stok — beli dulu di Shop.' };

  room.lastActivity = Date.now();
  const { guess, balance } = await applyRoomGuess(room, player, nearest.word);
  const sorted = [...player.guesses].sort(compareGuesses);
  broadcastRoom(room);
  maybeEndRound(room);
  return { ok: true, guess, guesses: sorted, balance };
}

/** Powerup: buka huruf pertama kata rahasia, hanya untuk pemain yang memakainya —
 *  tidak pernah disiarkan ke pemain lain. Sekali pakai per ronde. */
export async function useRoomLetterReveal(
  room: Room,
  playerId: string,
): Promise<{ letter: string; inventory: PowerupInventory } | { error: string }> {
  const player = room.players.get(playerId);
  if (!player) return { error: 'Kamu tidak ada di ruang ini.' };
  if (room.status !== 'playing' || !room.secret) return { error: 'Ronde belum dimulai.' };
  if (player.solved || player.gaveUp) return { error: 'Kamu sudah menyelesaikan ronde ini.' };
  if (player.letterRevealed) {
    return { error: 'Bocoran huruf sudah pernah dipakai di ronde ini.' };
  }

  const used = await usePowerup(player.id, 'letterReveal');
  if (!used) return { error: 'Belum punya stok — beli dulu di Shop.' };

  player.letterRevealed = true;
  room.lastActivity = Date.now();
  const inventory = await getInventory(player.id);
  return { letter: room.secret[0], inventory };
}

/**
 * Coin kemenangan di ruang: mirip `scoreFor` tapi diskalakan ke besaran coin
 * (bukan skor ronde) — cepat dan hemat tebakan lebih dihargai, posisi finis
 * lebih awal dapat bonus tambahan.
 */
function roomWinReward(player: RoomPlayer): number {
  const base = Math.max(3, 15 - Math.floor((player.guesses.length - 1) / 2));
  const placementBonus = [8, 5, 2, 0][(player.placement ?? 4) - 1] ?? 0;
  return base + placementBonus;
}

export function giveUp(room: Room, playerId: string): void {
  const player = room.players.get(playerId);
  if (!player || room.status !== 'playing' || player.solved || player.gaveUp) return;
  player.gaveUp = true;
  void recordGameResult(
    player.id,
    { won: false, guessCount: player.guesses.length },
    { userId: player.userId, displayName: player.name, avatar: player.avatar },
  );
  room.lastActivity = Date.now();
  broadcastRoom(room);
  maybeEndRound(room);
}

/** Berapa banyak pemain yang sudah menebak benar, termasuk yang baru saja. */
function countFinishers(room: Room): number {
  return [...room.players.values()].filter((p) => p.solved).length;
}

/**
 * Skor per ronde: cepat dan hemat tebakan lebih dihargai, tapi selisihnya
 * dijaga tidak terlalu tajam supaya pemain di posisi belakang tetap punya
 * alasan menyelesaikan tebakannya.
 */
function scoreFor(player: RoomPlayer): number {
  const base = 1000;
  const guessPenalty = Math.min(600, (player.guesses.length - 1) * 15);
  const placementBonus = [300, 200, 120, 60][(player.placement ?? 4) - 1] ?? 0;
  return Math.max(200, base - guessPenalty) + placementBonus;
}

function maybeEndRound(room: Room): void {
  if (room.status !== 'playing') return;
  const players = [...room.players.values()];
  const active = players.filter((p) => p.channel !== null || p.solved || p.gaveUp);
  if (active.length === 0) {
    endRound(room, 'Semua pemain keluar.');
    return;
  }
  if (players.some((p) => p.solved)) {
    endRound(room, 'Ronde selesai — sudah ada yang menemukan katanya.');
    return;
  }
  const stillPlaying = players.filter((p) => !p.solved && !p.gaveUp && p.channel !== null);
  if (stillPlaying.length === 0) endRound(room, 'Semua pemain sudah selesai.');
}

export function endRound(room: Room, reason: string): void {
  if (room.status !== 'playing') return;
  clearRoomTimer(room);
  room.status = 'finished';
  room.deadline = null;
  room.lastActivity = Date.now();

  const secret = room.secret ?? '';
  broadcast(room, { type: 'notice', level: 'info', message: reason });
  broadcast(room, { type: 'roundEnded', room: toRoomState(room), secret });
}

export function resetToLobby(room: Room, requesterId: string): string | null {
  const requester = room.players.get(requesterId);
  if (!requester?.isHost) return 'Hanya host yang bisa memulai ronde baru.';
  room.status = 'lobby';
  room.secret = null;
  room.startedAt = null;
  room.deadline = null;
  clearRoomTimer(room);

  // Pemain yang terputus saat ronde berjalan baru dilepas di sini, supaya
  // lobi berikutnya bersih tapi ronde berjalan tidak pernah kehilangan kursi.
  for (const [id, player] of [...room.players]) {
    if (player.channel === null) {
      room.players.delete(id);
      room.order = room.order.filter((x) => x !== id);
    }
  }
  if (![...room.players.values()].some((p) => p.isHost)) promoteNewHost(room);

  room.lastActivity = Date.now();
  broadcastRoom(room);
  return null;
}

export function updateSettings(
  room: Room,
  requesterId: string,
  patch: Partial<RoomSettings>,
): string | null {
  const requester = room.players.get(requesterId);
  if (!requester?.isHost) return 'Hanya host yang bisa mengubah pengaturan.';
  if (room.status === 'playing' || room.status === 'starting') {
    return 'Pengaturan tidak bisa diubah saat ronde berjalan.';
  }
  room.settings = { ...room.settings, ...sanitizeSettings(patch) };
  room.lastActivity = Date.now();
  broadcastRoom(room);
  return null;
}

export function playerGuesses(room: Room, playerId: string): Guess[] {
  const player = room.players.get(playerId);
  if (!player) return [];
  return [...player.guesses].sort(compareGuesses);
}

export function notifyRoom(room: Room): void {
  broadcastRoom(room);
}

function clearRoomTimer(room: Room): void {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}

export function sweepRooms(now = Date.now()): void {
  for (const [code, room] of rooms) {
    const everyoneGone = [...room.players.values()].every((p) => p.channel === null);
    if (everyoneGone && now - room.lastActivity > config.roomTtlMs) {
      clearRoomTimer(room);
      rooms.delete(code);
    }
  }
}

export function roomCount(): number {
  return rooms.size;
}

export type { Room };
