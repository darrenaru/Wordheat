import type { ChatMessage } from '@shared/types.ts';
import { emojiTokenPattern, isKnownEmojiSlug } from './emojis.ts';

/** Jeda maksimum antar pesan berturutan dari pengirim yang sama supaya
 *  masih dianggap satu "kumpulan" (avatar+waktu cuma tampil sekali). */
const GROUP_GAP_MS = 5 * 60 * 1000;

export interface ChatDivider {
  type: 'divider';
  key: string;
  label: string;
}

export interface ChatMessageItem {
  type: 'message';
  key: string;
  message: ChatMessage;
  mine: boolean;
  /** Cuma relevan untuk pesan lawan bicara — avatar tampil sekali di awal
   *  kumpulan, bukan tiap baris. */
  showAvatar: boolean;
  /** Waktu tampil sekali di AKHIR kumpulan (pola sama seperti WhatsApp/
   *  Telegram), bukan di tiap baris. */
  showTime: boolean;
}

export type ChatItem = ChatDivider | ChatMessageItem;

function dayLabel(date: Date): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return 'Hari ini';
  if (diffDays === 1) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Ubah daftar pesan datar (urut lama→baru) jadi daftar item siap-render:
 * pembagi hari disisipkan tiap kali tanggal kalender berganti, dan tiap
 * pesan ditandai posisinya dalam "kumpulan" pesan berturutan dari pengirim
 * yang sama supaya avatar/waktu tidak diulang di tiap baris.
 */
export function groupChatMessages(messages: ChatMessage[], myId: string): ChatItem[] {
  const items: ChatItem[] = [];
  let lastDayKey: string | null = null;

  messages.forEach((message, index) => {
    const date = new Date(message.createdAt);
    const dayKey = date.toDateString();
    if (dayKey !== lastDayKey) {
      items.push({ type: 'divider', key: `divider-${dayKey}`, label: dayLabel(date) });
      lastDayKey = dayKey;
    }

    const prev = messages[index - 1];
    const next = messages[index + 1];
    const sameDayAsPrev = prev && new Date(prev.createdAt).toDateString() === dayKey;
    const sameDayAsNext = next && new Date(next.createdAt).toDateString() === dayKey;

    const showAvatar =
      !prev ||
      !sameDayAsPrev ||
      prev.fromProfileId !== message.fromProfileId ||
      message.createdAt - prev.createdAt > GROUP_GAP_MS;
    const showTime =
      !next ||
      !sameDayAsNext ||
      next.fromProfileId !== message.fromProfileId ||
      next.createdAt - message.createdAt > GROUP_GAP_MS;

    items.push({
      type: 'message',
      key: message.id,
      message,
      mine: message.fromProfileId === myId,
      showAvatar,
      showTime,
    });
  });

  return items;
}

/** Pesan yang isinya MURNI satu/lebih token emoji dikenal (tanpa teks
 *  lain) ditampilkan lebih besar tanpa latar bubble — pola lazim di
 *  aplikasi chat modern untuk reaksi emoji tunggal. */
export function isEmojiOnlyMessage(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  const stripped = trimmed.replace(emojiTokenPattern(), (full, slug: string) =>
    isKnownEmojiSlug(slug) ? '' : full,
  );
  return stripped.trim().length === 0;
}
