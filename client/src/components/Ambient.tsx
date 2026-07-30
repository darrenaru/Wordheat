import { useMemo, type CSSProperties } from 'react';
import type { Temperature } from '@shared/types.ts';
import { between, usePrefersReducedMotion } from '../lib/motion.ts';

/**
 * Lapisan suasana di belakang seluruh isi layar: beberapa kabut warna yang
 * bergerak sangat pelan, ditambah bintik-bintik yang naik terus-menerus.
 *
 * Dua batasan yang membentuknya:
 *
 * 1. **Tidak boleh bersaing dengan konten.** Semua dijaga di opacity rendah;
 *    teks krem (17:1) harus tetap jadi yang paling terang di layar.
 * 2. **Di layar bermain, ini bukan hiasan.** Warnanya mengikuti suhu tebakan
 *    terakhir dan intensitasnya naik seiring pemain mendekat — ruangan ikut
 *    memanas. Jadi gerakan yang terus berjalan tetap membawa arti.
 */
interface AmbientProps {
  /** Bila diisi, kabut mengikuti warna suhu dan menguat saat makin panas. */
  temperature?: Temperature | null;
}

const MOTE_COUNT = 16;

function vars(record: Record<string, string>): CSSProperties {
  return record as CSSProperties;
}

export function Ambient({ temperature = null }: AmbientProps) {
  const reduced = usePrefersReducedMotion();

  // Dibuat sekali seumur komponen. Kalau diacak ulang tiap render, seluruh
  // animasi akan tersentak balik ke awal setiap kali suhu berubah.
  const motes = useMemo(
    () =>
      Array.from({ length: MOTE_COUNT }, () =>
        vars({
          '--x': `${between(0, 100).toFixed(1)}%`,
          '--sz': `${between(2.5, 6).toFixed(1)}px`,
          '--drift': `${between(-50, 50).toFixed(0)}px`,
          '--life': `${between(16, 30).toFixed(1)}s`,
          '--delay': `${between(-30, 0).toFixed(1)}s`,
        }),
      ),
    [],
  );

  if (reduced) return null;

  return (
    <div className="ambient" data-temp={temperature ?? undefined} aria-hidden="true">
      <span className="ambient__blob ambient__blob--a" />
      <span className="ambient__blob ambient__blob--b" />
      <span className="ambient__blob ambient__blob--c" />

      {motes.map((style, index) => (
        <span key={index} className="ambient__mote" style={style} />
      ))}
    </div>
  );
}
