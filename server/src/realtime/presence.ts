import type { Presence } from '@shared/types.ts';
import { getServiceClient } from '../db/client.ts';
import { broadcastAll, isOnline } from './events.ts';

/**
 * Profil mana saja yang sedang "bermain" — Set kode ruang per profil
 * (bukan boolean tunggal) supaya tahan multi-tab/reconnect: profil itu
 * baru dianggap berhenti bermain begitu SEMUA ruang yang diikutinya
 * dilepas, bukan begitu saja satu ruang saja yang dilepas. Murni
 * in-memory, sama seperti `realtime/events.ts` — hilang begitu server
 * restart, dibangun ulang lagi dari nol seiring pemain menyambung ulang.
 */
const playing = new Map<string, Set<string>>();

export function isPlaying(profileId: string): boolean {
  return (playing.get(profileId)?.size ?? 0) > 0;
}

/** Dipanggil dari `game/rooms.ts` tiap kali seorang pemain mendapat kursi
 *  di sebuah ruang (join baru maupun sambung ulang). */
export function markPlaying(profileId: string, roomCode: string): void {
  let set = playing.get(profileId);
  if (!set) {
    set = new Set();
    playing.set(profileId, set);
  }
  const wasPlaying = set.size > 0;
  set.add(roomCode);
  if (!wasPlaying) broadcastPresenceChange(profileId);
}

/** Dipanggil dari `game/rooms.ts` tiap kali kursi seorang pemain di
 *  sebuah ruang benar-benar dilepas (bukan cuma koneksinya putus). */
export function markStoppedPlaying(profileId: string, roomCode: string): void {
  const set = playing.get(profileId);
  if (!set) return;
  set.delete(roomCode);
  if (set.size === 0) {
    playing.delete(profileId);
    broadcastPresenceChange(profileId);
  }
}

/** Status kehadiran TERKINI seorang pemain — `playing` menang atas
 *  `online`, baru `offline` kalau keduanya tidak berlaku. `lastSeenAt`
 *  di sini SENGAJA selalu `null`: dipakai dari konteks yang datanya
 *  murni real-time (tidak baru saja baca dari database), lihat
 *  `getPresenceWithStoredLastSeen` untuk kasus itu. */
export function getPresence(profileId: string): Presence {
  if (isPlaying(profileId)) return { status: 'playing', lastSeenAt: null };
  if (isOnline(profileId)) return { status: 'online', lastSeenAt: null };
  return { status: 'offline', lastSeenAt: null };
}

/** Sama seperti `getPresence`, tapi untuk offline mengisi `lastSeenAt`
 *  dari kolom `player_stats.last_seen_at` yang sudah dibaca lebih dulu
 *  (mis. oleh `toUserSummary`/`getPublicProfile`) — dipakai saat MEMBACA
 *  status pemain lain, bukan saat baru saja mengubahnya sendiri. */
export function getPresenceWithStoredLastSeen(
  profileId: string,
  lastSeenAtRaw: string | null,
): Presence {
  const live = getPresence(profileId);
  if (live.status !== 'offline') return live;
  return { status: 'offline', lastSeenAt: lastSeenAtRaw ? new Date(lastSeenAtRaw).getTime() : null };
}

/** Catat "terakhir aktif" ke database — best-effort, dipanggil saat
 *  koneksi SSE seorang pemain terbuka maupun tertutup (lihat `GET
 *  /events` di `http/api.ts`). Kegagalan di sini tidak boleh mengganggu
 *  jalannya koneksi itu sendiri. */
export async function touchLastSeen(profileId: string): Promise<void> {
  const client = getServiceClient();
  if (!client) return;
  try {
    await client.from('player_stats').update({ last_seen_at: new Date().toISOString() }).eq('profile_id', profileId);
  } catch (err) {
    console.error('touchLastSeen: gagal mencatat waktu aktif:', err);
  }
}

/** Hitung presence terkini seorang pemain lalu siarkan ke SEMUA koneksi
 *  yang sedang terbuka (lihat catatan skala di `events.broadcastAll`).
 *  `lastSeenAt` untuk transisi ke offline diisi "sekarang" langsung
 *  (bukan baca ulang dari database) — pemanggil di titik transisi
 *  offline sudah/akan memanggil `touchLastSeen` sekitar waktu yang sama. */
export function broadcastPresenceChange(profileId: string): void {
  const presence = getPresence(profileId);
  const withLastSeen: Presence =
    presence.status === 'offline' ? { status: 'offline', lastSeenAt: Date.now() } : presence;
  broadcastAll('presence-update', { profileId, presence: withLastSeen });
}
