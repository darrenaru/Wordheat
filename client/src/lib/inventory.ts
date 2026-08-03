/**
 * Stok powerup pemain (anonim maupun login) — server adalah satu-satunya
 * sumber kebenaran. Pola sama seperti `wallet.ts`: cuma bertambah lewat
 * pembelian di Shop, cuma berkurang lewat pemakaian di dalam ronde.
 */
import type { PowerupInventory } from '@shared/types.ts';
import { api } from './api.ts';

let inventory: PowerupInventory = { nearestGuess: 0, letterReveal: 0 };
/** Sama seperti `version` di `wallet.ts` — mencegah hasil fetch basi
 *  menimpa balik state yang sudah lebih baru (dorongan WS atau fetch lain
 *  yang lebih baru). */
let version = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function fetchInventory(): void {
  const requestVersion = ++version;
  void api
    .inventory()
    .then((value) => {
      if (requestVersion !== version) return;
      inventory = value;
      emit();
    })
    .catch(() => {});
}

fetchInventory();

export function getInventory(): PowerupInventory {
  return inventory;
}

export function subscribeInventory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Dipanggil tiap respons API/WS membawa stok baru — hindari fetch ulang. */
export function applyInventory(next: PowerupInventory): void {
  version += 1;
  inventory = next;
  emit();
}

/** Muat ulang dari server — dipanggil mis. setelah login/logout berganti profil. */
export function refreshInventory(): void {
  fetchInventory();
}
