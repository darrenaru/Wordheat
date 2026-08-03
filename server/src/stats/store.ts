import type {
  AvatarConfig,
  Leaderboard,
  LeaderboardEntry,
  PlayerStats,
  PublicProfile,
} from '@shared/types.ts';
import { currentPuzzleDate } from '../game/words.ts';
import { getServiceClient } from '../db/client.ts';
import { getPresenceWithStoredLastSeen } from '../realtime/presence.ts';
import { ensureUsername } from '../social/store.ts';

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
  xp: number;
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
    xp: row.xp,
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
 * Increment (total_games/total_wins/xp/dst) dilakukan ATOMIC di database
 * lewat RPC `record_game_result` (satu statement `INSERT ... ON CONFLICT
 * DO UPDATE` yang membaca nilai lama dan menulis nilai baru dalam operasi
 * yang sama) — BUKAN fetch-lalu-upsert di sini. Pemain bisa punya sesi solo
 * di satu tab dan ruang aktif di tab lain sekaligus, jadi dua pemanggilan
 * fungsi ini untuk `profileId` yang sama bisa betul-betul bersamaan; fetch-
 * lalu-upsert di kode aplikasi akan membuat salah satu hasilnya (XP/menang/
 * streak) hilang diam-diam kalau keduanya membaca nilai lama yang sama
 * sebelum salah satunya sempat menulis.
 *
 * Selalu "best effort" — kegagalan di sini tidak boleh mengganggu jalannya
 * permainan, jadi semua error ditelan dan cuma dicatat ke log.
 */
export async function recordGameResult(
  profileId: string,
  outcome: { won: boolean; guessCount: number; xpEarned?: number },
  meta?: { userId?: string | null; displayName?: string; avatar?: AvatarConfig },
): Promise<void> {
  const client = getServiceClient();
  if (!client) return;

  try {
    const today = currentPuzzleDate();
    const yesterday = currentPuzzleDate(new Date(Date.now() - 24 * 3600_000));

    const { error } = await client.rpc('record_game_result', {
      p_profile_id: profileId,
      p_user_id: meta?.userId ?? null,
      p_display_name: meta?.displayName ?? null,
      p_avatar: meta?.avatar ?? null,
      p_won: outcome.won,
      p_guess_count: outcome.guessCount,
      p_xp_earned: outcome.xpEarned ?? 0,
      p_today: today,
      p_yesterday: yesterday,
    });
    if (error) {
      console.error('recordGameResult: gagal mencatat statistik:', error.message);
      return;
    }
    // Best-effort, no-op kalau username sudah ada — lihat `ensureUsername`.
    // Dipanggil tanpa syarat (bukan cuma saat baris baru) karena RPC di atas
    // tidak melaporkan balik apakah barisnya baru dibuat atau sudah ada.
    await ensureUsername(profileId);
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
 * Ringkasan profil kanonik akun Google yang SUDAH punya progres di
 * device/sesi lain — dipakai menyusun prompt konfirmasi "Kesalahan Fatal"
 * (lihat `peekAccountLink`) sebelum progres tamu di device ini dibuang.
 */
export interface AccountLinkConflict {
  displayName: string;
  avatar: AvatarConfig | null;
  xp: number;
  totalWins: number;
}

/**
 * Dipanggil SEBELUM `linkAccountProfile` tiap kali pemain mencoba login —
 * murni baca, tidak pernah menulis apa pun. Mengembalikan `null` kalau
 * aman langsung lanjut ke `linkAccountProfile` (akun ini belum pernah
 * dipakai, device ini sudah jadi profil akun ini, atau device ini sudah
 * dimiliki akun LAIN — kasus terakhir tetap silent-switch, tidak ada
 * progres tamu yang bakal dibuang). Mengembalikan ringkasan profil
 * kanonik kalau akun Google ini SUDAH punya progres tersimpan di
 * device/sesi lain DAN device saat ini masih tamu murni — di titik ini
 * caller (`POST /account/link`) wajib menampilkan prompt konfirmasi ke
 * pemain dulu, BUKAN langsung memanggil `linkAccountProfile` (yang kalau
 * dilanjutkan akan membuang progres tamu di device ini, lihat komentar
 * di RPC `link_account_profile`).
 */
export async function peekAccountLink(
  userId: string,
  profileId: string,
): Promise<AccountLinkConflict | null> {
  const client = getServiceClient();
  if (!client) return null;
  try {
    const { data, error } = await client.rpc('peek_account_link', {
      p_user_id: userId,
      p_profile_id: profileId,
    });
    if (error || !data) return null;
    const row = data as { displayName: string; avatar: AvatarConfig | null; xp: number; totalWins: number };
    return { displayName: row.displayName, avatar: row.avatar, xp: row.xp, totalWins: row.totalWins };
  } catch (err) {
    console.error('peekAccountLink: gagal memeriksa konflik akun:', err);
    return null;
  }
}

/**
 * Dipanggil begitu pemain login (dan, kalau `peekAccountLink` sebelumnya
 * melaporkan konflik, SETELAH pemain menyetujui prompt konfirmasi) —
 * menautkan profil perangkat ini ke akun.
 *
 * RPC `link_account_profile` (atomik di sisi database) menangani tiga
 * kasus: akun ini sudah pernah dipakai (progres tamu di device ini
 * DIBUANG lalu dipindah ke profil kanonik KALAU device ini masih murni
 * tamu — pemain sudah menyetujui ini lewat prompt sebelumnya; atau
 * langsung pindah ke profil kanonik tanpa membuang apa pun kalau device
 * ini kebetulan sedang dipegang akun lain, progres akun lain itu tidak
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

    // Login (lewat RPC di atas) juga bisa jadi titik pertama kali baris
    // `player_stats` profil ini benar-benar ada — pastikan langsung punya
    // username, jangan dibiarkan `null`. Jarang dipanggil dibanding
    // `recordGameResult`, jadi aman tidak dikondisikan cuma untuk baris
    // baru — no-op kalau username sudah ada.
    await ensureUsername(canonicalProfileId);

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
const EMPTY_LEADERBOARD: Leaderboard = { coins: [], wins: [], streak: [], guesses: [], xp: [] };

interface NamedStatsRow {
  profile_id: string;
  display_name: string | null;
  avatar: AvatarConfig | null;
  total_wins: number;
  longest_streak: number;
  total_guesses: number;
  xp: number;
}

function toEntry(
  profileId: string,
  row: { display_name: string | null; avatar: AvatarConfig | null; total_wins?: number },
  value: number,
): LeaderboardEntry {
  return {
    profileId,
    name: row.display_name ?? 'Pemain',
    avatar: row.avatar,
    value,
    totalWins: row.total_wins ?? 0,
  };
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
    const [walletsRes, winsRes, streakRes, guessesRes, xpRes] = await Promise.all([
      client
        .from('wallets')
        .select('profile_id, balance')
        .gt('balance', 0)
        .order('balance', { ascending: false })
        .limit(LEADERBOARD_LIMIT),
      client
        .from('player_stats')
        .select('profile_id, display_name, avatar, total_wins, longest_streak, total_guesses, xp')
        .gt('total_wins', 0)
        .order('total_wins', { ascending: false })
        .limit(LEADERBOARD_LIMIT),
      client
        .from('player_stats')
        .select('profile_id, display_name, avatar, total_wins, longest_streak, total_guesses, xp')
        .gt('longest_streak', 0)
        .order('longest_streak', { ascending: false })
        .limit(LEADERBOARD_LIMIT),
      client
        .from('player_stats')
        .select('profile_id, display_name, avatar, total_wins, longest_streak, total_guesses, xp')
        .gt('total_guesses', 0)
        .order('total_guesses', { ascending: false })
        .limit(LEADERBOARD_LIMIT),
      client
        .from('player_stats')
        .select('profile_id, display_name, avatar, total_wins, longest_streak, total_guesses, xp')
        .gt('xp', 0)
        .order('xp', { ascending: false })
        .limit(LEADERBOARD_LIMIT),
    ]);

    const walletRows = (walletsRes.data ?? []) as Array<{ profile_id: string; balance: number }>;
    let coins: LeaderboardEntry[] = [];
    if (walletRows.length > 0) {
      const { data: namesData } = await client
        .from('player_stats')
        .select('profile_id, display_name, avatar, total_wins')
        .in(
          'profile_id',
          walletRows.map((w) => w.profile_id),
        );
      const byId = new Map(
        (
          (namesData ?? []) as Array<{
            profile_id: string;
            display_name: string | null;
            avatar: AvatarConfig | null;
            total_wins: number;
          }>
        ).map((s) => [s.profile_id, s]),
      );
      coins = walletRows.map((w) => {
        const found = byId.get(w.profile_id);
        return toEntry(
          w.profile_id,
          found ?? { display_name: null, avatar: null, total_wins: 0 },
          w.balance,
        );
      });
    }

    const wins = ((winsRes.data ?? []) as NamedStatsRow[]).map((r) => toEntry(r.profile_id, r, r.total_wins));
    const streak = ((streakRes.data ?? []) as NamedStatsRow[]).map((r) =>
      toEntry(r.profile_id, r, r.longest_streak),
    );
    const guesses = ((guessesRes.data ?? []) as NamedStatsRow[]).map((r) =>
      toEntry(r.profile_id, r, r.total_guesses),
    );
    const xp = ((xpRes.data ?? []) as NamedStatsRow[]).map((r) => toEntry(r.profile_id, r, r.xp));

    return { coins, wins, streak, guesses, xp };
  } catch (err) {
    console.error('getLeaderboard: gagal mengambil data:', err);
    return EMPTY_LEADERBOARD;
  }
}

interface PublicProfileRow {
  profile_id: string;
  display_name: string | null;
  avatar: AvatarConfig | null;
  username: string | null;
  bio: string | null;
  total_games: number;
  total_wins: number;
  total_guesses: number;
  best_guess_count: number | null;
  current_streak: number;
  longest_streak: number;
  last_played_date: string | null;
  xp: number;
  last_seen_at: string | null;
}

/**
 * Profil publik pemain lain — dibuka dari Leaderboard. Sumbernya baris
 * `player_stats` yang sama seperti statistik/username/bio sendiri, cuma
 * kolom yang boleh publik yang dipilih (tanpa `user_id`,
 * `username_changed_at`, dst.).
 */
export async function getPublicProfile(profileId: string): Promise<PublicProfile | null> {
  const client = getServiceClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('player_stats')
      .select(
        'profile_id, display_name, avatar, username, bio, total_games, total_wins, total_guesses, best_guess_count, current_streak, longest_streak, last_played_date, xp, last_seen_at',
      )
      .eq('profile_id', profileId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as PublicProfileRow;
    return {
      profileId: row.profile_id,
      displayName: row.display_name ?? 'Pemain',
      username: row.username,
      avatar: row.avatar,
      bio: row.bio,
      presence: getPresenceWithStoredLastSeen(row.profile_id, row.last_seen_at),
      stats: {
        totalGames: row.total_games,
        totalWins: row.total_wins,
        totalGuesses: row.total_guesses,
        bestGuessCount: row.best_guess_count,
        currentStreak: row.current_streak,
        longestStreak: row.longest_streak,
        lastPlayedDate: row.last_played_date,
        xp: row.xp,
      },
    };
  } catch (err) {
    console.error('getPublicProfile: gagal mengambil profil:', err);
    return null;
  }
}
