"use client";

import { useState } from "react";

import Avatar from "@/components/Avatar";
import PlayerProfileModal from "@/components/PlayerProfileModal";
import type { LeaderboardEntry } from "@/lib/leaderboard";

/**
 * Daftar papan peringkat sebagai komponen klien -- klik satu baris membuka
 * profil pemain itu sebagai modal, tanpa meninggalkan halaman leaderboard.
 */
export default function LeaderboardList({
  entries,
  myId,
}: {
  entries: LeaderboardEntry[];
  myId: string | null;
}) {
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  return (
    <>
      <ol className="flex flex-col gap-2">
        {entries.map((entry, i) => {
          const mine = entry.profile.id === myId;
          // Tiga besar dapat warna medali; sisanya nomor polos.
          const medal = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : null;
          return (
            <li key={entry.profile.id}>
              <button
                type="button"
                onClick={() => setProfileUsername(entry.profile.username)}
                className={`flex w-full items-center gap-3 rounded-lg border bg-[var(--card)] p-3 text-left transition-colors hover:border-[var(--fg)]/35 ${
                  mine ? "border-flare/45" : "border-[var(--line)]"
                }`}
                style={
                  !mine && medal
                    ? { borderColor: `color-mix(in oklab, var(--accent-${medal}) 50%, transparent)` }
                    : undefined
                }
              >
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full font-mono text-[12px] font-bold"
                  style={
                    medal
                      ? { background: `var(--accent-${medal})`, color: "var(--bg)" }
                      : { color: "var(--muted)" }
                  }
                >
                  {i + 1}
                </span>
                <Avatar
                  seed={entry.profile.avatarSeed}
                  bg={entry.profile.avatarBg}
                  choices={entry.profile.avatarChoices}
                  name={entry.profile.displayName}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold">{entry.profile.displayName}</p>
                  <p className="text-[12px] text-[var(--muted)]">
                    {entry.gamesPlayed} game
                    {entry.avgWinningGuesses !== null &&
                      ` · rata-rata ${entry.avgWinningGuesses.toFixed(1)} tebakan saat menang`}
                  </p>
                </div>
                <span className="shrink-0 text-[15px] font-bold text-[var(--accent-gold)]">
                  {entry.wins} menang
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {profileUsername && (
        <PlayerProfileModal username={profileUsername} onClose={() => setProfileUsername(null)} />
      )}
    </>
  );
}
