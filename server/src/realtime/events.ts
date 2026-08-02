import type { Response } from 'express';

/**
 * Registry koneksi Server-Sent Events per `profileId` — dipakai mendorong
 * notifikasi real-time (mis. permintaan pertemanan masuk) ke browser pemain
 * TANPA pemain perlu berada di ruang permainan (beda dari `ws/gateway.ts`
 * yang cuma aktif selama pemain sedang di dalam satu ruang). Satu profil
 * boleh punya beberapa koneksi sekaligus (banyak tab/device terbuka).
 *
 * Murni in-memory, sama seperti `game/invites.ts` — notifikasi yang lewat
 * saat pemain sedang offline tidak dikirim ulang; begitu dia buka `GET
 * /friends` lagi (mis. saat membuka halaman Teman), datanya tetap benar
 * dari database, cuma tidak sempat dapat dorongan real-time-nya.
 */
const connections = new Map<string, Set<Response>>();

export function registerEventStream(profileId: string, res: Response): void {
  let set = connections.get(profileId);
  if (!set) {
    set = new Set();
    connections.set(profileId, set);
  }
  set.add(res);
}

export function unregisterEventStream(profileId: string, res: Response): void {
  const set = connections.get(profileId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) connections.delete(profileId);
}

/**
 * Kirim satu event SSE ke SEMUA koneksi aktif milik profil ini — no-op
 * kalau pemain itu sedang tidak membuka web sama sekali. Dipanggil
 * langsung dari handler HTTP lain (mis. `POST /friends/request`) begitu
 * aksinya berhasil, jadi kegagalan menulis ke SATU koneksi (mis. baru saja
 * terputus tapi belum sempat `unregisterEventStream`) tidak boleh
 * mengganggu request yang sedang diproses — ditelan diam-diam per koneksi.
 */
export function notifyProfile(profileId: string, event: string, data: unknown): void {
  const set = connections.get(profileId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      unregisterEventStream(profileId, res);
    }
  }
}
