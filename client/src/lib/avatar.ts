import { AVATAR_PART_NONE, type AvatarConfig } from '@shared/types.ts';
import type { RenderResult, StylePartKind } from './avatarEngine.ts';

/**
 * Palet latar avatar — cerminan langsung dari token di `tokens.css`.
 *
 * Nilainya harus berupa literal, bukan `var(...)`: warna ini ikut tersimpan di
 * profil pemain dan dikirim ke pemain lain lewat ruang, jadi harus tetap sama
 * artinya di luar konteks CSS. Konsekuensinya daftar ini **wajib ikut diubah**
 * setiap kali palet berubah — kalau tidak, studio avatar menampilkan warna
 * dari palet lama.
 */
export const AVATAR_BACKGROUNDS = [
  '1F1F23', // --surface-alt, netral
  'FF319F', // --brand
  'FF4A38', // --very-hot
  'FF8F4D', // --hot
  'E3BE43', // --warm
  '3FD177', // --correct
  '37CBBE', // --cool
  '3BB4E5', // --cold
  '4C8DF6', // --freezing
  'F3EFDA', // --cream
];

/**
 * Nilai `--surface-alt` sebagai hex tanpa '#'.
 *
 * Dibaca dari token, bukan disalin: latar pratinjau di studio pernah tertinggal
 * dua generasi palet justru karena nilainya ditulis ulang di dalam kode.
 */
let surfaceHex: string | null = null;

export function surfaceHexColor(): string {
  if (surfaceHex) return surfaceHex;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--surface-alt')
    .trim();
  surfaceHex = /^#?([0-9a-fA-F]{6})$/.exec(raw)?.[1] ?? '1F1F23';
  return surfaceHex;
}

/**
 * Nama Indonesia untuk opsi DiceBear. Daftar ini juga menentukan bagian mana
 * yang muncul di studio dan dalam urutan apa — dari atas kepala turun ke bawah,
 * baru aksesori. Opsi yang tidak tercantum sengaja disembunyikan supaya
 * panelnya tetap ringkas.
 */
const PART_LABELS: Record<string, string> = {
  hair: 'Rambut',
  hairColor: 'Warna rambut',
  eyebrows: 'Alis',
  eyes: 'Mata',
  mouth: 'Mulut',
  skinColor: 'Warna kulit',
  glasses: 'Kacamata',
  earrings: 'Anting',
  // mustache / blush / birthmark / freckles — satu label payung lebih jujur
  // daripada menamai salah satunya.
  features: 'Detail wajah',
};

const PART_ORDER = Object.keys(PART_LABELS);

export interface AvatarPart {
  key: string;
  label: string;
  kind: StylePartKind;
  values: string[];
  /** Bisa dikosongkan — studio menawarkan pilihan "Tanpa". */
  optional: boolean;
}

type Engine = typeof import('./avatarEngine.ts');

let engine: Engine | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Mulai memuat mesin avatar. Aman dipanggil berkali-kali. */
export function ensureAvatarEngine(): void {
  if (engine || loading) return;
  loading = import('./avatarEngine.ts')
    .then((module) => {
      engine = module;
      for (const listener of listeners) listener();
    })
    .catch(() => {
      // Gagal memuat bukan alasan untuk menghentikan permainan; avatar tetap
      // tampil sebagai inisial berwarna.
      loading = null;
    });
}

export function subscribeAvatarEngine(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function avatarEngineVersion(): number {
  return engine ? 1 : 0;
}

/** Bagian yang bisa disetel, atau `null` bila mesinnya belum siap. */
export function avatarParts(): AvatarPart[] | null {
  if (!engine) {
    ensureAvatarEngine();
    return null;
  }
  return engine
    .describeStyle()
    .filter((part) => part.values.length > 1 && part.key in PART_LABELS)
    .map((part) => ({ ...part, label: PART_LABELS[part.key] }))
    .sort((a, b) => PART_ORDER.indexOf(a.key) - PART_ORDER.indexOf(b.key));
}

const cache = new Map<string, RenderResult>();

/**
 * Sidik jari sebuah konfigurasi avatar. Selain jadi kunci cache, ini juga
 * dipakai membandingkan dua konfigurasi (mis. draf vs profil tersimpan).
 */
export function avatarKey(config: AvatarConfig): string {
  const parts = Object.entries(config.parts ?? {})
    // Diurut supaya dua konfigurasi yang sama tapi urutan kuncinya berbeda —
    // hal biasa setelah objeknya bolak-balik lewat JSON — tetap satu entri.
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
  return `${config.seed}|${config.backgroundColor}|${parts}`;
}

function renderCached(config: AvatarConfig): RenderResult | null {
  if (!engine) {
    ensureAvatarEngine();
    return null;
  }
  const key = avatarKey(config);
  const cached = cache.get(key);
  if (cached) return cached;

  const result = engine.render(config);
  // Batasnya cukup longgar: membuka satu bagian di studio saja sudah merender
  // puluhan pratinjau, dan berpindah bagian bolak-balik tidak boleh memaksa
  // semuanya dirender ulang.
  if (cache.size > 800) cache.clear();
  cache.set(key, result);
  return result;
}

/** SVG avatar sebagai data URI, atau `null` bila mesinnya belum siap. */
export function avatarDataUri(config: AvatarConfig): string | null {
  return renderCached(config)?.uri ?? null;
}

/**
 * Bagian yang benar-benar terpakai pada konfigurasi ini, termasuk yang dipilih
 * `seed`. Dipakai studio untuk menunjukkan "sedang di varian mana" walau bagian
 * itu belum dipatok pemain.
 */
export function avatarResolvedParts(config: AvatarConfig): Record<string, string> | null {
  return renderCached(config)?.resolved ?? null;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 12);
}

/**
 * Avatar acak sepenuhnya. Bagian yang sebelumnya dipilih sendiri ikut
 * dilepas — kalau tidak, tombol "Acak" terasa rusak karena rambut yang sudah
 * dikunci tidak pernah berubah.
 */
export function randomAvatar(): AvatarConfig {
  return {
    seed: randomSeed(),
    backgroundColor: AVATAR_BACKGROUNDS[Math.floor(Math.random() * AVATAR_BACKGROUNDS.length)],
  };
}

/**
 * Mengubah satu bagian. `value` `null` berarti kembali mengikuti seed, dan
 * kuncinya dibuang supaya konfigurasi tidak menyimpan pilihan kosong.
 */
export function withPart(
  avatar: AvatarConfig,
  key: string,
  value: string | null,
): AvatarConfig {
  const parts = { ...(avatar.parts ?? {}) };
  if (value === null) delete parts[key];
  else parts[key] = value;
  return {
    ...avatar,
    parts: Object.keys(parts).length > 0 ? parts : undefined,
  };
}

export { AVATAR_PART_NONE };

/** Inisial untuk placeholder sebelum mesin avatar selesai dimuat. */
export function initialsFor(seed: string): string {
  const letters = seed.replace(/[^a-zA-Z]/g, '');
  return (letters.slice(0, 2) || '??').toUpperCase();
}
