import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";
import { cookies } from "next/headers";

import {
  DEFAULT_AVATAR_BG,
  isValidAvatarBg,
  randomAvatarSeed,
  sanitizeChoices,
  type AvatarChoices,
} from "@/lib/avatar";
import { db } from "@/lib/db";

/**
 * Akun, profil, dan pertemanan.
 *
 * Tidak ada kata sandi: identitas dipegang cookie sesi di perangkat pemain,
 * ditambah kode pemulihan sekali-tampil untuk masuk dari perangkat lain. Untuk
 * permainan kasual, meminta kata sandi berarti ikut menanggung penyimpanan
 * sandi, alur reset, dan pengumpulan surel -- padahal tidak ada yang perlu
 * dilindungi selain nama dan daftar teman.
 */

export const SESSION_COOKIE = "wh_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365;

/** Tanpa huruf dan angka yang mudah tertukar saat kode disalin ulang dengan tangan. */
const RECOVERY_ALPHABET = "ACDEFGHJKLMNPQRTUVWXY34679";
const RECOVERY_GROUPS = 4;
const RECOVERY_GROUP_LEN = 5;

const USERNAME_RE = /^[a-z0-9_]{3,16}$/;

export type Account = {
  id: string;
  username: string;
  displayName: string;
  avatarSeed: string;
  avatarBg: string;
  /** Pilihan rinci avatar. Bidang kosong berarti ikut benih. */
  avatarChoices: AvatarChoices;
  createdAt: number;
};

export type PublicProfile = Pick<
  Account,
  "id" | "username" | "displayName" | "avatarSeed" | "avatarBg" | "avatarChoices"
>;

export type AccountRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_seed: string;
  avatar_bg: string;
  avatar_options: string;
  created_at: number;
};

/** Kolom disimpan sebagai JSON; isinya tetap disaring saat dibaca, karena
 *  baris lama bisa berasal dari versi skema yang lebih tua. */
function readChoices(raw: string): AvatarChoices {
  try {
    return sanitizeChoices(JSON.parse(raw || "{}"));
  } catch {
    return {};
  }
}

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarSeed: row.avatar_seed,
    avatarBg: row.avatar_bg,
    avatarChoices: readChoices(row.avatar_options),
    createdAt: row.created_at,
  };
}

export function toPublicProfile(account: Account): PublicProfile {
  const { id, username, displayName, avatarSeed, avatarBg, avatarChoices } = account;
  return { id, username, displayName, avatarSeed, avatarBg, avatarChoices };
}

function newId(): string {
  return randomBytes(12).toString("base64url");
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function newRecoveryCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < RECOVERY_GROUPS; g++) {
    let group = "";
    for (let i = 0; i < RECOVERY_GROUP_LEN; i++) {
      group += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

/** Kode dibandingkan dalam bentuk kanonik agar spasi dan tanda hubung tidak jadi soal. */
export function normalizeRecoveryCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username);
}

function sanitizeDisplayName(raw: string, fallback: string): string {
  const name = raw.trim().replace(/\s+/g, " ").slice(0, 24);
  return name || fallback;
}

// ------------------------------------------------------------------ akun --

export type SignupError = "bad-username" | "username-taken";

export function createAccount(input: {
  username: string;
  displayName?: string;
  avatarSeed?: string;
  avatarBg?: string;
  avatarChoices?: unknown;
}): { ok: true; account: Account; recoveryCode: string } | { ok: false; error: SignupError } {
  const username = normalizeUsername(input.username);
  if (!isValidUsername(username)) return { ok: false, error: "bad-username" };

  const database = db();
  const existing = database
    .prepare("SELECT id FROM accounts WHERE username = ?")
    .get(username);
  if (existing) return { ok: false, error: "username-taken" };

  const account: Account = {
    id: newId(),
    username,
    displayName: sanitizeDisplayName(input.displayName ?? "", username),
    avatarSeed: input.avatarSeed?.slice(0, 32) || randomAvatarSeed(),
    avatarBg: input.avatarBg && isValidAvatarBg(input.avatarBg) ? input.avatarBg : DEFAULT_AVATAR_BG,
    avatarChoices: sanitizeChoices(input.avatarChoices),
    createdAt: Date.now(),
  };

  database
    .prepare(
      `INSERT INTO accounts
         (id, username, display_name, avatar_seed, avatar_bg, avatar_options, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      account.id,
      account.username,
      account.displayName,
      account.avatarSeed,
      account.avatarBg,
      JSON.stringify(account.avatarChoices),
      account.createdAt,
    );

  const recoveryCode = newRecoveryCode();
  database
    .prepare(
      `INSERT INTO credentials (account_id, kind, identifier, created_at)
       VALUES (?, 'recovery', ?, ?)`,
    )
    .run(account.id, hash(normalizeRecoveryCode(recoveryCode)), Date.now());

  return { ok: true, account, recoveryCode };
}

export function findAccountByRecoveryCode(raw: string): Account | null {
  const row = db()
    .prepare(
      `SELECT a.* FROM accounts a
       JOIN credentials c ON c.account_id = a.id AND c.kind = 'recovery'
       WHERE c.identifier = ?`,
    )
    .get(hash(normalizeRecoveryCode(raw))) as AccountRow | undefined;
  return row ? toAccount(row) : null;
}

export function findAccountByUsername(username: string): Account | null {
  const row = db()
    .prepare("SELECT * FROM accounts WHERE username = ?")
    .get(normalizeUsername(username)) as AccountRow | undefined;
  return row ? toAccount(row) : null;
}

export function findAccountById(id: string): Account | null {
  const row = db().prepare("SELECT * FROM accounts WHERE id = ?").get(id) as
    | AccountRow
    | undefined;
  return row ? toAccount(row) : null;
}

export type ProfileError = "bad-username" | "username-taken" | "bad-avatar";

export function updateProfile(
  accountId: string,
  patch: {
    username?: string;
    displayName?: string;
    avatarSeed?: string;
    avatarBg?: string;
    avatarChoices?: unknown;
  },
): { ok: true; account: Account } | { ok: false; error: ProfileError } {
  const database = db();
  const current = findAccountById(accountId);
  if (!current) return { ok: false, error: "bad-username" };

  let username = current.username;
  if (patch.username !== undefined) {
    username = normalizeUsername(patch.username);
    if (!isValidUsername(username)) return { ok: false, error: "bad-username" };
    if (username !== current.username) {
      const taken = database
        .prepare("SELECT id FROM accounts WHERE username = ?")
        .get(username);
      if (taken) return { ok: false, error: "username-taken" };
    }
  }

  const avatarBg = patch.avatarBg ?? current.avatarBg;
  if (!isValidAvatarBg(avatarBg)) return { ok: false, error: "bad-avatar" };

  const displayName =
    patch.displayName !== undefined
      ? sanitizeDisplayName(patch.displayName, username)
      : current.displayName;
  const avatarSeed = patch.avatarSeed?.slice(0, 32) || current.avatarSeed;
  const avatarChoices =
    patch.avatarChoices !== undefined
      ? sanitizeChoices(patch.avatarChoices)
      : current.avatarChoices;

  database
    .prepare(
      `UPDATE accounts
         SET username = ?, display_name = ?, avatar_seed = ?, avatar_bg = ?, avatar_options = ?
       WHERE id = ?`,
    )
    .run(
      username,
      displayName,
      avatarSeed,
      avatarBg,
      JSON.stringify(avatarChoices),
      accountId,
    );

  return {
    ok: true,
    account: { ...current, username, displayName, avatarSeed, avatarBg, avatarChoices },
  };
}

// ---------------------------------------------------------------- sesi ----

export function createSession(accountId: string): string {
  const token = randomBytes(24).toString("base64url");
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO sessions (token_hash, account_id, created_at, last_seen_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(hash(token), accountId, now, now);
  return token;
}

export function destroySession(token: string) {
  db().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hash(token));
}

export function accountForToken(token: string): Account | null {
  const row = db()
    .prepare(
      `SELECT a.* FROM accounts a
       JOIN sessions s ON s.account_id = a.id
       WHERE s.token_hash = ?`,
    )
    .get(hash(token)) as AccountRow | undefined;
  if (!row) return null;
  db()
    .prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?")
    .run(Date.now(), hash(token));
  return toAccount(row);
}

/** Akun pemilik permintaan ini, atau null kalau pengunjung belum punya profil. */
export async function currentAccount(): Promise<Account | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? accountForToken(token) : null;
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    // Cookie tetap terkirim saat pengembangan lewat http://localhost.
    secure: process.env.NODE_ENV === "production",
  };
}

// ------------------------------------------------------------ pertemanan --

/** Pasangan selalu terurut supaya satu hubungan tidak tercatat dua kali. */
function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function areFriends(a: string, b: string): boolean {
  const [x, y] = pair(a, b);
  return Boolean(
    db().prepare("SELECT 1 FROM friendships WHERE a_id = ? AND b_id = ?").get(x, y),
  );
}

export function listFriends(accountId: string): PublicProfile[] {
  const rows = db()
    .prepare(
      `SELECT a.* FROM accounts a
       JOIN friendships f ON (f.a_id = a.id OR f.b_id = a.id)
       WHERE (f.a_id = ?1 OR f.b_id = ?1) AND a.id != ?1
       ORDER BY a.display_name COLLATE NOCASE`,
    )
    .all(accountId) as AccountRow[];
  return rows.map((row) => toPublicProfile(toAccount(row)));
}

export type FriendRequestView = {
  id: string;
  createdAt: number;
  profile: PublicProfile;
};

export function listIncomingRequests(accountId: string): FriendRequestView[] {
  const rows = db()
    .prepare(
      `SELECT r.id AS req_id, r.created_at AS req_created, a.*
       FROM friend_requests r JOIN accounts a ON a.id = r.from_id
       WHERE r.to_id = ? ORDER BY r.created_at DESC`,
    )
    .all(accountId) as (AccountRow & { req_id: string; req_created: number })[];
  return rows.map((row) => ({
    id: row.req_id,
    createdAt: row.req_created,
    profile: toPublicProfile(toAccount(row)),
  }));
}

export function listOutgoingRequests(accountId: string): FriendRequestView[] {
  const rows = db()
    .prepare(
      `SELECT r.id AS req_id, r.created_at AS req_created, a.*
       FROM friend_requests r JOIN accounts a ON a.id = r.to_id
       WHERE r.from_id = ? ORDER BY r.created_at DESC`,
    )
    .all(accountId) as (AccountRow & { req_id: string; req_created: number })[];
  return rows.map((row) => ({
    id: row.req_id,
    createdAt: row.req_created,
    profile: toPublicProfile(toAccount(row)),
  }));
}

export type RequestError =
  | "not-found"
  | "self"
  | "already-friends"
  | "already-sent"
  | "pending-incoming";

export function sendFriendRequest(
  fromId: string,
  username: string,
): { ok: true; to: Account; autoAccepted: boolean } | { ok: false; error: RequestError } {
  const to = findAccountByUsername(username);
  if (!to) return { ok: false, error: "not-found" };
  if (to.id === fromId) return { ok: false, error: "self" };
  if (areFriends(fromId, to.id)) return { ok: false, error: "already-friends" };

  const database = db();

  // Kalau orang itu sudah lebih dulu mengirim permintaan, mengirim balik jelas
  // berarti setuju -- jadi langsung dijadikan pertemanan alih-alih membuat dua
  // permintaan yang saling menunggu.
  const mirrored = database
    .prepare("SELECT id FROM friend_requests WHERE from_id = ? AND to_id = ?")
    .get(to.id, fromId) as { id: string } | undefined;
  if (mirrored) {
    acceptFriendRequest(fromId, mirrored.id);
    return { ok: true, to, autoAccepted: true };
  }

  const existing = database
    .prepare("SELECT id FROM friend_requests WHERE from_id = ? AND to_id = ?")
    .get(fromId, to.id);
  if (existing) return { ok: false, error: "already-sent" };

  database
    .prepare("INSERT INTO friend_requests (id, from_id, to_id, created_at) VALUES (?, ?, ?, ?)")
    .run(newId(), fromId, to.id, Date.now());

  return { ok: true, to, autoAccepted: false };
}

/** Menerima permintaan yang ditujukan ke accountId. */
export function acceptFriendRequest(
  accountId: string,
  requestId: string,
): { ok: true; friendId: string } | { ok: false; error: "not-found" } {
  const database = db();
  const row = database
    .prepare("SELECT from_id, to_id FROM friend_requests WHERE id = ? AND to_id = ?")
    .get(requestId, accountId) as { from_id: string; to_id: string } | undefined;
  if (!row) return { ok: false, error: "not-found" };

  const [a, b] = pair(row.from_id, row.to_id);
  database
    .prepare(
      "INSERT OR IGNORE INTO friendships (a_id, b_id, created_at) VALUES (?, ?, ?)",
    )
    .run(a, b, Date.now());
  database.prepare("DELETE FROM friend_requests WHERE id = ?").run(requestId);

  return { ok: true, friendId: row.from_id };
}

/** Menolak permintaan masuk, atau membatalkan permintaan yang sudah dikirim. */
export function dropFriendRequest(
  accountId: string,
  requestId: string,
): { ok: true; otherId: string } | { ok: false; error: "not-found" } {
  const database = db();
  const row = database
    .prepare(
      "SELECT from_id, to_id FROM friend_requests WHERE id = ? AND (to_id = ? OR from_id = ?)",
    )
    .get(requestId, accountId, accountId) as { from_id: string; to_id: string } | undefined;
  if (!row) return { ok: false, error: "not-found" };

  database.prepare("DELETE FROM friend_requests WHERE id = ?").run(requestId);
  return { ok: true, otherId: row.from_id === accountId ? row.to_id : row.from_id };
}

/** Semua yang perlu diketahui satu akun tentang pertemanannya, dalam sekali baca. */
export function friendState(accountId: string) {
  return {
    friends: listFriends(accountId),
    incoming: listIncomingRequests(accountId),
    outgoing: listOutgoingRequests(accountId),
  };
}

export function removeFriend(accountId: string, friendId: string): boolean {
  const [a, b] = pair(accountId, friendId);
  const info = db()
    .prepare("DELETE FROM friendships WHERE a_id = ? AND b_id = ?")
    .run(a, b);
  return info.changes > 0;
}
