"use client";

import { useEffect, useRef, useState } from "react";

import PlayerProfileCard from "@/components/PlayerProfileCard";
import type { PlayerStats, RecentGame } from "@/lib/leaderboard";

type Loaded = { stats: PlayerStats; games: RecentGame[] };

/**
 * Profil satu pemain sebagai modal -- dibuka dari mana saja nama/avatar
 * pemain muncul (room, daftar teman, papan peringkat) tanpa meninggalkan
 * halaman yang sedang dilihat. Datanya diambil lewat GET /api/players/[username]
 * karena lib/leaderboard.ts server-only dan modal ini komponen klien.
 */
export default function PlayerProfileModal({
  username,
  onClose,
}: {
  username: string;
  onClose: () => void;
}) {
  // undefined = masih memuat, null = tidak ditemukan.
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
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

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    (async () => {
      try {
        const res = await fetch(`/api/players/${encodeURIComponent(username)}`);
        if (cancelled) return;
        if (!res.ok) {
          setData(null);
          return;
        }
        setData((await res.json()) as Loaded);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

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

        {data === undefined ? (
          <p className="text-[14px] text-[var(--muted)]">Memuat…</p>
        ) : data === null ? (
          <p className="text-[14px] text-[var(--muted)]">Tidak ada pemain dengan username itu.</p>
        ) : (
          <PlayerProfileCard stats={data.stats} games={data.games} />
        )}
      </div>
    </div>
  );
}
