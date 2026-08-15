/**
 * Identitas pemain di sisi perangkat.
 *
 * Permainan ini tidak punya akun. Keanggotaan room dibuktikan dengan id acak
 * yang diberikan server saat membuat atau bergabung, lalu disimpan di
 * localStorage agar menyegarkan halaman tidak mengeluarkan pemain dari room.
 */

const NAME_KEY = "wordheat:name";

function membershipKey(code: string) {
  return `wordheat:room:${code.toUpperCase()}`;
}

export function readPlayerName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

export function storePlayerName(name: string) {
  try {
    if (name.trim()) localStorage.setItem(NAME_KEY, name.trim());
  } catch {
    // Penyimpanan diblokir: nama cukup berlaku untuk sesi ini.
  }
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
