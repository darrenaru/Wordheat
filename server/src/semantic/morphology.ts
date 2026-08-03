/**
 * Heuristik ringan pemotong imbuhan Indonesia — BUKAN stemmer penuh
 * (Sastrawi dkk). Dipakai satu-satunya untuk mendeteksi bentuk imbuhan dari
 * kata target sendiri (mis. "cintanya", "mencintai", "kecintaan" untuk
 * target "cinta"), yang tanpa ini memenuhi pool tetangga terdekat target
 * (lihat `engine.ts`) karena embedding fastText berbasis subword menaruh
 * varian morfologis sangat dekat ke akar katanya.
 *
 * Membangkitkan bentuk permukaan (target + imbuhan) alih-alih mencoba
 * melepas imbuhan dari tiap kata kosakata — `neighbors()` di `engine.ts`
 * memanggil ini sekali per TARGET (bukan per kata), lalu cukup melakukan
 * pengecekan keanggotaan Set O(1) untuk 50.000 kata kosakata. Versi awal
 * yang melepas imbuhan dari tiap kata terbukti terlalu lambat: dipanggil
 * lintas ~978 kata target sekaligus (mis. skrip smoke test yang menyimpulkan
 * target lewat eliminasi), totalnya bisa melebihi 30 detik dan memicu
 * heartbeat WebSocket klien.
 */

const PREFIXES = [
  '', 'meng', 'meny', 'menge', 'mem', 'men', 'me',
  'peng', 'peny', 'pem', 'pen', 'pe',
  'ber', 'be', 'ter', 'di', 'ke', 'se', 'per',
];

const SUFFIXES = ['', 'kan', 'lah', 'kah', 'pun', 'nya', 'i', 'an'];

/**
 * Prefix nasal meN-/peN- meluruhkan konsonan pertama akar berawalan k/p/s/t
 * saat digabung — mis. "sapu" + "meny-" → "menyapu", BUKAN "menysapu".
 * Tanpa ini, bentuk baku turunan akar berawalan k/p/s/t (mis. target
 * "sayang" → "menyayangi") tidak pernah terbentuk sama sekali, jadi tidak
 * pernah dikenali sebagai varian target oleh `isMorphologicalVariant`
 * ataupun dikecualikan dari pool tetangga di `engine.ts`.
 */
const NASAL_DROP: Record<string, string> = {
  meng: 'k',
  meny: 's',
  mem: 'p',
  men: 't',
  peng: 'k',
  peny: 's',
  pem: 'p',
  pen: 't',
};

/** Bentuk permukaan `target` dengan tiap kombinasi prefix/suffix umum. */
export function morphologicalVariantsOf(target: string): Set<string> {
  const out = new Set<string>();
  for (const prefix of PREFIXES) {
    for (const suffix of SUFFIXES) {
      if (!prefix && !suffix) continue;
      out.add(prefix + target + suffix);
      const dropped = NASAL_DROP[prefix];
      if (dropped && target.startsWith(dropped)) {
        out.add(prefix + target.slice(1) + suffix);
      }
    }
  }
  return out;
}

/** Apakah `word` adalah bentuk imbuhan dari `target`? Cuma untuk pengecekan sekali (bukan loop kosakata) — untuk itu pakai `morphologicalVariantsOf` + `Set.has`. */
export function isMorphologicalVariant(word: string, target: string): boolean {
  if (word === target) return true;
  return morphologicalVariantsOf(target).has(word);
}
