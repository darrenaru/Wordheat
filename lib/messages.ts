import "server-only";

import { randomBytes } from "node:crypto";

import { areFriends } from "@/lib/accounts";
import { db } from "@/lib/db";
import { notifyAccount } from "@/lib/presence";

/**
 * Pesan langsung antar teman.
 *
 * Hanya bisa dikirim antar akun yang sudah berteman -- daftar teman sudah
 * jadi penyaring alami siapa yang boleh saling menyapa, tanpa perlu sistem
 * izin terpisah.
 */

const MAX_BODY_LEN = 500;
const HISTORY_LIMIT = 300;

function newId(): string {
  return randomBytes(12).toString("base64url");
}

export type ChatMessage = {
  id: string;
  fromId: string;
  body: string;
  at: number;
};

export type SendError = "not-friends" | "empty" | "too-long";

export function sendMessage(
  fromId: string,
  toId: string,
  rawBody: string,
): { ok: true; message: ChatMessage } | { ok: false; error: SendError } {
  const body = rawBody.trim();
  if (!body) return { ok: false, error: "empty" };
  if (body.length > MAX_BODY_LEN) return { ok: false, error: "too-long" };
  if (!areFriends(fromId, toId)) return { ok: false, error: "not-friends" };

  const message: ChatMessage = { id: newId(), fromId, body, at: Date.now() };
  db()
    .prepare(
      `INSERT INTO messages (id, from_id, to_id, body, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(message.id, fromId, toId, message.body, message.at);

  // Kedua sisi diberi tahu: penerima supaya pesannya muncul, pengirim supaya
  // tab lain miliknya sendiri ikut sinkron.
  notifyAccount(toId);
  notifyAccount(fromId);
  return { ok: true, message };
}

type MessageRow = { id: string; from_id: string; body: string; created_at: number };

export function listConversation(accountId: string, friendId: string): ChatMessage[] {
  const rows = db()
    .prepare(
      `SELECT id, from_id, body, created_at FROM messages
       WHERE (from_id = ?1 AND to_id = ?2) OR (from_id = ?2 AND to_id = ?1)
       ORDER BY created_at ASC
       LIMIT ?3`,
    )
    .all(accountId, friendId, HISTORY_LIMIT) as MessageRow[];
  return rows.map((r) => ({ id: r.id, fromId: r.from_id, body: r.body, at: r.created_at }));
}

/**
 * Menandai pesan dari friendId ke accountId sebagai terbaca, lalu mengabari
 * balik lewat saluran pribadi supaya lencana belum-terbaca ikut hilang di
 * semua tab -- bukan hanya di modal yang sedang dibuka.
 */
export function markConversationRead(accountId: string, friendId: string) {
  const info = db()
    .prepare(
      `UPDATE messages SET read_at = ? WHERE to_id = ? AND from_id = ? AND read_at IS NULL`,
    )
    .run(Date.now(), accountId, friendId);
  if (info.changes > 0) notifyAccount(accountId);
}

export function unreadCounts(accountId: string): Record<string, number> {
  const rows = db()
    .prepare(
      `SELECT from_id, COUNT(*) AS n FROM messages
       WHERE to_id = ? AND read_at IS NULL GROUP BY from_id`,
    )
    .all(accountId) as { from_id: string; n: number }[];
  const out: Record<string, number> = {};
  for (const row of rows) out[row.from_id] = row.n;
  return out;
}
