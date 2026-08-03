/**
 * Manifest emoji chat — 112 wajah dari Vector Emojis Pack (CC0, penerbit
 * sama seperti Vector Ranks Pack yang dipakai fitur Rank). Aset SVG-nya di
 * `public/emojis/emoji-{slug}.svg`. Dipakai `EmojiPicker` (daftar pilihan)
 * dan `chatText.tsx` (render token `:slug:` di isi pesan jadi ikon).
 */
export interface EmojiEntry {
  slug: string;
  label: string;
}

export const EMOJIS: EmojiEntry[] = [
  { slug: 'angry-face-with-horns', label: 'Angry face with horns' },
  { slug: 'angry-face', label: 'Angry face' },
  { slug: 'anguished-face', label: 'Anguished face' },
  { slug: 'anxious-face-with-sweat', label: 'Anxious face with sweat' },
  { slug: 'astonished-face', label: 'Astonished face' },
  { slug: 'beaming-face-with-smiling-eyes', label: 'Beaming face with smiling eyes' },
  { slug: 'clown-face', label: 'Clown face' },
  { slug: 'cold-face', label: 'Cold face' },
  { slug: 'confounded-face', label: 'Confounded face' },
  { slug: 'confused-face', label: 'Confused face' },
  { slug: 'cowboy-hat-face', label: 'Cowboy hat face' },
  { slug: 'crying-face', label: 'Crying face' },
  { slug: 'disappointed-face', label: 'Disappointed face' },
  { slug: 'disguised-face', label: 'Disguised face' },
  { slug: 'dizzy-face', label: 'Dizzy face' },
  { slug: 'dotted-line-face', label: 'Dotted line face' },
  { slug: 'downcase-face-with-sweat', label: 'Downcase face with sweat' },
  { slug: 'drooling-face', label: 'Drooling face' },
  { slug: 'exploding-head', label: 'Exploding head' },
  { slug: 'expressionless-face', label: 'Expressionless face' },
  { slug: 'face-blowing-a-kiss', label: 'Face blowing a kiss' },
  { slug: 'face-exhaling', label: 'Face exhaling' },
  { slug: 'face-holding-back-tears', label: 'Face holding back tears' },
  { slug: 'face-in-clouds', label: 'Face in clouds' },
  { slug: 'face-savoring-food', label: 'Face savoring food' },
  { slug: 'face-screaming-in-fear', label: 'Face screaming in fear' },
  { slug: 'face-vomiting', label: 'Face vomiting' },
  { slug: 'face-with-diagonal-mouth', label: 'Face with diagonal mouth' },
  { slug: 'face-with-hand-over-mouth', label: 'Face with hand over mouth' },
  { slug: 'face-with-head-bandage', label: 'Face with head bandage' },
  { slug: 'face-with-medical-mask', label: 'Face with medical mask' },
  { slug: 'face-with-monocle', label: 'Face with monocle' },
  { slug: 'face-with-open-eyes-and-hand-over-mouth', label: 'Face with open eyes and hand over mouth' },
  { slug: 'face-with-open-mouth', label: 'Face with open mouth' },
  { slug: 'face-with-peeking-eye', label: 'Face with peeking eye' },
  { slug: 'face-with-raised-eyebrow', label: 'Face with raised eyebrow' },
  { slug: 'face-with-rolling-eyes', label: 'Face with rolling eyes' },
  { slug: 'face-with-spiral-eyes', label: 'Face with spiral eyes' },
  { slug: 'face-with-steam-from-nose', label: 'Face with steam from nose' },
  { slug: 'face-with-symbols-on-mouth', label: 'Face with symbols on mouth' },
  { slug: 'face-with-tears-of-joy', label: 'Face with tears of joy' },
  { slug: 'face-with-thermometer', label: 'Face with thermometer' },
  { slug: 'face-with-tongue', label: 'Face with tongue' },
  { slug: 'face-without-mouth', label: 'Face without mouth' },
  { slug: 'fearful-face', label: 'Fearful face' },
  { slug: 'flushed-face', label: 'Flushed face' },
  { slug: 'frowning-face-with-open-mouth', label: 'Frowning face with open mouth' },
  { slug: 'frowning-face', label: 'Frowning face' },
  { slug: 'grimacing-face', label: 'Grimacing face' },
  { slug: 'grinning-face-with-big-eyes', label: 'Grinning face with big eyes' },
  { slug: 'grinning-face-with-smiling-eyes', label: 'Grinning face with smiling eyes' },
  { slug: 'grinning-face-with-sweat', label: 'Grinning face with sweat' },
  { slug: 'grinning-face', label: 'Grinning face' },
  { slug: 'grinning-squinting-face', label: 'Grinning squinting face' },
  { slug: 'head-shaking-horizontally', label: 'Head shaking horizontally' },
  { slug: 'head-shaking-vertically', label: 'Head shaking vertically' },
  { slug: 'hot-face', label: 'Hot face' },
  { slug: 'hugging-face', label: 'Hugging face' },
  { slug: 'hushed-face', label: 'Hushed face' },
  { slug: 'kissing-face-with-closed-eyes', label: 'Kissing face with closed eyes' },
  { slug: 'kissing-face-with-smiling-eyes', label: 'Kissing face with smiling eyes' },
  { slug: 'kissing-face', label: 'Kissing face' },
  { slug: 'loudly-crying-face', label: 'Loudly crying face' },
  { slug: 'lying-face', label: 'Lying face' },
  { slug: 'melting-face', label: 'Melting face' },
  { slug: 'mewing-face', label: 'Mewing face' },
  { slug: 'money-mouth-face', label: 'Money mouth face' },
  { slug: 'nauseated-face', label: 'Nauseated face' },
  { slug: 'nerd-face', label: 'Nerd face' },
  { slug: 'neutral-face', label: 'Neutral face' },
  { slug: 'partying-face', label: 'Partying face' },
  { slug: 'pensive-face', label: 'Pensive face' },
  { slug: 'persevering-face', label: 'Persevering face' },
  { slug: 'pile-of-poo', label: 'Pile of poo' },
  { slug: 'pleading-face', label: 'Pleading face' },
  { slug: 'pouting-face', label: 'Pouting face' },
  { slug: 'relieved-face', label: 'Relieved face' },
  { slug: 'robot', label: 'Robot' },
  { slug: 'rolling-on-the-floor-laughing', label: 'Rolling on the floor laughing' },
  { slug: 'sad-but-relieved-face', label: 'Sad but relieved face' },
  { slug: 'saluting-face', label: 'Saluting face' },
  { slug: 'shaking-face', label: 'Shaking face' },
  { slug: 'shushing-face', label: 'Shushing face' },
  { slug: 'skull', label: 'Skull' },
  { slug: 'sleeping-face', label: 'Sleeping face' },
  { slug: 'sleepy-face', label: 'Sleepy face' },
  { slug: 'slightly-frowning-face', label: 'Slightly frowning face' },
  { slug: 'slightly-smiling-face', label: 'Slightly smiling face' },
  { slug: 'smiling-face-with-halo', label: 'Smiling face with halo' },
  { slug: 'smiling-face-with-heart-eyes', label: 'Smiling face with heart-eyes' },
  { slug: 'smiling-face-with-hearts', label: 'Smiling face with hearts' },
  { slug: 'smiling-face-with-horns', label: 'Smiling face with horns' },
  { slug: 'smiling-face-with-smiling-eyes', label: 'Smiling face with smiling eyes' },
  { slug: 'smiling-face-with-sunglasses', label: 'Smiling face with sunglasses' },
  { slug: 'smiling-face-with-tear', label: 'Smiling face with tear' },
  { slug: 'smiling-face', label: 'Smiling face' },
  { slug: 'smirking-face', label: 'Smirking face' },
  { slug: 'sneezing-face', label: 'Sneezing face' },
  { slug: 'squinting-face-with-tongue', label: 'Squinting face with tongue' },
  { slug: 'star-struck', label: 'Star-struck' },
  { slug: 'thinking-face', label: 'Thinking face' },
  { slug: 'tired-face', label: 'Tired face' },
  { slug: 'unamused-face', label: 'Unamused face' },
  { slug: 'upside-down-face', label: 'Upside-down face' },
  { slug: 'weary-face', label: 'Weary face' },
  { slug: 'winking-face-with-tongue', label: 'Winking face with tongue' },
  { slug: 'winking-face', label: 'Winking face' },
  { slug: 'woozy-face', label: 'Woozy face' },
  { slug: 'worried-face', label: 'Worried face' },
  { slug: 'yawning-face', label: 'Yawning face' },
  { slug: 'zany-face', label: 'Zany face' },
  { slug: 'zipper-mouth-face', label: 'Zipper-mouth face' },
];

const EMOJI_BY_SLUG = new Map(EMOJIS.map((e) => [e.slug, e]));

export function isKnownEmojiSlug(slug: string): boolean {
  return EMOJI_BY_SLUG.has(slug);
}

export function emojiIconUrl(slug: string): string {
  return `/emojis/emoji-${slug}.svg`;
}

/**
 * Grammar token `:slug:` dipakai chat — satu sumber untuk `chatGrouping.ts`
 * (deteksi pesan-emoji-murni) dan `chatText.tsx` (render inline), supaya
 * keduanya tidak diam-diam menyimpang kalau formatnya berubah.
 *
 * Fungsi (bukan konstanta regex langsung) supaya tiap pemanggil dapat
 * instance `RegExp` sendiri — regex ber-flag `g` menyimpan posisi terakhir
 * (`lastIndex`) di objeknya sendiri, jadi satu instance yang dibagi dua
 * tempat berisiko saling mengganggu urutan pencarian kalau salah satu
 * pemakaiannya berubah pola di masa depan (mis. loop manual `exec`).
 */
export function emojiTokenPattern(): RegExp {
  return /:([a-z0-9-]+):/g;
}
