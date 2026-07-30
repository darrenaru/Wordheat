/**
 * Semua kode DiceBear terkumpul di file ini dan HANYA diimpor secara dinamis
 * (lihat `avatar.ts`). Pemisahan ini menjaga bundle awal tetap ringan: paket
 * DiceBear lebih besar dari seluruh sisa aplikasi, padahal permainan sudah bisa
 * dimainkan sebelum avatar selesai dirender.
 *
 * Hanya gaya "adventurer" yang dipakai. Satu gaya membuat seluruh studio
 * bekerja dengan satu daftar bagian — dan hanya satu koleksi yang ikut diunduh.
 */
import { createAvatar } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';
import { AVATAR_PART_NONE, type AvatarConfig } from '@shared/types.ts';

/**
 * Bentuk skema JSON milik DiceBear, disempitkan ke bagian yang dibutuhkan.
 * Tiap opsi yang bisa dipilih pemain berupa array: `hair: ['long01']` untuk
 * bentuk, `hairColor: ['ab2a18']` untuk warna.
 */
interface SchemaProperty {
  type?: string;
  items?: { enum?: string[]; pattern?: string };
  default?: unknown;
}

const PROPERTIES = (adventurer.schema?.properties ?? {}) as Record<string, SchemaProperty>;

const HEX = /^[0-9a-fA-F]{6}$/;

export type StylePartKind = 'variant' | 'color';

export interface StylePart {
  /** Nama opsi DiceBear, mis. `hair` atau `skinColor`. */
  key: string;
  kind: StylePartKind;
  values: string[];
  /** Punya pasangan `<key>Probability`, jadi bagian ini boleh dikosongkan. */
  optional: boolean;
}

/**
 * Membaca daftar bagian yang bisa disetel dari skema gayanya sendiri.
 *
 * Diturunkan saat dijalankan, bukan ditulis tangan: DiceBear menambah varian
 * rambut dan mata tiap rilis, dan daftar salinan pasti tertinggal.
 */
export function describeStyle(): StylePart[] {
  const parts: StylePart[] = [];

  for (const [key, property] of Object.entries(PROPERTIES)) {
    // Warna latar sudah punya pemilihnya sendiri di studio.
    if (key === 'backgroundColor' || property.type !== 'array') continue;
    const optional = `${key}Probability` in PROPERTIES;

    const variants = property.items?.enum;
    if (variants) {
      parts.push({ key, kind: 'variant', values: [...variants].sort(), optional });
      continue;
    }

    // Opsi warna dikenali dari pola hex-nya; daftar bawaan skema dipakai
    // sebagai palet.
    if (property.items?.pattern && Array.isArray(property.default)) {
      const palette = (property.default as unknown[]).filter(
        (value): value is string => typeof value === 'string' && HEX.test(value),
      );
      if (palette.length > 0) parts.push({ key, kind: 'color', values: palette, optional });
    }
  }

  return parts;
}

/**
 * Menerjemahkan pilihan pemain jadi opsi DiceBear.
 *
 * Setiap nilai dicocokkan ulang dengan skemanya. Konfigurasi avatar datang dari
 * pemain lain lewat ruang, jadi nilai yang tidak dikenali dibuang di sini
 * daripada dibiarkan menembus ke DiceBear.
 */
function partOptions(config: AvatarConfig): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config.parts ?? {})) {
    const property = PROPERTIES[key];
    if (!property || property.type !== 'array') continue;
    const probabilityKey = `${key}Probability`;
    const optional = probabilityKey in PROPERTIES;

    if (value === AVATAR_PART_NONE) {
      if (optional) options[probabilityKey] = 0;
      continue;
    }

    const variants = property.items?.enum;
    if (variants ? !variants.includes(value) : !HEX.test(value)) continue;

    options[key] = [value];
    if (optional) options[probabilityKey] = 100;
  }

  return options;
}

/**
 * Kunci di `extra` yang bukan bagian karakter. Sisanya adalah bagian yang
 * benar-benar dipakai pada render ini.
 */
const NON_PART_EXTRA = new Set([
  'primaryBackgroundColor',
  'secondaryBackgroundColor',
  'backgroundType',
  'backgroundRotation',
]);

export interface RenderResult {
  uri: string;
  /**
   * Bagian yang benar-benar terpakai — termasuk yang dipilih `seed` dan tidak
   * dipatok pemain. Ini satu-satunya cara mengetahui "sedang di varian mana"
   * saat sebuah bagian masih dibiarkan acak.
   *
   * Bagian opsional yang sedang tidak dipakai (mis. tanpa kacamata) tidak
   * muncul sebagai kunci sama sekali.
   */
  resolved: Record<string, string>;
}

export function render(config: AvatarConfig): RenderResult {
  // `toJson()` memberi SVG dan daftar bagian terpilih sekaligus; `toString()`
  // mengembalikan SVG yang sama persis, jadi tidak ada gunanya merender dua kali.
  const { svg, extra } = createAvatar(adventurer, {
    seed: config.seed,
    backgroundColor: [config.backgroundColor],
    radius: 50,
    ...partOptions(config),
  }).toJson();

  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (NON_PART_EXTRA.has(key) || typeof value !== 'string') continue;
    // Warna dilaporkan dengan '#', sedangkan `AvatarConfig.parts` menyimpannya
    // tanpa '#'. Disamakan di sini supaya keduanya bisa dibandingkan langsung.
    resolved[key] = value.startsWith('#') ? value.slice(1) : value;
  }

  return { uri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, resolved };
}
