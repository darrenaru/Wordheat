import "server-only";

import { randomBytes } from "node:crypto";

import { xpBalance } from "@/lib/coins";
import { db } from "@/lib/db";
import {
  findAccountByUsername,
  toAccount,
  toPublicProfile,
  type AccountRow,
  type PublicProfile,
} from "@/lib/accounts";

/**
 * Papan peringkat pemain.
 *
 * Hanya menghitung game room multiplayer yang benar-benar selesai (ada
 * pemenang); mode solo tidak dikenal room/status sehingga tidak relevan di
 * sini. Tamu tanpa akun dilewati -- tidak ada identitas permanen untuk
 * ditempelkan skornya.
 */

function newId(): string {
  return randomBytes(12).toString("base64url");
}

/** Satu pemain yang ikut sebuah room ketika room itu berakhir. */
export type RoomOutcomePlayer = {
  id: string;
  accountId?: string;
  guessCount: number;
};

/**
 * Mencatat hasil satu room yang baru saja selesai. Dipanggil sekali saja per
 * room, tepat saat status berubah jadi "finished" -- lihat lib/rooms.ts.
 */
export function recordRoomResult(input: {
  roomCode: string;
  winnerId: string;
  players: RoomOutcomePlayer[];
}): void {
  const insert = db().prepare(
    `INSERT INTO game_results (id, account_id, room_code, guess_count, won, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const now = Date.now();
  for (const player of input.players) {
    if (!player.accountId) continue; // tamu: tidak masuk papan peringkat
    insert.run(
      newId(),
      player.accountId,
      input.roomCode,
      player.guessCount,
      player.id === input.winnerId ? 1 : 0,
      now,
    );
  }
}

export type LeaderboardEntry = {
  profile: PublicProfile;
  wins: number;
  gamesPlayed: number;
  /** Rata-rata jumlah tebakan saat menang; null kalau belum pernah menang. */
  avgWinningGuesses: number | null;
};

const LEADERBOARD_LIMIT = 50;

type LeaderboardRow = AccountRow & {
  games_played: number;
  wins: number;
  avg_winning_guesses: number | null;
};

/**
 * Semua akun yang pernah main, terurut sama seperti papan peringkat --
 * dipakai bersama oleh topPlayers() (mengiris N teratas) dan playerStats()
 * (mencari posisi satu akun), supaya "peringkat pasti" di halaman statistik
 * selalu konsisten dengan urutan leaderboard tanpa menduplikasi tie-break.
 */
function allRanked(): LeaderboardRow[] {
  return db()
    .prepare(
      `SELECT a.*,
              COUNT(*) AS games_played,
              SUM(g.won) AS wins,
              AVG(CASE WHEN g.won = 1 THEN g.guess_count END) AS avg_winning_guesses
       FROM game_results g
       JOIN accounts a ON a.id = g.account_id
       GROUP BY g.account_id
       ORDER BY wins DESC, avg_winning_guesses ASC, games_played DESC`,
    )
    .all() as LeaderboardRow[];
}

function toEntry(row: LeaderboardRow): LeaderboardEntry {
  return {
    profile: toPublicProfile(toAccount(row)),
    wins: row.wins,
    gamesPlayed: row.games_played,
    avgWinningGuesses: row.avg_winning_guesses,
  };
}

/**
 * Pemain teratas berdasarkan jumlah kemenangan, dengan rata-rata jumlah
 * tebakan saat menang sebagai penentu seri -- makin sedikit tebakan, makin
 * jago, jadi lebih kecil lebih baik.
 */
export function topPlayers(limit = LEADERBOARD_LIMIT): LeaderboardEntry[] {
  return allRanked().slice(0, limit).map(toEntry);
}

export type CoinLeaderboardEntry = { profile: PublicProfile; coins: number };

/**
 * Pemain dengan Coin terbanyak. Beda dari topPlayers(): tidak butuh riwayat
 * game_results sama sekali -- coins ada di accounts, jadi akun yang hanya
 * pernah main sendiri (tanpa room) tetap bisa masuk papan ini. Akun yang
 * belum pernah punya Coin (masih 0) dilewati, sama seperti akun yang belum
 * pernah main dilewati di papan kemenangan.
 */
export function topPlayersByCoins(limit = LEADERBOARD_LIMIT): CoinLeaderboardEntry[] {
  const rows = db()
    .prepare(`SELECT * FROM accounts WHERE coins > 0 ORDER BY coins DESC LIMIT ?`)
    .all(limit) as (AccountRow & { coins: number })[];
  return rows.map((row) => ({ profile: toPublicProfile(toAccount(row)), coins: row.coins }));
}

export type LevelLeaderboardEntry = { profile: PublicProfile; xp: number };

/** Pemain dengan Level tertinggi, diurutkan dari total XP (lihat lib/xp.ts). */
export function topPlayersByXp(limit = LEADERBOARD_LIMIT): LevelLeaderboardEntry[] {
  const rows = db()
    .prepare(`SELECT * FROM accounts WHERE xp > 0 ORDER BY xp DESC LIMIT ?`)
    .all(limit) as (AccountRow & { xp: number })[];
  return rows.map((row) => ({ profile: toPublicProfile(toAccount(row)), xp: row.xp }));
}

export type PlayerStats = LeaderboardEntry & {
  losses: number;
  /** Persentase 0-1; null kalau belum pernah main. */
  winRate: number | null;
  /** Posisi di papan peringkat penuh (bukan cuma 50 besar); null kalau
   *  belum pernah menyelesaikan game. */
  rank: number | null;
  /** Kapan akun dibuat, untuk baris "Bergabung sejak" di halaman profil. */
  memberSince: number;
  /** Total XP -- publik seperti statistik lainnya, beda dari Coin yang privat.
   *  Levelnya sendiri diturunkan di sisi tampilan lewat lib/xp.ts. */
  xp: number;
};

/**
 * Statistik satu akun berdasarkan username, untuk halaman publik
 * /players/[username]. Beda dari topPlayers(): akun yang belum pernah main
 * tetap punya profil valid (gamesPlayed 0), bukan menghilang begitu saja
 * seperti pada JOIN leaderboard biasa.
 */
export function playerStats(username: string): PlayerStats | null {
  const account = findAccountByUsername(username);
  if (!account) return null;

  const row = db()
    .prepare(
      `SELECT COUNT(*) AS games_played, SUM(won) AS wins,
              AVG(CASE WHEN won = 1 THEN guess_count END) AS avg_winning_guesses
       FROM game_results WHERE account_id = ?`,
    )
    .get(account.id) as {
    games_played: number;
    wins: number | null;
    avg_winning_guesses: number | null;
  };

  const gamesPlayed = row.games_played;
  const wins = row.wins ?? 0;

  let rank: number | null = null;
  if (gamesPlayed > 0) {
    const idx = allRanked().findIndex((r) => r.id === account.id);
    rank = idx === -1 ? null : idx + 1;
  }

  return {
    profile: toPublicProfile(account),
    gamesPlayed,
    wins,
    losses: gamesPlayed - wins,
    winRate: gamesPlayed > 0 ? wins / gamesPlayed : null,
    avgWinningGuesses: row.avg_winning_guesses,
    rank,
    memberSince: account.createdAt,
    xp: xpBalance(account.id),
  };
}

export type RecentGame = {
  id: string;
  roomCode: string;
  won: boolean;
  guessCount: number;
  at: number;
};

const RECENT_GAMES_LIMIT = 10;

/** Riwayat game terakhir satu akun, terbaru dulu, untuk halaman statistik. */
export function recentGames(accountId: string, limit = RECENT_GAMES_LIMIT): RecentGame[] {
  const rows = db()
    .prepare(
      `SELECT id, room_code, won, guess_count, created_at FROM game_results
       WHERE account_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(accountId, limit) as {
    id: string;
    room_code: string;
    won: number;
    guess_count: number;
    created_at: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    roomCode: r.room_code,
    won: r.won === 1,
    guessCount: r.guess_count,
    at: r.created_at,
  }));
}
