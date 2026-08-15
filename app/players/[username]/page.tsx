import Link from "next/link";

import PlayerProfileCard from "@/components/PlayerProfileCard";
import ThemeToggle from "@/components/ThemeToggle";
import Wordmark from "@/components/Wordmark";
import { playerStats, recentGames } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

function Header() {
  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
        <Wordmark />
        <ThemeToggle />
      </header>
      <div className="flex flex-col gap-1.5">
        <Link href="/leaderboard" className="text-[13px] font-bold text-[var(--muted)]">
          Papan peringkat
        </Link>
        <p className="text-center text-[22px] font-bold tracking-[-0.01em]">Statistik</p>
      </div>
    </>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const stats = playerStats(username);

  if (!stats) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[38rem] flex-col gap-6 px-4 py-6 sm:px-6">
        <Header />
        <p className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-5 text-[14px] text-[var(--muted)]">
          Tidak ada pemain dengan username itu.
        </p>
      </main>
    );
  }

  const games = stats.gamesPlayed > 0 ? recentGames(stats.profile.id) : [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[38rem] flex-col gap-6 px-4 py-6 sm:px-6">
      <Header />
      <PlayerProfileCard stats={stats} games={games} />
    </main>
  );
}
