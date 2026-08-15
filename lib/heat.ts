/**
 * Pemetaan peringkat -> suhu.
 *
 * Peringkat membentang dari 1 sampai puluhan ribu, tetapi rasa "dekat" pada
 * manusia bersifat logaritmik: selisih peringkat 5 ke 50 terasa jauh lebih
 * besar daripada 5.000 ke 5.045. Skala log membuat bar tetap bergerak terasa
 * di seluruh rentang alih-alih menempel di ujung dingin sepanjang permainan.
 */

export type Rgb = [number, number, number];
export type Theme = "dark" | "light";

type Stop = { at: number; rgb: Rgb };

/**
 * Setiap tema punya ramp sendiri karena keduanya menyandikan panas dengan cara
 * berbeda.
 *
 * Di latar gelap, panas adalah kecerahan: barisnya menyala makin terang
 * seiring mendekat, mengikuti urutan pijar benda hitam sampai ke oranye
 * putih-panas.
 *
 * Di latar terang, urutan itu terbalik-arah -- oranye muda justru paling
 * lemah kontrasnya terhadap krem. Jadi panas disandikan lewat saturasi dan
 * ramp-nya berhenti di magenta, warna paling menonjol di atas kertas terang.
 */
const RAMPS: Record<Theme, Stop[]> = {
  dark: [
    { at: 0.0, rgb: [59, 20, 42] },    // #3b142a bara mati
    { at: 0.3, rgb: [122, 26, 74] },   // anggur
    { at: 0.6, rgb: [196, 34, 104] },  // merah menyala
    { at: 0.85, rgb: [255, 49, 159] }, // #ff319f nyala
    { at: 1.0, rgb: [255, 196, 138] }, // #ffc48a putih panas
  ],
  light: [
    { at: 0.0, rgb: [59, 20, 42] },    // #3b142a arang
    { at: 0.35, rgb: [122, 26, 74] },  // anggur
    { at: 0.65, rgb: [196, 34, 104] }, // merah menyala
    { at: 1.0, rgb: [255, 49, 159] },  // #ff319f nyala
  ],
};

/** Warna teks yang tersedia untuk diletakkan di atas isian bar. */
const NIGHT: Rgb = [21, 7, 16];
const CREAM: Rgb = [243, 239, 218];

/** Peringkat 1 menghasilkan 1, peringkat terjauh menghasilkan 0. */
export function heatLevel(rank: number, vocabSize: number): number {
  if (rank <= 1) return 1;
  const t = 1 - Math.log(rank) / Math.log(vocabSize);
  return Math.min(1, Math.max(0, t));
}

export function heatRgb(level: number, theme: Theme): Rgb {
  const stops = RAMPS[theme];
  const t = Math.min(1, Math.max(0, level));
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].at && t <= stops[i + 1].at) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi.at - lo.at || 1;
  const f = (t - lo.at) / span;
  return [0, 1, 2].map((i) =>
    Math.round(lo.rgb[i] + (hi.rgb[i] - lo.rgb[i]) * f),
  ) as Rgb;
}

export function heatColor(level: number, theme: Theme): string {
  const [r, g, b] = heatRgb(level, theme);
  return `rgb(${r} ${g} ${b})`;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Warna teks di atas isian bar.
 *
 * Ramp suhu melintasi rentang kecerahan yang lebar, jadi tidak ada satu warna
 * teks yang benar di sepanjangnya. Yang dipilih adalah yang rasio kontrasnya
 * lebih tinggi terhadap warna isian di titik itu, dihitung memakai luminans
 * relatif WCAG.
 */
export function heatTextColor(level: number, theme: Theme): string {
  const fill = heatRgb(level, theme);
  const rgb = contrastRatio(fill, CREAM) >= contrastRatio(fill, NIGHT) ? CREAM : NIGHT;
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}

/**
 * Lebar bar. Diberi lantai kecil supaya tebakan terjauh sekalipun tetap
 * meninggalkan jejak yang terlihat, bukan baris yang tampak rusak.
 */
export function heatFill(level: number): number {
  return 3 + 97 * level;
}

/**
 * Radius pendar di sekeliling baris, khusus tema gelap. Pangkat lebih dari
 * satu menahannya tetap padam selama tebakan masih jauh, sehingga daftar tidak
 * berubah jadi kumpulan baris yang semuanya bersinar.
 */
export function heatHalo(level: number): number {
  return Math.round(level ** 2.2 * 46);
}

/** Ambang dipilih agar tiap label terasa berbeda saat dimainkan. */
export function heatLabel(rank: number): string {
  if (rank === 1) return "tepat";
  if (rank <= 25) return "membara";
  if (rank <= 200) return "panas";
  if (rank <= 1000) return "hangat";
  if (rank <= 5000) return "dingin";
  return "beku";
}
