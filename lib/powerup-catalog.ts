/**
 * Katalog Power-Up: tipe, biaya, dan label bersama server dan klien.
 *
 * Sengaja BUKAN "server-only" -- komponen klien (toko, papan permainan) perlu
 * membaca biaya dan label yang sama persis yang dipakai server untuk
 * menegakkan pembelian, supaya harga yang ditampilkan tidak pernah meleset
 * dari yang benar-benar dipotong. Logika permainan yang menyentuh kata
 * rahasia tetap tinggal di lib/powerups.ts dan lib/puzzles.ts (server-only).
 */

export type PowerUpKind = "reveal_initial" | "reveal_digits" | "closest_guess";

export const POWER_UP_KINDS: PowerUpKind[] = ["reveal_initial", "reveal_digits", "closest_guess"];

export type RevealInitialPayload = { letter: string; length: number };
export type RevealDigitsPayload = { length: number; letters: { index: number; char: string }[] };
export type RevealPayload = RevealInitialPayload | RevealDigitsPayload;

export type PowerUpCatalogEntry = {
  label: string;
  description: string;
  cost: number;
  /** Sekali pakai per puzzle/pertandingan (false) atau bisa dipakai berulang selama stok ada (true). */
  repeatable: boolean;
};

export const POWER_UP_CATALOG: Record<PowerUpKind, PowerUpCatalogEntry> = {
  reveal_initial: {
    label: "Buka Huruf Awal",
    description: "Menampilkan huruf pertama kata rahasia.",
    cost: 10,
    repeatable: false,
  },
  reveal_digits: {
    label: "Buka Jumlah Huruf",
    description: "Menampilkan panjang kata rahasia dan 1-2 huruf acak di dalamnya.",
    cost: 15,
    repeatable: false,
  },
  closest_guess: {
    label: "Tebakan Terdekat",
    description: "Otomatis mengirim kata terdekat yang belum pernah kamu tebak.",
    cost: 20,
    repeatable: true,
  },
};

export function emptyInventory(): Record<PowerUpKind, number> {
  return { reveal_initial: 0, reveal_digits: 0, closest_guess: 0 };
}

export function isPowerUpKind(value: unknown): value is PowerUpKind {
  return typeof value === "string" && (POWER_UP_KINDS as string[]).includes(value);
}
