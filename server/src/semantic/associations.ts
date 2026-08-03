import { readFileSync } from 'node:fs';
import { normalizeWord } from './embeddings.ts';

// Grup kata sebelum titik dua mengizinkan strip (`-`) — beberapa kata
// target adalah kata majemuk berhubung strip (mis. "lumba-lumba",
// "kupu-kupu"); tanpa `-` di sini, baris `+` untuk kata-kata itu gagal
// cocok dan diam-diam diabaikan (lihat `loadAssociations`).
const ASSOCIATION_LINE = /^\+\s*([a-z-]+)\s*:\s*(.+)$/i;
const WEIGHTED_TOKEN = /^([a-z]+)([1-3])$/i;

/**
 * Baca asosiasi kurasi tangan `+ kata: terkait1<bobot> terkait2<bobot> ...`
 * dari leksikon lama (`lexicon.lex`) — satu-satunya bagian file itu yang
 * masih relevan di luar `build-embeddings.ts`. Sisanya (baris `@` fitur
 * kategori, daftar kata per kategori) diabaikan; hanya asosiasi kata-ke-kata
 * eksplisit yang dipakai, sebagai sinyal tambahan untuk menambal celah
 * geometri cosine embedding (lihat pemakaian di `engine.ts`).
 */
export function loadAssociations(path: string): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);

  for (const raw of lines) {
    const match = ASSOCIATION_LINE.exec(raw.trim());
    if (!match) continue;
    const word = normalizeWord(match[1]);
    if (!word) continue;

    const entry = out.get(word) ?? new Map<string, number>();
    for (const token of match[2].trim().split(/\s+/)) {
      const tokenMatch = WEIGHTED_TOKEN.exec(token);
      if (!tokenMatch) continue;
      const assocWord = normalizeWord(tokenMatch[1]);
      if (!assocWord || assocWord === word) continue;
      const weight = Number(tokenMatch[2]);
      const existing = entry.get(assocWord);
      if (existing === undefined || weight > existing) entry.set(assocWord, weight);
    }
    if (entry.size > 0) out.set(word, entry);
  }

  return out;
}
