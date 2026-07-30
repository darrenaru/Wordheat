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

/**
 * Dipanggil setelah pembelian di Shop sukses memotong saldo. Best-effort
 * seperti `creditWallet` — kegagalan menambah stok tidak boleh terjadi
 * diam-diam tanpa saldo ikut kembali, jadi pemanggil (`POST /api/shop/buy`)
 * tetap melaporkan hasilnya ke pemain lewat log server kalau ini gagal.
 */
export async function addPowerup(
  profileId: string,
  powerup: keyof PowerupInventory,
  qty = 1,
): Promise<number> {
  const client = getServiceClient();
  if (!client) return 0;
  try {
    const { data, error } = await client.rpc('add_powerup', {
      p_profile_id: profileId,
      p_powerup: powerup,
      p_qty: qty,
    });
    if (error) {
      console.error('addPowerup: gagal menambah stok:', error.message);
      return 0;
    }
    return data as number;
  } catch (err) {
    console.error('addPowerup: gagal menambah stok:', err);
    return 0;
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
