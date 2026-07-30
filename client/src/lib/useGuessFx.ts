/**
 * Menerjemahkan satu hasil tebakan menjadi "kejadian" yang bisa dianimasikan.
 *
 * Komponen tampilan tidak perlu tahu riwayat: mereka cukup melihat `id` yang
 * selalu naik untuk memutar ulang animasi, plus keterangan apakah tebakan ini
 * memecahkan rekor kedekatan dan seberapa besar lompatannya.
 */

import { useEffect, useRef, useState } from 'react';
import type { Guess, Temperature } from '@shared/types.ts';

export interface GuessFx {
  /** Naik tiap tebakan baru. Dipakai sebagai `key` supaya animasi mulai lagi. */
  id: number;
  word: string;
  temperature: Temperature;
  closeness: number;
  /** Lonjakan kedekatan dibanding rekor sebelumnya (0..100), 0 bila tidak membaik. */
  delta: number;
  improved: boolean;
  correct: boolean;
}

/**
 * @param latest   Tebakan yang baru saja dijawab server.
 * @param guesses  Seluruh riwayat ronde ini, termasuk `latest`.
 * @param resetKey Berganti saat ronde/sesi baru dimulai — mengosongkan efek.
 */
export function useGuessFx(
  latest: Guess | null,
  guesses: Guess[],
  resetKey: string | number,
): GuessFx | null {
  const [fx, setFx] = useState<GuessFx | null>(null);
  // Menandai tebakan yang efeknya sudah diputar, supaya render ulang karena
  // sebab lain (mis. daftar pemain berubah) tidak memicu animasi kedua kali.
  const played = useRef<string | null>(null);
  const counter = useRef(0);

  // Efek reset sengaja dideklarasikan lebih dulu: saat mount kedua efek jalan
  // berurutan, dan yang ini tidak boleh menghapus efek yang baru saja dibuat.
  useEffect(() => {
    played.current = null;
    setFx(null);
  }, [resetKey]);

  useEffect(() => {
    if (!latest) return;
    const token = `${latest.order}:${latest.word}`;
    if (played.current === token) return;
    played.current = token;

    // Rekor lama dihitung dari riwayat tanpa tebakan ini — jauh lebih tahan
    // banting daripada menyimpan nilai terbaik di ref, karena ikut benar saat
    // sesi lama dilanjutkan atau ronde multiplayer berganti.
    const previousBest = guesses.reduce(
      (best, guess) => (guess.order === latest.order ? best : Math.max(best, guess.closeness)),
      0,
    );

    counter.current += 1;
    setFx({
      id: counter.current,
      word: latest.word,
      temperature: latest.temperature,
      closeness: latest.closeness,
      delta: Math.round(Math.max(0, latest.closeness - previousBest)),
      improved: latest.closeness > previousBest,
      correct: latest.temperature === 'correct',
    });
  }, [latest, guesses]);

  return fx;
}
