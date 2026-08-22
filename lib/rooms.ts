import "server-only";

import { randomBytes, randomInt } from "node:crypto";

import type { PublicProfile } from "@/lib/accounts";
import type { AvatarChoices } from "@/lib/avatar";
import { earnCoins } from "@/lib/coins";
import { recordRoomResult } from "@/lib/leaderboard";
import type { AccountStatus } from "@/lib/profile";
import type { PowerUpKind, RevealPayload } from "@/lib/powerup-catalog";
import { decrementInventory, incrementInventory } from "@/lib/powerups";
import {
  findClosestGuess,
  getPuzzleById,
  loadManifest,
  rankGuess,
  revealDigits,
  revealInitial,
  type PuzzleMeta,
} from "@/lib/puzzles";

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

/** Batas waktu semua pemain merespons sebuah ajakan menyerah. */
const SURRENDER_VOTE_MS = 20_000;

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
  /**
   * Hasil Power-Up sekali-pakai (reveal_initial/reveal_digits) yang sudah
   * dipakai pemain ini di pertandingan berjalan -- privat, hanya dikirim ke
   * pemiliknya sendiri lewat viewOf(room, viewerId). Nilai "pending" adalah
   * sentinel anti-race: dipasang sinkron sebelum satu pun `await` dijalankan
   * untuk menghitung wahyunya, supaya klik ganda tidak lolos memotong stok
   * dua kali (lihat useRoomPowerUp).
   */
  powerUps?: Partial<Record<PowerUpKind, RevealPayload | "pending">>;
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
  surrenderRequest?: SurrenderRequest;
  listeners: Set<() => void>;
};

/**
 * Ajakan menyerah yang sedang berjalan. Pemain yang mengajak otomatis
 * tercatat "terima" -- mengajukan menyerah jelas berarti dia setuju.
 *
 * Ada tiga jalan keluar: ambang suara "terima" tercapai (`resolved` jadi
 * true, permainan berakhir -- objeknya sengaja DIBIARKAN di room, jadi
 * modal hasil masih bisa membaca siapa yang setuju), semua pemain sudah
 * menjawab tapi ambangnya tidak tercapai (jelas ditolak, `surrenderRequest`
 * langsung dihapus), atau waktu habis lebih dulu tanpa keputusan (juga
 * dihapus). Penanda `resolved` mencegah timer yang sudah basi -- tertunda
 * gara-gara antrean event -- menimpa hasil "terima" yang sudah terjadi
 * lebih dulu.
 */
type SurrenderRequest = {
  startedBy: string;
  deadline: number;
  responses: Map<string, "accept" | "reject">;
  resolved: boolean;
  timer?: NodeJS.Timeout;
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
    /** Status keaktifan global (fitur Player Status) -- kosong untuk tamu
     *  tanpa akun. Diisi belakangan di lapisan API lewat
     *  lib/presence.ts `withPlayerPresence`, bukan di sini, supaya rooms.ts
     *  tidak perlu mengimpor presence.ts (lihat catatan di
     *  `setMatchStatusListener`). */
    status?: AccountStatus;
  }[];
  feed: FeedEntry[];
  chat: ChatEntry[];
  winner?: { id: string; name: string; guessCount: number };
  /** Hanya terisi setelah permainan usai. */
  answer?: string;
  /** Suara "terima" yang dibutuhkan untuk mengakhiri permainan lewat menyerah. */
  surrenderThreshold: number;
  /** Ada isinya hanya selama sebuah ajakan menyerah sedang berjalan. */
  surrenderRequest?: {
    startedBy: string;
    deadline: number;
    responses: Record<string, "accept" | "reject">;
  };
  /** Hasil Power-Up milik pemain yang meminta view ini sendiri -- kosong untuk pemain lain. */
  myPowerUps?: Partial<Record<PowerUpKind, RevealPayload>>;
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

/**
 * Lebih dari separuh pemain, bukan sekadar separuh -- di room 2 orang,
 * kedua-duanya harus setuju; di room 3 orang, 2 dari 3 sudah cukup.
 */
function surrenderThresholdOf(room: Room): number {
  return Math.floor(room.players.size / 2) + 1;
}

export function viewOf(room: Room, viewerId?: string): RoomView {
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

  const viewerPowerUps = viewerId ? room.players.get(viewerId)?.powerUps : undefined;
  const myPowerUps: Partial<Record<PowerUpKind, RevealPayload>> = {};
  if (viewerPowerUps) {
    for (const [kind, value] of Object.entries(viewerPowerUps) as [PowerUpKind, RevealPayload | "pending"][]) {
      if (value !== "pending") myPowerUps[kind] = value;
    }
  }

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
    surrenderThreshold: surrenderThresholdOf(room),
    surrenderRequest: room.surrenderRequest
      ? {
          startedBy: room.surrenderRequest.startedBy,
          deadline: room.surrenderRequest.deadline,
          responses: Object.fromEntries(room.surrenderRequest.responses),
        }
      : undefined,
    myPowerUps: Object.keys(myPowerUps).length ? myPowerUps : undefined,
  };
}

export async function publicView(room: Room, viewerId?: string): Promise<RoomView> {
  const { vocabSize } = await loadManifest();
  return { ...viewOf(room, viewerId), vocabSize };
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

/** Hadiah kemenangan room: max(3, 15 - floor((tebakan-1)/2)), hanya untuk pemenang berakun. */
function roomWinReward(guessCount: number): number {
  return Math.max(3, 15 - Math.floor((guessCount - 1) / 2));
}

/**
 * Menerapkan satu tebakan (manual maupun hasil Power-Up "Tebakan Terdekat")
 * ke room: papan bersama, deteksi menang, dan pencatatan/hadiah kemenangan.
 * Diekstrak dari submitRoomGuess supaya jalur Power-Up bisa memicu kemenangan
 * (dan tetap dapat coin) lewat kode yang sama persis, bukan duplikat.
 */
function applyRoomGuess(
  room: Room,
  player: Player,
  result: { word: string; rank: number },
): GuessOutcome {
  const already = player.guesses.find((g) => g.word === result.word);
  if (already) return { room, result: already, duplicate: true };

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

    if (player.accountId) {
      earnCoins(player.accountId, roomWinReward(player.guesses.length), "room_win", {
        roomCode: room.code,
      });
    }
  }

  touch(room);
  broadcast(room);
  // Ditaruh setelah earnCoins() di atas (sinkron, tanpa await di antaranya):
  // notifyMatchStatus memberi tahu setiap accountId di room lewat presence.ts,
  // jadi saldo coin terbaru pemenang sudah ikut terbawa di push berikutnya
  // tanpa perlu notifyAccount() terpisah di sini.
  if (room.status === "finished") notifyMatchStatus(room, "finished");
  return { room, result, duplicate: false };
}

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

  return { ok: true, value: applyRoomGuess(room, player, result) };
}

export type PowerUpError =
  | "not-found"
  | "not-playing"
  | "not-member"
  | "insufficient-stock"
  | "no-candidates";

type PowerUpOutcome = {
  room: Room;
  reveal?: RevealPayload;
  guess?: GuessOutcome;
};

/**
 * Pakai Power-Up selama pertandingan room berjalan.
 *
 * reveal_initial/reveal_digits: privat untuk pemain ini saja (lihat
 * viewOf/RoomView.myPowerUps), sekali per pertandingan -- ditegakkan lewat
 * `player.powerUps[kind]`, bukan tabel DB, karena state room memang sudah
 * sepenuhnya di memori. Sentinel "pending" dipasang SINKRON tepat setelah
 * stok dipotong, sebelum `await` menghitung wahyunya, supaya dua klik
 * beruntun tidak lolos memotong stok dua kali (pola yang sama dengan
 * useSoloRevealPowerUp di lib/powerups.ts).
 *
 * closest_guess: konsumsi 1 stok per pakai, hasilnya diterapkan lewat
 * applyRoomGuess yang sama dengan tebakan manual -- transparan ke papan
 * bersama, dan tetap bisa memicu kemenangan + hadiah coin.
 */
export async function useRoomPowerUp(
  code: string,
  playerId: string,
  kind: PowerUpKind,
): Promise<Result<PowerUpOutcome, PowerUpError>> {
  const room = getRoom(code);
  if (!room) return { ok: false, error: "not-found" };
  if (room.status !== "playing") return { ok: false, error: "not-playing" };

  const player = room.players.get(playerId);
  if (!player) return { ok: false, error: "not-member" };

  if (kind === "closest_guess") {
    if (!player.accountId || !decrementInventory(player.accountId, kind)) {
      return { ok: false, error: "insufficient-stock" };
    }
    const result = await findClosestGuess(room.puzzle.id, player.guesses.map((g) => g.word));
    if (!result) {
      incrementInventory(player.accountId, kind, 1);
      return { ok: false, error: "no-candidates" };
    }
    return { ok: true, value: { room, guess: applyRoomGuess(room, player, result) } };
  }

  const existing = player.powerUps?.[kind];
  if (existing && existing !== "pending") {
    return { ok: true, value: { room, reveal: existing } };
  }

  if (!player.accountId || !decrementInventory(player.accountId, kind)) {
    return { ok: false, error: "insufficient-stock" };
  }

  player.powerUps ??= {};
  player.powerUps[kind] = "pending";

  const reveal = kind === "reveal_initial" ? await revealInitial(room.puzzle.id) : await revealDigits(room.puzzle.id);
  if (!reveal) {
    delete player.powerUps[kind];
    incrementInventory(player.accountId, kind, 1);
    return { ok: false, error: "insufficient-stock" };
  }

  player.powerUps[kind] = reveal;
  touch(room);
  broadcast(room);
  return { ok: true, value: { room, reveal } };
}

export type SurrenderError = "not-found" | "not-playing" | "not-member" | "already-active";
export type SurrenderRespondError =
  | "not-found"
  | "not-playing"
  | "not-member"
  | "no-active-vote"
  | "already-responded";

/**
 * Menutup sebuah ajakan menyerah kalau sudah punya keputusan: cukup suara
 * "terima" (permainan berakhir tanpa pemenang -- jawabannya tetap dibuka
 * lewat `viewOf` seperti kemenangan biasa, tapi sengaja tidak dicatat ke
 * papan peringkat karena menyerah bukan kekalahan yang harus menodai rekam
 * jejak siapa pun), atau semua pemain sudah menjawab tanpa mencapai ambang
 * (jelas ditolak, tidak perlu menunggu waktu habis). Kalau belum ada
 * keputusan, request dibiarkan berjalan sampai timer-nya sendiri habis.
 */
function resolveSurrenderIfDecided(room: Room): void {
  const request = room.surrenderRequest;
  if (!request || request.resolved) return;

  const acceptCount = [...request.responses.values()].filter((r) => r === "accept").length;
  if (acceptCount >= surrenderThresholdOf(room)) {
    if (request.timer) clearTimeout(request.timer);
    request.timer = undefined;
    request.resolved = true;
    room.status = "finished";
    notifyMatchStatus(room, "finished");
    return;
  }

  if (request.responses.size >= room.players.size) {
    if (request.timer) clearTimeout(request.timer);
    room.surrenderRequest = undefined;
  }
}

export function startSurrenderVote(
  code: string,
  playerId: string,
): Result<{ room: Room }, SurrenderError> {
  const room = getRoom(code);
  if (!room) return { ok: false, error: "not-found" };
  if (room.status !== "playing") return { ok: false, error: "not-playing" };
  if (!room.players.has(playerId)) return { ok: false, error: "not-member" };
  if (room.surrenderRequest) return { ok: false, error: "already-active" };

  const request: SurrenderRequest = {
    startedBy: playerId,
    deadline: Date.now() + SURRENDER_VOTE_MS,
    responses: new Map([[playerId, "accept"]]),
    resolved: false,
  };
  room.surrenderRequest = request;
  resolveSurrenderIfDecided(room);

  // Masih berjalan setelah respons otomatis si pengajak -- pasang batas
  // waktu supaya request yang tidak pernah selesai tidak menggantung selamanya.
  if (!request.resolved) {
    request.timer = setTimeout(() => {
      const current = getRoom(code);
      if (!current || current.surrenderRequest !== request || request.resolved) return;
      current.surrenderRequest = undefined;
      touch(current);
      broadcast(current);
    }, SURRENDER_VOTE_MS);
    request.timer.unref?.();
  }

  touch(room);
  broadcast(room);
  return { ok: true, value: { room } };
}

export function respondToSurrenderVote(
  code: string,
  playerId: string,
  response: "accept" | "reject",
): Result<{ room: Room }, SurrenderRespondError> {
  const room = getRoom(code);
  if (!room) return { ok: false, error: "not-found" };
  if (room.status !== "playing") return { ok: false, error: "not-playing" };
  if (!room.players.has(playerId)) return { ok: false, error: "not-member" };

  const request = room.surrenderRequest;
  if (!request) return { ok: false, error: "no-active-vote" };
  if (request.responses.has(playerId)) return { ok: false, error: "already-responded" };

  request.responses.set(playerId, response);
  resolveSurrenderIfDecided(room);

  touch(room);
  broadcast(room);
  return { ok: true, value: { room } };
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
