/** Format kasar waktu relatif untuk "terakhir online" — cuma perlu akurat
 *  sampai level menit/jam/hari, bukan presisi detik. */
export function formatLastSeen(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return new Date(epochMs).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
