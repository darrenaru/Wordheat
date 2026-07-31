import type { ReactNode } from 'react';
import { emojiIconUrl, isKnownEmojiSlug } from './emojis.ts';

const TOKEN_PATTERN = /:([a-z0-9-]+):/g;

/**
 * Pecah isi pesan chat pada token `:slug:` yang cocok manifest emoji
 * (`emojis.ts`) dan render jadi ikon inline — token yang tidak dikenal
 * (atau sekadar teks berisi titik dua, mis. "05:00") dibiarkan sebagai
 * teks apa adanya, bukan ikut terpotong.
 *
 * `emojiSize` dilebihkan untuk pesan yang isinya MURNI emoji (lihat
 * `isEmojiOnlyMessage` di `chatGrouping.ts`) — ikonnya jadi jauh lebih
 * besar, pola lazim di aplikasi chat modern untuk reaksi emoji tunggal.
 */
export function renderChatText(body: string, emojiSize = 20): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of body.matchAll(TOKEN_PATTERN)) {
    const slug = match[1];
    if (!isKnownEmojiSlug(slug)) continue;
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(body.slice(lastIndex, start));
    nodes.push(
      <img
        key={key++}
        className="chat-emoji"
        src={emojiIconUrl(slug)}
        alt={`:${slug}:`}
        width={emojiSize}
        height={emojiSize}
      />,
    );
    lastIndex = start + match[0].length;
  }

  if (lastIndex < body.length) nodes.push(body.slice(lastIndex));
  return nodes;
}
