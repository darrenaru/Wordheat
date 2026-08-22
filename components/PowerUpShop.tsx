"use client";

import Link from "next/link";

import PowerUpShopContent from "@/components/PowerUpShopContent";
import ThemeToggle from "@/components/ThemeToggle";
import Wordmark from "@/components/Wordmark";

function Header() {
  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <Wordmark />
        <ThemeToggle />
      </header>
      <div className="flex flex-col gap-1.5">
        <Link href="/" className="text-[13px] font-bold text-[var(--muted)]">
          Kembali
        </Link>
        <p className="text-center text-[22px] font-bold tracking-[-0.01em]">Toko Power-Up</p>
      </div>
    </>
  );
}

/** Halaman Toko Power-Up penuh, dibuka dari luar permainan (beranda, profil). */
export default function PowerUpShop() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[46rem] flex-col gap-6 px-4 py-8 sm:px-6">
      <Header />
      <PowerUpShopContent />
    </main>
  );
}
