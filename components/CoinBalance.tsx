"use client";

import Link from "next/link";

import { useAccount } from "@/components/AccountProvider";

/**
 * Pil saldo Coin, dipasang di header tiap layar (GameBoard, RoomBoard,
 * ProfilePanel, Landing -- tidak ada komponen <Header> bersama di proyek
 * ini, jadi komponen ini ditaruh berulang, sama seperti Wordmark/ThemeToggle).
 * Klik membuka halaman Toko Power-Up di /shop.
 */
export default function CoinBalance() {
  const { me } = useAccount();

  if (!me) return null;

  return (
    <Link
      href="/shop"
      className="flex shrink-0 items-center gap-1.5 rounded-pill border border-[var(--line)] px-3 py-1.5 font-mono text-[13px] font-bold transition-colors hover:border-[var(--fg)]/35"
    >
      <img src="/coin.svg" alt="" width={16} height={16} aria-hidden="true" />
      {me.coins.toLocaleString("id-ID")}
    </Link>
  );
}
