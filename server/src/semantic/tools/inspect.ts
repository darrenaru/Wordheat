/**
 * Alat bantu kurasi lexicon. Jalankan: `npm run lexicon:check [kata...]`
 *
 * Tanpa argumen: cetak ringkasan kosakata + sanity check beberapa pasangan
 * kata yang hasilnya harus terasa masuk akal.
 * Dengan argumen: cetak 15 kata terdekat untuk tiap kata yang diberikan.
 */
import { getEngine } from '../engine.ts';
import { TEMPERATURE_LABEL } from '@shared/types.ts';

const engine = getEngine();
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`Kosakata      : ${engine.vocabularySize} kata`);
  console.log(`Dimensi vektor: ${engine.lexicon.dim} (fastText cc.id.300)`);
  console.log(`Kata target   : ${engine.targets.length}`);
  console.log(`Pool peringkat: ${engine.poolSize}`);
  console.log(`Alias         : ${engine.lexicon.aliases.size}`);
  console.log('');

  const checks: Array<[string, string]> = [
    ['topi', 'kepala'],
    ['topi', 'makan'],
    ['topi', 'sepatu'],
    ['kucing', 'anjing'],
    ['kucing', 'lemari'],
    ['nasi', 'roti'],
    ['dokter', 'obat'],
    ['hujan', 'payung'],
    ['gitar', 'musik'],
    ['gunung', 'laut'],
    ['sepatu', 'jantung'],
  ];
  console.log('Sanity check pasangan kata:');
  for (const [a, b] of checks) {
    const s = engine.score(a, b);
    const rank = s.rank === null ? '  -' : String(s.rank).padStart(3);
    console.log(
      `  ${a.padEnd(10)} ~ ${b.padEnd(10)} sim=${s.similarity.toFixed(3)} rank=${rank} ${TEMPERATURE_LABEL[s.temperature]}`,
    );
  }
} else {
  for (const raw of args) {
    const word = engine.resolve(raw);
    if (!word) {
      console.log(`"${raw}" tidak ada di lexicon.\n`);
      continue;
    }
    console.log(`Terdekat dari "${word}":`);
    for (const n of engine.neighbors(word).slice(0, 15)) {
      const s = engine.score(word, n.word);
      console.log(
        `  ${String(n.rank).padStart(3)}. ${n.word.padEnd(16)} ${n.similarity.toFixed(3)}  ${TEMPERATURE_LABEL[s.temperature]}`,
      );
    }
    console.log('');
  }
}
