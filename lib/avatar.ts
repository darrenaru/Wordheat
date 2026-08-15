/**
 * Avatar profil, gaya "adventurer" dari DiceBear.
 *
 * Gambarnya dibangkitkan dari sebuah benih ditambah pilihan-pilihan yang bisa
 * disetel pemain, jadi tidak ada berkas yang perlu diunggah atau disimpan --
 * profil cukup menyimpan konfigurasinya.
 *
 * Berkas ini aman dipakai di browser maupun server: isinya hanya daftar
 * pilihan dan penyusun URL, tanpa pustaka render.
 */

/** Warna latar diambil dari palet DESIGN.md agar avatar menyatu dengan antarmuka. */
export const AVATAR_BACKGROUNDS = [
  "ffc48a", // bara
  "ff319f", // nyala
  "c42268", // merah menyala
  "7a1a4a", // anggur
  "3b142a", // maroon
  "f3efda", // krem
] as const;

export const DEFAULT_AVATAR_BG = AVATAR_BACKGROUNDS[0];

/**
 * Daftar pilihan gaya adventurer, disalin dari skema @dicebear/adventurer
 * 9.4.3. Diurutkan naik supaya grid pemilihnya terbaca rapi -- urutan asli di
 * paketnya acak.
 */
function variants(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `variant${String(i + 1).padStart(2, "0")}`);
}

export const AVATAR_OPTIONS = {
  eyes: variants(26),
  eyebrows: variants(15),
  mouth: variants(30),
  glasses: variants(5),
  earrings: variants(6),
  hair: [
    ...Array.from({ length: 19 }, (_, i) => `short${String(i + 1).padStart(2, "0")}`),
    ...Array.from({ length: 26 }, (_, i) => `long${String(i + 1).padStart(2, "0")}`),
  ],
  features: ["freckles", "blush", "birthmark", "mustache"],
  hairColor: [
    "0e0e0e", "562306", "6a4e35", "796a45", "ac6511", "cb6820",
    "ab2a18", "b9a05f", "e5d7a3", "afafaf", "3eac2c", "85c2c6",
    "dba3be", "592454",
  ],
  skinColor: ["f2d3b1", "ecad80", "9e5622", "763900"],
} as const;

/**
 * Konfigurasi avatar seorang pemain.
 *
 * Bidang yang kosong sengaja dibiarkan ditentukan oleh benih. Dengan begitu
 * profil lama yang belum pernah dikustomisasi tetap tampil sama persis, dan
 * pemain yang hanya mengganti rambut tidak ikut kehilangan wajah acaknya.
 */
export type AvatarConfig = {
  seed: string;
  bg: string;
  skinColor?: string;
  /** null berarti sengaja tidak berambut. */
  hair?: string | null;
  hairColor?: string;
  eyes?: string;
  eyebrows?: string;
  mouth?: string;
  /** null berarti sengaja tidak memakai, beda dengan undefined yang berarti ikut benih. */
  glasses?: string | null;
  earrings?: string | null;
  features?: string[];
};

export type AvatarChoices = Omit<AvatarConfig, "seed" | "bg">;

/** Benih apa pun sah, tapi yang dibangkitkan sendiri dibuat pendek dan mudah dibaca. */
export function randomAvatarSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function isValidAvatarBg(bg: string): boolean {
  return (AVATAR_BACKGROUNDS as readonly string[]).includes(bg);
}

/**
 * Membuang nilai yang tidak dikenal sebelum apa pun disimpan atau dirender.
 *
 * Nilai ini datang dari permintaan jaringan, jadi tidak boleh dipercaya
 * mentah-mentah: satu nama varian karangan bisa membuat pustaka render
 * melempar galat pada tiap permintaan berikutnya.
 */
export function sanitizeChoices(raw: unknown): AvatarChoices {
  if (!raw || typeof raw !== "object") return {};
  const input = raw as Record<string, unknown>;
  const out: AvatarChoices = {};

  const pick = (key: "eyes" | "eyebrows" | "mouth") => {
    const value = input[key];
    if (typeof value === "string" && (AVATAR_OPTIONS[key] as readonly string[]).includes(value)) {
      out[key] = value;
    }
  };
  pick("eyes");
  pick("eyebrows");
  pick("mouth");

  if (input.hair === null) out.hair = null;
  else if (
    typeof input.hair === "string" &&
    (AVATAR_OPTIONS.hair as readonly string[]).includes(input.hair)
  ) {
    out.hair = input.hair;
  }

  const pickColor = (key: "hairColor" | "skinColor") => {
    const value = input[key];
    if (typeof value === "string" && (AVATAR_OPTIONS[key] as readonly string[]).includes(value)) {
      out[key] = value;
    }
  };
  pickColor("hairColor");
  pickColor("skinColor");

  const pickOptional = (key: "glasses" | "earrings") => {
    const value = input[key];
    if (value === null) out[key] = null;
    else if (typeof value === "string" && (AVATAR_OPTIONS[key] as readonly string[]).includes(value)) {
      out[key] = value;
    }
  };
  pickOptional("glasses");
  pickOptional("earrings");

  if (Array.isArray(input.features)) {
    const allowed = input.features.filter(
      (f): f is string =>
        typeof f === "string" && (AVATAR_OPTIONS.features as readonly string[]).includes(f),
    );
    out.features = [...new Set(allowed)];
  }

  return out;
}

/**
 * Menyusun parameter render.
 *
 * DiceBear memilih sendiri dari benih ketika sebuah pilihan tidak disebut,
 * dan memakai "probability" untuk memutuskan apakah aksesori dipakai. Karena
 * itu pilihan yang eksplisit selalu dikunci ke 100 atau 0 -- kalau tidak,
 * kacamata yang sudah dipilih pemain masih bisa hilang karena undian.
 */
export function avatarParams(config: AvatarConfig, size: number): URLSearchParams {
  const params = new URLSearchParams({
    seed: config.seed,
    backgroundColor: config.bg,
    size: String(size),
  });

  if (config.skinColor) params.set("skinColor", config.skinColor);
  if (config.hairColor) params.set("hairColor", config.hairColor);

  if (config.hair === null) {
    params.set("hairProbability", "0");
  } else if (config.hair) {
    params.set("hair", config.hair);
    params.set("hairProbability", "100");
  }
  if (config.eyes) params.set("eyes", config.eyes);
  if (config.eyebrows) params.set("eyebrows", config.eyebrows);
  if (config.mouth) params.set("mouth", config.mouth);

  if (config.glasses === null) {
    params.set("glassesProbability", "0");
  } else if (config.glasses) {
    params.set("glasses", config.glasses);
    params.set("glassesProbability", "100");
  }

  if (config.earrings === null) {
    params.set("earringsProbability", "0");
  } else if (config.earrings) {
    params.set("earrings", config.earrings);
    params.set("earringsProbability", "100");
  }

  if (config.features) {
    if (config.features.length === 0) {
      params.set("featuresProbability", "0");
    } else {
      for (const feature of config.features) params.append("features", feature);
      params.set("featuresProbability", "100");
    }
  }

  return params;
}

/**
 * Penanda versi perender.
 *
 * Gambar avatar disajikan dengan header immutable, jadi browser tidak akan
 * pernah memintanya ulang. Angka ini ikut masuk ke alamatnya supaya perbaikan
 * pada cara render bisa membatalkan seluruh cache lama -- naikkan setiap kali
 * hasil gambarnya berubah untuk parameter yang sama.
 */
const RENDER_VERSION = 2;

/** Alamat gambar avatar. Dilayani sendiri, bukan diambil dari api.dicebear.com. */
export function avatarSrc(config: AvatarConfig, size = 96): string {
  const params = avatarParams(config, size);
  params.set("v", String(RENDER_VERSION));
  return `/api/avatar?${params}`;
}
