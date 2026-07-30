/**
 * Utilitas kecil untuk lapisan animasi.
 *
 * Semua efek dinamis (partikel, kilat suhu, getaran) harus lewat sini supaya
 * satu aturan berlaku di mana-mana: pemain yang meminta gerak minimal tidak
 * pernah melihat partikel sama sekali, bukan sekadar melihatnya berkedip cepat.
 */

import { useEffect, useState } from 'react';
import type { Temperature } from '@shared/types.ts';

/** Keluarga suhu — menentukan "rasa" partikel yang dipakai. */
export type HeatFamily = 'cold' | 'warm' | 'correct';

export function heatFamily(temperature: Temperature): HeatFamily {
  if (temperature === 'correct') return 'correct';
  return temperature === 'warm' || temperature === 'hot' || temperature === 'very-hot'
    ? 'warm'
    : 'cold';
}

const QUERY = '(prefers-reduced-motion: reduce)';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const sync = () => setReduced(media.matches);
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return reduced;
}

/**
 * Memutar ulang animasi CSS pada elemen yang sudah ada di DOM.
 *
 * Reflow paksa di tengah diperlukan: tanpa itu browser menganggap kelasnya
 * tidak pernah hilang, dan animasi kedua tidak akan pernah jalan.
 */
export function replayAnimation(el: HTMLElement | null, className: string): void {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
}

/** Acak dalam rentang, dipakai untuk menyebar partikel supaya tidak terlihat berpola. */
export function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
