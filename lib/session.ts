/**
 * Keanggotaan room di sisi perangkat.
 *
 * Keanggotaan room dibuktikan dengan id acak yang diberikan server saat
 * membuat atau bergabung, lalu disimpan di localStorage agar menyegarkan
 * halaman tidak mengeluarkan pemain dari room.
 */

function membershipKey(code: string) {
  return `wordheat:room:${code.toUpperCase()}`;
}

export function rememberMembership(code: string, playerId: string) {
  try {
    localStorage.setItem(membershipKey(code), playerId);
  } catch {
    // Tanpa penyimpanan, menyegarkan halaman akan meminta pemain bergabung lagi.
  }
}

export function readMembership(code: string): string | null {
  try {
    return localStorage.getItem(membershipKey(code));
  } catch {
    return null;
  }
}

export function forgetMembership(code: string) {
  try {
    localStorage.removeItem(membershipKey(code));
  } catch {
    // Tidak ada yang perlu dibersihkan.
  }
}
