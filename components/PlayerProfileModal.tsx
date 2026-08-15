"use client";

import { useEffect, useRef } from "react";

import PlayerStats from "@/components/PlayerStats";

/**
 * Profil satu pemain sebagai modal -- dibuka dari mana saja nama/avatar
 * pemain muncul (room, daftar teman, papan peringkat) tanpa meninggalkan
 * halaman yang sedang dilihat. PlayerStats yang menangani pengambilan data
 * lewat GET /api/players/[username]; modal ini cuma bungkusnya.
 */
export default function PlayerProfileModal({
  username,
  onClose,
}: {
  username: string;
  onClose: () => void;
}) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Profil pemain"
        tabIndex={-1}
        className="flex w-full max-w-[28rem] flex-col gap-5 overflow-y-auto border-[var(--line)] bg-[var(--card)] p-5 outline-none sm:max-h-[85dvh] sm:rounded-lg sm:border"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
          <span className="text-[15px] font-bold">Profil</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <PlayerStats username={username} />
      </div>
    </div>
  );
}
