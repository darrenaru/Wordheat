/**
 * Emoji kustom untuk chat, disajikan sebagai berkas statis di public/emojis.
 *
 * Namanya dipakai sebagai kode pintas ":nama:" di dalam teks pesan -- jadi
 * pemain bisa mengetik sambil tetap ekspresif tanpa keluar dari kotak teks.
 */

export const EMOJI_NAMES = [
  "angry-face-with-horns",
  "angry-face",
  "anguished-face",
  "anxious-face-with-sweat",
  "astonished-face",
  "beaming-face-with-smiling-eyes",
  "clown-face",
  "cold-face",
  "confounded-face",
  "confused-face",
  "cowboy-hat-face",
  "crying-face",
  "disappointed-face",
  "disguised-face",
  "dizzy-face",
  "dotted-line-face",
  "downcase-face-with-sweat",
  "drooling-face",
  "exploding-head",
  "expressionless-face",
  "face-blowing-a-kiss",
  "face-exhaling",
  "face-holding-back-tears",
  "face-in-clouds",
  "face-savoring-food",
  "face-screaming-in-fear",
  "face-vomiting",
  "face-with-diagonal-mouth",
  "face-with-hand-over-mouth",
  "face-with-head-bandage",
  "face-with-medical-mask",
  "face-with-monocle",
  "face-with-open-eyes-and-hand-over-mouth",
  "face-with-open-mouth",
  "face-with-peeking-eye",
  "face-with-raised-eyebrow",
  "face-with-rolling-eyes",
  "face-with-spiral-eyes",
  "face-with-steam-from-nose",
  "face-with-symbols-on-mouth",
  "face-with-tears-of-joy",
  "face-with-thermometer",
  "face-with-tongue",
  "face-without-mouth",
  "fearful-face",
  "flushed-face",
  "frowning-face-with-open-mouth",
  "frowning-face",
  "grimacing-face",
  "grinning-face-with-big-eyes",
  "grinning-face-with-smiling-eyes",
  "grinning-face-with-sweat",
  "grinning-face",
  "grinning-squinting-face",
  "head-shaking-horizontally",
  "head-shaking-vertically",
  "hot-face",
  "hugging-face",
  "hushed-face",
  "kissing-face-with-closed-eyes",
  "kissing-face-with-smiling-eyes",
  "kissing-face",
  "loudly-crying-face",
  "lying-face",
  "melting-face",
  "mewing-face",
  "money-mouth-face",
  "nauseated-face",
  "nerd-face",
  "neutral-face",
  "partying-face",
  "pensive-face",
  "persevering-face",
  "pile-of-poo",
  "pleading-face",
  "pouting-face",
  "relieved-face",
  "robot",
  "rolling-on-the-floor-laughing",
  "sad-but-relieved-face",
  "saluting-face",
  "shaking-face",
  "shushing-face",
  "skull",
  "sleeping-face",
  "sleepy-face",
  "slightly-frowning-face",
  "slightly-smiling-face",
  "smiling-face-with-halo",
  "smiling-face-with-heart-eyes",
  "smiling-face-with-hearts",
  "smiling-face-with-horns",
  "smiling-face-with-smiling-eyes",
  "smiling-face-with-sunglasses",
  "smiling-face-with-tear",
  "smiling-face",
  "smirking-face",
  "sneezing-face",
  "squinting-face-with-tongue",
  "star-struck",
  "thinking-face",
  "tired-face",
  "unamused-face",
  "upside-down-face",
  "weary-face",
  "winking-face-with-tongue",
  "winking-face",
  "woozy-face",
  "worried-face",
  "yawning-face",
  "zany-face",
  "zipper-mouth-face",
] as const;

export type EmojiName = (typeof EMOJI_NAMES)[number];

const EMOJI_SET: Set<string> = new Set(EMOJI_NAMES);

export function emojiSrc(name: string): string {
  return `/emojis/emoji-${name}.svg`;
}

const SHORTCODE_RE = /:([a-z0-9-]+):/g;

/**
 * Mengubah teks pesan jadi campuran teks biasa dan gambar emoji sebaris,
 * berdasarkan kode pintas ":nama-emoji:". Kode yang tidak dikenal dibiarkan
 * sebagai teks apa adanya -- titik dua ganda bukan berarti selalu emoji.
 */
export function renderWithEmoji(body: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  SHORTCODE_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = SHORTCODE_RE.exec(body))) {
    const [full, name] = match;
    if (!EMOJI_SET.has(name)) continue;
    if (match.index > last) parts.push(body.slice(last, match.index));
    parts.push(
      <img
        key={key++}
        src={emojiSrc(name)}
        alt={`:${name}:`}
        width={20}
        height={20}
        className="inline-block -translate-y-0.5 align-middle"
      />,
    );
    last = match.index + full.length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}
