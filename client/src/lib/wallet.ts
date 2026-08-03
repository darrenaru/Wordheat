/**
 * Saldo coin pemain (anonim maupun login) — server adalah satu-satunya
 * sumber kebenaran. Modul ini cuma menyimpan salinan lokal supaya UI
 * (chip header, tombol powerup) bisa langsung baca tanpa fetch ulang tiap
 * render, di-refresh saat load dan tiap kali respons API/WS lain membawa
 * saldo baru.
 */
import { api } from './api.ts';

let balance = 0;
/** Penanda "update terbaru" — dipakai membuang hasil fetch yang datang
 *  belakangan tapi sebenarnya lebih basi (mis. dorongan WS tiba lebih dulu
 *  daripada respons fetch yang dikirim sebelumnya, atau dua `refreshWallet()`
 *  tumpang tindih). Tanpa ini, hasil yang lebih lama tapi tiba belakangan
 *  bisa menimpa balik state yang sudah lebih baru. */
let version = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function fetchBalance(): void {
  const requestVersion = ++version;
  void api
    .wallet()
    .then((value) => {
      if (requestVersion !== version) return;
      balance = value;
      emit();
    })
    .catch(() => {});
}

fetchBalance();

export function getBalance(): number {
  return balance;
}

export function subscribeWallet(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Dipanggil tiap respons API/WS membawa saldo baru — hindari fetch ulang. */
export function applyBalance(next: number): void {
  version += 1;
  balance = next;
  emit();
}

/** Muat ulang dari server — dipanggil mis. setelah login/logout berganti profil. */
export function refreshWallet(): void {
  fetchBalance();
}
