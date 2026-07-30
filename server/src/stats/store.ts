import type { AvatarConfig, Leaderboard, LeaderboardEntry, PlayerStats } from '@shared/types.ts';
import { currentPuzzleDate } from '../game/words.ts';
import { getServiceClient } from '../db/client.ts';

interface StatsRow {
  profile_id: string;
  user_id: string | null;
  display_name: string | null;
  avatar: AvatarConfig | null;
  total_games: number;
  total_wins: number;
  total_guesses: number;
  best_guess_count: number | null;
  current_streak: number;
  longest_streak: number;
  last_played_date: string | null;
}

function toPlayerStats(row: StatsRow): PlayerStats {
  return {
    totalGames: row.total_games,
    totalWins: row.total_wins,
    totalGuesses: row.total_guesses,
    bestGuessCount: row.best_guess_count,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastPlayedDate: row.last_played_date,
  };
}

/** Verifikasi access token Supabase, kembalikan id pemain kalau valid. */
export async function verifyToken(token: string): Promise<string | null> {
  const client = getServiceClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

export async function getStats(profileId: string): Promise<PlayerStats | null> {
  const client = getServiceClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('player_stats')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle();
    if (error || !data) return null;
    return toPlayerStats(data as StatsRow);
  } catch {
    return null;
  }
}

/**
 * Dipanggil begitu satu ronde (solo atau ruang) selesai — untuk SEMUA
 * pemain, anonim maupun login, dikaitkan ke `profile.id` yang sama seperti
 * wallet coin. `meta.userId` cuma ditempel kalau pemain itu kebetulan
 * sedang login (bukan syarat) — dan `displayName`/`avatar` disegarkan tiap
 * kali diberikan, supaya leaderboard menampilkan nama/avatar terbaru.
 *
 * Selalu "best effort" — kegagalan di sini tidak boleh mengganggu jalannya
 * permainan, jadi semua error ditelan dan cuma dicatat ke log.
 */
export async function recordGameResult(
  profileId: string,
  outcome: { won: boolean; guessCount: number },
  meta?: { userId?: string | null; displayName?: string; avatar?: AvatarConfig },
): Promise<void> {
  const client = getServiceClient();
  if (!client) return;

  try {
    const { data: existing } = await client
      .from('player_stats')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle();

    const row: StatsRow = (existing as StatsRow | null) ?? {
      profile_id: profileId,
      user_id: null,
      display_name: null,
      avatar: null,
      total_games: 0,
      total_wins: 0,
      total_guesses: 0,
      best_guess_count: null,
      current_streak: 0,
      longest_streak: 0,
      last_played_date: null,
    };

    const today = currentPuzzleDate();
    const yesterday = currentPuzzleDate(new Date(Date.now() - 24 * 3600_000));

    let currentStreak = row.current_streak;
    if (row.last_played_date === today) {
      // Sudah tercatat main hari ini — streak tidak berubah lagi.
    } else if (row.last_played_date === yesterday) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }

    const bestGuessCount =
      outcome.won && (row.best_guess_count === null || outcome.guessCount < row.best_guess_count)
        ? outcome.guessCount
        : row.best_guess_count;

    const { error } = await client.from('player_stats').upsert({
      profile_id: profileId,
      user_id: meta?.userId ?? row.user_id,
      display_name: meta?.displayName ?? row.display_name,
      avatar: meta?.avatar ?? row.avatar,
      total_games: row.total_games + 1,
      total_wins: row.total_wins + (outcome.won ? 1 : 0),
      total_guesses: row.total_guesses + outcome.guessCount,
      best_guess_count: bestGuessCount,
      current_streak: currentStreak,
      longest_streak: Math.max(row.longest_streak, currentStreak),
      last_played_date: today,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error('recordGameResult: gagal upsert statistik:', error.message);
  } catch (err) {
    console.error('recordGameResult: gagal mencatat statistik:', err);
  }
}

export interface LinkedProfile {
  profileId: string;
  /** Nama/avatar TERSIMPAN milik akun ini — `null` kalau akun itu belum
   *  pernah menyimpan apa pun. Dipakai client memulihkan identitas akun,
   *  bukan sekadar mengikuti profil device saat ini. */
  displayName: string | null;
  avatar: AvatarConfig | null;
}

/**
 * Dipanggil begitu pemain login — menautkan profil perangkat ini ke akun.
 *
 * RPC `link_account_profile` (atomik di sisi database) menangani tiga
 * kasus: akun ini sudah pernah dipakai (gabung progres device KALAU device
 * ini masih murni tamu, atau langsung pindah ke profil kanonik kalau device
 * ini kebetulan sedang dipegang akun lain — progres akun lain itu tidak
 * boleh ikut tertarik), atau akun ini belum pernah dipakai sama sekali
 * (device tamu jadi miliknya, atau baris baru dibuat kalau device ini juga
 * sedang dipegang akun lain).
 *
 * Balikannya bukan cuma `profile_id` yang wajib dipakai client ke depan,
 * tapi juga `displayName`/`avatar` TERSIMPAN milik profil itu — supaya
 * client bisa memulihkan identitas akun ke UI, bukan cuma mengganti id
 * sambil tetap menampilkan nama/avatar device yang lama.
 *
 * Best-effort: kegagalan di sini tidak boleh menggagalkan proses login itu
 * sendiri, jadi profil ID asli dikembalikan apa adanya kalau terjadi error.
 */
export async function linkAccountProfile(
  userId: string,
  profileId: string,
  displayName?: string,
  avatar?: AvatarConfig,
): Promise<LinkedProfile> {
  const client = getServiceClient();
  const fallback: LinkedProfile = { profileId, displayName: null, avatar: null };
  if (!client) return fallback;
  try {
    const { data, error } = await client.rpc('link_account_profile', {
      p_user_id: userId,
      p_profile_id: profileId,
      p_display_name: displayName ?? null,
      p_avatar: avatar ?? null,
    });
    if (error) {
      console.error('linkAccountProfile: gagal menautkan profil:', error.message);
      return fallback;
    }
    const canonicalProfileId = (data as string | null) ?? profileId;

    const { data: row } = await client
      .from('player_stats')
      .select('display_name, avatar')
      .eq('profile_id', canonicalProfileId)
      .maybeSingle();

    return {
      profileId: canonicalProfileId,
      displayName: (row?.display_name as string | null | undefined) ?? null,
      avatar: (row?.avatar as AvatarConfig | null | undefined) ?? null,
    };
  } catch (err) {
    console.error('linkAccountProfile: gagal menautkan profil:', err);
    return fallback;
  }
}

const LEADERBOARD_LIMIT = 20;
const EMPTY_LEADERBOARD: Leaderboard = { coins: [], wins: [], streak: [], guesses: [] };

interface NamedStatsRow {
  profile_id: string;
  display_name: string | null;
  avatar: AvatarConfig | null;
  total_wins: number;
  longest_streak: number;
  total_guesses: number;
}

function toEntry(row: { display_name: string | null; avatar: AvatarConfig | null }, value: number): LeaderboardEntry {
  return { name: row.display_name ?? 'Pemain', avatar: row.avatar, value };
}

/**
 * Empat papan peringkat sekaligus. Coin (`wallets`) dan statistik
 * (`player_stats`) adalah tabel terpisah tanpa foreign key di antara
 * keduanya, jadi nama/avatar untuk papan coin diambil lewat query kedua
 * (`in profile_id`) alih-alih join otomatis PostgREST.
 */
export async function getLeaderboard(): Promise<Leaderboard> {
  const client = getServiceClient();
  if (!client) return EMPTY_LEADERBOARD;

  try {
    const [walletsRes, winsRes, streakRes, guessesRes] = await Promise.all([
      client
        .from('wallets')
        .select('profile_id, balance')
        .gt('balance', 0)
        .order('balance', { ascending: false })
        .limit(LEADERBOARD_LIMIT),
      client
        .from('player_stats')
        .select('profile_id, display_name, avatar, total_wins, longest_streak, total_guesses')
        .gt('total_wins', 0)
        .order('total_wins', { ascending: false })
        .limit(LEADERBOARD_LIMIT),
      client
        .from('player_stats')
        .select('profile_id, display_name, avatar, total_wins, longest_streak, total_guesses')
        .gt('longest_streak', 0)
        .order('longest_streak', { ascending: false })
        .limit(LEADERBOARD_LIMIT),
      client
        .from('player_stats')
        .select('profile_id, display_name, avatar, total_wins, longest_streak, total_guesses')
        .gt('total_guesses', 0)
        .order('total_guesses', { ascending: false })
        .limit(LEADERBOARD_LIMIT),
    ]);

    const walletRows = (walletsRes.data ?? []) as Array<{ profile_id: string; balance: number }>;
    let coins: LeaderboardEntry[] = [];
    if (walletRows.length > 0) {
      const { data: namesData } = await client
        .from('player_stats')
        .select('profile_id, display_name, avatar')
        .in(
          'profile_id',
          walletRows.map((w) => w.profile_id),
        );
      const byId = new Map(
        ((namesData ?? []) as Array<{ profile_id: string; display_name: string | null; avatar: AvatarConfig | null }>).map(
          (s) => [s.profile_id, s],
        ),
      );
      coins = walletRows.map((w) => {
        const found = byId.get(w.profile_id);
        return toEntry(found ?? { display_name: null, avatar: null }, w.balance);
      });
    }

    const wins = ((winsRes.data ?? []) as NamedStatsRow[]).map((r) => toEntry(r, r.total_wins));
    const streak = ((streakRes.data ?? []) as NamedStatsRow[]).map((r) => toEntry(r, r.longest_streak));
    const guesses = ((guessesRes.data ?? []) as NamedStatsRow[]).map((r) => toEntry(r, r.total_guesses));

    return { coins, wins, streak, guesses };
  } catch (err) {
    console.error('getLeaderboard: gagal mengambil data:', err);
    return EMPTY_LEADERBOARD;
  }
}
