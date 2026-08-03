import type { PowerupInventory } from '@shared/types.ts';
import { getServiceClient } from '../db/client.ts';

const EMPTY_INVENTORY: PowerupInventory = { nearestGuess: 0, letterReveal: 0 };

export async function getInventory(profileId: string): Promise<PowerupInventory> {
  const client = getServiceClient();
  if (!client) return { ...EMPTY_INVENTORY };
  try {
    const { data, error } = await client
      .from('powerup_inventory')
      .select('powerup, count')
      .eq('profile_id', profileId);
    if (error || !data) return { ...EMPTY_INVENTORY };
    const inventory = { ...EMPTY_INVENTORY };
    for (const row of data as Array<{ powerup: keyof PowerupInventory; count: number }>) {
      inventory[row.powerup] = row.count;
    }
    return inventory;
  } catch {
    return { ...EMPTY_INVENTORY };
  }
}

export type BuyPowerupResult =
  | { ok: true; balance: number; count: number }
  | { ok: false; balance?: number };

/**
 * Satu-satunya cara membeli powerup — memotong saldo DAN menambah stok
 * dalam satu RPC atomic (`buy_powerup`), bukan dua panggilan terpisah
 * (`spendWallet` lalu `addPowerup`). Dua panggilan terpisah punya celah:
 * kalau yang kedua gagal (network blip, dsb) setelah yang pertama sukses,
 * pemain kehilangan coin tanpa dapat item, dan tidak ada mekanisme refund.
 */
export async function buyPowerup(
  profileId: string,
  powerup: keyof PowerupInventory,
  cost: number,
): Promise<BuyPowerupResult> {
  const client = getServiceClient();
  if (!client) return { ok: false };
  try {
    const { data, error } = await client.rpc('buy_powerup', {
      p_profile_id: profileId,
      p_powerup: powerup,
      p_cost: cost,
    });
    if (error) {
      console.error('buyPowerup: gagal membeli powerup:', error.message);
      return { ok: false };
    }
    const result = data as { ok: boolean; balance: number; count?: number };
    if (!result.ok) return { ok: false, balance: result.balance };
    return { ok: true, balance: result.balance, count: result.count ?? 0 };
  } catch (err) {
    console.error('buyPowerup: gagal membeli powerup:', err);
    return { ok: false };
  }
}

/**
 * Beda dari `addPowerup`: ini mengontrol akses ke efek gameplay nyata,
 * jadi fail-closed — Supabase tidak terkonfigurasi atau stok habis
 * sama-sama berarti "tidak boleh".
 */
export async function usePowerup(profileId: string, powerup: keyof PowerupInventory): Promise<boolean> {
  const client = getServiceClient();
  if (!client) return false;
  try {
    const { data, error } = await client.rpc('use_powerup', {
      p_profile_id: profileId,
      p_powerup: powerup,
    });
    if (error) {
      console.error('usePowerup: gagal memakai stok:', error.message);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.error('usePowerup: gagal memakai stok:', err);
    return false;
  }
}
