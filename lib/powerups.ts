import "server-only";

import { db } from "@/lib/db";
import { spendCoins } from "@/lib/coins";
import {
  emptyInventory,
  POWER_UP_CATALOG,
  type PowerUpKind,
  type RevealDigitsPayload,
  type RevealInitialPayload,
} from "@/lib/powerup-catalog";
import {
  findClosestGuess,
  revealDigits,
  revealInitial,
  type GuessResult,
} from "@/lib/puzzles";

/**
 * Stok Power-Up dan pemakaiannya di mode solo.
 *
 * Tidak mengimpor lib/presence.ts -- sama seperti lib/coins.ts, pemberitahuan
 * real-time (notifyAccount) jadi tanggung jawab lapisan route API, bukan
 * modul ini, supaya tidak membentuk siklus lewat lib/rooms.ts.
 */

export function inventoryOf(accountId: string): Record<PowerUpKind, number> {
  const rows = db()
    .prepare("SELECT kind, count FROM power_up_inventory WHERE account_id = ?")
    .all(accountId) as { kind: PowerUpKind; count: number }[];
  const inventory = emptyInventory();
  for (const row of rows) inventory[row.kind] = row.count;
  return inventory;
}

export function incrementInventory(accountId: string, kind: PowerUpKind, by = 1): void {
  db()
    .prepare(
      `INSERT INTO power_up_inventory (account_id, kind, count) VALUES (?, ?, ?)
       ON CONFLICT(account_id, kind) DO UPDATE SET count = count + excluded.count`,
    )
    .run(accountId, kind, by);
}

/** Guarded: hanya berhasil kalau stoknya benar-benar ada. */
export function decrementInventory(accountId: string, kind: PowerUpKind): boolean {
  const info = db()
    .prepare(
      `UPDATE power_up_inventory SET count = count - 1
       WHERE account_id = ? AND kind = ? AND count >= 1`,
    )
    .run(accountId, kind);
  return info.changes > 0;
}

export type BuyPowerUpResult =
  | { ok: true; balance: number; inventory: Record<PowerUpKind, number> }
  | { ok: false; error: "insufficient-funds" };

export function buyPowerUp(accountId: string, kind: PowerUpKind): BuyPowerUpResult {
  const cost = POWER_UP_CATALOG[kind].cost;
  const spent = spendCoins(accountId, cost, "shop_buy", { kind });
  if (!spent.ok) return { ok: false, error: spent.error };
  incrementInventory(accountId, kind, 1);
  return { ok: true, balance: spent.balance, inventory: inventoryOf(accountId) };
}

export function soloPowerUpStatus(
  accountId: string,
  puzzleId: number,
): Partial<Record<PowerUpKind, RevealInitialPayload | RevealDigitsPayload>> {
  const rows = db()
    .prepare(
      `SELECT kind, result FROM solo_power_up_usage
       WHERE account_id = ? AND puzzle_id = ? AND result IS NOT NULL`,
    )
    .all(accountId, puzzleId) as { kind: PowerUpKind; result: string }[];
  const status: Partial<Record<PowerUpKind, RevealInitialPayload | RevealDigitsPayload>> = {};
  for (const row of rows) status[row.kind] = JSON.parse(row.result);
  return status;
}

export type UseRevealResult =
  | { ok: true; result: RevealInitialPayload | RevealDigitsPayload; alreadyUsed: boolean }
  | { ok: false; error: "insufficient-stock" | "bad-kind" };

/**
 * Pakai Power-Up sekali-pakai (reveal_initial/reveal_digits) di mode solo.
 *
 * Urutan reserve-then-await-then-finalize supaya aman dari dua klik
 * bersamaan: baris "pending" (result masih NULL) ditulis SINKRON tepat
 * setelah stok dipotong, sebelum satu pun `await` dijalankan -- pola
 * "tanpa await di antara pernyataan = tidak ada interleaving" yang dipakai
 * di seluruh basis kode ini hanya berlaku kalau reservasinya memang terjadi
 * sebelum bagian async (menghitung wahyu kata rahasia) dimulai.
 */
export async function useSoloRevealPowerUp(
  accountId: string,
  puzzleId: number,
  kind: PowerUpKind,
): Promise<UseRevealResult> {
  if (kind !== "reveal_initial" && kind !== "reveal_digits") {
    return { ok: false, error: "bad-kind" };
  }

  const existing = db()
    .prepare(
      `SELECT result FROM solo_power_up_usage
       WHERE account_id = ? AND puzzle_id = ? AND kind = ? AND result IS NOT NULL`,
    )
    .get(accountId, puzzleId, kind) as { result: string } | undefined;
  if (existing) {
    return { ok: true, result: JSON.parse(existing.result), alreadyUsed: true };
  }

  if (!decrementInventory(accountId, kind)) {
    return { ok: false, error: "insufficient-stock" };
  }

  // Reservasi: baris ditulis dengan result=NULL SEBELUM await manapun, supaya
  // request bersamaan yang lolos pemeriksaan `existing` di atas tidak juga
  // ikut lolos pemotongan stok dua kali.
  db()
    .prepare(
      `INSERT OR IGNORE INTO solo_power_up_usage (account_id, puzzle_id, kind, result, created_at)
       VALUES (?, ?, ?, NULL, ?)`,
    )
    .run(accountId, puzzleId, kind, Date.now());

  const result = kind === "reveal_initial" ? await revealInitial(puzzleId) : await revealDigits(puzzleId);
  if (!result) {
    // Puzzle tidak ditemukan: batalkan reservasi dan kembalikan stoknya.
    db()
      .prepare(`DELETE FROM solo_power_up_usage WHERE account_id = ? AND puzzle_id = ? AND kind = ?`)
      .run(accountId, puzzleId, kind);
    incrementInventory(accountId, kind, 1);
    return { ok: false, error: "bad-kind" };
  }

  db()
    .prepare(
      `UPDATE solo_power_up_usage SET result = ?
       WHERE account_id = ? AND puzzle_id = ? AND kind = ?`,
    )
    .run(JSON.stringify(result), accountId, puzzleId, kind);

  return { ok: true, result, alreadyUsed: false };
}

export type UseClosestGuessResult =
  | { ok: true; result: GuessResult; inventory: Record<PowerUpKind, number> }
  | { ok: false; error: "insufficient-stock" | "no-candidates" };

/** Pakai Power-Up "Tebakan Terdekat" di mode solo -- konsumsi 1 stok per pakai. */
export async function useSoloClosestGuess(
  accountId: string,
  puzzleId: number,
  guessed: string[],
): Promise<UseClosestGuessResult> {
  if (!decrementInventory(accountId, "closest_guess")) {
    return { ok: false, error: "insufficient-stock" };
  }

  const result = await findClosestGuess(puzzleId, guessed);
  if (!result) {
    incrementInventory(accountId, "closest_guess", 1);
    return { ok: false, error: "no-candidates" };
  }

  return { ok: true, result, inventory: inventoryOf(accountId) };
}
