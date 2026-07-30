/**
 * Akun pemain (opsional). Client cuma pakai Supabase untuk Auth — sesi
 * login/logout dan tokennya. Semua data permainan (statistik, dll) tetap
 * lewat server Wordheat sendiri, bukan lewat SDK ini.
 *
 * Kalau env-nya belum diisi, fitur akun nonaktif diam-diam: pemain tetap
 * bisa main solo/ruang seperti biasa, cuma tombol "Masuk" disembunyikan.
 */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const client: SupabaseClient | null =
  URL && ANON_KEY ? createClient(URL, ANON_KEY) : null;

export function isAuthAvailable(): boolean {
  return client !== null;
}

let session: Session | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

client?.auth.getSession().then(({ data }) => {
  session = data.session;
  emit();
});

client?.auth.onAuthStateChange((_event, next) => {
  session = next;
  emit();
});

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAuthSession(): Session | null {
  return session;
}

export function getAuthToken(): string | null {
  return session?.access_token ?? null;
}

export async function signUp(email: string, password: string): Promise<string | null> {
  if (!client) return 'Akun belum bisa dipakai di server ini.';
  const { error } = await client.auth.signUp({ email, password });
  return error?.message ?? null;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!client) return 'Akun belum bisa dipakai di server ini.';
  const { error } = await client.auth.signInWithPassword({ email, password });
  return error?.message ?? null;
}

/**
 * Login Google — alur redirect: halaman ini ditinggalkan sementara ke Google,
 * lalu Supabase membawa pemain kembali ke sini dengan sesi yang sudah aktif.
 * Tidak ada yang perlu dilakukan setelah baris ini; `onAuthStateChange` yang
 * sudah didaftarkan di atas otomatis menangkap sesinya begitu halaman dimuat
 * ulang.
 */
export async function signInWithGoogle(): Promise<string | null> {
  if (!client) return 'Akun belum bisa dipakai di server ini.';
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  return error?.message ?? null;
}

export async function signOut(): Promise<void> {
  await client?.auth.signOut();
}
