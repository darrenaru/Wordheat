"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import PowerUpShopContent from "@/components/PowerUpShopContent";

/**
 * Toko Power-Up sebagai modal, dibuka di atas papan permainan (GameBoard/
 * RoomBoard) supaya pemain bisa belanja tanpa meninggalkan game -- beda dari
 * PowerUpShop.tsx (halaman /shop penuh) yang dipakai saat dibuka dari luar
 * permainan (beranda, profil).
 */
export default function PowerUpShopModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  // Lewat portal ke document.body -- pemanggilnya (CoinBalance) ditaruh di
  // dalam header ber-kelas "rise", dan animasi masuk halaman itu memakai
  // animation-fill-mode:both yang meninggalkan transform non-"none" permanen
  // selesai animasi. Elemen dengan transform begitu jadi containing block
  // baru untuk descendant position:fixed, jadi tanpa portal overlay ini akan
  // terkurung di kotak header, bukan viewport penuh layar (bug nyata yang
  // sempat kejadian saat Toko masih berupa modal, sebelum jadi halaman /shop).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Toko Power-Up"
        tabIndex={-1}
        className="flex max-h-[86dvh] w-full max-w-[26rem] flex-col gap-4 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--card)] p-5 outline-none"
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-[16px] font-bold">Toko Power-Up</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-pill border border-[var(--line)] px-3 py-1.5 text-[13px] font-bold"
          >
            Tutup
          </button>
        </div>

        <PowerUpShopContent />
      </div>
    </div>,
    document.body,
  );
}
