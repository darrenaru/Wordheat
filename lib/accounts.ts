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
import { randomFantasyDisplayName } from "@/lib/fantasy-name";

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
  /** null berarti belum pernah diganti sejak akun dibuat. */
  usernameChangedAt: number | null;
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
  username_changed_at: number | null;
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
    usernameChangedAt: row.username_changed_at,
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
    usernameChangedAt: null,
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

export const FRIEND_SEARCH_MIN_LENGTH = 2;
export const FRIEND_SEARCH_LIMIT = 8;

/** Meloloskan karakter LIKE (%, _, \) supaya username berisi garis bawah
 *  tidak diperlakukan sebagai wildcard satu-karakter. */
function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Pencarian awalan+substring untuk autolengkap "Tambah teman". Table scan
 *  cukup murah untuk ukuran data permainan ini -- tidak perlu FTS. */
export function searchAccounts(rawQuery: string, excludeId: string): PublicProfile[] {
  const query = normalizeUsername(rawQuery);
  if (query.length < FRIEND_SEARCH_MIN_LENGTH || !/^[a-z0-9_]+$/.test(query)) return [];

  const escaped = escapeLikePattern(query);
  const prefixPattern = `${escaped}%`;
  const containsPattern = `%${escaped}%`;

  const rows = db()
    .prepare(
      `SELECT * FROM accounts
       WHERE id != ?
         AND username LIKE ? ESCAPE '\\'
       ORDER BY
         CASE WHEN username LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
         LENGTH(username) ASC,
         username ASC
       LIMIT ?`,
    )
    .all(excludeId, containsPattern, prefixPattern, FRIEND_SEARCH_LIMIT) as AccountRow[];

  return rows.map((row) => toPublicProfile(toAccount(row)));
}

export function findAccountByGoogleSub(sub: string): Account | null {
  const row = db()
    .prepare(
      `SELECT a.* FROM accounts a
       JOIN credentials c ON c.account_id = a.id AND c.kind = 'google'
       WHERE c.identifier = ?`,
    )
    .get(sub) as AccountRow | undefined;
  return row ? toAccount(row) : null;
}

export function accountHasGoogle(accountId: string): boolean {
  const row = db()
    .prepare("SELECT 1 FROM credentials WHERE account_id = ? AND kind = 'google'")
    .get(accountId);
  return Boolean(row);
}

export function linkGoogleCredential(accountId: string, sub: string): void {
  db()
    .prepare(
      `INSERT INTO credentials (account_id, kind, identifier, created_at)
       VALUES (?, 'google', ?, ?)`,
    )
    .run(accountId, sub, Date.now());
}

/** Kandidat awal dari alamat surel/nama Google, lalu diadu keunikannya di createAccount. */
function slugifyUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16);
}

/** Kandidat unik dari basis apa pun -- dipakai baik untuk username asal
 *  Google maupun untuk akun tamu. */
function uniqueUsernameFrom(base: string): string {
  let trimmed = slugifyUsername(base);
  if (trimmed.length < 3) trimmed = (trimmed + "pemain").slice(0, 3);
  trimmed = trimmed.slice(0, 12); // sisakan ruang untuk akhiran angka sampai 16 karakter

  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = attempt === 0 ? trimmed : `${trimmed}${randomInt(10, 9999)}`;
    if (!findAccountByUsername(candidate)) return candidate;
  }
  return `${trimmed}${randomInt(100000, 999999)}`.slice(0, 16);
}

function generateUsernameFromGoogle(name: string, email: string): string {
  const emailLocal = email.split("@")[0] ?? "";
  const base = slugifyUsername(emailLocal) || slugifyUsername(name);
  return uniqueUsernameFrom(base);
}

/**
 * Mencari akun yang sudah terikat ke `sub` Google ini, atau membuat akun baru
 * kalau ini pertama kalinya. Username dibuat otomatis dari surel/nama --
 * Google tidak pernah memberi username, dan meminta pemain mengetiknya di
 * tengah alur masuk hanya menambah gesekan yang tidak perlu; ganti nama bisa
 * kapan saja lewat halaman profil.
 */
export function findOrCreateGoogleAccount(claims: {
  sub: string;
  email?: string;
  name?: string;
}): { ok: true; account: Account; recoveryCode?: string } | { ok: false; error: "bad-request" } {
  const existing = findAccountByGoogleSub(claims.sub);
  if (existing) return { ok: true, account: existing };
  if (!claims.sub) return { ok: false, error: "bad-request" };

  const username = generateUsernameFromGoogle(claims.name ?? "", claims.email ?? "");
  const result = createAccount({ username, displayName: claims.name });
  if (!result.ok) {
    // Tabrakan username sisa dari race kondisi jarang -- coba sekali lagi
    // dengan akhiran acak baru alih-alih menampilkan galat mentah ke klik Google.
    const retryUsername = `${username.slice(0, 10)}${randomInt(1000, 9999)}`;
    const retry = createAccount({ username: retryUsername, displayName: claims.name });
    if (!retry.ok) return { ok: false, error: "bad-request" };
    linkGoogleCredential(retry.account.id, claims.sub);
    return { ok: true, account: retry.account, recoveryCode: retry.recoveryCode };
  }

  linkGoogleCredential(result.account.id, claims.sub);
  return { ok: true, account: result.account, recoveryCode: result.recoveryCode };
}

/**
 * Akun tamu: dibuat otomatis tanpa pemain mengetik apa pun, memakai jalur
 * createAccount() yang sama seperti pendaftaran manual -- hanya beda sumber
 * username/displayName-nya (nama fantasy acak, bukan input pemain). Kode
 * pemulihannya tetap muncul lewat mekanisme yang sudah ada, jadi akun ini
 * tetap bisa dipulihkan dari perangkat lain persis seperti akun manual.
 */
export function createGuestAccount():
  | { ok: true; account: Account; recoveryCode: string }
  | { ok: false; error: "bad-request" } {
  const displayName = randomFantasyDisplayName();
  const result = createAccount({ username: uniqueUsernameFrom(displayName), displayName });
  if (result.ok) return result;

  // Tabrakan username sisa dari race kondisi jarang -- coba sekali lagi
  // dengan nama fantasy baru.
  const retryName = randomFantasyDisplayName();
  const retry = createAccount({ username: uniqueUsernameFrom(retryName), displayName: retryName });
  return retry.ok ? retry : { ok: false, error: "bad-request" };
}

export function findAccountById(id: string): Account | null {
  const row = db().prepare("SELECT * FROM accounts WHERE id = ?").get(id) as
    | AccountRow
    | undefined;
  return row ? toAccount(row) : null;
}

export type ProfileError = "bad-username" | "username-taken" | "bad-avatar" | "username-cooldown";

/** Jeda wajib antar-pergantian username, supaya orang tidak bisa gonta-ganti
 *  identitas tiap saat untuk mempersulit pencarian teman atau menyamar. */
export const USERNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function updateProfile(
  accountId: string,
  patch: {
    username?: string;
    displayName?: string;
    avatarSeed?: string;
    avatarBg?: string;
    avatarChoices?: unknown;
  },
):
  | { ok: true; account: Account }
  | { ok: false; error: ProfileError; retryAt?: number } {
  const database = db();
  const current = findAccountById(accountId);
  if (!current) return { ok: false, error: "bad-username" };

  let username = current.username;
  let usernameChangedAt = current.usernameChangedAt;
  if (patch.username !== undefined) {
    username = normalizeUsername(patch.username);
    if (!isValidUsername(username)) return { ok: false, error: "bad-username" };
    if (username !== current.username) {
      // null berarti belum pernah diganti -- pergantian pertama sejak akun
      // dibuat tidak boleh terhalang cooldown yang justru dimaksudkan untuk
      // pergantian berulang.
      if (current.usernameChangedAt !== null) {
        const retryAt = current.usernameChangedAt + USERNAME_CHANGE_COOLDOWN_MS;
        if (Date.now() < retryAt) return { ok: false, error: "username-cooldown", retryAt };
      }
      const taken = database
        .prepare("SELECT id FROM accounts WHERE username = ?")
        .get(username);
      if (taken) return { ok: false, error: "username-taken" };
      usernameChangedAt = Date.now();
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
         SET username = ?, display_name = ?, avatar_seed = ?, avatar_bg = ?, avatar_options = ?,
             username_changed_at = ?
       WHERE id = ?`,
    )
    .run(
      username,
      displayName,
      avatarSeed,
      avatarBg,
      JSON.stringify(avatarChoices),
      usernameChangedAt,
      accountId,
    );

  return {
    ok: true,
    account: { ...current, username, displayName, avatarSeed, avatarBg, avatarChoices, usernameChangedAt },
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

// ------------------------------------------------------- tambah cepat --

/**
 * Membuat/menetapkan token acak baru untuk tautan "Tambah Cepat". Coba
 * ulang beberapa kali kalau tabrakan UNIQUE (peluangnya nyaris nol dengan
 * 9 byte acak, tapi murah untuk dijaga).
 */
function assignQuickAddToken(accountId: string): string {
  const database = db();
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = randomBytes(9).toString("base64url");
    try {
      database.prepare("UPDATE accounts SET quick_add_token = ? WHERE id = ?").run(token, accountId);
      return token;
    } catch {
      // Tabrakan UNIQUE -- coba token baru.
    }
  }
  throw new Error("gagal membuat token tambah cepat");
}

/** Token tautan tambah cepat milik akun ini, dibuat sekali lalu dipakai ulang. */
export function quickAddLinkToken(accountId: string): string {
  const row = db()
    .prepare("SELECT quick_add_token FROM accounts WHERE id = ?")
    .get(accountId) as { quick_add_token: string | null } | undefined;
  return row?.quick_add_token ?? assignQuickAddToken(accountId);
}

/** Mengganti token lama -- tautan yang sudah beredar berhenti berfungsi. */
export function regenerateQuickAddLink(accountId: string): string {
  return assignQuickAddToken(accountId);
}

function findAccountByQuickAddToken(token: string): Account | null {
  const row = db().prepare("SELECT * FROM accounts WHERE quick_add_token = ?").get(token) as
    | AccountRow
    | undefined;
  return row ? toAccount(row) : null;
}

export type QuickAddError = "not-found" | "self";

/**
 * Langsung menjadikan dua akun berteman lewat token tautan -- tanpa lewat
 * `friend_requests` sama sekali, beda dari `sendFriendRequest`. Token
 * (bukan username) yang jadi kuncinya, supaya cuma orang yang benar-benar
 * menerima tautan yang dibagikan pemiliknya yang bisa memicu ini.
 */
export function quickAddFriend(
  accountId: string,
  token: string,
): { ok: true; friend: Account; alreadyFriends: boolean } | { ok: false; error: QuickAddError } {
  const target = findAccountByQuickAddToken(token);
  if (!target) return { ok: false, error: "not-found" };
  if (target.id === accountId) return { ok: false, error: "self" };

  if (areFriends(accountId, target.id)) {
    return { ok: true, friend: target, alreadyFriends: true };
  }

  const database = db();
  const [a, b] = pair(accountId, target.id);
  database
    .prepare("INSERT OR IGNORE INTO friendships (a_id, b_id, created_at) VALUES (?, ?, ?)")
    .run(a, b, Date.now());
  // Bersihkan permintaan basi di antara keduanya (arah mana pun), kalau ada.
  database
    .prepare(
      "DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)",
    )
    .run(accountId, target.id, target.id, accountId);

  return { ok: true, friend: target, alreadyFriends: false };
}
