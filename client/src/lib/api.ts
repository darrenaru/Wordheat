import type {
  AccountLinkResult,
  ApiError,
  AvatarConfig,
  ChatMessage,
  FriendsPayload,
  Guess,
  Leaderboard,
  PlayerStats,
  PowerupInventory,
  PublicProfile,
  SoloSessionState,
  UserSummary,
} from '@shared/types.ts';
import { getDeviceSecret, loadProfile } from './profile.ts';
import { getAuthToken } from './supabase.ts';

export class ApiFailure extends Error {
  readonly code: ApiError['code'];
  /** Cuma terisi untuk error tertentu (mis. cooldown ganti username) yang
   *  butuh bawa data tambahan selain kode/pesan. */
  readonly changeableAt?: string;
  constructor(error: ApiError & { changeableAt?: string }) {
    super(error.message);
    this.code = error.code;
    this.changeableAt = error.changeableAt;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const profile = loadProfile();
  const response = await fetch(`/api${path}`, {
    headers: {
      'content-type': 'application/json',
      'x-player-id': profile.id,
      'x-player-secret': getDeviceSecret(),
      'x-player-name': encodeURIComponent(profile.name),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  });
  const body = await response.json().catch(() => null);
  // `body === null` juga menutup kasus respons 200 yang isinya bukan JSON
  // valid (mis. gangguan proxy/CDN) — tanpa ini, `null as T` lolos ke
  // pemanggil yang langsung mengakses propertinya (`r.balance`, `r.state`,
  // dst.), jadi `TypeError` yang membingungkan alih-alih pesan error jelas.
  if (!response.ok || body === null || body.ok === false) {
    throw new ApiFailure(
      body ?? { ok: false, code: 'invalid', message: 'Server tidak merespons dengan benar.' },
    );
  }
  return body as T;
}

export const api = {
  health: () =>
    request<{ vocabulary: number; targets: number; poolSize: number; puzzleDate: string }>(
      '/health',
    ),

  newSolo: (mode: 'practice' | 'daily') =>
    request<{ state: SoloSessionState }>('/solo', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }).then((r) => r.state),

  getSolo: (id: string) =>
    request<{ state: SoloSessionState }>(`/solo/${id}`).then((r) => r.state),

  guess: (id: string, word: string) =>
    request<{ guess: Guess; state: SoloSessionState; balance?: number }>(`/solo/${id}/guess`, {
      method: 'POST',
      body: JSON.stringify({ word }),
    }),

  hint: (id: string) =>
    request<{ word: string }>(`/solo/${id}/hint`, { method: 'POST' }).then((r) => r.word),

  reveal: (id: string) =>
    request<{ state: SoloSessionState }>(`/solo/${id}/reveal`, { method: 'POST' }).then(
      (r) => r.state,
    ),

  roomInfo: (code: string) =>
    request<{ code: string; status: string; players: number }>(`/room/${code}`),

  stats: () => request<{ stats: PlayerStats | null }>('/stats').then((r) => r.stats),

  leaderboard: () => request<{ leaderboard: Leaderboard }>('/leaderboard').then((r) => r.leaderboard),

  playerProfile: (profileId: string) =>
    request<{ profile: PublicProfile }>(`/players/${encodeURIComponent(profileId)}`).then(
      (r) => r.profile,
    ),

  /**
   * Dipanggil sekali tiap login, dan sekali lagi dengan `confirm: true`
   * kalau panggilan pertama melaporkan `conflict: true` (akun Google ini
   * sudah punya progres di device/sesi lain — pemain harus menyetujui dulu
   * lewat `AccountLinkConflictModal` sebelum progres tamu di device ini
   * dibuang, lihat `AccountLinkResult` di `shared/types.ts`). Saat
   * `conflict: false`, `profileId` wajib dipakai ke depan;
   * `displayName`/`avatar` adalah identitas TERSIMPAN milik akun itu
   * (`null` kalau akun belum pernah menyimpan apa pun) — dipakai memulihkan
   * nama/avatar akun ke UI, bukan cuma mengikuti profil device saat ini.
   */
  linkAccount: (name: string, avatar: AvatarConfig, confirm = false) =>
    request<AccountLinkResult>('/account/link', {
      method: 'POST',
      body: JSON.stringify({ name, avatar, confirm }),
    }),

  username: () =>
    request<{ username: string | null; changeableAt: string | null }>('/username').then((r) => ({
      username: r.username,
      changeableAt: r.changeableAt,
    })),

  /**
   * Gagal (mis. sudah dipakai) melempar `ApiFailure` — baca `.code`/`.message`.
   * `displayName`/`avatar` disegarkan sekalian ke `player_stats` — tanpa ini,
   * pemain yang belum pernah main/login tidak akan punya nama tampil di sana
   * sama sekali (baris itu baru disentuh lewat sesi permainan atau login).
   */
  setUsername: (username: string, displayName: string, avatar: AvatarConfig) =>
    request<{ ok: true }>('/username', {
      method: 'POST',
      body: JSON.stringify({ username, displayName, avatar }),
    }),

  bio: () => request<{ bio: string | null }>('/bio').then((r) => r.bio),

  setBio: (bio: string, displayName: string, avatar: AvatarConfig) =>
    request<{ ok: true }>('/bio', {
      method: 'POST',
      body: JSON.stringify({ bio, displayName, avatar }),
    }),

  setProfile: (displayName: string, avatar: AvatarConfig) =>
    request<{ ok: true }>('/profile', {
      method: 'POST',
      body: JSON.stringify({ displayName, avatar }),
    }),

  searchUsers: (q: string) =>
    request<{ users: UserSummary[] }>(`/users/search?q=${encodeURIComponent(q)}`).then(
      (r) => r.users,
    ),

  friends: () => request<{ ok: true } & FriendsPayload>('/friends'),

  conversation: (profileId: string) =>
    request<{ messages: ChatMessage[] }>(`/messages/${encodeURIComponent(profileId)}`).then(
      (r) => r.messages,
    ),

  sendMessage: (profileId: string, text: string) =>
    request<{ ok: true }>(`/messages/${encodeURIComponent(profileId)}`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  sendFriendRequest: (toProfileId: string, avatar: AvatarConfig) =>
    request<{ ok: true }>('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ toProfileId, avatar }),
    }),

  respondFriendRequest: (id: string, accept: boolean) =>
    request<{ ok: true }>(`/friends/${id}/${accept ? 'accept' : 'decline'}`, { method: 'POST' }),

  removeFriendship: (id: string) => request<{ ok: true }>(`/friends/${id}/remove`, { method: 'POST' }),

  inviteToRoom: (code: string, toProfileId: string, fromName: string, fromAvatar: AvatarConfig) =>
    request<{ ok: true }>(`/rooms/${code}/invite`, {
      method: 'POST',
      body: JSON.stringify({ toProfileId, fromName, avatar: fromAvatar }),
    }),

  dismissInvite: (id: string) => request<{ ok: true }>(`/invites/${id}/dismiss`, { method: 'POST' }),

  wallet: () => request<{ balance: number }>('/wallet').then((r) => r.balance),

  inventory: () => request<{ inventory: PowerupInventory }>('/inventory').then((r) => r.inventory),

  buyPowerup: (powerup: keyof PowerupInventory) =>
    request<{ balance: number; inventory: PowerupInventory }>('/shop/buy', {
      method: 'POST',
      body: JSON.stringify({ powerup }),
    }),

  soloPowerupNearest: (id: string) =>
    request<{ guess: Guess; state: SoloSessionState; inventory: PowerupInventory }>(
      `/solo/${id}/powerup/nearest`,
      { method: 'POST' },
    ),

  soloPowerupLetter: (id: string) =>
    request<{ letter: string; wordLength: number; inventory: PowerupInventory }>(
      `/solo/${id}/powerup/letter`,
      { method: 'POST' },
    ),
};
