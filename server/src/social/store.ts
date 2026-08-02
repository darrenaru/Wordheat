import type {
  AvatarConfig,
  FriendRequestSummary,
  FriendSummary,
  UserSummary,
} from '@shared/types.ts';
import { getServiceClient } from '../db/client.ts';
import { getPresenceWithStoredLastSeen } from '../realtime/presence.ts';

/** 3-20 karakter, harus diawali huruf, sisanya huruf/angka/underscore. */
const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

/** Username cuma bisa DIGANTI tiap 7 hari sekali — klaim pertama kali
 *  (dari belum punya sama sekali) selalu bebas, cooldown baru berlaku
 *  mulai perubahan berikutnya. */
const USERNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Bahan generator username acak — masing-masing ≤7 karakter supaya
 *  gabungan Adjective+Noun+4 digit selalu jauh di bawah batas 20 karakter
 *  `USERNAME_PATTERN`. */
const USERNAME_ADJECTIVES = [
  'Swift', 'Brave', 'Silent', 'Clever', 'Lucky', 'Bold', 'Quiet', 'Fierce',
  'Nimble', 'Wild', 'Happy', 'Sunny', 'Chill', 'Sharp', 'Cosmic', 'Mighty',
  'Gentle', 'Rapid', 'Crimson', 'Golden',
];
const USERNAME_NOUNS = [
  'Fox', 'Wolf', 'Hawk', 'Bear', 'Tiger', 'Raven', 'Otter', 'Lynx',
  'Falcon', 'Panda', 'Eagle', 'Shark', 'Rabbit', 'Turtle', 'Dragon',
  'Phoenix', 'Comet', 'Storm', 'Ember', 'Nova',
];

function randomUsername(): string {
  const adjective = USERNAME_ADJECTIVES[Math.floor(Math.random() * USERNAME_ADJECTIVES.length)];
  const noun = USERNAME_NOUNS[Math.floor(Math.random() * USERNAME_NOUNS.length)];
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${adjective}${noun}${suffix}`;
}

const RANDOM_USERNAME_ATTEMPTS = 5;

/**
 * Isi username acak kalau profil ini belum punya — dipanggil best-effort
 * begitu profil ini pertama kali disentuh (main pertama kali, login
 * pertama kali, ATAU sekadar membuka Profil Saya sebagai Guest yang belum
 * pernah main — lihat `GET /username` di `http/api.ts`), supaya SEMUA
 * pemain punya username (dipakai Add Friend) tanpa perlu mengaturnya
 * sendiri dulu — Guest sendiri memang sengaja tidak boleh mengatur
 * username sendiri (lihat `POST /username`), jadi ini satu-satunya cara
 * dia punya username sama sekali.
 *
 * Baris `player_stats` boleh belum ada sama sekali di titik ini (Guest
 * yang baru buka Profil Saya sebelum pernah main) — makanya di sini
 * fetch-lalu-upsert baris PENUH (pola sama seperti `setUsername`/`setBio`
 * di bawah), bukan `UPDATE ... WHERE username IS NULL` (yang cuma
 * menyentuh baris yang SUDAH ada, jadi tidak berbuat apa-apa untuk Guest
 * yang barisnya belum tercipta).
 *
 * Konflik `profile_id` sendiri tidak mungkin memicu error di sini — upsert
 * meng-update baris yang sudah ada lewat primary key itu, bukan menolaknya
 * — jadi satu-satunya sumber error `23505` yang mungkin muncul adalah
 * tabrakan kandidat username dengan pemain lain, aman dicoba ulang dengan
 * kandidat baru.
 *
 * SENGAJA tidak menyentuh `username_changed_at`: supaya saat pemain nanti
 * mengganti username acak ini dengan pilihannya sendiri, itu tetap
 * dihitung "klaim pertama" yang bebas cooldown (lihat `setUsername`).
 *
 * Kolom `username` sengaja TETAP nullable (tidak di-`NOT NULL`-kan) —
 * kegagalan di sini (mis. kolisi beruntun) tidak boleh menggagalkan
 * pemanggilnya, jadi semua error ditelan setelah percobaan habis.
 */
export async function ensureUsername(profileId: string): Promise<void> {
  const client = getServiceClient();
  if (!client) return;
  try {
    const { data: existing } = await client
      .from('player_stats')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle();
    if ((existing as StatsRow | null)?.username) return;

    const row: StatsRow = (existing as StatsRow | null) ?? {
      profile_id: profileId,
      user_id: null,
      display_name: null,
      avatar: null,
      username: null,
      username_changed_at: null,
      bio: null,
      xp: 0,
      total_games: 0,
      total_wins: 0,
      total_guesses: 0,
      best_guess_count: null,
      current_streak: 0,
      longest_streak: 0,
      last_played_date: null,
    };

    for (let attempt = 0; attempt < RANDOM_USERNAME_ATTEMPTS; attempt++) {
      const { error } = await client.from('player_stats').upsert({
        ...row,
        username: randomUsername(),
        updated_at: new Date().toISOString(),
      });
      if (!error) return;
      if (error.code !== '23505') {
        console.error('ensureUsername: gagal mengisi username acak:', error.message);
        return;
      }
      // 23505: kandidat itu sudah dipakai pemain lain — coba kandidat lain.
    }
  } catch (err) {
    console.error('ensureUsername: gagal mengisi username acak:', err);
  }
}

interface StatsRow {
  profile_id: string;
  user_id: string | null;
  display_name: string | null;
  avatar: AvatarConfig | null;
  username: string | null;
  username_changed_at: string | null;
  bio: string | null;
  xp: number;
  total_games: number;
  total_wins: number;
  total_guesses: number;
  best_guess_count: number | null;
  current_streak: number;
  longest_streak: number;
  last_played_date: string | null;
}

/** Bio bebas diganti kapan saja (bukan identitas unik seperti username),
 *  jadi tidak ada cooldown — cukup batasi panjangnya. */
const BIO_MAX_LENGTH = 140;

/** `null` kalau boleh diganti sekarang, atau ISO timestamp kapan boleh lagi. */
function changeableAtFrom(usernameChangedAt: string | null): string | null {
  if (!usernameChangedAt) return null;
  const changeableAt = new Date(usernameChangedAt).getTime() + USERNAME_COOLDOWN_MS;
  return changeableAt > Date.now() ? new Date(changeableAt).toISOString() : null;
}

interface UserRow {
  profile_id: string;
  username: string | null;
  display_name: string | null;
  avatar: AvatarConfig | null;
  last_seen_at: string | null;
}

function toUserSummary(row: UserRow): UserSummary {
  return {
    profileId: row.profile_id,
    username: row.username ?? '',
    displayName: row.display_name ?? 'Pemain',
    avatar: row.avatar,
    presence: getPresenceWithStoredLastSeen(row.profile_id, row.last_seen_at),
  };
}

export type SetUsernameResult =
  | { ok: true }
  | { ok: false; code: 'invalid' | 'taken' }
  | { ok: false; code: 'cooldown'; changeableAt: string };

/**
 * Set/ganti username sendiri. Fetch-lalu-upsert baris `player_stats` penuh
 * (pola sama seperti `recordGameResult` di `stats/store.ts`) supaya kolom
 * lain (statistik, avatar, dst) tidak ikut ter-null-kan oleh upsert parsial.
 * Ini sekaligus menjamin baris `player_stats` pemain ada — prasyarat untuk
 * foreign key `friendships` sebelum dia bisa berteman.
 *
 * Klaim pertama kali (belum pernah punya username) selalu bebas — cooldown
 * 7 hari cuma berlaku begitu pemain sudah punya username dan MENGGANTINYA
 * jadi nilai yang berbeda.
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
      username_changed_at: null,
      bio: null,
      xp: 0,
      total_games: 0,
      total_wins: 0,
      total_guesses: 0,
      best_guess_count: null,
      current_streak: 0,
      longest_streak: 0,
      last_played_date: null,
    };

    const isRealChange = (row.username ?? '').toLowerCase() !== username.toLowerCase();
    if (isRealChange && row.username !== null) {
      const changeableAt = changeableAtFrom(row.username_changed_at);
      if (changeableAt) return { ok: false, code: 'cooldown', changeableAt };
    }

    const { error } = await client.from('player_stats').upsert({
      ...row,
      username,
      username_changed_at: isRealChange ? new Date().toISOString() : row.username_changed_at,
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

export async function getUsername(
  profileId: string,
): Promise<{ username: string | null; changeableAt: string | null }> {
  const client = getServiceClient();
  if (!client) return { username: null, changeableAt: null };
  try {
    const { data } = await client
      .from('player_stats')
      .select('username, username_changed_at')
      .eq('profile_id', profileId)
      .maybeSingle();
    return {
      username: (data?.username as string | null | undefined) ?? null,
      changeableAt: changeableAtFrom((data?.username_changed_at as string | null | undefined) ?? null),
    };
  } catch {
    return { username: null, changeableAt: null };
  }
}

export type SetBioResult = { ok: true } | { ok: false; code: 'invalid' };

/**
 * Set/ganti bio sendiri. Fetch-lalu-upsert baris penuh — pola sama seperti
 * `setUsername` di atas, supaya kolom lain tidak ikut ter-null-kan.
 */
export async function setBio(
  profileId: string,
  rawBio: string,
  meta?: { displayName?: string; avatar?: AvatarConfig },
): Promise<SetBioResult> {
  const bio = rawBio.trim().slice(0, BIO_MAX_LENGTH);

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
      username_changed_at: null,
      bio: null,
      xp: 0,
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
      bio: bio || null,
      display_name: meta?.displayName ?? row.display_name,
      avatar: meta?.avatar ?? row.avatar,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error('setBio: gagal menyimpan bio:', error.message);
      return { ok: false, code: 'invalid' };
    }
    return { ok: true };
  } catch (err) {
    console.error('setBio: gagal menyimpan bio:', err);
    return { ok: false, code: 'invalid' };
  }
}

export type SetDisplayProfileResult = { ok: true } | { ok: false; code: 'invalid' };

/**
 * Set/ganti Display Name + avatar sendiri (tombol "Simpan" di Profil
 * Saya). Fetch-lalu-upsert baris penuh — pola sama seperti `setUsername`/
 * `setBio` di atas. Tanpa endpoint ini, perubahan Display Name/avatar cuma
 * tersimpan di localStorage perangkat — begitu pemain login Google
 * sebelum sempat main lagi, RPC `link_account_profile` akan mempertahankan
 * `display_name` LAMA yang masih tersimpan di server (`coalesce`), bukan
 * yang baru saja diketik.
 */
export async function setDisplayProfile(
  profileId: string,
  rawDisplayName: string,
  avatar: AvatarConfig,
): Promise<SetDisplayProfileResult> {
  const displayName = rawDisplayName.trim().slice(0, 32) || 'Pemain';

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
      username_changed_at: null,
      bio: null,
      xp: 0,
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
      display_name: displayName,
      avatar,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error('setDisplayProfile: gagal menyimpan profil:', error.message);
      return { ok: false, code: 'invalid' };
    }
    return { ok: true };
  } catch (err) {
    console.error('setDisplayProfile: gagal menyimpan profil:', err);
    return { ok: false, code: 'invalid' };
  }
}

export async function getBio(profileId: string): Promise<{ bio: string | null }> {
  const client = getServiceClient();
  if (!client) return { bio: null };
  try {
    const { data } = await client
      .from('player_stats')
      .select('bio')
      .eq('profile_id', profileId)
      .maybeSingle();
    return { bio: (data?.bio as string | null | undefined) ?? null };
  } catch {
    return { bio: null };
  }
}

/** Cari lewat kecocokan di MANA SAJA dalam username (bukan cuma awalan) —
 *  username auto-generate (pola `AdjectiveNoun1234`, lihat `ensureUsername`)
 *  wajar dicari lewat kata di tengahnya juga (mis. "fox" untuk
 *  "SwiftFox4821"). Semua pemain punya username (diisi otomatis lewat
 *  `ensureUsername`) jadi `ilike` di sini selalu bisa menemukan siapa pun
 *  yang sudah pernah membuka Profil Saya atau main sekali. */
export async function searchUsers(query: string, excludeProfileId: string): Promise<UserSummary[]> {
  const client = getServiceClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from('player_stats')
      .select('profile_id, username, display_name, avatar, last_seen_at')
      .ilike('username', `%${query}%`)
      .neq('profile_id', excludeProfileId)
      .limit(10);
    if (error || !data) return [];
    return (data as UserRow[]).map(toUserSummary);
  } catch {
    return [];
  }
}

export type FriendActionResult = { ok: true } | { ok: false; code: string; message: string };

/** Sengaja TANPA anotasi `FriendActionResult` — cabang `ok:false`-nya
 *  dipakai ulang oleh `sendFriendRequest` juga (`SendFriendRequestResult`,
 *  yang cabang `ok:true`-nya beda bentuk, punya `id`), jadi bentuknya
 *  dibiarkan disimpulkan TypeScript supaya cocok dengan keduanya. */
const UNAVAILABLE = {
  ok: false as const,
  code: 'unavailable',
  message: 'Fitur pertemanan sedang tidak tersedia.',
};

export type SendFriendRequestResult =
  | { ok: true; id: string }
  | { ok: false; code: string; message: string };

export async function sendFriendRequest(
  fromProfileId: string,
  toProfileId: string,
): Promise<SendFriendRequestResult> {
  if (fromProfileId === toProfileId) {
    return { ok: false, code: 'invalid', message: 'Tidak bisa menambahkan diri sendiri.' };
  }
  const client = getServiceClient();
  if (!client) return UNAVAILABLE;
  try {
    const { data, error } = await client
      .from('friendships')
      .insert({
        requester_id: fromProfileId,
        addressee_id: toProfileId,
      })
      .select('id')
      .single();
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
    return { ok: true, id: (data as { id: string }).id };
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
      .select('profile_id, username, display_name, avatar, last_seen_at')
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
