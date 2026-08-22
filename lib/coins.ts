import "server-only";

import { randomBytes } from "node:crypto";

import { db } from "@/lib/db";

/**
 * Saldo Coin dan riwayatnya.
 *
 * Sengaja tidak mengimpor lib/presence.ts (untuk notifyAccount()) dari sini
 * -- lib/rooms.ts memanggil fungsi-fungsi di modul ini untuk hadiah
 * kemenangan room, dan lib/rooms.ts sendiri sengaja menghindari impor balik
 * ke lib/presence.ts (lihat catatan "dependensi dua arah" di lib/rooms.ts)
 * supaya tidak membentuk siklus rooms.ts -> coins.ts -> presence.ts ->
 * rooms.ts. Pemberitahuan real-time (notifyAccount) jadi tanggung jawab
 * lapisan pemanggil (route API), persis seperti updateProfile() di
 * lib/accounts.ts yang juga tidak memberi tahu dirinya sendiri.
 */

export type CoinReason = "solo_win" | "room_win" | "shop_buy";

export type CoinLedgerEntry = {
  id: string;
  delta: number;
  reason: CoinReason;
  meta: Record<string, unknown> | null;
  createdAt: number;
};

function newId(): string {
  return randomBytes(12).toString("base64url");
}

function recordLedger(accountId: string, delta: number, reason: CoinReason, meta?: object) {
  db()
    .prepare(
      `INSERT INTO coin_ledger (id, account_id, delta, reason, meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(newId(), accountId, delta, reason, meta ? JSON.stringify(meta) : null, Date.now());
}

export function coinBalance(accountId: string): number {
  const row = db().prepare("SELECT coins FROM accounts WHERE id = ?").get(accountId) as
    | { coins: number }
    | undefined;
  return row?.coins ?? 0;
}

export function earnCoins(
  accountId: string,
  amount: number,
  reason: CoinReason,
  meta?: object,
): { balance: number } {
  db().prepare("UPDATE accounts SET coins = coins + ? WHERE id = ?").run(amount, accountId);
  recordLedger(accountId, amount, reason, meta);
  return { balance: coinBalance(accountId) };
}

export type SpendResult = { ok: true; balance: number } | { ok: false; error: "insufficient-funds" };

export function spendCoins(
  accountId: string,
  amount: number,
  reason: CoinReason,
  meta?: object,
): SpendResult {
  const info = db()
    .prepare("UPDATE accounts SET coins = coins - ? WHERE id = ? AND coins >= ?")
    .run(amount, accountId, amount);
  if (info.changes === 0) return { ok: false, error: "insufficient-funds" };
  recordLedger(accountId, -amount, reason, meta);
  return { ok: true, balance: coinBalance(accountId) };
}

export function coinHistory(accountId: string, limit = 50): CoinLedgerEntry[] {
  const rows = db()
    .prepare(
      `SELECT id, delta, reason, meta, created_at FROM coin_ledger
       WHERE account_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(accountId, limit) as {
    id: string;
    delta: number;
    reason: CoinReason;
    meta: string | null;
    created_at: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    delta: r.delta,
    reason: r.reason,
    meta: r.meta ? (JSON.parse(r.meta) as Record<string, unknown>) : null,
    createdAt: r.created_at,
  }));
}

/**
 * Hadiah kemenangan solo: max(5, 20 - jumlah tebakan). Dijaga `solo_wins`
 * supaya mengirim ulang kata yang sama tidak pernah membayar dua kali --
 * mode solo tidak punya sesi server yang melacak status "sudah menang".
 */
export function awardSoloWin(
  accountId: string,
  puzzleId: number,
  guessCount: number,
): { awarded: boolean; amount?: number; balance?: number } {
  const clamped = Math.max(1, Math.min(1000, Math.trunc(guessCount) || 1));
  const info = db()
    .prepare(
      `INSERT OR IGNORE INTO solo_wins (account_id, puzzle_id, guess_count, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(accountId, puzzleId, clamped, Date.now());
  if (info.changes === 0) return { awarded: false };

  const amount = Math.max(5, 20 - clamped);
  const { balance } = earnCoins(accountId, amount, "solo_win", { puzzleId, guessCount: clamped });
  return { awarded: true, amount, balance };
}
