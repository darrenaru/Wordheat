import { getServiceClient } from '../db/client.ts';

export async function getBalance(profileId: string): Promise<number> {
  const client = getServiceClient();
  if (!client) return 0;
  try {
    const { data, error } = await client
      .from('wallets')
      .select('balance')
      .eq('profile_id', profileId)
      .maybeSingle();
    if (error || !data) return 0;
    return data.balance as number;
  } catch {
    return 0;
  }
}

/**
 * Dipanggil saat pemain (anonim maupun login) menang. Selalu "best effort" —
 * kegagalan mencatat coin tidak boleh mengganggu hasil permainan yang sudah
 * valid, jadi errornya cuma ditelan dan dicatat ke log. Mengembalikan saldo
 * baru (dari RPC-nya langsung, tanpa query terpisah) supaya pemanggil bisa
 * mengabari client — tanpa ini chip saldo di header tidak pernah tahu dia
 * baru saja dapat coin sampai halaman dimuat ulang.
 */
export async function creditWallet(profileId: string, amount: number): Promise<number | undefined> {
  const client = getServiceClient();
  if (!client) return undefined;
  try {
    const { data, error } = await client.rpc('credit_wallet', {
      p_profile_id: profileId,
      p_amount: amount,
    });
    if (error) {
      console.error('creditWallet: gagal menambah saldo:', error.message);
      return undefined;
    }
    return data as number;
  } catch (err) {
    console.error('creditWallet: gagal menambah saldo:', err);
    return undefined;
  }
}
