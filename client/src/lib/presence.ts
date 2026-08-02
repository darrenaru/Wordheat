/**
 * Override live untuk status kehadiran (presence) pemain lain — TIDAK
 * fetch apa pun sendiri (beda dari `friends.ts`/`wallet.ts`), murni
 * ditulisi oleh event `presence-update` dari saluran SSE (`App.tsx`).
 * Data AWAL presence datang menumpang di respons `GET /friends`/`GET
 * /players/:id` yang sudah ada (field `presence` di `UserSummary`/
 * `PublicProfile`) — store ini cuma jadi tempat penyimpanan pembaruan
 * yang lebih baru, dibaca lewat `getLivePresence(profileId) ?? initialPresence`
 * supaya sebelum ada dorongan apa pun, data awal dari fetch tetap tampil.
 */
import type { Presence } from '@shared/types.ts';

const live = new Map<string, Presence>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getLivePresence(profileId: string): Presence | undefined {
  return live.get(profileId);
}

export function subscribePresence(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Dipanggil dari listener `presence-update` di `App.tsx`. */
export function applyPresenceUpdate(profileId: string, presence: Presence): void {
  live.set(profileId, presence);
  emit();
}
