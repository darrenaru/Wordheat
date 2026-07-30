/**
 * Animasi koin terbang dari saldo di header menuju tombol powerup yang baru
 * dibeli. Pola sama seperti `useGuessFx`/`GuessFx.tsx`: event ber-id naik,
 * diterjemahkan jadi partikel oleh lapisan overlay terpisah (`CoinFxLayer`).
 *
 * Asalnya (chip saldo di header) didaftarkan sekali oleh `App.tsx` lewat
 * `registerCoinFxOrigin` — modul ini sendiri tidak tahu apa-apa soal DOM
 * selain dua titik itu.
 */

let originEl: HTMLElement | null = null;

export function registerCoinFxOrigin(el: HTMLElement | null): void {
  originEl = el;
}

export interface CoinFxEvent {
  id: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  count: number;
}

let counter = 0;
const listeners = new Set<(event: CoinFxEvent) => void>();

export function subscribeCoinFx(listener: (event: CoinFxEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function centerOf(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Dipanggil setelah pembelian powerup benar-benar sukses (bukan optimis saat
 * klik) — `targetEl` biasanya tombol powerup yang baru saja dibeli.
 */
export function fireCoinFx(targetEl: HTMLElement | null, count = 6): void {
  if (!originEl || !targetEl) return;
  counter += 1;
  const event: CoinFxEvent = { id: counter, from: centerOf(originEl), to: centerOf(targetEl), count };
  for (const listener of listeners) listener(event);
}
