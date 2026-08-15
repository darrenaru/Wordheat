"use client";

import { useEffect, useState } from "react";

import PlayerProfileCard from "@/components/PlayerProfileCard";
import type { PlayerStats as PlayerStatsData, RecentGame } from "@/lib/leaderboard";

type Loaded = { stats: PlayerStatsData; games: RecentGame[] };

/**
 * Ambil statistik satu pemain lewat GET /api/players/[username] dan
 * tampilkan lewat PlayerProfileCard. Dipisah dari PlayerProfileModal supaya
 * bisa dipakai ulang tanpa bungkus modal -- mis. langsung di halaman Profil
 * sendiri, di mana statistik semestinya tidak perlu diklik dulu untuk terlihat.
 */
export default function PlayerStats({
  username,
  showHeader = true,
}: {
  username: string;
  /** Dimatikan saat pemakainya sudah menampilkan avatar+nama sendiri di atas,
      supaya tidak dobel. */
  showHeader?: boolean;
}) {
  // undefined = masih memuat, null = tidak ditemukan.
  const [data, setData] = useState<Loaded | null | undefined>(undefined);

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

  if (data === undefined) return <p className="text-[14px] text-[var(--muted)]">Memuat…</p>;
  if (data === null) {
    return <p className="text-[14px] text-[var(--muted)]">Tidak ada pemain dengan username itu.</p>;
  }
  return <PlayerProfileCard stats={data.stats} games={data.games} showHeader={showHeader} />;
}
