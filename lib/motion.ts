import { useLayoutEffect, useRef, useState, useEffect } from "react";

/** Pemain yang meminta gerak minimal tidak pernah melihat animasi geser ini. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}

const SHIFT_MS = 340;

/**
 * Animasi geser saat daftar tebakan diurut ulang.
 *
 * Tanpa ini, baris "berteleportasi" ke posisi barunya begitu satu tebakan
 * lebih dekat masuk dan daftarnya diurut ulang, dan pemain kehilangan jejak
 * kata yang tadi dilihatnya. Tiap baris digeser balik ke posisi lamanya
 * (lewat Web Animations API, di luar siklus render React) lalu dilepas ke
 * posisi barunya.
 *
 * `offsetTop` dipakai, bukan `getBoundingClientRect`, karena halaman ikut
 * bergeser saat daftar bertambah panjang dan koordinat viewport jadi menipu.
 *
 * @param items Daftar saat ini, dalam urutan render -- dipakai sebagai
 *   pemicu efek lewat panjang & urutannya, isinya sendiri tidak dibaca.
 * @returns Fungsi yang menghasilkan ref-callback untuk dipasang ke elemen
 *   tiap baris, diberi kunci stabil yang sama dengan `key` di JSX.
 */
export function useReorderAnimation<T>(
  items: T[],
): (key: string) => (node: HTMLElement | null) => void {
  const reduced = usePrefersReducedMotion();
  const rows = useRef(new Map<string, HTMLElement>());
  const lastTop = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const current = new Map<string, number>();

    rows.current.forEach((row, key) => {
      const top = row.offsetTop;
      current.set(key, top);

      const previous = lastTop.current.get(key);
      if (reduced || previous === undefined) return;

      const shift = previous - top;
      if (Math.abs(shift) < 1) return;

      row.animate(
        [{ transform: `translateY(${shift}px)` }, { transform: "translateY(0)" }],
        { duration: SHIFT_MS, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
      );
    });

    lastTop.current = current;
  }, [items, reduced]);

  return (key: string) => (node: HTMLElement | null) => {
    if (node) rows.current.set(key, node);
    else rows.current.delete(key);
  };
}

/* ---------------------------------------------------------- efek tebakan */

/** Acak dalam rentang, dipakai untuk menyebar partikel supaya tidak terlihat berpola. */
export function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export type GuessFxFamily = "cold" | "warm" | "correct";

export type GuessFx = {
  /** Naik tiap kejadian baru -- dipakai sebagai `key` supaya animasi mulai lagi. */
  id: number;
  word: string;
  rank: number;
  family: GuessFxFamily;
  correct: boolean;
  /** Tebakan ini memecahkan rekor kedekatan sejauh ini. */
  improved: boolean;
};

/**
 * Peringkat -> keluarga suhu, menentukan "rasa" kilatan dan partikelnya.
 * Ambang batasnya sama dengan yang membedakan label "hangat" dari "dingin"
 * di `lib/heat.ts`'s `heatLabel`, supaya kilatan layar tidak pernah
 * berseberangan dengan label yang terbaca di baris tebakan itu sendiri.
 */
export function heatFamilyFromRank(rank: number): GuessFxFamily {
  if (rank === 1) return "correct";
  return rank <= 1000 ? "warm" : "cold";
}

/** Membungkus satu hasil tebakan jadi kejadian yang bisa dianimasikan. */
export function buildGuessFx(
  id: number,
  word: string,
  rank: number,
  previousBest: number | null,
): GuessFx {
  return {
    id,
    word,
    rank,
    family: heatFamilyFromRank(rank),
    correct: rank === 1,
    improved: previousBest === null || rank < previousBest,
  };
}
