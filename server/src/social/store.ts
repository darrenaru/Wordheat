import type {
  AvatarConfig,
  FriendRequestSummary,
  FriendSummary,
  UserSummary,
} from '@shared/types.ts';
import { getServiceClient } from '../db/client.ts';

/** 3-20 karakter, harus diawali huruf, sisanya huruf/angka/underscore. */
const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

interface StatsRow {
  profile_id: string;
  user_id: string | null;
  display_name: string | null;
  avatar: AvatarConfig | null;
  username: string | null;
  total_games: number;
  total_wins: number;
  total_guesses: number;
  best_guess_count: number | null;
  current_streak: number;
  longest_streak: number;
  last_played_date: string | null;
}

interface UserRow {
  profile_id: string;
  username: string | null;
  display_name: string | null;
  avatar: AvatarConfig | null;
}

function toUserSummary(row: UserRow): UserSummary {
  return {
    profileId: row.profile_id,
    username: row.username ?? '',
    displayName: row.display_name ?? 'Pemain',
    avatar: row.avatar,
  };
}

export type SetUsernameResult = { ok: true } | { ok: false; code: 'invalid' | 'taken' };

/**
 * Set/ganti username sendiri. Fetch-lalu-upsert baris `player_stats` penuh
 * (pola sama seperti `recordGameResult` di `stats/store.ts`) supaya kolom
 * lain (statistik, avatar, dst) tidak ikut ter-null-kan oleh upsert parsial.
 * Ini sekaligus menjamin baris `player_stats` pemain ada — prasyarat untuk
 * foreign key `friendships` sebelum dia bisa berteman.
 */
export async function setUsername(
  profileId: string,
  rawUsername: string,
  meta?: { displayName?: string; avatar?: AvatarConfig },
): Promise<SetUsernameResult> {
  const username = rawUsername.trim();
  if (!USERNAME_PATTERN.test(username)) return { ok: false, code: 'invalid' };

  const client = getServiceClient();
  if (!client) return { ok: false, code: 'invalid' };

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
      username: null,
      total_games: 0,
      total_wins: 0,
      total_guesses: 0,
      best_guess_count: null,
      current_streak: 0,
      longest_streak: 0,
      last_played_date: null,
    };

    const { error } = await client.from('player_stats').upsert({
      ...row,
      username,
      // Baris `player_stats` cuma disegarkan lewat sesi permainan atau login
      // (`recordGameResult`/`linkAccountProfile`) — pemain yang baru mengatur
      // username sebelum pernah main tidak akan punya nama/avatar di sini
      // sama sekali kalau tidak ikut disegarkan di titik ini juga.
      display_name: meta?.displayName ?? row.display_name,
      avatar: meta?.avatar ?? row.avatar,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      if (error.code === '23505') return { ok: false, code: 'taken' };
      console.error('setUsername: gagal menyimpan username:', error.message);
      return { ok: false, code: 'invalid' };
    }
    return { ok: true };
  } catch (err) {
    console.error('setUsername: gagal menyimpan username:', err);
    return { ok: false, code: 'invalid' };
  }
}

export async function getUsername(profileId: string): Promise<string | null> {
  const client = getServiceClient();
  if (!client) return null;
  try {
    const { data } = await client
      .from('player_stats')
      .select('username')
      .eq('profile_id', profileId)
      .maybeSingle();
    return (data?.username as string | null | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Cari lewat awalan username. Cuma pemain yang sudah mengatur username
 *  sendiri yang bisa ketemu — `ilike` otomatis tidak mencocokkan NULL. */
export async function searchUsers(query: string, excludeProfileId: string): Promise<UserSummary[]> {
  const client = getServiceClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from('player_stats')
      .select('profile_id, username, display_name, avatar')
      .ilike('username', `${query}%`)
      .neq('profile_id', excludeProfileId)
      .limit(10);
    if (error || !data) return [];
    return (data as UserRow[]).map(toUserSummary);
  } catch {
    return [];
  }
}

export type FriendActionResult = { ok: true } | { ok: false; code: string; message: string };

const UNAVAILABLE: FriendActionResult = {
  ok: false,
  code: 'unavailable',
  message: 'Fitur pertemanan sedang tidak tersedia.',
};

export async function sendFriendRequest(
  fromProfileId: string,
  toProfileId: string,
): Promise<FriendActionResult> {
  if (fromProfileId === toProfileId) {
    return { ok: false, code: 'invalid', message: 'Tidak bisa menambahkan diri sendiri.' };
  }
  const client = getServiceClient();
  if (!client) return UNAVAILABLE;
  try {
    const { error } = await client.from('friendships').insert({
      requester_id: fromProfileId,
      addressee_id: toProfileId,
    });
    if (error) {
      if (error.code === '23505') {
        return {
          ok: false,
          code: 'already_pending_or_friends',
          message: 'Sudah berteman atau permintaan masih menunggu.',
        };
      }
      if (error.code === '23503') {
        return { ok: false, code: 'not_found', message: 'Pemain tidak ditemukan.' };
      }
      console.error('sendFriendRequest: gagal mengirim permintaan:', error.message);
      return { ok: false, code: 'invalid', message: 'Gagal mengirim permintaan.' };
    }
    return { ok: true };
  } catch (err) {
    console.error('sendFriendRequest: gagal mengirim permintaan:', err);
    return { ok: false, code: 'invalid', message: 'Gagal mengirim permintaan.' };
  }
}

export async function respondToFriendRequest(
  profileId: string,
  friendshipId: string,
  accept: boolean,
): Promise<FriendActionResult> {
  const client = getServiceClient();
  if (!client) return UNAVAILABLE;
  try {
    const query = accept
      ? client
          .from('friendships')
          .update({ status: 'accepted', responded_at: new Date().toISOString() })
          .eq('id', friendshipId)
          .eq('addressee_id', profileId)
          .eq('status', 'pending')
          .select('id')
      : client
          .from('friendships')
          .delete()
          .eq('id', friendshipId)
          .eq('addressee_id', profileId)
          .eq('status', 'pending')
          .select('id');
    const { data, error } = await query;
    if (error) {
      console.error('respondToFriendRequest: gagal merespons:', error.message);
      return { ok: false, code: 'invalid', message: 'Gagal merespons permintaan.' };
    }
    if (!data || data.length === 0) {
      return { ok: false, code: 'not_found', message: 'Permintaan tidak ditemukan.' };
    }
    return { ok: true };
  } catch (err) {
    console.error('respondToFriendRequest: gagal merespons:', err);
    return { ok: false, code: 'invalid', message: 'Gagal merespons permintaan.' };
  }
}

/**
 * Menutup tiga kasus sekaligus (batalkan permintaan keluar, tolak lewat rute
 * lain sudah dipakai `respondToFriendRequest`, hapus pertemanan yang sudah
 * diterima) — pemanggil boleh salah satu pihak, bukan cuma `addressee`.
 * Dua query terpisah (bukan `.or()` dengan interpolasi string) supaya
 * `profileId` dari header pemain tidak pernah dianggap sebagai fragmen
 * sintaks filter PostgREST.
 */
export async function removeFriendship(
  profileId: string,
  friendshipId: string,
): Promise<FriendActionResult> {
  const client = getServiceClient();
  if (!client) return UNAVAILABLE;
  try {
    const asRequester = await client
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .eq('requester_id', profileId)
      .select('id');
    if (asRequester.error) {
      console.error('removeFriendship: gagal menghapus:', asRequester.error.message);
      return { ok: false, code: 'invalid', message: 'Gagal menghapus.' };
    }
    if (asRequester.data && asRequester.data.length > 0) return { ok: true };

    const asAddressee = await client
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
      .eq('addressee_id', profileId)
      .select('id');
    if (asAddressee.error) {
      console.error('removeFriendship: gagal menghapus:', asAddressee.error.message);
      return { ok: false, code: 'invalid', message: 'Gagal menghapus.' };
    }
    if (!asAddressee.data || asAddressee.data.length === 0) {
      return { ok: false, code: 'not_found', message: 'Tidak ditemukan.' };
    }
    return { ok: true };
  } catch (err) {
    console.error('removeFriendship: gagal menghapus:', err);
    return { ok: false, code: 'invalid', message: 'Gagal menghapus.' };
  }
}

export async function areFriends(profileIdA: string, profileIdB: string): Promise<boolean> {
  const client = getServiceClient();
  if (!client) return false;
  try {
    const [ab, ba] = await Promise.all([
      client
        .from('friendships')
        .select('id')
        .eq('requester_id', profileIdA)
        .eq('addressee_id', profileIdB)
        .eq('status', 'accepted')
        .maybeSingle(),
      client
        .from('friendships')
        .select('id')
        .eq('requester_id', profileIdB)
        .eq('addressee_id', profileIdA)
        .eq('status', 'accepted')
        .maybeSingle(),
    ]);
    return Boolean(ab.data || ba.data);
  } catch {
    return false;
  }
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
}

export interface FriendsAndRequests {
  friends: FriendSummary[];
  incoming: FriendRequestSummary[];
  outgoing: FriendRequestSummary[];
}

const EMPTY_FRIENDS: FriendsAndRequests = { friends: [], incoming: [], outgoing: [] };

/**
 * Teman (accepted) + permintaan masuk/keluar (pending) untuk satu pemain.
 * Dua query terpisah (sebagai requester, sebagai addressee) alih-alih
 * `.or()` dengan interpolasi string — lihat komentar `removeFriendship`.
 */
export async function listFriends(profileId: string): Promise<FriendsAndRequests> {
  const client = getServiceClient();
  if (!client) return EMPTY_FRIENDS;
  try {
    const [asRequester, asAddressee] = await Promise.all([
      client
        .from('friendships')
        .select('id, requester_id, addressee_id, status, created_at')
        .eq('requester_id', profileId),
      client
        .from('friendships')
        .select('id, requester_id, addressee_id, status, created_at')
        .eq('addressee_id', profileId),
    ]);
    const rows = [
      ...((asRequester.data ?? []) as FriendshipRow[]),
      ...((asAddressee.data ?? []) as FriendshipRow[]),
    ];
    if (rows.length === 0) return EMPTY_FRIENDS;

    const otherIds = new Set(
      rows.map((row) => (row.requester_id === profileId ? row.addressee_id : row.requester_id)),
    );
    const { data: users } = await client
      .from('player_stats')
      .select('profile_id, username, display_name, avatar')
      .in('profile_id', [...otherIds]);
    const usersById = new Map((users as UserRow[] | null ?? []).map((u) => [u.profile_id, toUserSummary(u)]));

    const friends: FriendSummary[] = [];
    const incoming: FriendRequestSummary[] = [];
    const outgoing: FriendRequestSummary[] = [];
    for (const row of rows) {
      const otherId = row.requester_id === profileId ? row.addressee_id : row.requester_id;
      const user = usersById.get(otherId);
      if (!user) continue; // seharusnya selalu ada, dijamin foreign key
      const createdAt = new Date(row.created_at).getTime();
      if (row.status === 'accepted') {
        friends.push({ friendshipId: row.id, user });
      } else if (row.addressee_id === profileId) {
        incoming.push({ id: row.id, user, createdAt });
      } else {
        outgoing.push({ id: row.id, user, createdAt });
      }
    }
    return { friends, incoming, outgoing };
  } catch (err) {
    console.error('listFriends: gagal memuat daftar teman:', err);
    return EMPTY_FRIENDS;
  }
}
