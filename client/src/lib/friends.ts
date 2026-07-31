/**
 * Teman, permintaan pertemanan, dan undangan room — server adalah satu-satunya
 * sumber kebenaran. Pola sama seperti `wallet.ts`: salinan lokal supaya badge
 * di topbar dan halaman Friend List bisa langsung baca tanpa fetch ulang tiap
 * render, disegarkan saat load dan kapan pun `refreshFriends()` dipanggil.
 */
import type { FriendsPayload } from '@shared/types.ts';
import { api } from './api.ts';

const EMPTY: FriendsPayload = { friends: [], incoming: [], outgoing: [], invites: [], unreadMessages: 0 };

let payload: FriendsPayload = EMPTY;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function load(): void {
  void api
    .friends()
    .then((next) => {
      payload = next;
      emit();
    })
    .catch(() => {});
}

load();

export function getFriends(): FriendsPayload {
  return payload;
}

export function subscribeFriends(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Muat ulang dari server — dipanggil saat halaman Friend List dibuka/refresh manual. */
export function refreshFriends(): void {
  load();
}
