import Avatar from "@/components/Avatar";
import { CheckIcon, GamepadIcon, TargetIcon, TrophyIcon } from "@/components/icons";
import LivePresenceDot from "@/components/LivePresenceDot";
import PlayerProfileActions from "@/components/PlayerProfileActions";
import XpBar from "@/components/XpBar";
import type { PlayerStats, RecentGame } from "@/lib/leaderboard";
import type { AccountStatus } from "@/lib/profile";
import { levelForXp } from "@/lib/xp";

/** Kotak statistik ikon+angka, meniru `.profile__stat` di project Wordheat sebelumnya. */
function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[var(--field)] p-3 text-left">
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--card)] text-[var(--muted)]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
        >
          {icon}
        </svg>
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
          {label}
        </p>
        <p className="truncate text-[16px] font-bold">{value}</p>
      </div>
    </div>
  );
}

/**
 * Isi profil satu pemain: header (avatar, nama, tanggal bergabung, tombol
 * aksi) plus statistik dan riwayat game. Dipakai bersama oleh halaman penuh
 * `/players/[username]` (tautan yang bisa dibagikan) dan `PlayerProfileModal`
 * (tampilan cepat tanpa pindah halaman), supaya markupnya tidak dobel.
 *
 * Header dan kartu statistik meniru tata letak "Profil Pemain" di project
 * Wordheat sebelumnya (`ViewProfileModal`): avatar besar dengan cincin dan
 * badge Level di kartu horizontal berlatar redup, lalu kotak statistik
 * berikon alih-alih angka polos.
 */
export default function PlayerProfileCard({
  stats,
  games,
  status,
  showHeader = true,
}: {
  stats: PlayerStats;
  games: RecentGame[];
  status?: AccountStatus;
  /** Dimatikan saat pemakainya sudah menampilkan avatar+nama sendiri di atas. */
  showHeader?: boolean;
}) {
  return (
    <>
      {showHeader && (
        <div className="relative flex shrink-0 items-center gap-4 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--field)] p-4">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-20 size-56 rounded-full bg-flare/20 blur-3xl"
          />
          <span className="relative inline-block shrink-0 rounded-full border-2 border-flare/40 p-0.5">
            <Avatar
              seed={stats.profile.avatarSeed}
              bg={stats.profile.avatarBg}
              choices={stats.profile.avatarChoices}
              name={stats.profile.displayName}
              size={72}
            />
            <span
              aria-hidden="true"
              className="absolute -bottom-1 -right-1.5 rounded-pill border border-[var(--line)] bg-[var(--card)] px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none"
            >
              Lv.{levelForXp(stats.xp)}
            </span>
          </span>
          <div className="relative min-w-0 flex-1">
            <p className="truncate text-[18px] font-bold">{stats.profile.displayName}</p>
            <p className="truncate font-mono text-[13px] text-[var(--muted)]">
              @{stats.profile.username}
            </p>
            {status && (
              <LivePresenceDot
                username={stats.profile.username}
                initialStatus={status}
                withLabel
                className="mt-1"
              />
            )}
            <p className="text-[12px] text-[var(--muted)]">
              Bergabung{" "}
              {new Date(stats.memberSince).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="relative shrink-0 self-start">
            <PlayerProfileActions profile={stats.profile} />
          </div>
        </div>
      )}

      <div className="shrink-0 rounded-lg border border-[var(--line)] bg-[var(--card)] p-4">
        <XpBar xp={stats.xp} />
      </div>

      <div className="shrink-0 rounded-lg border border-[var(--line)] bg-[var(--card)] p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <StatTile icon={TrophyIcon} label="Peringkat" value={stats.rank ? `#${stats.rank}` : "—"} />
          <StatTile icon={GamepadIcon} label="Game" value={String(stats.gamesPlayed)} />
          <StatTile icon={CheckIcon} label="Menang" value={String(stats.wins)} />
          <StatTile
            icon={TargetIcon}
            label="Rasio menang"
            value={stats.winRate !== null ? `${Math.round(stats.winRate * 100)}%` : "—"}
          />
        </div>
      </div>

      {stats.avgWinningGuesses !== null && (
        <p className="shrink-0 text-[13px] text-[var(--muted)]">
          Rata-rata {stats.avgWinningGuesses.toFixed(1)} tebakan saat menang.
        </p>
      )}

      <section className="flex shrink-0 flex-col gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Riwayat terakhir
        </p>
        {games.length === 0 ? (
          <p className="text-[13px] text-[var(--muted)]">Belum ada riwayat game.</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {games.map((game) => (
              <li
                key={game.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 py-2.5 text-[13px]"
              >
                <span
                  className={
                    game.won ? "font-bold text-[var(--accent-gold)]" : "text-[var(--muted)]"
                  }
                >
                  {game.won ? "Menang" : "Kalah"}
                </span>
                <span className="font-mono text-[12px] text-[var(--muted)]">
                  Room {game.roomCode}
                </span>
                <span className="text-[var(--muted)]">{game.guessCount} tebakan</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
