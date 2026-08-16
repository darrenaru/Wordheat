import "server-only";

import { randomBytes, randomInt } from "node:crypto";

import type { PublicProfile } from "@/lib/accounts";
import type { AvatarChoices } from "@/lib/avatar";
import { recordRoomResult } from "@/lib/leaderboard";
import { getPuzzleById, loadManifest, rankGuess, type PuzzleMeta } from "@/lib/puzzles";

/**
 * Room multiplayer, disimpan di memori proses.
 *
 * Permainannya berumur pendek dan tidak berharga untuk disimpan permanen, jadi
 * tidak ada basis data. Konsekuensinya: room hilang saat server dimulai ulang,
 * dan penyebaran ke banyak instance butuh penyimpanan bersama seperti Redis.
 *
 * Pengecualian: HASIL AKHIR sebuah room (siapa menang, berapa tebakan) dicatat
 * ke SQLite lewat lib/leaderboard.ts, bukan seluruh state room -- papan
 * peringkat harus bertahan lewat restart, sedangkan lobi dan feed tebakan
 * memang boleh hilang begitu saja.
 */

/** Tanpa huruf dan angka yang mudah tertukar saat kode dibacakan lewat suara. */
const CODE_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679";
const CODE_LENGTH = 4;

/** Room tanpa aktivitas dibersihkan agar memori tidak menumpuk. */
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;

/** Tenggang setelah koneksi putus, supaya muat ulang halaman tidak dianggap keluar. */
const DISCONNECT_GRACE_MS = 12_000;

/** Hitung mundur sebelum permainan benar-benar mulai, supaya semua pemain siap bersamaan. */
const COUNTDOWN_MS = 3_000;

export type RoomStatus = "lobby" | "countdown" | "playing" | "finished";

export type FeedEntry = {
  word: string;
  rank: number;
  by: string;
  byId: string;
  at: number;
};

export type ChatEntry = {
  id: string;
  playerId: string;
  text: string;
  at: number;
};

/**
 * Siapa yang duduk di kursi ini. Pemain berprofil membawa nama dan avatarnya,
 * sedangkan tamu tanpa profil cukup mengetik nama panggilan -- bermain bersama
 * tidak boleh mensyaratkan pendaftaran.
 */
export type Identity = { name?: string; account?: PublicProfile };

type Player = {
  id: string;
  accountId?: string;
  username?: string;
  name: string;
  avatarSeed?: string;
  avatarBg?: string;
  avatarChoices?: AvatarChoices;
  joinedAt: number;
  connections: number;
  removalTimer?: NodeJS.Timeout;
  guesses: { word: string; rank: number }[];
  solvedAt?: number;
};

type Room = {
  code: string;
  hostId: string;
  status: RoomStatus;
  puzzle: PuzzleMeta;
  players: Map<string, Player>;
  feed: FeedEntry[];
  chat: ChatEntry[];
  createdAt: number;
  touchedAt: number;
  startedAt?: number;
  countdownEndsAt?: number;
  winnerId?: string;
  listeners: Set<() => void>;
};

/** Modul dimuat ulang tiap kali kode berubah saat pengembangan; room tidak boleh ikut hilang. */
const store: Map<string, Room> =
  ((globalThis as Record<string, unknown>).__wordheatRooms as Map<string, Room>) ??
  ((globalThis as Record<string, unknown>).__wordheatRooms = new Map());

/**
 * Indeks balik akun -> kursi room, dipakai fitur status pemain untuk
 * menjawab "akun ini sedang di room mana" tanpa harus memindai seluruh
 * `store`. Validasinya malas (lihat `isAccountInMatch`): entri basi cukup
 * dibuang saat benar-benar ditanya, tidak perlu dibersihkan eksplisit di
 * setiap jalur penghapusan room/pemain.
 */
const accountRoomIndex: Map<string, { code: string; playerId: string }> =
  ((globalThis as Record<string, unknown>).__wordheatAccountRooms as Map<
    string,
    { code: string; playerId: string }
  >) ??
  ((globalThis as Record<string, unknown>).__wordheatAccountRooms = new Map());

/**
 * Slot notifikasi status pertandingan, diisi oleh lib/presence.ts.
 *
 * rooms.ts sengaja tidak meng-import presence.ts (menghindari dependensi dua
 * arah antar modul) -- presence.ts yang mendaftarkan dirinya ke sini lewat
 * `setMatchStatusListener`. Ditaruh di globalThis, bukan `let` modul biasa,
 * supaya pendaftarannya tidak hilang kalau Fast Refresh cuma memuat ulang
 * berkas ini saja saat pengembangan.
 */
type MatchStatusListener = (accountIds: string[], status: "playing" | "finished") => void;
const listenerBox: { current: MatchStatusListener | null } =
  ((globalThis as Record<string, unknown>).__wordheatRoomMatchListener as {
    current: MatchStatusListener | null;
  }) ?? ((globalThis as Record<string, unknown>).__wordheatRoomMatchListener = { current: null });

export function setMatchStatusListener(fn: MatchStatusListener) {
  listenerBox.current = fn;
}

function notifyMatchStatus(room: Room, status: "playing" | "finished") {
  const accountIds = [...room.players.values()]
    .map((p) => p.accountId)
    .filter((id): id is string => Boolean(id));
  if (accountIds.length) listenerBox.current?.(accountIds, status);
}

export type RoomView = {
  code: string;
  status: RoomStatus;
  hostId: string;
  puzzleId: number;
  vocabSize: number;
  startedAt?: number;
  countdownEndsAt?: number;
  players: {
    id: string;
    accountId?: string;
    username?: string;
    name: string;
    avatarSeed?: string;
    avatarBg?: string;
    avatarChoices?: AvatarChoices;
    isHost: boolean;
    online: boolean;
    guessCount: number;
    bestRank: number | null;
    solvedAt?: number;
  }[];
  feed: FeedEntry[];
  chat: ChatEntry[];
  winner?: { id: string; name: string; guessCount: number };
  /** Hanya terisi setelah permainan usai. */
  answer?: string;
};

function newId(): string {
  return randomBytes(12).toString("base64url");
}

function newCode(): string {
  for (let attempt = 0; attempt < 40; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    if (!store.has(code)) return code;
  }
  throw new Error("Gagal membuat kode room yang belum terpakai");
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function sweep() {
  const now = Date.now();
  for (const [code, room] of store) {
    if (now - room.touchedAt > ROOM_TTL_MS) store.delete(code);
  }
}

function touch(room: Room) {
  room.touchedAt = Date.now();
}

function broadcast(room: Room) {
  for (const listener of room.listeners) listener();
}

function bestRankOf(player: Player): number | null {
  if (!player.guesses.length) return null;
  return Math.min(...player.guesses.map((g) => g.rank));
}

export function viewOf(room: Room): RoomView {
  const players = [...room.players.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({
      id: p.id,
      accountId: p.accountId,
      username: p.username,
      name: p.name,
      avatarSeed: p.avatarSeed,
      avatarBg: p.avatarBg,
      avatarChoices: p.avatarChoices,
      isHost: p.id === room.hostId,
      online: p.connections > 0,
      guessCount: p.guesses.length,
      bestRank: bestRankOf(p),
      solvedAt: p.solvedAt,
    }));

  const winner = room.winnerId ? room.players.get(room.winnerId) : undefined;

  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    puzzleId: room.puzzle.id,
    vocabSize: 0, // diisi pemanggil; lihat withVocabSize
    startedAt: room.startedAt,
    countdownEndsAt: room.countdownEndsAt,
    players,
    feed: room.feed,
    chat: room.chat,
    winner: winner
      ? { id: winner.id, name: winner.name, guessCount: winner.guesses.length }
      : undefined,
    // Jawaban baru boleh menyeberang ke klien setelah permainan benar-benar usai.
    answer: room.status === "finished" ? room.puzzle.word : undefined,
  };
}

export async function publicView(room: Room): Promise<RoomView> {
  const { vocabSize } = await loadManifest();
  return { ...viewOf(room), vocabSize };
}

export function getRoom(code: string): Room | undefined {
  sweep();
  return store.get(normalizeCode(code));
}

/** Dipakai fitur status pemain: apakah akun ini sedang di tengah pertandingan aktif. */
export function isAccountInMatch(accountId: string): boolean {
  const ref = accountRoomIndex.get(accountId);
  if (!ref) return false;

  const room = getRoom(ref.code);
  if (!room) {
    accountRoomIndex.delete(accountId);
    return false;
  }
  const player = room.players.get(ref.playerId);
  if (!player || player.accountId !== accountId) {
    accountRoomIndex.delete(accountId);
    return false;
  }
  return room.status === "playing";
}

function sanitizeName(raw: string | undefined, fallback: string): string {
  const name = (raw ?? "").trim().replace(/\s+/g, " ").slice(0, 18);
  return name || fallback;
}

/**
 * Profil selalu menang atas nama yang diketik: nama dan avatar itulah yang
 * dikenali teman-temannya, dan tidak masuk akal kalau bisa disamarkan begitu
 * saja di dalam room.
 */
function seatPlayer(identity: Identity, fallbackName: string): Player {
  return {
    id: newId(),
    accountId: identity.account?.id,
    username: identity.account?.username,
    name: identity.account
      ? identity.account.displayName
      : sanitizeName(identity.name, fallbackName),
    avatarSeed: identity.account?.avatarSeed,
    avatarBg: identity.account?.avatarBg,
    avatarChoices: identity.account?.avatarChoices,
    joinedAt: Date.now(),
    connections: 0,
    guesses: [],
  };
}

/** Puzzle room diacak agar main berkali-kali tidak mengulang kata yang sama. */
async function pickPuzzle(): Promise<PuzzleMeta> {
  const { puzzles } = await loadManifest();
  return puzzles[randomInt(puzzles.length)];
}

export async function createRoom(identity: Identity) {
  sweep();
  const puzzle = await pickPuzzle();
  const host = seatPlayer(identity, "Host");
  const room: Room = {
    code: newCode(),
    hostId: host.id,
    status: "lobby",
    puzzle,
    players: new Map([[host.id, host]]),
    feed: [],
    chat: [],
    createdAt: Date.now(),
    touchedAt: Date.now(),
    listeners: new Set(),
  };
  store.set(room.code, room);
  if (host.accountId) accountRoomIndex.set(host.accountId, { code: room.code, playerId: host.id });
  return { room, playerId: host.id };
}

export type JoinError = "not-found" | "already-started" | "full";

/**
 * Hasil bertanda agar pemanggil tidak perlu menebak-nebak bentuk baliknya.
 * Tanpa penanda `ok`, TypeScript menyisipkan properti opsional saat menyatukan
 * literal objek yang bentuknya berbeda, dan penyempitannya jadi tidak rapat.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export async function joinRoom(
  code: string,
  identity: Identity,
): Promise<Result<{ room: Room; playerId: string }, JoinError>> {
  const room = getRoom(code);
  if (!room) return { ok: false, error: "not-found" };
  if (room.status !== "lobby") return { ok: false, error: "already-started" };
  if (room.players.size >= 12) return { ok: false, error: "full" };

  const player = seatPlayer(identity, `Pemain ${room.players.size + 1}`);
  room.players.set(player.id, player);
  if (player.accountId) accountRoomIndex.set(player.accountId, { code: room.code, playerId: player.id });
  touch(room);
  broadcast(room);
  return { ok: true, value: { room, playerId: player.id } };
}

export type StartError = "not-found" | "not-host" | "already-started";

export function startRoom(
  code: string,
  playerId: string,
): Result<{ room: Room }, StartError> {
  const room = getRoom(code);
  if (!room) return { ok: false, error: "not-found" };
  if (room.hostId !== playerId) return { ok: false, error: "not-host" };
  if (room.status !== "lobby") return { ok: false, error: "already-started" };

  // Hitung mundur dulu sebelum benar-benar bermain, supaya semua pemain punya
  // waktu yang sama untuk menutup obrolan dan hal lain lalu fokus ke papan.
  room.status = "countdown";
  room.countdownEndsAt = Date.now() + COUNTDOWN_MS;
  touch(room);
  broadcast(room);

  const countdownTimer = setTimeout(() => {
    const current = getRoom(code);
    if (!current || current.status !== "countdown") return;
    current.status = "playing";
    current.startedAt = Date.now();
    current.countdownEndsAt = undefined;
    touch(current);
    broadcast(current);
    notifyMatchStatus(current, "playing");
  }, COUNTDOWN_MS);
  countdownTimer.unref?.();

  return { ok: true, value: { room } };
}

export type GuessError = "not-found" | "not-playing" | "not-member" | "unknown-word";

type GuessOutcome = {
  room: Room;
  result: { word: string; rank: number };
  duplicate: boolean;
};

export async function submitRoomGuess(
  code: string,
  playerId: string,
  rawWord: string,
): Promise<Result<GuessOutcome, GuessError>> {
  const room = getRoom(code);
  if (!room) return { ok: false, error: "not-found" };
  if (room.status !== "playing") return { ok: false, error: "not-playing" };

  const player = room.players.get(playerId);
  if (!player) return { ok: false, error: "not-member" };

  const result = await rankGuess(room.puzzle.id, rawWord);
  if (!result) return { ok: false, error: "unknown-word" };

  const already = player.guesses.find((g) => g.word === result.word);
  if (already) return { ok: true, value: { room, result: already, duplicate: true } };

  player.guesses.push(result);

  // Papan bersama hanya mencatat kemunculan pertama sebuah kata, supaya tebakan
  // yang sama dari beberapa pemain tidak memenuhi daftar.
  if (!room.feed.some((entry) => entry.word === result.word)) {
    room.feed.push({
      word: result.word,
      rank: result.rank,
      by: player.name,
      byId: player.id,
      at: Date.now(),
    });
  }

  if (result.rank === 1 && !room.winnerId) {
    room.winnerId = player.id;
    player.solvedAt = Date.now();
    room.status = "finished";

    recordRoomResult({
      roomCode: room.code,
      winnerId: room.winnerId,
      players: [...room.players.values()]
        .filter((p) => p.accountId)
        .map((p) => ({ id: p.id, accountId: p.accountId, guessCount: p.guesses.length })),
    });
  }

  touch(room);
  broadcast(room);
  if (room.status === "finished") notifyMatchStatus(room, "finished");
  return { ok: true, value: { room, result, duplicate: false } };
}

const CHAT_MAX_LEN = 300;
/** Riwayat dipangkas supaya room ramai tidak menumpuk memori tanpa batas. */
const CHAT_HISTORY_LIMIT = 200;

export type ChatError = "not-found" | "not-member" | "empty" | "too-long";

/**
 * Obrolan bersama satu room, terbuka untuk semua yang duduk di dalamnya --
 * termasuk tamu tanpa akun, karena kursi room-lah yang jadi identitasnya di
 * sini, bukan akun. Ikut disapu bersama room lewat ROOM_TTL_MS, sama seperti
 * papan tebakan.
 */
export function sendRoomChat(
  code: string,
  playerId: string,
  rawText: string,
): Result<ChatEntry, ChatError> {
  const room = getRoom(code);
  if (!room) return { ok: false, error: "not-found" };

  const player = room.players.get(playerId);
  if (!player) return { ok: false, error: "not-member" };

  const text = rawText.trim();
  if (!text) return { ok: false, error: "empty" };
  if (text.length > CHAT_MAX_LEN) return { ok: false, error: "too-long" };

  const entry: ChatEntry = { id: newId(), playerId, text, at: Date.now() };
  room.chat.push(entry);
  if (room.chat.length > CHAT_HISTORY_LIMIT) {
    room.chat.splice(0, room.chat.length - CHAT_HISTORY_LIMIT);
  }

  touch(room);
  broadcast(room);
  return { ok: true, value: entry };
}

export function subscribe(code: string, listener: () => void): (() => void) | null {
  const room = getRoom(code);
  if (!room) return null;
  room.listeners.add(listener);
  return () => room.listeners.delete(listener);
}

/**
 * Kehadiran pemain diikat ke koneksi aliran datanya. Penghapusan ditunda
 * sebentar supaya menyegarkan halaman tidak terlihat sebagai keluar-lalu-masuk.
 */
export function markConnected(code: string, playerId: string) {
  const room = getRoom(code);
  const player = room?.players.get(playerId);
  if (!room || !player) return;

  player.connections += 1;
  if (player.removalTimer) {
    clearTimeout(player.removalTimer);
    player.removalTimer = undefined;
  }
  touch(room);
  broadcast(room);
}

export function markDisconnected(code: string, playerId: string) {
  const room = getRoom(code);
  const player = room?.players.get(playerId);
  if (!room || !player) return;

  player.connections = Math.max(0, player.connections - 1);
  if (player.connections > 0) return;

  broadcast(room);
  player.removalTimer = setTimeout(() => {
    if (player.connections > 0) return;

    // Begitu permainan sudah dimulai, kursinya dibiarkan (hanya tampil
    // offline) alih-alih dihapus, supaya pemain yang koneksinya putus masih
    // bisa kembali ke room yang sama kapan pun -- lewat playerId yang sudah
    // tersimpan di localStorage -- tanpa kehilangan skor dan tebakannya.
    // Room-nya sendiri tetap dibatasi oleh ROOM_TTL_MS seperti biasa.
    if (room.status !== "lobby") return;

    room.players.delete(playerId);

    if (room.players.size === 0) {
      store.delete(room.code);
      return;
    }
    // Host yang pergi menyerahkan kendali ke pemain terlama berikutnya, agar
    // room tidak terkunci selamanya di ruang tunggu.
    if (room.hostId === playerId) {
      const next = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
      room.hostId = next.id;
    }
    broadcast(room);
  }, DISCONNECT_GRACE_MS);
  player.removalTimer.unref?.();
}

export async function roomPuzzleNeighbours(code: string) {
  const room = getRoom(code);
  if (!room) return null;
  const puzzle = await getPuzzleById(room.puzzle.id);
  return puzzle?.neighbours ?? null;
}
