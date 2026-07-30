/**
 * Stok powerup pemain (anonim maupun login) — server adalah satu-satunya
 * sumber kebenaran. Pola sama seperti `wallet.ts`: cuma bertambah lewat
 * pembelian di Shop, cuma berkurang lewat pemakaian di dalam ronde.
 */
import type { PowerupInventory } from '@shared/types.ts';
import { api } from './api.ts';

let inventory: PowerupInventory = { nearestGuess: 0, letterReveal: 0 };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

void api
  .inventory()
  .then((value) => {
    inventory = value;
    emit();
  })
  .catch(() => {});

export function getInventory(): PowerupInventory {
  return inventory;
}

export function subscribeInventory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Dipanggil tiap respons API/WS membawa stok baru — hindari fetch ulang. */
export function applyInventory(next: PowerupInventory): void {
  inventory = next;
  emit();
}
