/**
 * Teman, permintaan pertemanan, dan undangan room — server adalah satu-satunya
 * sumber kebenaran. Pola sama seperti `wallet.ts`: salinan lokal supaya badge
 * di topbar dan halaman Friend List bisa langsung baca tanpa fetch ulang tiap
 * render, disegarkan saat load dan kapan pun `refreshFriends()` dipanggil.
 */
import type { FriendsPayload } from '@shared/types.ts';
import { api } from './api.ts';

/** Fallback dipakai `useSyncExternalStore` di komponen mana pun yang
 *  bergantung pada store ini — diekspor dari sini (bukan ditulis ulang di
 *  tiap pemanggil) supaya cuma ada satu bentuk "kosong" yang dikenal. */
export const EMPTY_FRIENDS_PAYLOAD: FriendsPayload = {
  friends: [],
  incoming: [],
  outgoing: [],
  invites: [],
  unreadMessages: 0,
};

const EMPTY = EMPTY_FRIENDS_PAYLOAD;

let payload: FriendsPayload = EMPTY;
/** Mencegah refresh yang tumpang tindih saling menimpa dengan urutan
 *  terbalik — `refreshFriends()` dipanggil dari banyak tempat sekaligus
 *  (listener SSE, `FriendListScreen`), jadi lebih dari satu `load()` bisa
 *  berjalan bersamaan; cuma hasil dari panggilan TERAKHIR yang dipakai. */
let version = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function load(): void {
  const requestVersion = ++version;
  void api
    .friends()
    .then((next) => {
      if (requestVersion !== version) return;
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
