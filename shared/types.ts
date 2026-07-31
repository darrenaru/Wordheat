/**
 * Tipe yang dipakai bersama oleh server dan client.
 * Satu-satunya sumber kebenaran untuk bentuk payload HTTP dan WebSocket.
 */

/** Label suhu dari yang paling jauh sampai jawaban benar. */
export type Temperature =
  | 'freezing'
  | 'cold'
  | 'cool'
  | 'warm'
  | 'hot'
  | 'very-hot'
  | 'correct';

export const TEMPERATURE_ORDER: Temperature[] = [
  'freezing',
  'cold',
  'cool',
  'warm',
  'hot',
  'very-hot',
  'correct',
];

export const TEMPERATURE_LABEL: Record<Temperature, string> = {
  freezing: 'Beku',
  cold: 'Dingin',
  cool: 'Sejuk',
  warm: 'Hangat',
  hot: 'Panas',
  'very-hot': 'Panas Sekali',
  correct: 'Tepat!',
};

/** Satu baris riwayat tebakan. */
export interface Guess {
  /** Nomor urut tebakan dalam ronde ini (1-based). */
  order: number;
  word: string;
  /** Cosine similarity mentah, 0..1. Berguna untuk debug/tooltip. */
  similarity: number;
  /**
   * Peringkat kata ini di antara seluruh kosakata, diurut dari yang paling
   * dekat dengan target. 1 = kata paling dekat. `null` bila di luar pool.
   */
  rank: number | null;
  /** 0..100 — posisi pada heat meter. */
  closeness: number;
  temperature: Temperature;
}

/**
 * Urutan tampil riwayat tebakan: paling dekat maknanya di atas.
 *
 * Peringkat ikut dibandingkan karena semua tebakan "Beku" punya `closeness` 0 —
 * tanpa ini, tebakan peringkat 423 akan tampil di bawah tebakan yang bahkan
 * tidak masuk pool sama sekali.
 */
export function compareGuesses(a: Guess, b: Guess): number {
  if (a.closeness !== b.closeness) return b.closeness - a.closeness;
  const rankA = a.rank ?? Number.POSITIVE_INFINITY;
  const rankB = b.rank ?? Number.POSITIVE_INFINITY;
  if (rankA !== rankB) return rankA - rankB;
  return a.order - b.order;
}

export type GameMode = 'practice' | 'daily' | 'race';

export interface PlayerProfile {
  id: string;
  name: string;
  /** Seed + opsi DiceBear, cukup untuk merender ulang avatar di mana saja. */
  avatar: AvatarConfig;
}

export interface AvatarConfig {
  /** Dasar acak untuk bagian yang tidak dipilih sendiri oleh pemain. */
  seed: string;
  backgroundColor: string;
  /**
   * Bagian yang dipilih sendiri oleh pemain (rambut, mata, mulut, warna kulit,
   * ...). Kunci dan nilainya memakai nama opsi DiceBear apa adanya.
   *
   * Bagian yang tidak tercantum di sini sengaja dibiarkan mengikuti `seed`,
   * jadi profil lama yang belum punya kolom ini tetap tampil persis sama.
   */
  parts?: Record<string, string>;
}

/** Nilai `parts` yang berarti "bagian ini disembunyikan" (mis. tanpa kacamata). */
export const AVATAR_PART_NONE = 'none';

/* ------------------------------------------------------------------ */
/* Mode solo (practice / daily) — lewat HTTP                            */
/* ------------------------------------------------------------------ */

export interface SoloSessionState {
  sessionId: string;
  mode: GameMode;
  /** Ukuran pool tetangga terdekat yang dipakai untuk peringkat. */
  poolSize: number;
  guesses: Guess[];
  solved: boolean;
  revealed: boolean;
  /** Hanya terisi bila `solved` atau `revealed`. */
  secret: string | null;
  startedAt: number;
  finishedAt: number | null;
  /** Untuk mode daily: tanggal WIB dalam format YYYY-MM-DD. */
  puzzleDate?: string;
  /** Powerup "Bocoran Huruf" cuma bisa dibeli sekali per ronde. */
  letterRevealed: boolean;
}

export interface GuessResponse {
  ok: true;
  guess: Guess;
  state: SoloSessionState;
}

export interface ApiError {
  ok: false;
  code:
    | 'not_in_lexicon'
    | 'already_guessed'
    | 'not_found'
    | 'finished'
    | 'invalid'
    | 'blocked'
    | 'insufficient_funds'
    | 'out_of_stock'
    | 'cooldown';
  message: string;
}

/* ------------------------------------------------------------------ */
/* Mode multiplayer (race) — lewat WebSocket                            */
/* ------------------------------------------------------------------ */

export type RoomStatus = 'lobby' | 'starting' | 'playing' | 'finished';

export interface RoomSettings {
  /** Detik. 0 = tanpa batas waktu. */
  timeLimit: number;
  /** 0 = tanpa batas tebakan. */
  maxGuesses: number;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  timeLimit: 0,
  maxGuesses: 0,
};

export interface RoomGuessPlayer {
  id: string;
  name: string;
}

/**
 * Satu baris tebakan di papan bersama. `players` bisa lebih dari satu kalau
 * beberapa pemain kebetulan menebak kata yang sama persis — digabung jadi
 * satu baris alih-alih diduplikasi, karena rank/closeness/temperature-nya
 * pasti identik (dihitung dari kata yang sama terhadap kata rahasia yang sama).
 */
export interface RoomGuess extends Guess {
  players: RoomGuessPlayer[];
}

/** Progres pemain lain. Kata yang mereka tebak terlihat lewat `RoomState.guesses`. */
export interface PlayerPublicState {
  id: string;
  name: string;
  avatar: AvatarConfig;
  connected: boolean;
  isHost: boolean;
  guessCount: number;
  /** Suhu terbaik yang pernah dicapai. */
  bestTemperature: Temperature | null;
  bestCloseness: number;
  solved: boolean;
  gaveUp: boolean;
  /** Waktu (ms) sejak ronde mulai sampai menebak benar. */
  solvedInMs: number | null;
  /** Posisi finis, 1-based. `null` bila belum selesai. */
  placement: number | null;
  score: number;
}

export interface RoomState {
  code: string;
  status: RoomStatus;
  settings: RoomSettings;
  hostId: string;
  players: PlayerPublicState[];
  round: number;
  poolSize: number;
  startedAt: number | null;
  /** Timestamp epoch ms kapan hitung mundur "starting" berakhir dan ronde
   *  benar-benar mulai. `null` bila status bukan `starting`. */
  startsAt: number | null;
  /** Timestamp epoch ms kapan ronde otomatis berakhir. `null` = tanpa batas. */
  deadline: number | null;
  /** Hanya terisi setelah ronde selesai. */
  secret: string | null;
  /** Semua tebakan seluruh pemain di ronde ini, diurut paling dekat di atas. */
  guesses: RoomGuess[];
}

/* ------------------------------------------------------------------ */
/* Statistik pribadi (berlaku untuk anonim maupun akun, sama seperti coin) */
/* ------------------------------------------------------------------ */

export interface PlayerStats {
  totalGames: number;
  totalWins: number;
  totalGuesses: number;
  /** Tebakan tersedikit untuk menang. `null` bila belum pernah menang. */
  bestGuessCount: number | null;
  currentStreak: number;
  longestStreak: number;
  /** Tanggal WIB (YYYY-MM-DD) terakhir kali main. `null` bila belum pernah. */
  lastPlayedDate: string | null;
  /** Total XP terkumpul — didapat cuma saat menang, sama seperti coin. */
  xp: number;
}

/* ------------------------------------------------------------------ */
/* Leaderboard                                                          */
/* ------------------------------------------------------------------ */

export interface LeaderboardEntry {
  profileId: string;
  name: string;
  avatar: AvatarConfig | null;
  value: number;
  /** Dipakai badge Rank (`client/src/lib/ranks.ts`) — terpisah dari
   *  `value` karena kategori Coin/XP/Streak/Tebakan tidak selalu sama
   *  dengan jumlah kemenangan. */
  totalWins: number;
}

export interface Leaderboard {
  coins: LeaderboardEntry[];
  wins: LeaderboardEntry[];
  streak: LeaderboardEntry[];
  guesses: LeaderboardEntry[];
  xp: LeaderboardEntry[];
}

/** Profil publik pemain lain — dibuka dari Leaderboard. Cuma data yang sudah
 *  tampil di leaderboard/statistik sendiri, tidak ada apa pun yang butuh
 *  login untuk dilihat (sama seperti coin & statistik pribadi). */
export interface PublicProfile {
  profileId: string;
  displayName: string;
  /** `null` kalau pemain itu belum pernah mengatur username sendiri. */
  username: string | null;
  avatar: AvatarConfig | null;
  bio: string | null;
  stats: PlayerStats;
}

/* ------------------------------------------------------------------ */
/* Pertemanan & undangan room (berlaku untuk anonim maupun akun, sama   */
/* seperti coin — diikat ke `profile_id`, bukan `user_id`)              */
/* ------------------------------------------------------------------ */

/** Identitas publik seorang pemain — dipakai di hasil pencarian, daftar
 *  teman, dan permintaan pertemanan. Cuma pemain yang sudah mengatur
 *  username sendiri yang bisa muncul di sini. */
export interface UserSummary {
  profileId: string;
  username: string;
  displayName: string;
  avatar: AvatarConfig | null;
}

export interface FriendSummary {
  friendshipId: string;
  user: UserSummary;
}

export interface FriendRequestSummary {
  id: string;
  user: UserSummary;
  createdAt: number;
}

export interface RoomInviteSummary {
  id: string;
  roomCode: string;
  from: UserSummary;
  createdAt: number;
}

export interface FriendsPayload {
  friends: FriendSummary[];
  incoming: FriendRequestSummary[];
  outgoing: FriendRequestSummary[];
  invites: RoomInviteSummary[];
  /** Total pesan belum dibaca di SEMUA percakapan — dilebur ke badge
   *  "Teman" yang sama di header, bukan badge terpisah. */
  unreadMessages: number;
}

/* ------------------------------------------------------------------ */
/* Chat pribadi antar teman (persisten, bukan real-time)                */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  id: string;
  fromProfileId: string;
  body: string;
  createdAt: number;
}

/* ------------------------------------------------------------------ */
/* Coin & powerup (opsional, berlaku untuk anonim maupun akun)          */
/* ------------------------------------------------------------------ */

/** Biaya powerup dalam coin — satu sumber angka untuk client & server. */
export const POWERUP_COSTS = {
  nearestGuess: 15,
  letterReveal: 8,
} as const;

/** Stok powerup pemain — cuma bertambah lewat Shop, cuma berkurang lewat pemakaian di ronde. */
export interface PowerupInventory {
  nearestGuess: number;
  letterReveal: number;
}

export type ClientMessage =
  | {
      type: 'hello';
      profile: PlayerProfile;
      roomCode?: string;
      create?: boolean;
      settings?: Partial<RoomSettings>;
      /** Access token Supabase — opsional, cuma diisi kalau pemain login.
       *  Server verifikasi sekali saat join untuk mencatat statistik pribadi. */
      authToken?: string;
    }
  | { type: 'start' }
  | { type: 'guess'; word: string }
  | { type: 'giveUp' }
  | { type: 'settings'; settings: Partial<RoomSettings> }
  | { type: 'playAgain' }
  | { type: 'kick'; playerId: string }
  | { type: 'powerupNearestGuess' }
  | { type: 'powerupLetterReveal' }
  | { type: 'ping' };

export type ServerMessage
  = { type: 'joined'; room: RoomState; you: string }
  | { type: 'room'; room: RoomState }
  | { type: 'guessResult'; guess: Guess; guesses: Guess[] }
  | { type: 'notice'; level: 'info' | 'error'; message: string }
  | { type: 'roundEnded'; room: RoomState; secret: string }
  /** Saldo terbaru pemain itu sendiri — tidak pernah disiarkan ke pemain lain. */
  | { type: 'wallet'; balance: number }
  /** Stok powerup terbaru pemain itu sendiri, setelah dipakai di ronde. */
  | { type: 'inventory'; inventory: PowerupInventory }
  | { type: 'pong' };
