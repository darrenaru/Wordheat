"use client";

import Link from "next/link";

import { useAccount } from "@/components/AccountProvider";
import Avatar from "@/components/Avatar";
import CoinBalance from "@/components/CoinBalance";
import ThemeToggle from "@/components/ThemeToggle";
import Wordmark from "@/components/Wordmark";
import { BackIcon, FriendsIcon } from "@/components/icons";

/**
 * Navbar bersama di seluruh halaman, meniru `.topbar` di project Wordheat
 * sebelumnya: tanda merek di beranda diganti tombol "Beranda" di halaman
 * lain (satu-satunya jalan kembali -- halaman tidak lagi punya tautan
 * "Kembali" terpisah di bawahnya), lalu satu baris tombol gaya-hantu (Tema,
 * Coin, Teman, Avatar) di kanan, sama di setiap halaman.
 */
export default function AppHeader({
  /** Tampilkan tombol "Beranda" alih-alih tanda merek -- dipakai semua halaman selain beranda sendiri. */
  back = false,
  /** Diteruskan ke CoinBalance: true di dalam permainan (buka sebagai modal), false di halaman biasa (buka /shop). */
  coinAsModal = false,
  className = "",
  style,
}: {
  back?: boolean;
  coinAsModal?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { me } = useAccount();
  const friendsBadge = me
    ? me.incoming.length + Object.values(me.unreadMessages).reduce((a, b) => a + b, 0)
    : 0;

  const ghostButton =
    "flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-1.5 text-[13px] font-bold text-[var(--muted)] transition-colors hover:bg-[var(--field)] hover:text-[var(--fg)]";

  return (
    <header
      className={`flex items-center justify-between gap-2 border-b border-[var(--line)] pb-4 ${className}`}
      style={style}
    >
      {back ? (
        <Link href="/" className={ghostButton}>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            {BackIcon}
          </svg>
          Beranda
        </Link>
      ) : (
        <Wordmark href={null} />
      )}

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <CoinBalance asModal={coinAsModal} />
        <Link href="/friends" aria-label="Teman" className={`relative ${ghostButton}`}>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            {FriendsIcon}
          </svg>
          <span className="hidden sm:inline">Teman</span>
          {friendsBadge > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 grid size-[16px] place-items-center rounded-full bg-flare text-[10px] font-bold text-[#150710]"
            >
              {friendsBadge}
            </span>
          )}
        </Link>
        {me && (
          <Link href="/profile" aria-label="Profil saya" className="shrink-0 rounded-full transition-transform hover:scale-[1.06]">
            <Avatar
              seed={me.account.avatarSeed}
              bg={me.account.avatarBg}
              choices={me.account.avatarChoices}
              name={me.account.displayName}
              size={32}
            />
          </Link>
        )}
      </div>
    </header>
  );
}
