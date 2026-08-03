import type { PlayerProfile } from '@shared/types.ts';
import { randomAvatar } from './avatar.ts';

const STORAGE_KEY = 'wordheat:profile';

/**
 * Kunci yang dipakai sebelum permainan berganti nama. Masih dibaca sekali saat
 * memuat: avatar dan nama yang sudah disusun sendiri oleh pemain tidak boleh
 * hilang hanya karena judulnya berubah.
 */
const LEGACY_STORAGE_KEY = 'panas-dingin:profile';

/** Nama karakter bergenre fantasi — dipakai apa adanya sebagai separuh pertama. */
const FANTASY_CHARACTER_NAMES = [
  'Aric', 'Kael', 'Fenn', 'Corin', 'Aldric', 'Thorne', 'Draven',
  'Kaidan', 'Sylas', 'Bracken', 'Zephyrion', 'Morvane', 'Ryn',
  "Thal'orien", 'Kestrel', 'Aldwin', 'Roric', 'Varek', 'Coen', 'Dorian',
  'Lira', 'Nova', 'Zara', 'Tessa', 'Vesper', 'Seraphine', 'Isolde',
  'Elowen', 'Wren', 'Nyla', 'Astraia', 'Lunara', 'Ophira', 'Thessaly',
  'Nyssara', 'Elandra', 'Freya', 'Sable', 'Verity', 'Ashlyn',
  'Aris', 'Sage', 'Rhen', 'Shae', 'Vael', 'Ember', 'Storm',
  'Rune', 'Quill', 'Ash', 'Wynn', 'Dune', 'Frost', 'Thistle',
];

/** Generator suku kata — dipakai selang-seling dengan daftar nama tetap di atas
 *  supaya kombinasinya jauh lebih banyak daripada sekadar daftar tetap. */
const NAME_PREFIXES = [
  'Ael', 'Bran', 'Cor', 'Dra', 'El', 'Fen', 'Gal', 'Hal', 'Isol',
  'Kael', 'Lun', 'Mor', 'Nys', 'Or', 'Pyr', 'Quel', 'Ryn', 'Sil',
  'Thal', 'Vael', 'Wyn', 'Zeph',
];
const NAME_SUFFIXES = [
  'wyn', 'ir', 'eth', 'dor', 'iel', 'ric', 'wen', 'ara', 'ion',
  'orn', 'ith', 'yn', 'ael', 'oth', 'ien',
];

/** Gelar/julukan — ditempel di belakang nama untuk sentuhan fantasi. */
const FANTASY_EPITHETS = [
  'the Wanderer', 'the Silent', 'of the Hollow', 'Nightshade',
  'the Forsaken', 'of the Ember', 'Voidwhisper', 'the Unbound',
  'Frostborn', 'the Wayfarer',
];

function randomName(): string {
  const base =
    Math.random() < 0.55
      ? FANTASY_CHARACTER_NAMES[Math.floor(Math.random() * FANTASY_CHARACTER_NAMES.length)]
      : NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)] +
        NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
  const epithet = FANTASY_EPITHETS[Math.floor(Math.random() * FANTASY_EPITHETS.length)];
  return `${base} ${epithet}`;
}

function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function createProfile(): PlayerProfile {
  return {
    id: randomId(),
    name: randomName(),
    avatar: randomAvatar(),
  };
}

export function loadProfile(): PlayerProfile {
  try {
    const migrated = localStorage.getItem(STORAGE_KEY) === null;
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlayerProfile;
      // `id` harus bertahan antar sesi — itu yang membuat pemain bisa
      // menyambung lagi ke kursinya setelah reload di tengah ronde.
      if (parsed?.id && parsed.name && parsed.avatar?.seed) {
        if (migrated) {
          saveProfile(parsed);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
        return parsed;
      }
    }
  } catch {
    // localStorage bisa diblokir (mode privat). Jatuh ke profil baru saja.
  }
  const profile = createProfile();
  saveProfile(profile);
  return profile;
}

const SECRET_KEY = 'wordheat:deviceSecret';

function randomSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Secret device — bukti kepemilikan `profile.id`, TIDAK PERNAH dikirim ke
 * pemain lain (beda dari `profile.id` sendiri, yang tampil apa adanya di
 * leaderboard/profil publik/daftar pemain room). Dibuat sekali per device,
 * dipakai lewat header `x-player-secret` (HTTP, lihat `lib/api.ts`) dan
 * field `secret` pesan `hello` (WebSocket, lihat `lib/ws.ts`) — tanpa ini
 * siapa pun yang tahu `profile.id` orang lain bisa mengaku sebagai dia.
 * Satu secret dipakai terus walau `profile.id` berganti (logout, dsb.) —
 * itu tidak masalah, server mengikat secret ke profileId apa pun yang
 * memakainya, bukan sebaliknya (lihat `server/src/http/identity.ts`).
 */
export function getDeviceSecret(): string {
  try {
    const existing = localStorage.getItem(SECRET_KEY);
    if (existing) return existing;
    const created = randomSecret();
    localStorage.setItem(SECRET_KEY, created);
    return created;
  } catch {
    // localStorage diblokir (mode privat) — secret baru tiap panggilan.
    return randomSecret();
  }
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* diabaikan — permainan tetap jalan tanpa penyimpanan */
  }
}

/**
 * Dipanggil saat logout — identitas device diganti ke tamu baru yang bersih
 * (id/nama/avatar acak baru, pola sama seperti kunjungan pertama kali).
 * Tanpa ini, `profile.id` di localStorage tetap menunjuk ke profil akun
 * yang baru saja logout, dan permainan "tamu" berikutnya diam-diam masih
 * tercatat ke akun itu lewat header `x-player-id` yang tidak berubah.
 */
export function resetProfile(): PlayerProfile {
  const profile = createProfile();
  saveProfile(profile);
  return profile;
}

const SIGN_IN_CHOICE_KEY = 'wordheat:signInChoice';

/** Sudah pernah ditanya "Guest atau Google" sekali — jangan tanya lagi. */
export function hasChosenSignInMethod(): boolean {
  try {
    return localStorage.getItem(SIGN_IN_CHOICE_KEY) === '1';
  } catch {
    return true;
  }
}

export function markSignInMethodChosen(): void {
  try {
    localStorage.setItem(SIGN_IN_CHOICE_KEY, '1');
  } catch {
    /* diabaikan */
  }
}
