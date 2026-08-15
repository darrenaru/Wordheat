import Link from "next/link";

import LeaderboardList from "@/components/LeaderboardList";
import ThemeToggle from "@/components/ThemeToggle";
import Wordmark from "@/components/Wordmark";
import { currentAccount } from "@/lib/accounts";
import { topPlayers } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [account, entries] = [await currentAccount(), topPlayers()];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[38rem] flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
        <Wordmark />
        <ThemeToggle />
      </header>

      <div className="flex flex-col gap-1.5">
        <Link href="/" className="text-[13px] font-bold text-[var(--muted)]">
          Kembali
        </Link>
        <p className="text-center text-[22px] font-bold tracking-[-0.01em]">Papan peringkat</p>
      </div>

      <p className="text-[13px] leading-relaxed text-[var(--muted)]">
        Dihitung dari kemenangan di room multiplayer. Main sendiri tidak ikut dinilai.
      </p>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-5 text-[14px] text-[var(--muted)]">
          Belum ada game yang selesai. Ajak teman main bareng dan jadilah yang pertama
          masuk papan ini.
        </p>
      ) : (
        <LeaderboardList entries={entries} myId={account?.id ?? null} />
      )}
    </main>
  );
}
