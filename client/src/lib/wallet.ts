/**
 * Saldo coin pemain (anonim maupun login) — server adalah satu-satunya
 * sumber kebenaran. Modul ini cuma menyimpan salinan lokal supaya UI
 * (chip header, tombol powerup) bisa langsung baca tanpa fetch ulang tiap
 * render, di-refresh saat load dan tiap kali respons API/WS lain membawa
 * saldo baru.
 */
import { api } from './api.ts';

let balance = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

void api
  .wallet()
  .then((value) => {
    balance = value;
    emit();
  })
  .catch(() => {});

export function getBalance(): number {
  return balance;
}

export function subscribeWallet(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Dipanggil tiap respons API/WS membawa saldo baru — hindari fetch ulang. */
export function applyBalance(next: number): void {
  balance = next;
  emit();
}
