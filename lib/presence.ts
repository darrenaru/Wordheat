import "server-only";

import { randomBytes } from "node:crypto";

import type { PublicProfile } from "@/lib/accounts";
import { listFriends } from "@/lib/accounts";
import type { AccountStatus } from "@/lib/profile";
import { isAccountInMatch, setMatchStatusListener, type RoomView } from "@/lib/rooms";

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

/** Diam tanpa gerak mouse/keyboard selama ini dianggap AFK. */
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
/** Sama seperti tenggang di lib/rooms.ts: muat ulang halaman tidak boleh
 *  membuat teman terlihat sekilas offline. */
const DISCONNECT_GRACE_MS = 12_000;

type Store = {
  listeners: Map<string, Set<() => void>>;
  invites: Map<string, Invite[]>;
  /** Jumlah koneksi /api/me/stream yang terbuka per akun. */
  connections: Map<string, number>;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  lastActiveAt: Map<string, number>;
};

// `??=` saja tidak cukup: proses pengembangan yang sudah lama hidup mungkin
// masih menyimpan bentuk lama (sebelum field koneksi/aktivitas ditambahkan)
// di globalThis, jadi field yang belum ada dilengkapi satu per satu alih-alih
// mengandalkan objeknya sudah lengkap begitu ditemukan.
const store: Store = ((globalThis as Record<string, unknown>).__wordheatPresence ??=
  {}) as Store;
store.listeners ??= new Map();
store.invites ??= new Map();
store.connections ??= new Map();
store.disconnectTimers ??= new Map();
store.lastActiveAt ??= new Map();

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

// ------------------------------------------------------------- kehadiran --

/**
 * Memberi tahu semua pengawas status keaktifan sebuah akun bahwa statusnya
 * berubah -- baik yang mengawasi langsung lewat accountId-nya sendiri
 * (halaman profil publik, app/api/players/[username]/stream) maupun teman-
 * temannya lewat /api/me/stream. Keduanya sama-sama lewat `subscribeToAccount`
 * yang sudah ada; ini cuma memutuskan siapa saja yang perlu dibangunkan.
 */
function notifyPresenceWatchers(accountId: string) {
  notifyAccount(accountId);
  for (const friend of listFriends(accountId)) notifyAccount(friend.id);
}

/**
 * Sinyal koneksi /api/me/stream, dipakai bersama isAccountInMatch dan
 * lastActiveAt untuk menyusun status gabungan lewat getAccountStatus.
 * Pola timernya sama seperti markConnected/markDisconnected di
 * lib/rooms.ts: tenggang singkat sebelum benar-benar dianggap offline,
 * supaya muat ulang halaman tidak terlihat sebagai keluar-lalu-masuk.
 */
export function markAccountConnected(accountId: string) {
  const timer = store.disconnectTimers.get(accountId);
  if (timer) {
    clearTimeout(timer);
    store.disconnectTimers.delete(accountId);
  }

  const wasOffline = (store.connections.get(accountId) ?? 0) === 0;
  store.connections.set(accountId, (store.connections.get(accountId) ?? 0) + 1);
  store.lastActiveAt.set(accountId, Date.now());

  if (wasOffline) notifyPresenceWatchers(accountId);
}

export function markAccountDisconnected(accountId: string) {
  const current = store.connections.get(accountId) ?? 0;
  const next = Math.max(0, current - 1);
  store.connections.set(accountId, next);
  if (next > 0) return;

  const timer = setTimeout(() => {
    store.disconnectTimers.delete(accountId);
    if ((store.connections.get(accountId) ?? 0) > 0) return;
    notifyPresenceWatchers(accountId);
  }, DISCONNECT_GRACE_MS);
  timer.unref?.();
  store.disconnectTimers.set(accountId, timer);
}

/** Dipanggil dari POST /api/me/heartbeat setiap ada aktivitas mouse/keyboard nyata. */
export function touchActivity(accountId: string) {
  const now = Date.now();
  const previous = store.lastActiveAt.get(accountId) ?? now;
  store.lastActiveAt.set(accountId, now);

  // Baru saja kembali dari idle -- teman berhak tahu tanpa menunggu siklus
  // penyegaran berkala. Menuju idle sengaja tidak dipicu aktif di sini,
  // karena tidak ada event untuk itu; cukup mengandalkan penyegaran berkala
  // di app/api/me/stream/route.ts.
  if (now - previous > IDLE_THRESHOLD_MS) notifyPresenceWatchers(accountId);
}

/**
 * Status gabungan satu akun. `isAccountInMatch` menang lebih dulu -- sinyal
 * dari room lebih kuat daripada heartbeat /api/me/stream yang mungkin sempat
 * terputus sesaat -- baru offline (tidak ada koneksi sama sekali), lalu
 * idle/online berdasarkan kapan terakhir ada aktivitas nyata.
 */
export function getAccountStatus(accountId: string): AccountStatus {
  if (isAccountInMatch(accountId)) return "in-game";

  const connections = store.connections.get(accountId) ?? 0;
  if (connections <= 0) return "offline";

  const lastActive = store.lastActiveAt.get(accountId) ?? 0;
  return Date.now() - lastActive > IDLE_THRESHOLD_MS ? "idle" : "online";
}

setMatchStatusListener((accountIds) => {
  for (const id of accountIds) notifyPresenceWatchers(id);
});

/**
 * Menempelkan status keaktifan global (fitur Player Status) ke tiap pemain
 * berakun dalam sebuah RoomView, dipanggil dari lapisan API (bukan dari
 * dalam lib/rooms.ts, supaya modul itu tidak perlu mengimpor presence.ts).
 * Tamu tanpa akun dilewati -- tidak ada identitas global untuk diperiksa.
 */
export function withPlayerPresence(view: RoomView): RoomView {
  return {
    ...view,
    players: view.players.map((p) =>
      p.accountId ? { ...p, status: getAccountStatus(p.accountId) } : p,
    ),
  };
}
