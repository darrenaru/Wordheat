"use client";

import { useState } from "react";

import Avatar from "@/components/Avatar";
import PlayerProfileModal from "@/components/PlayerProfileModal";
import type { PublicProfile } from "@/lib/accounts";

export type LeaderboardRow = {
  profile: PublicProfile;
  /** Angka di kanan, mis. "12 menang", "340 koin", "Level 5". */
  primary: string;
  /** Baris kecil di bawah nama, opsional -- mis. jumlah game atau total XP. */
  secondary?: string;
};

/**
 * Daftar papan peringkat sebagai komponen klien -- klik satu baris membuka
 * profil pemain itu sebagai modal, tanpa meninggalkan halaman leaderboard.
 *
 * Tata warna baris meniru persis project Wordheat sebelumnya: hanya
 * peringkat 1 yang dapat warna (aksen emas), peringkat 2-3 sekadar diangkat
 * dari latar polos tanpa warna baru, dan angka di kanan tetap teks biasa --
 * bukan medali emas/perak/perunggu atau angka tebal berwarna seperti versi
 * sebelumnya di sini.
 *
 * Sengaja hanya menerima baris yang sudah diformat (bukan entry mentah per
 * kategori) supaya komponen ini tidak perlu tahu bedanya kemenangan, Coin,
 * dan Level -- pemanggil (LeaderboardTabs) yang memutuskan apa yang tampil
 * sebagai angka utama dan sub-teksnya.
 */
export default function LeaderboardList({
  rows,
  myId,
}: {
  rows: LeaderboardRow[];
  myId: string | null;
}) {
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  return (
    <>
      <ol className="flex flex-col gap-2 rounded-lg border border-[var(--line)] bg-[var(--card)] p-4">
        {rows.map((row, i) => {
          const mine = row.profile.id === myId;
          const podium = i === 0 ? "first" : i === 1 || i === 2 ? "raised" : "plain";
          const surface =
            podium === "first"
              ? "bg-[var(--accent-gold)]/[0.16]"
              : podium === "raised"
                ? "bg-[var(--field)]"
                : "bg-[var(--field)]/60";
          const border = mine
            ? "border-flare/45"
            : podium === "first"
              ? "border-[var(--accent-gold)]/40"
              : podium === "raised"
                ? "border-[var(--line)]"
                : "border-transparent";
          return (
            <li key={row.profile.id}>
              <button
                type="button"
                onClick={() => setProfileUsername(row.profile.username)}
                className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors hover:border-[var(--fg)]/35 ${surface} ${border}`}
              >
                <span
                  className={`w-5 shrink-0 text-center text-[14px] font-bold ${
                    podium === "first" ? "text-[var(--accent-gold)]" : "text-[var(--muted)]"
                  }`}
                >
                  {i + 1}
                </span>
                <Avatar
                  seed={row.profile.avatarSeed}
                  bg={row.profile.avatarBg}
                  choices={row.profile.avatarChoices}
                  name={row.profile.displayName}
                  size={28}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{row.profile.displayName}</p>
                  {row.secondary && (
                    <p className="truncate text-[12px] text-[var(--muted)]">{row.secondary}</p>
                  )}
                </div>
                <span className="shrink-0 tabular-nums text-[14px] text-[var(--fg)]">
                  {row.primary}
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
