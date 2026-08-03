import type { ChatMessage } from '@shared/types.ts';
import { getServiceClient } from '../db/client.ts';
import { areFriends } from '../social/store.ts';

/** Sama urutan besarnya seperti batas bio (140) tapi pesan chat wajar lebih
 *  panjang dari bio sekali isi — ini dikirim berkali-kali per percakapan. */
const MESSAGE_MAX_LENGTH = 500;

interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
}

function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    fromProfileId: row.sender_id,
    body: row.body,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export type SendMessageResult = { ok: true } | { ok: false; code: string; message: string };

const UNAVAILABLE: SendMessageResult = {
  ok: false,
  code: 'unavailable',
  message: 'Fitur chat sedang tidak tersedia.',
};

/**
 * Kirim satu pesan. Cuma boleh ke teman (sama seperti undangan room —
 * "Cuma bisa mengundang teman") supaya chat tidak jadi jalur spam ke
 * sembarang profileId yang kebetulan diketahui.
 */
export async function sendMessage(
  fromProfileId: string,
  toProfileId: string,
  rawBody: string,
): Promise<SendMessageResult> {
  const body = rawBody.trim();
  if (!body) return { ok: false, code: 'invalid', message: 'Pesan kosong.' };
  if (body.length > MESSAGE_MAX_LENGTH) {
    return {
      ok: false,
      code: 'invalid',
      message: `Pesan maksimal ${MESSAGE_MAX_LENGTH} karakter.`,
    };
  }
  if (fromProfileId === toProfileId) {
    return { ok: false, code: 'invalid', message: 'Tidak bisa mengirim pesan ke diri sendiri.' };
  }

  const client = getServiceClient();
  if (!client) return UNAVAILABLE;

  try {
    if (!(await areFriends(fromProfileId, toProfileId))) {
      return { ok: false, code: 'not_friends', message: 'Cuma bisa mengirim pesan ke teman.' };
    }
    const { error } = await client.from('direct_messages').insert({
      sender_id: fromProfileId,
      recipient_id: toProfileId,
      body,
    });
    if (error) {
      console.error('sendMessage: gagal mengirim pesan:', error.message);
      return { ok: false, code: 'invalid', message: 'Gagal mengirim pesan.' };
    }
    return { ok: true };
  } catch (err) {
    console.error('sendMessage: gagal mengirim pesan:', err);
    return { ok: false, code: 'invalid', message: 'Gagal mengirim pesan.' };
  }
}

/**
 * Semua pesan antara dua profil, diurut lama→baru. DUA query terpisah
 * (sebagai pengirim, sebagai penerima) alih-alih `.or()` dengan interpolasi
 * string — pola sama seperti `removeFriendship`/`listFriends` di
 * `social/store.ts`, supaya profileId dari header pemain tidak pernah
 * dianggap sebagai fragmen sintaks filter PostgREST.
 *
 * Efek samping wajar: pesan MASUK yang belum dibaca di percakapan ini
 * langsung ditandai terbaca — membuka sebuah percakapan berarti sudah
 * "melihatnya".
 */
export async function listConversation(
  profileId: string,
  otherProfileId: string,
): Promise<ChatMessage[]> {
  const client = getServiceClient();
  if (!client) return [];
  try {
    const [sent, received] = await Promise.all([
      client
        .from('direct_messages')
        .select('id, sender_id, recipient_id, body, created_at')
        .eq('sender_id', profileId)
        .eq('recipient_id', otherProfileId),
      client
        .from('direct_messages')
        .select('id, sender_id, recipient_id, body, created_at')
        .eq('sender_id', otherProfileId)
        .eq('recipient_id', profileId),
    ]);

    const rows = [
      ...((sent.data ?? []) as MessageRow[]),
      ...((received.data ?? []) as MessageRow[]),
    ].sort((a, b) => a.created_at.localeCompare(b.created_at));

    // Best-effort — kegagalan menandai terbaca tidak boleh menggagalkan
    // pemain melihat isi percakapannya sendiri. Dibungkus try/catch di
    // dalam IIFE async (bukan cuma `.then()`) — builder Supabase adalah
    // `PromiseLike`, bukan `Promise` penuh, jadi tidak bisa langsung
    // di-`.catch()` — dan tanpa penanganan reject sama sekali, satu
    // gangguan jaringan sesaat ke Supabase di sini jadi unhandled
    // rejection yang mematikan seluruh proses Node (default sejak Node 15)
    // untuk semua pemain yang sedang online.
    void (async () => {
      try {
        const { error } = await client
          .from('direct_messages')
          .update({ read_at: new Date().toISOString() })
          .eq('recipient_id', profileId)
          .eq('sender_id', otherProfileId)
          .is('read_at', null);
        if (error) console.error('listConversation: gagal menandai terbaca:', error.message);
      } catch (err) {
        console.error('listConversation: gagal menandai terbaca:', err);
      }
    })();

    return rows.map(toChatMessage);
  } catch (err) {
    console.error('listConversation: gagal memuat percakapan:', err);
    return [];
  }
}

export async function countUnreadMessages(profileId: string): Promise<number> {
  const client = getServiceClient();
  if (!client) return 0;
  try {
    const { count, error } = await client
      .from('direct_messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', profileId)
      .is('read_at', null);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
