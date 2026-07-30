/**
 * Script build sekali-jalan (BUKAN dipanggil saat runtime server).
 *
 * Mengunduh fastText `cc.id.300.vec.gz` (crawl vectors resmi, diurut dari kata
 * paling sering muncul), menyaring jadi kosakata Bahasa Indonesia yang bersih,
 * lalu menyimpannya sebagai vektor biner ringkas plus targets.txt/aliases.txt
 * hasil irisan dengan lexicon.lex lama.
 *
 * Jalankan: npm run embeddings:build [jumlahKata]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, '..', 'data');

const VEC_URL = 'https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.id.300.vec.gz';
const DIM = 300;
const TARGET_COUNT = Number(process.argv[2]) || 50_000;
// Banyak baris mentah dibuang filter (angka, tanda baca, kata asing) — baca
// lebih banyak dari target supaya tetap tercapai.
const MAX_RAW_LINES = TARGET_COUNT * 12;

const WORD_RE = /^[a-z]+(-[a-z]+)*$/;

function cleanToken(raw: string): string | null {
  const w = raw.toLowerCase().trim();
  if (w.length < 2 || w.length > 25) return null;
  if (!WORD_RE.test(w)) return null;
  return w;
}

function loadBlocklist(): Set<string> {
  const text = readFileSync(resolve(DATA_DIR, 'blocklist.txt'), 'utf8');
  const set = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const body = line.replace(/#.*$/, '').trim();
    if (!body) continue;
    for (const w of body.split(',')) {
      const t = w.trim().toLowerCase();
      if (t) set.add(t);
    }
  }
  return set;
}

async function downloadAndFilter(blocked: Set<string>): Promise<{ words: string[]; vectors: Float32Array[] }> {
  console.log(`Mengunduh & menyaring ${VEC_URL}`);
  console.log(`Target: ${TARGET_COUNT} kata (maks ${MAX_RAW_LINES} baris mentah dibaca)`);

  const controller = new AbortController();
  const res = await fetch(VEC_URL, { signal: controller.signal });
  if (!res.ok || !res.body) throw new Error(`unduhan gagal: HTTP ${res.status}`);

  let stopped = false;
  const source = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream);
  source.on('error', (err) => {
    if (!stopped) console.error('stream sumber error:', err);
  });
  const gunzip = createGunzip();
  gunzip.on('error', (err) => {
    if (!stopped) console.error('gunzip error:', err);
  });
  source.pipe(gunzip);

  const rl = createInterface({ input: gunzip, crlfDelay: Infinity });

  const words: string[] = [];
  const vectors: Float32Array[] = [];
  const seen = new Set<string>();
  let rawLineNo = 0;
  let rejectedByRegexSample: string[] = [];
  let rejectedByBlocklistCount = 0;

  for await (const line of rl) {
    if (stopped) break;
    rawLineNo++;
    if (rawLineNo === 1) continue; // header "jumlahKata dimensi"

    const spaceIdx = line.indexOf(' ');
    if (spaceIdx === -1) continue;
    const rawWord = line.slice(0, spaceIdx);
    const word = cleanToken(rawWord);

    if (!word) {
      if (rejectedByRegexSample.length < 20) rejectedByRegexSample.push(rawWord);
    } else if (seen.has(word)) {
      // duplikat (mis. beda kapitalisasi di sumber) — lewati
    } else if (blocked.has(word)) {
      rejectedByBlocklistCount++;
    } else {
      const parts = line.slice(spaceIdx + 1).trim().split(' ');
      if (parts.length === DIM) {
        const vec = new Float32Array(DIM);
        let ok = true;
        for (let i = 0; i < DIM; i++) {
          const v = Number(parts[i]);
          if (!Number.isFinite(v)) {
            ok = false;
            break;
          }
          vec[i] = v;
        }
        if (ok) {
          seen.add(word);
          words.push(word);
          vectors.push(vec);
        }
      }
    }

    if (words.length >= TARGET_COUNT || rawLineNo >= MAX_RAW_LINES) {
      stopped = true;
    }
  }

  controller.abort();
  rl.close();
  gunzip.destroy();
  source.destroy();

  console.log(`Selesai baca: ${rawLineNo} baris mentah -> ${words.length} kata diterima.`);
  console.log(`  dibuang oleh regex/panjang: contoh -> ${rejectedByRegexSample.slice(0, 10).join(', ') || '-'}`);
  console.log(`  dibuang oleh blocklist.txt: ${rejectedByBlocklistCount} kata`);
  if (words.length < TARGET_COUNT) {
    console.warn(
      `Peringatan: hanya dapat ${words.length}/${TARGET_COUNT} kata sebelum baris mentah habis (${MAX_RAW_LINES}). ` +
        `Jalankan ulang dengan angka target lebih kecil, atau naikkan MAX_RAW_LINES di script ini.`,
    );
  }

  return { words, vectors };
}

function writeEmbeddingFiles(words: string[], vectors: Float32Array[]): void {
  writeFileSync(resolve(DATA_DIR, 'embeddings.words.txt'), words.join('\n') + '\n', 'utf8');

  const buf = Buffer.alloc(words.length * DIM * 4);
  for (let i = 0; i < vectors.length; i++) {
    const vec = vectors[i];
    const base = i * DIM * 4;
    for (let d = 0; d < DIM; d++) {
      buf.writeFloatLE(vec[d], base + d * 4);
    }
  }
  writeFileSync(resolve(DATA_DIR, 'embeddings.vec.bin'), buf);

  console.log(
    `Ditulis embeddings.words.txt (${words.length} kata) dan embeddings.vec.bin ` +
      `(${(buf.length / 1_000_000).toFixed(1)} MB).`,
  );
}

interface OldLexicon {
  categories: Array<{ name: string; words: string[] }>;
  aliasLines: Array<{ canonical: string; aliases: string[] }>;
}

function parseOldLexicon(): OldLexicon {
  const text = readFileSync(resolve(DATA_DIR, 'lexicon.lex'), 'utf8');
  const lines = text.split(/\r?\n/);
  const categories: Array<{ name: string; words: string[] }> = [];
  const aliasLines: Array<{ canonical: string; aliases: string[] }> = [];
  let current: { name: string; words: string[] } | null = null;
  let inAliasSection = false;
  const CATEGORY_TITLE_RE = /^[A-ZÀ-ÖØ-Þ,&\s]+$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('# ---')) continue;

    if (line.startsWith('#')) {
      const title = line.replace(/^#+/, '').trim();
      if (/^ALIAS/i.test(title)) {
        inAliasSection = true;
        current = null;
        continue;
      }
      if (title && CATEGORY_TITLE_RE.test(title)) {
        current = { name: title.toLowerCase(), words: [] };
        categories.push(current);
        inAliasSection = false;
      }
      continue;
    }

    if (line.startsWith('~')) {
      const [canonicalPart, aliasPart] = line.slice(1).split('->');
      if (!aliasPart) continue;
      const canonical = canonicalPart.trim().toLowerCase();
      const aliases = aliasPart
        .split(',')
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean);
      aliasLines.push({ canonical, aliases });
      continue;
    }

    if (line.startsWith('@') || line.startsWith('+')) continue;

    if (current && !inAliasSection) {
      for (const w of line.split(',')) {
        const word = w.trim().toLowerCase();
        if (word) current.words.push(word);
      }
    }
  }

  return { categories, aliasLines };
}

function buildTargetsAndAliases(vocab: Set<string>): void {
  const { categories, aliasLines } = parseOldLexicon();

  const targetLines: string[] = [
    '# Kata target yang dikurasi.',
    '# Dibangun otomatis dari lexicon.lex lama, diiriskan dengan kosakata',
    '# embedding fastText baru (lihat tools/build-embeddings.ts).',
    '# Setiap kata di sini WAJIB ada di embeddings.words.txt (dicek saat server start).',
    '',
  ];
  let totalKept = 0;
  let totalSkipped = 0;
  const skippedSample: string[] = [];

  for (const cat of categories) {
    const kept = cat.words.filter((w) => {
      const inVocab = vocab.has(w);
      if (!inVocab) {
        totalSkipped++;
        if (skippedSample.length < 30) skippedSample.push(w);
      }
      return inVocab;
    });
    totalKept += kept.length;
    if (kept.length === 0) continue;
    targetLines.push(`# --- ${cat.name} ---`);
    for (let i = 0; i < kept.length; i += 10) {
      targetLines.push(kept.slice(i, i + 10).join(', '));
    }
    targetLines.push('');
  }

  writeFileSync(resolve(DATA_DIR, 'targets.txt'), targetLines.join('\n').trimEnd() + '\n', 'utf8');
  console.log(
    `targets.txt: ${totalKept} kata target (${totalSkipped} kata lama dibuang, ` +
      `contoh: ${skippedSample.slice(0, 10).join(', ') || '-'})`,
  );

  const aliasOutLines: string[] = [
    '# Alias — bentuk lain yang lumrah diketik pemain.',
    '# Dibangun otomatis dari seksi ALIAS lexicon.lex lama, disaring ke kanonik',
    '# yang masih ada di kosakata embedding baru.',
    '',
  ];
  let aliasKept = 0;
  let aliasSkipped = 0;
  for (const { canonical, aliases } of aliasLines) {
    if (!vocab.has(canonical)) {
      aliasSkipped++;
      continue;
    }
    aliasOutLines.push(`~ ${canonical} -> ${aliases.join(', ')}`);
    aliasKept++;
  }
  writeFileSync(resolve(DATA_DIR, 'aliases.txt'), aliasOutLines.join('\n') + '\n', 'utf8');
  console.log(`aliases.txt: ${aliasKept} baris alias (${aliasSkipped} dibuang, kanonik tak ada di kosakata baru)`);
}

async function main(): Promise<void> {
  const blocked = loadBlocklist();
  const { words, vectors } = await downloadAndFilter(blocked);
  writeEmbeddingFiles(words, vectors);
  buildTargetsAndAliases(new Set(words));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
