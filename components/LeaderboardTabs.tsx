"use client";

import { useState } from "react";

import LeaderboardList, { type LeaderboardRow } from "@/components/LeaderboardList";
import type { CoinLeaderboardEntry, LeaderboardEntry, LevelLeaderboardEntry } from "@/lib/leaderboard";
import { levelForXp } from "@/lib/xp";

type Category = "wins" | "coins" | "level";

// Jumlah Kemenangan di posisi paling kiri dan jadi kategori aktif pertama
// kali halaman ini dibuka.
const TABS: { key: Category; label: string }[] = [
  { key: "wins", label: "Jumlah Kemenangan" },
  { key: "coins", label: "Coin Terbanyak" },
  { key: "level", label: "XP Terbanyak" },
];

const EMPTY_MESSAGE: Record<Category, string> = {
  wins: "Belum ada game yang selesai. Ajak teman main bareng dan jadilah yang pertama masuk papan ini.",
  coins: "Belum ada yang mengumpulkan Coin. Menang di mode sendiri atau bareng untuk dapat Coin pertamamu.",
  level: "Belum ada yang naik Level. Level didapat dari XP, dan XP didapat setiap kali menang.",
};

function winRows(entries: LeaderboardEntry[]): LeaderboardRow[] {
  return entries.map((e) => ({
    profile: e.profile,
    primary: `${e.wins} menang`,
    secondary:
      `${e.gamesPlayed} game` +
      (e.avgWinningGuesses !== null
        ? ` · rata-rata ${e.avgWinningGuesses.toFixed(1)} tebakan saat menang`
        : ""),
  }));
}

function coinRows(entries: CoinLeaderboardEntry[]): LeaderboardRow[] {
  return entries.map((e) => ({
    profile: e.profile,
    primary: `${e.coins.toLocaleString("id-ID")} koin`,
  }));
}

function levelRows(entries: LevelLeaderboardEntry[]): LeaderboardRow[] {
  return entries.map((e) => ({
    profile: e.profile,
    primary: `Level ${levelForXp(e.xp)}`,
    secondary: `${e.xp.toLocaleString("id-ID")} XP`,
  }));
}

/**
 * Papan peringkat bertab: Kemenangan (room multiplayer), Coin, dan Level.
 * Ketiga daftarnya sudah diambil sekaligus di server (page.tsx) supaya
 * berpindah tab tidak perlu permintaan jaringan baru.
 */
export default function LeaderboardTabs({
  wins,
  coins,
  level,
  myId,
}: {
  wins: LeaderboardEntry[];
  coins: CoinLeaderboardEntry[];
  level: LevelLeaderboardEntry[];
  myId: string | null;
}) {
  const [tab, setTab] = useState<Category>("wins");

  const rows =
    tab === "wins" ? winRows(wins) : tab === "coins" ? coinRows(coins) : levelRows(level);

  return (
    <>
      <div
        role="tablist"
        aria-label="Kategori papan peringkat"
        className="flex gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--field)] p-[3px]"
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-center text-[13px] font-medium transition-colors ${
              tab === key ? "bg-[var(--line)] text-[var(--fg)]" : "text-[var(--muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-4 py-8 text-center text-[14px] text-[var(--muted)]">
          {EMPTY_MESSAGE[tab]}
        </p>
      ) : (
        <LeaderboardList rows={rows} myId={myId} />
      )}
    </>
  );
}
