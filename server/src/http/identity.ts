import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { getServiceClient } from '../db/client.ts';
import { verifyToken } from '../stats/store.ts';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Token Supabase pemain, kalau ada — dipakai menempelkan akun ke statistik
 *  maupun memverifikasi kepemilikan profil (lihat `verifyProfileOwnership`). */
export async function resolveUserId(req: Request): Promise<string | null> {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return verifyToken(token);
}

/**
 * Inti verifikasi kepemilikan profil — dipakai bersama oleh HTTP
 * (`resolveIdentity`, header `x-player-id`/`x-player-secret`) dan WebSocket
 * (`ws/gateway.ts`, field `profile.id`/`secret` di pesan `hello`), supaya
 * logikanya cuma ada satu tempat.
 *
 * `profileId` sendiri TIDAK RAHASIA (tampil apa adanya di leaderboard,
 * profil publik, dan daftar pemain di dalam room), jadi tidak pernah cukup
 * sendirian sebagai bukti kepemilikan — tanpa fungsi ini, siapa pun yang
 * melihat profileId korban bisa mengaku sebagai dia lewat endpoint/pesan
 * apa pun yang menerimanya.
 *
 * Dua jalur verifikasi:
 * 1. **Login Google** — `userId` (sudah diverifikasi lewat token Supabase
 *    oleh pemanggil) dicek terhadap baris `player_stats`: kolom `user_id`
 *    cuma pernah diisi lewat `link_account_profile`, jadi aman dipakai
 *    sebagai bukti kepemilikan.
 * 2. **Guest** — `secret` device (dibuat sekali oleh client, disimpan
 *    lokal, tidak pernah dibagikan ke pemain lain) diverifikasi
 *    trust-on-first-use lewat RPC `verify_identity`: permintaan PERTAMA
 *    untuk sebuah profileId mengikat secret itu; permintaan berikutnya
 *    wajib membawa secret yang sama persis, kalau tidak ditolak.
 *
 * Kompatibilitas mundur: kalau `secret` tidak dikirim SAMA SEKALI (client
 * lama yang belum sempat memuat ulang setelah pembaruan ini dipasang) DAN
 * profil itu belum pernah punya secret terikat, diizinkan apa adanya —
 * tidak ada cara lain memverifikasi identitas device lama itu. Begitu
 * client mana pun (pemilik asli atau bukan) sudah pernah mengirim secret
 * untuk profil itu, ia terkunci ke secret itu selamanya.
 */
export async function verifyProfileOwnership(
  profileId: string,
  opts: { userId?: string | null; secret?: string | null },
): Promise<boolean> {
  const client = getServiceClient();
  // Supabase nonaktif (mis. dev lokal tanpa env var) — fitur yang
  // bergantung padanya sudah degradasi di tempat lain, jangan tambah
  // lapisan tolak di sini juga.
  if (!client) return true;

  if (opts.userId) {
    const { data, error } = await client.rpc('profile_belongs_to_user', {
      p_profile_id: profileId,
      p_user_id: opts.userId,
    });
    if (!error && data === true) return true;
    // Token valid tapi profil ini belum/bukan miliknya — bisa jadi
    // permintaan ini terjadi tepat di sela-sela `/account/link` belum
    // selesai (profil masih ID tamu lama). Jangan langsung tolak, coba
    // jalur secret Guest di bawah dulu.
  }

  if (!opts.secret) {
    const { data: bound } = await client.rpc('has_bound_secret', { p_profile_id: profileId });
    return bound !== true;
  }
  if (opts.secret.length < 16) return false;

  const { data: ok, error } = await client.rpc('verify_identity', {
    p_profile_id: profileId,
    p_secret_hash: sha256(opts.secret),
  });
  if (error) {
    console.error('verifyProfileOwnership: gagal verifikasi:', error.message);
    return false;
  }
  return ok === true;
}

/** Wrapper HTTP dari `verifyProfileOwnership` — baca id/secret/token dari
 *  header request, kembalikan `profileId` kalau terverifikasi atau `null`
 *  kalau tidak (id tidak valid ATAU kepemilikannya gagal diverifikasi). */
export async function resolveIdentity(req: Request): Promise<string | null> {
  const rawId = req.header('x-player-id');
  const profileId = typeof rawId === 'string' && rawId.length >= 6 ? rawId : null;
  if (!profileId) return null;

  const userId = await resolveUserId(req);
  const secret = req.header('x-player-secret') ?? null;
  const owned = await verifyProfileOwnership(profileId, { userId, secret });
  return owned ? profileId : null;
}
