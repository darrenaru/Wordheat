import Link from "next/link";

import LeaderboardTabs from "@/components/LeaderboardTabs";
import ThemeToggle from "@/components/ThemeToggle";
import Wordmark from "@/components/Wordmark";
import { currentAccount } from "@/lib/accounts";
import { topPlayers, topPlayersByCoins, topPlayersByXp } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [account, wins, coins, level] = [
    await currentAccount(),
    topPlayers(),
    topPlayersByCoins(),
    topPlayersByXp(),
  ];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[38rem] flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
        <Wordmark />
        <ThemeToggle />
      </header>

      <div className="flex flex-col gap-2">
        <Link href="/" className="text-[13px] font-bold text-[var(--muted)]">
          Kembali
        </Link>
        <h1 className="text-[34px] font-bold tracking-[-0.02em]">Papan peringkat</h1>
      </div>

      <LeaderboardTabs wins={wins} coins={coins} level={level} myId={account?.id ?? null} />
    </main>
  );
}
