import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Guess, Temperature } from '@shared/types.ts';
import { cosine, normalizeWord, loadEmbeddingLexicon, type Lexicon, type WordVector } from './embeddings.ts';
import { isMorphologicalVariant, morphologicalVariantsOf } from './morphology.ts';
import { loadAssociations } from './associations.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, 'data');

export interface Neighbor {
  word: string;
  similarity: number;
  /** 1 = kata paling dekat dengan target (target sendiri tidak dihitung). */
  rank: number;
}

export interface ScoredGuess {
  word: string;
  similarity: number;
  rank: number | null;
  closeness: number;
  temperature: Temperature;
}

/**
 * Berapa banyak tetangga terdekat yang dianggap "zona panas". Peringkat di luar
 * pool ini tidak ditampilkan angkanya — persis seperti Semantle, agar pemain
 * fokus pada sinyal "sudah dekat" alih-alih angka cosine mentah yang abstrak.
 *
 * `POOL_RATIO` dipertahankan untuk kosakata kecil (mis. lexicon kurasi tangan,
 * 45% terasa pas). Begitu kosakata membesar (embedding fastText, puluhan ribu
 * kata umum yang sebagian besar tak relevan ke target mana pun), rasio tetap
 * akan menghasilkan pool puluhan ribu kata — bukan cuma bikin kata tak terkait
 * terasa "hangat" secara keliru, tapi juga bikin cache tetangga per target
 * membengkak proporsional ke ukuran vocab. `MAX_POOL_SIZE` mengunci pool ke
 * ukuran yang masuk akal terlepas dari besarnya kosakata — nilainya dipilih
 * empiris (lihat data di PR ini): batas atas peringkat pasangan kata yang
 * benar-benar terkait di kosakata 50 ribu kata konsisten di bawah ~250,
 * sedangkan pasangan kata umum yang tidak terkait mulai dari peringkat ~2500.
 */
const POOL_RATIO = 0.45;
const MAX_POOL_SIZE = 2000;

/**
 * Ambang suhu berbasis peringkat relatif (rank / poolSize), bukan cosine
 * mentah. Peringkat dipilih sebagai sinyal utama karena skala cosine berbeda
 * antar kata target — kata dengan tetangga rapat dan kata dengan tetangga
 * renggang tetap terasa adil kalau yang dipakai peringkat.
 *
 * `bar` adalah nilai heat meter di batas atas tiap band. Nilainya diikat ke
 * band supaya panjang bar dan label teks tidak pernah bertentangan.
 */
const RANK_BANDS: Array<{ maxRatio: number; temperature: Temperature; bar: number }> = [
  { maxRatio: 0.015, temperature: 'very-hot', bar: 100 },
  { maxRatio: 0.06, temperature: 'hot', bar: 85 },
  { maxRatio: 0.16, temperature: 'warm', bar: 65 },
  { maxRatio: 0.24, temperature: 'cool', bar: 45 },
  { maxRatio: 1.0, temperature: 'cold', bar: 30 },
];

/**
 * Penahan ringan: peringkat bagus pada target yang tetangganya sangat renggang
 * tidak boleh langsung dilabeli panas. Sengaja longgar — perannya hanya
 * menangkap kasus ekstrem, bukan ikut menentukan rasa permainan.
 */
const SIMILARITY_FLOOR: Array<{ temperature: Temperature; min: number }> = [
  { temperature: 'very-hot', min: 0.3 },
  { temperature: 'hot', min: 0.18 },
  { temperature: 'warm', min: 0.08 },
  { temperature: 'cool', min: 0.03 },
  { temperature: 'cold', min: 0.0001 },
];

const TEMP_RANK: Temperature[] = ['freezing', 'cold', 'cool', 'warm', 'hot', 'very-hot', 'correct'];

function coolerOf(a: Temperature, b: Temperature): Temperature {
  return TEMP_RANK.indexOf(a) <= TEMP_RANK.indexOf(b) ? a : b;
}

/**
 * Peringkat sintetis untuk pasangan kata yang punya asosiasi kurasi tangan
 * (lihat `associations.ts`) tapi geometri cosine mentahnya kebetulan lemah —
 * mis. "senang" vs target "cinta" (lihat catatan di `score()`). Nilainya
 * dipilih di titik tengah band peringkat yang cocok dengan bobot asosiasi
 * (3=inti→hot, 2=kuat→warm, 1=lemah→cool), supaya band akhirnya konsisten
 * dengan `RANK_BANDS`.
 */
const ASSOCIATION_RANK_RATIO: Record<number, number> = { 3: 0.04, 2: 0.11, 1: 0.2 };

/**
 * Petakan peringkat ke 0..100 secara linear di dalam band-nya masing-masing,
 * bukan linear terhadap seluruh pool. Tanpa ini, peringkat 61 dari 444 akan
 * menghasilkan bar 86% padahal labelnya baru "Hangat".
 */
function barFromRank(rank: number, poolSize: number): number {
  const ratio = rank / poolSize;
  let lowerRatio = 0;
  for (let i = 0; i < RANK_BANDS.length; i++) {
    const band = RANK_BANDS[i];
    if (ratio <= band.maxRatio) {
      const span = band.maxRatio - lowerRatio;
      const nextBar = RANK_BANDS[i + 1]?.bar ?? 0;
      const t = span === 0 ? 0 : (ratio - lowerRatio) / span;
      return Math.round((band.bar - (band.bar - nextBar) * t) * 10) / 10;
    }
    lowerRatio = band.maxRatio;
  }
  return 0;
}

export class SemanticEngine {
  readonly lexicon: Lexicon;
  readonly targets: string[];
  readonly poolSize: number;

  private readonly blocked: Set<string>;
  /** Asosiasi kurasi tangan (`+ kata: terkait<bobot> ...` di lexicon.lex), lihat `score()`. */
  private readonly associations: Map<string, Map<string, number>>;
  /** Cache daftar tetangga per target — dihitung sekali, dipakai seumur proses. */
  private readonly neighborCache = new Map<string, Neighbor[]>();
  private readonly rankCache = new Map<string, Map<string, number>>();

  constructor(
    lexicon: Lexicon,
    targets: string[],
    blocked: Set<string>,
    associations: Map<string, Map<string, number>> = new Map(),
  ) {
    this.lexicon = lexicon;
    this.blocked = blocked;
    this.associations = associations;
    this.targets = targets.filter((w) => lexicon.vectors.has(w) && !blocked.has(w));
    this.poolSize = Math.max(50, Math.min(MAX_POOL_SIZE, Math.round(lexicon.words.length * POOL_RATIO)));
  }

  static load(): SemanticEngine {
    const lexicon = loadEmbeddingLexicon(DATA_DIR);
    const targets = readList(resolve(DATA_DIR, 'targets.txt'));
    const blocked = new Set(readList(resolve(DATA_DIR, 'blocklist.txt')));
    const associations = loadAssociations(resolve(DATA_DIR, 'lexicon.lex'));

    const missing = targets.filter((w) => !lexicon.vectors.has(w));
    if (missing.length > 0) {
      throw new Error(
        `targets.txt memuat ${missing.length} kata yang tidak ada di lexicon: ${missing.slice(0, 10).join(', ')}`,
      );
    }
    return new SemanticEngine(lexicon, targets, blocked, associations);
  }

  get vocabularySize(): number {
    return this.lexicon.words.length;
  }

  /**
   * Ubah input mentah pemain menjadi kata kanonik di lexicon.
   * Mengembalikan `null` bila kata tidak dikenali.
   */
  resolve(input: string): string | null {
    const word = normalizeWord(input);
    if (!word) return null;
    if (this.lexicon.vectors.has(word)) return word;
    const alias = this.lexicon.aliases.get(word);
    if (alias) return alias;
    return null;
  }

  isBlocked(word: string): boolean {
    return this.blocked.has(word);
  }

  private vector(word: string): WordVector {
    const v = this.lexicon.vectors.get(word);
    if (!v) throw new Error(`kata "${word}" tidak ada di lexicon`);
    return v;
  }

  /**
   * Daftar tetangga terdekat target, terurut dari yang paling dekat, dipotong
   * ke `poolSize` teratas. Kata di luar itu selalu "freezing" (lihat `score`),
   * jadi peringkat persisnya tidak berguna — memotongnya di sini yang penting
   * supaya cache tidak menyimpan seluruh kosakata (bisa puluhan ribu entri)
   * per kata target.
   *
   * Bentuk imbuhan dari target sendiri (mis. "cintanya", "mencintai" untuk
   * target "cinta") dikecualikan dari pool ini — tanpa stemming, embedding
   * subword menaruh semua varian itu sangat dekat ke akar katanya sehingga
   * mereka memenuhi puluhan slot teratas pool dan mendesak sinonim asli
   * (kata berakar beda) jauh ke bawah peringkat. Tebakan langsung terhadap
   * varian ini tetap ditangani secara terpisah di `score()`.
   */
  neighbors(target: string): Neighbor[] {
    const cached = this.neighborCache.get(target);
    if (cached) return cached;

    const targetVector = this.vector(target);
    const variants = morphologicalVariantsOf(target);
    const scored: Array<{ word: string; similarity: number }> = [];
    for (const word of this.lexicon.words) {
      if (word === target || variants.has(word)) continue;
      scored.push({ word, similarity: cosine(targetVector, this.vector(word)) });
    }
    // Tie-break alfabetis supaya peringkat deterministik antar proses/mesin —
    // syarat mutlak agar semua pemain di satu ronde melihat angka yang sama.
    scored.sort((a, b) => b.similarity - a.similarity || (a.word < b.word ? -1 : 1));

    // Peringkat dihitung dari urutan penuh SEBELUM dipotong, supaya angkanya
    // tetap benar terhadap seluruh kosakata walau yang disimpan cuma sebagian.
    const list = scored.slice(0, this.poolSize).map((item, i) => ({ ...item, rank: i + 1 }));
    const ranks = new Map<string, number>();
    for (const item of list) ranks.set(item.word, item.rank);

    this.neighborCache.set(target, list);
    this.rankCache.set(target, ranks);
    return list;
  }

  /** Hitung skor sebuah tebakan terhadap target. */
  score(target: string, guessWord: string): ScoredGuess {
    if (guessWord === target) {
      return { word: guessWord, similarity: 1, rank: 0, closeness: 100, temperature: 'correct' };
    }

    this.neighbors(target);
    // Bentuk imbuhan dari target sendiri dikecualikan dari pool (lihat
    // `neighbors()`), tapi menebaknya seharusnya tetap terasa nyaris benar —
    // perlakukan seperti peringkat #1, bukan "freezing" karena tidak
    // ditemukan di pool normal.
    const isVariant = isMorphologicalVariant(guessWord, target);
    let rank = isVariant ? 1 : (this.rankCache.get(target)!.get(guessWord) ?? null);

    // Geometri cosine mentah kadang tidak sejalan dengan intuisi makna
    // (mis. target "cinta" punya wilayah tetangga sangat padat, jadi
    // sinonim asli seperti "senang" bisa jatuh jauh ke bawah peringkat
    // walau similarity-nya sebenarnya masih wajar). Asosiasi kurasi tangan
    // dari leksikon lama menambal celah itu — cuma bisa MEMPERBAIKI
    // peringkat (ambil yang lebih baik), tidak pernah memperburuknya.
    const assocWeight = this.associations.get(target)?.get(guessWord);
    if (assocWeight) {
      const assocRank = Math.max(1, Math.round(this.poolSize * ASSOCIATION_RANK_RATIO[assocWeight]));
      rank = rank === null ? assocRank : Math.min(rank, assocRank);
    }

    const similarity = cosine(this.vector(target), this.vector(guessWord));

    const inPool = rank !== null && rank <= this.poolSize;

    let temperature: Temperature = 'freezing';
    if (inPool && similarity > 0) {
      const ratio = rank! / this.poolSize;
      const byRank = RANK_BANDS.find((b) => ratio <= b.maxRatio)?.temperature ?? 'freezing';
      // Ambil label yang lebih dingin antara sinyal peringkat dan sinyal cosine.
      const bySimilarity =
        SIMILARITY_FLOOR.find((f) => similarity >= f.min)?.temperature ?? 'freezing';
      temperature = coolerOf(byRank, bySimilarity);
    }

    return {
      word: guessWord,
      similarity: Math.round(similarity * 10000) / 10000,
      rank: inPool ? rank : null,
      closeness: temperature === 'freezing' ? 0 : barFromRank(rank!, this.poolSize),
      temperature,
    };
  }

  toGuess(target: string, guessWord: string, order: number): Guess {
    const scored = this.score(target, guessWord);
    return {
      order,
      word: scored.word,
      similarity: scored.similarity,
      rank: scored.rank,
      closeness: scored.closeness,
      temperature: scored.temperature,
    };
  }

  /** Kata terdekat ke-`n` dari target — dipakai untuk fitur petunjuk. */
  hint(target: string, n: number): string | null {
    const list = this.neighbors(target);
    return list[n]?.word ?? null;
  }

  randomTarget(rng: () => number = Math.random): string {
    return this.targets[Math.floor(rng() * this.targets.length)];
  }
}

function readList(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean)
    .flatMap((line) => line.split(','))
    .map(normalizeWord)
    .filter(Boolean);
}

let singleton: SemanticEngine | null = null;

export function getEngine(): SemanticEngine {
  if (!singleton) singleton = SemanticEngine.load();
  return singleton;
}
