/**
 * Isi ikon garis 24×24, dipakai di dalam <svg> milik pemanggil.
 *
 * Digambar sendiri alih-alih memakai pustaka ikon: yang dibutuhkan cuma
 * segelintir bentuk, dan ketebalan garisnya harus sama persis dengan sisa
 * antarmuka.
 */

/** Satu orang: mode main sendiri. */
export const SoloIcon = (
  <>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5.2 20c0-3.4 3-5.4 6.8-5.4s6.8 2 6.8 5.4" />
  </>
);

/** Beberapa orang: mode main bareng. */
export const PartyIcon = (
  <>
    <circle cx="9.2" cy="8" r="3.2" />
    <path d="M3 20c0-3.2 2.8-5.1 6.2-5.1s6.2 1.9 6.2 5.1" />
    <path d="M16.4 5.3a3.2 3.2 0 0 1 0 5.9" />
    <path d="M18 14.4c1.9.6 3 2.2 3 4.4" />
  </>
);

// ------------------------------------------------- kategori avatar --

/** Rambut: siluet poni di atas kepala. */
export const HairIcon = (
  <>
    <path d="M4 13a8 8 0 0 1 16 0" />
    <path d="M4 13v5" />
    <path d="M20 13v5" />
    <path d="M8.5 6.5c2 2.5 5.5 3.5 9 3" />
  </>
);

/** Alis: sepasang lengkung. */
export const EyebrowIcon = (
  <>
    <path d="M3 13c1.6-2.8 4-4.2 7-4.2" />
    <path d="M14 8.8c3 0 5.4 1.4 7 4.2" />
  </>
);

/** Mata. */
export const EyeIcon = (
  <>
    <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.6" />
  </>
);

/** Mulut: lengkung senyum. */
export const MouthIcon = (
  <>
    <path d="M4 10c2.6 4.6 13.4 4.6 16 0" />
    <path d="M8.5 13.4c1.9 1.4 5.1 1.4 7 0" />
  </>
);

/** Detail wajah: kilau kecil untuk bintik, rona, dan tanda lahir. */
export const SparkIcon = (
  <>
    <path d="M12 4.5 13.4 9 18 10.4 13.4 11.8 12 16.3 10.6 11.8 6 10.4 10.6 9 12 4.5Z" />
    <path d="M18.2 15.6 18.8 17.6 20.8 18.2 18.8 18.8 18.2 20.8 17.6 18.8 15.6 18.2 17.6 17.6 18.2 15.6Z" />
  </>
);

/** Kacamata. */
export const GlassesIcon = (
  <>
    <circle cx="6.4" cy="14" r="3.4" />
    <circle cx="17.6" cy="14" r="3.4" />
    <path d="M9.8 14c.7-1 3.7-1 4.4 0" />
    <path d="M3 12.4 4.6 9.2" />
    <path d="M21 12.4 19.4 9.2" />
  </>
);

/** Anting: gelang gantung di daun telinga. */
export const EarringIcon = (
  <>
    <path d="M12 3.5v7" />
    <circle cx="12" cy="14" r="4" />
    <circle cx="12" cy="3.5" r="1.2" />
  </>
);

/** Dadu: mengacak pilihan. */
export const DiceIcon = (
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <circle cx="8.6" cy="8.6" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="15.4" cy="15.4" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="15.4" cy="8.6" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="8.6" cy="15.4" r="1.15" fill="currentColor" stroke="none" />
  </>
);

/** Panah memutar: mengembalikan ke keadaan semula. */
export const UndoIcon = (
  <>
    <path d="M4 5.5v5h5" />
    <path d="M4.6 10.5a8 8 0 1 1 .7 5.2" />
  </>
);

/** Kunci: kartu untuk masuk dengan kode room. */
export const KeyIcon = (
  <>
    <circle cx="8" cy="12" r="3.6" />
    <path d="M11.6 12H21" />
    <path d="M17.6 12v3.2" />
    <path d="M20.4 12v2.2" />
  </>
);

/** Dua orang berdampingan, satu garis satu isi: daftar teman. */
export const FriendsIcon = (
  <>
    <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
    <rect x="5.8" y="3.8" width="6.4" height="6.4" rx="2.2" />
    <path d="M22 20v-1.5a4 4 0 0 0-3-3.87M16.5 4.2a3.2 3.2 0 0 1 0 5.9" />
  </>
);

/** Gelembung percakapan: membuka obrolan dengan teman. */
export const ChatIcon = (
  <>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5v-3.5H6.5A2.5 2.5 0 0 1 4 12.5v-6Z" />
  </>
);

/** Panah kirim: melepas pesan chat. */
export const SendIcon = (
  <>
    <path d="M4 12 20 4l-6 16-2.5-7L4 12Z" />
  </>
);

/** Tanda tanya dalam lingkaran: membuka panduan cara bermain. */
export const HelpIcon = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.3 9.3a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.2 1-1.2 2" />
    <circle cx="12" cy="16.6" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="1.8" />
  </>
);

/** Satu orang plus tanda tambah: mengirim permintaan pertemanan. */
export const AddFriendIcon = (
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19.5c0-3.2 2.7-5 6-5s6 1.8 6 5" />
    <path d="M18 8v6" />
    <path d="M15 11h6" />
  </>
);

/** Satu orang plus tanda kurang: memutus pertemanan atau membatalkan permintaan. */
export const RemoveFriendIcon = (
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19.5c0-3.2 2.7-5 6-5s6 1.8 6 5" />
    <path d="M15 11h6" />
  </>
);

/** Jam: permintaan pertemanan yang masih menunggu jawaban. */
export const PendingIcon = (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>
);

/** Piala: papan peringkat, siapa paling sering menang. */
export const TrophyIcon = (
  <>
    <path d="M8 3.5h8v4a4 4 0 0 1-8 0v-4Z" />
    <path d="M8 4.3H5.3A2 2 0 0 0 4.8 8.2L8 9.8" />
    <path d="M16 4.3h2.7a2 2 0 0 1 .5 3.9L16 9.8" />
    <path d="M12 11.5v3.2" />
    <path d="M9 20.5h6" />
    <path d="M10 17.5h4l.7 3H9.3l.7-3Z" />
  </>
);
