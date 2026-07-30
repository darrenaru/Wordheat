/**
 * Loader untuk kosakata embedding fastText yang sudah disaring & disimpan
 * secara lokal oleh `tools/build-embeddings.ts` (lihat file itu untuk cara
 * datanya dihasilkan — proses itu butuh jaringan, loader ini tidak).
 *
 * Dibaca dari tiga berkas di `data/`:
 *   embeddings.words.txt  -> satu kata per baris, urutannya = indeks vektor
 *   embeddings.vec.bin    -> Float32 padat berurutan (wordCount x dim x 4 byte)
 *   aliases.txt           -> `~ kanonik -> alias, alias` (bentuk lain yang
 *                             lumrah diketik pemain, mis. singkatan)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const EMBEDDING_DIM = 300;

export interface WordVector {
  word: string;
  vector: Float32Array;
  norm: number;
}

export interface Lexicon {
  dim: number;
  vectors: Map<string, WordVector>;
  /** bentuk alternatif -> bentuk kanonik */
  aliases: Map<string, string>;
  words: string[];
}

export function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z' -]/g, '');
}

export function cosine(a: WordVector, b: WordVector): number {
  if (a.norm === 0 || b.norm === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.vector.length; i++) dot += a.vector[i] * b.vector[i];
  return dot / (a.norm * b.norm);
}

function readWords(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function readVectors(path: string, wordCount: number, dim: number): Float32Array {
  const buf = readFileSync(path);
  const expected = wordCount * dim * 4;
  if (buf.length !== expected) {
    throw new Error(
      `embeddings.vec.bin: ukuran ${buf.length} byte tidak cocok dengan ${wordCount} kata x ${dim} dim ` +
        `(diharapkan ${expected} byte). Jalankan ulang "npm run embeddings:build".`,
    );
  }
  return new Float32Array(buf.buffer, buf.byteOffset, wordCount * dim);
}

function readAliases(path: string): Map<string, string> {
  const aliases = new Map<string, string>();
  const text = readFileSync(path, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.startsWith('~')) continue;
    const [canonicalPart, aliasPart] = line.slice(1).split('->');
    if (!aliasPart) continue;
    const canonical = normalizeWord(canonicalPart);
    for (const alias of aliasPart.split(',').map(normalizeWord).filter(Boolean)) {
      aliases.set(alias, canonical);
    }
  }
  return aliases;
}

export function loadEmbeddingLexicon(dataDir: string): Lexicon {
  const words = readWords(resolve(dataDir, 'embeddings.words.txt'));
  const flat = readVectors(resolve(dataDir, 'embeddings.vec.bin'), words.length, EMBEDDING_DIM);
  const aliases = readAliases(resolve(dataDir, 'aliases.txt'));

  // Mean-centering ("all-but-the-top" tanpa langkah PCA-nya): vektor fastText
  // mentah punya offset rata-rata korpus yang membuat cosine similarity antar
  // kata ACAK MANA PUN condong tinggi ("hubness") — dua kata tak terkait bisa
  // tetap sim>0.2. Mengurangi rata-rata seluruh kosakata dari tiap vektor
  // menghilangkan bias itu sehingga cosine jauh lebih diskriminatif antara
  // pasangan yang benar-benar terkait vs yang tidak.
  const mean = new Float64Array(EMBEDDING_DIM);
  for (let i = 0; i < words.length; i++) {
    const base = i * EMBEDDING_DIM;
    for (let d = 0; d < EMBEDDING_DIM; d++) mean[d] += flat[base + d];
  }
  for (let d = 0; d < EMBEDDING_DIM; d++) mean[d] /= words.length;
  for (let i = 0; i < flat.length; i++) flat[i] -= mean[i % EMBEDDING_DIM];

  const vectors = new Map<string, WordVector>();
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const vector = flat.subarray(i * EMBEDDING_DIM, (i + 1) * EMBEDDING_DIM);
    let sumSq = 0;
    for (let d = 0; d < vector.length; d++) sumSq += vector[d] * vector[d];
    vectors.set(word, { word, vector, norm: Math.sqrt(sumSq) });
  }

  for (const [alias, canonical] of aliases) {
    if (!vectors.has(canonical)) {
      throw new Error(`aliases.txt: alias "${alias}" menunjuk kata tak dikenal "${canonical}"`);
    }
  }

  return { dim: EMBEDDING_DIM, vectors, aliases, words };
}
