"use client";

import Link from "next/link";
import { useState } from "react";

import { useAccount } from "@/components/AccountProvider";
import PowerUpShopModal from "@/components/PowerUpShopModal";

/**
 * Pil saldo Coin, dipasang di header tiap layar (GameBoard, RoomBoard,
 * ProfilePanel, Landing -- tidak ada komponen <Header> bersama di proyek
 * ini, jadi komponen ini ditaruh berulang, sama seperti Wordmark/ThemeToggle).
 *
 * Di luar permainan (Landing, Profil) klik membawa ke halaman /shop penuh.
 * Di dalam permainan (`asModal`, dipakai GameBoard/RoomBoard) klik membuka
 * Toko sebagai modal di atas papan permainan -- pemain tidak boleh terlempar
 * keluar dari game cuma untuk beli Power-Up.
 */
export default function CoinBalance({ asModal = false }: { asModal?: boolean }) {
  const { me } = useAccount();
  const [shopOpen, setShopOpen] = useState(false);

  if (!me) return null;

  const pill = (
    <>
      <img src="/coin.svg" alt="" width={16} height={16} aria-hidden="true" />
      {me.coins.toLocaleString("id-ID")}
    </>
  );
  const pillClassName =
    "flex shrink-0 items-center gap-1.5 rounded-pill border border-[var(--line)] px-3 py-1.5 font-mono text-[13px] font-bold transition-colors hover:border-[var(--fg)]/35";

  if (!asModal) {
    return (
      <Link href="/shop" className={pillClassName}>
        {pill}
      </Link>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setShopOpen(true)} className={pillClassName}>
        {pill}
      </button>
      {shopOpen && <PowerUpShopModal onClose={() => setShopOpen(false)} />}
    </>
  );
}
