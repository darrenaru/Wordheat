import Link from "next/link";

import Logo from "@/components/Logo";

/**
 * Kunci nama produk: tanda gambar plus tulisan.
 *
 * Disatukan dalam satu komponen supaya perbandingan tanda terhadap teks sama
 * persis di setiap halaman, bukan diketik ulang tiap kali dan pelan-pelan
 * bergeser.
 */
export default function Wordmark({
  size = 26,
  href = "/",
}: {
  /** Ukuran huruf tulisan; tandanya diskalakan mengikutinya. */
  size?: number;
  href?: string | null;
}) {
  const content = (
    <span className="flex items-center gap-2">
      {/* Tandanya memakai warna nyala, sama dengan ujung "heat" pada tulisan. */}
      <Logo size={size * 0.72} className="shrink-0 text-flare" />
      <span
        style={{ fontSize: size }}
        className="font-bold leading-none tracking-[-0.03em]"
      >
        Word<span className="wordmark-heat">heat</span>
      </span>
    </span>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
