"use client";

import { useEffect, useRef } from "react";

import Avatar from "@/components/Avatar";
import type { AvatarChoices } from "@/lib/avatar";

type ResultPlayer = {
  id: string;
  name: string;
  avatarSeed?: string;
  avatarBg?: string;
  avatarChoices?: AvatarChoices;
  guessCount: number;
  bestRank: number | null;
};

/**
 * Muncul sekali begitu permainan berakhir lewat suara menyerah -- bukan
 * kemenangan -- supaya semua pemain langsung tahu apa yang terjadi dan apa
 * kata rahasianya, tanpa harus menebak dari papan bersama yang kosong.
 * Bisa ditutup; papan tetap menampilkan jawabannya lewat baris "Kata
 * rahasianya" yang sudah ada, jadi menutup modal ini tidak menghilangkan
 * jawabannya.
 */
export default function SurrenderResultModal({
  players,
  answer,
  voteCount,
  totalPlayers,
  onClose,
}: {
  players: ResultPlayer[];
  answer: string;
  voteCount: number;
  totalPlayers: number;
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

  const ranked = [...players].sort((a, b) => {
    if (a.bestRank === null && b.bestRank === null) return 0;
    if (a.bestRank === null) return 1;
    if (b.bestRank === null) return -1;
    return a.bestRank - b.bestRank;
  });

  return (
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
        aria-label="Hasil permainan"
        tabIndex={-1}
        className="flex w-full max-w-[26rem] flex-col gap-4 rounded-lg border border-[var(--line)] bg-[var(--card)] p-5 outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[17px] font-bold">Permainan berakhir</p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              {voteCount} dari {totalPlayers} pemain memilih menyerah.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="shrink-0 text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
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

        <div className="rounded-lg border border-[var(--line)] bg-[var(--field)] px-4 py-4 text-center">
          <p className="text-[13px] text-[var(--muted)]">Kata rahasianya adalah</p>
          <p className="mt-1 text-[28px] font-bold text-[var(--accent-hot)]">{answer}</p>
        </div>

        <ul className="flex flex-col gap-1">
          {ranked.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 py-2 text-[14px]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Avatar
                  seed={player.avatarSeed}
                  bg={player.avatarBg}
                  choices={player.avatarChoices}
                  name={player.name}
                  size={28}
                />
                <span className="truncate">{player.name}</span>
              </span>
              <span className="shrink-0 font-mono text-[12px] tabular-nums text-[var(--muted)]">
                {player.bestRank === null
                  ? "—"
                  : `${player.guessCount} · ${player.bestRank.toLocaleString("id-ID")}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
