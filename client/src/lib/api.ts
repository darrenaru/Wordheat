import type {
  ApiError,
  AvatarConfig,
  Guess,
  Leaderboard,
  PlayerStats,
  PowerupInventory,
  SoloSessionState,
} from '@shared/types.ts';
import { loadProfile } from './profile.ts';
import { getAuthToken } from './supabase.ts';

export class ApiFailure extends Error {
  readonly code: ApiError['code'];
  constructor(error: ApiError) {
    super(error.message);
    this.code = error.code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const profile = loadProfile();
  const response = await fetch(`/api${path}`, {
    headers: {
      'content-type': 'application/json',
      'x-player-id': profile.id,
      'x-player-name': encodeURIComponent(profile.name),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok === false) {
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

  /** Dipanggil sekali tiap login — balikannya `profileId` yang wajib dipakai ke depan. */
  linkAccount: (name: string, avatar: AvatarConfig) =>
    request<{ profileId: string }>('/account/link', {
      method: 'POST',
      body: JSON.stringify({ name, avatar }),
    }).then((r) => r.profileId),

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
    request<{ letter: string; inventory: PowerupInventory }>(`/solo/${id}/powerup/letter`, {
      method: 'POST',
    }),
};
