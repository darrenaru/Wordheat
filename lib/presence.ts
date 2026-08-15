import "server-only";

import { randomBytes } from "node:crypto";

import type { PublicProfile } from "@/lib/accounts";

/**
 * Saluran pribadi tiap akun.
 *
 * Permintaan pertemanan dan undangan room harus sampai tanpa pemain perlu
 * menyegarkan halaman. Pendengarnya disimpan di memori seperti room: kalau
 * server dimulai ulang, browser cukup menyambung ulang dan menarik keadaan
 * terbaru dari basis data.
 */

export type Invite = {
  id: string;
  code: string;
  from: PublicProfile;
  at: number;
};

/** Undangan basi dibuang: room-nya sendiri kemungkinan besar sudah selesai. */
const INVITE_TTL_MS = 30 * 60 * 1000;
const MAX_INVITES = 12;

type Store = {
  listeners: Map<string, Set<() => void>>;
  invites: Map<string, Invite[]>;
};

const store: Store =
  ((globalThis as Record<string, unknown>).__wordheatPresence as Store) ??
  ((globalThis as Record<string, unknown>).__wordheatPresence = {
    listeners: new Map(),
    invites: new Map(),
  });

export function subscribeToAccount(accountId: string, listener: () => void): () => void {
  let set = store.listeners.get(accountId);
  if (!set) {
    set = new Set();
    store.listeners.set(accountId, set);
  }
  set.add(listener);

  return () => {
    set.delete(listener);
    if (set.size === 0) store.listeners.delete(accountId);
  };
}

/** Memberi tahu satu akun bahwa keadaannya berubah, di semua tab yang terbuka. */
export function notifyAccount(accountId: string) {
  const set = store.listeners.get(accountId);
  if (!set) return;
  for (const listener of set) listener();
}

export function addInvite(toId: string, from: PublicProfile, code: string): Invite {
  const invite: Invite = {
    id: randomBytes(8).toString("base64url"),
    code,
    from,
    at: Date.now(),
  };

  const current = listInvites(toId).filter(
    // Mengundang ulang ke room yang sama menggantikan undangan lama alih-alih
    // menumpuk baris kembar di layar penerimanya.
    (existing) => !(existing.code === code && existing.from.id === from.id),
  );
  store.invites.set(toId, [invite, ...current].slice(0, MAX_INVITES));

  notifyAccount(toId);
  return invite;
}

export function listInvites(accountId: string): Invite[] {
  const cutoff = Date.now() - INVITE_TTL_MS;
  const fresh = (store.invites.get(accountId) ?? []).filter((i) => i.at > cutoff);
  store.invites.set(accountId, fresh);
  return fresh;
}

export function dismissInvite(accountId: string, inviteId: string) {
  const remaining = listInvites(accountId).filter((i) => i.id !== inviteId);
  store.invites.set(accountId, remaining);
  notifyAccount(accountId);
}
