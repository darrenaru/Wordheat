"use client";

import { useEffect, useMemo, useState } from "react";

const MOTE_COUNT = 16;

function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Lapisan suasana di belakang seluruh isi layar: tiga kabut warna yang
 * bergerak sangat pelan, ditambah bintik-bintik yang naik terus-menerus.
 * Murni dekoratif -- diadaptasi dari proyek Wordheat sebelumnya.
 *
 * Posisi tiap bintik diacak, jadi baru dirender setelah mount di klien:
 * merender angka acak saat SSR akan membuat HTML server dan hasil hidrasi
 * klien berbeda.
 */
export default function Ambient() {
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Dibuat sekali seumur komponen. Kalau diacak ulang tiap render, seluruh
  // animasi akan tersentak balik ke awal.
  const motes = useMemo(
    () =>
      Array.from(
        { length: MOTE_COUNT },
        () =>
          ({
            "--x": `${between(0, 100).toFixed(1)}%`,
            "--sz": `${between(2.5, 6).toFixed(1)}px`,
            "--drift": `${between(-50, 50).toFixed(0)}px`,
            "--life": `${between(16, 30).toFixed(1)}s`,
            "--delay": `${between(-30, 0).toFixed(1)}s`,
          }) as React.CSSProperties,
      ),
    [],
  );

  if (!mounted || reducedMotion) return null;

  return (
    <div className="ambient" aria-hidden="true">
      <span className="ambient__blob ambient__blob--a" />
      <span className="ambient__blob ambient__blob--b" />
      <span className="ambient__blob ambient__blob--c" />
      {motes.map((style, index) => (
        <span key={index} className="ambient__mote" style={style} />
      ))}
    </div>
  );
}
