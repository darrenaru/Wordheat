export const config = {
  port: Number(process.env.PORT ?? 8787),
  isProduction: process.env.NODE_ENV === 'production',

  /** Sesi solo yang tidak disentuh selama ini akan dibuang. */
  soloSessionTtlMs: 1000 * 60 * 60 * 6,
  /** Ruang kosong dibuang setelah tenggang ini. */
  roomTtlMs: 1000 * 60 * 30,
  /** Jeda antar pemeriksaan housekeeping. */
  sweepIntervalMs: 1000 * 60,

  maxPlayersPerRoom: 12,
  maxRooms: 500,
  /** Batas tebakan per pemain, sebagai pengaman anti-spam. */
  maxGuessesPerPlayer: 300,

  /**
   * Zona waktu acuan kata harian. Semua pemain di zona mana pun mendapat kata
   * yang sama sepanjang tanggal WIB berjalan.
   */
  dailyTimezoneOffsetHours: 7,
};
