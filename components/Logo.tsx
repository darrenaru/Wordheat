/**
 * Tanda gambar Wordheat.
 *
 * Ditulis sebaris alih-alih memuat berkas dari public/, supaya warnanya bisa
 * diwarisi dari CSS dan tidak ada permintaan jaringan tambahan hanya untuk
 * sebuah tanda seukuran teks.
 */
export default function Logo({
  size = 24,
  className,
}: {
  /** Tinggi tanda dalam piksel; lebarnya mengikuti rasio aslinya. */
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 4651 3385"
      role="img"
      aria-label="Wordheat"
      style={{ height: size, width: (size * 4651) / 3385 }}
      className={className}
      fill="currentColor"
    >
      <path d="M2242.01 433.251L1504.01 704.251L1.51001 2807.75L2002.01 1877.25L2388.51 3383.75L3760.01 1346.25H3381.01L3874.01 1149.25L4649.01 0.750977L3904.51 161.251L2477.51 1981.75V955.751L1411.01 1660.75L2242.01 433.251Z" />
    </svg>
  );
}
