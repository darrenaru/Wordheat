import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null | undefined;

/**
 * `undefined` = belum dicek, `null` = env var tidak lengkap (fitur-fitur yang
 * bergantung padanya nonaktif tapi server tetap jalan normal), `SupabaseClient`
 * = siap dipakai. Dipakai bersama oleh statistik pribadi dan wallet coin —
 * keduanya opsional, bukan bagian inti permainan.
 */
export function getServiceClient(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn(
      'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY tidak diset — statistik pribadi & coin pemain nonaktif.',
    );
    client = null;
    return client;
  }

  try {
    client = createClient(url, key, { auth: { persistSession: false } });
  } catch (err) {
    console.error('getServiceClient: gagal membuat client Supabase:', err);
    client = null;
  }
  return client;
}
