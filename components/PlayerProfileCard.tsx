import Avatar from "@/components/Avatar";
import LivePresenceDot from "@/components/LivePresenceDot";
import PlayerProfileActions from "@/components/PlayerProfileActions";
import XpBar from "@/components/XpBar";
import type { PlayerStats, RecentGame } from "@/lib/leaderboard";
import type { AccountStatus } from "@/lib/profile";
import { levelForXp } from "@/lib/xp";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-4 text-center">
      <p className="text-[22px] font-bold">{value}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
    </div>
  );
}

/**
 * Isi profil satu pemain: header (avatar, nama, tanggal bergabung, tombol
 * aksi) plus statistik dan riwayat game. Dipakai bersama oleh halaman penuh
 * `/players/[username]` (tautan yang bisa dibagikan) dan `PlayerProfileModal`
 * (tampilan cepat tanpa pindah halaman), supaya markupnya tidak dobel.
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
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative inline-block shrink-0">
              <Avatar
                seed={stats.profile.avatarSeed}
                bg={stats.profile.avatarBg}
                choices={stats.profile.avatarChoices}
                name={stats.profile.displayName}
                size={56}
              />
              <span
                aria-hidden="true"
                className="absolute -bottom-1 -right-1 rounded-pill border border-[var(--line)] bg-[var(--card)] px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none"
              >
                Lv.{levelForXp(stats.xp)}
              </span>
            </span>
            <div className="min-w-0">
              <p className="truncate text-[20px] font-bold">{stats.profile.displayName}</p>
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
          </div>
          <PlayerProfileActions profile={stats.profile} />
        </div>
      )}

      <div className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-4">
        <XpBar xp={stats.xp} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Peringkat" value={stats.rank ? `#${stats.rank}` : "—"} />
        <StatTile label="Game" value={String(stats.gamesPlayed)} />
        <StatTile label="Menang" value={String(stats.wins)} />
        <StatTile
          label="Rasio menang"
          value={stats.winRate !== null ? `${Math.round(stats.winRate * 100)}%` : "—"}
        />
      </div>

      {stats.avgWinningGuesses !== null && (
        <p className="text-[13px] text-[var(--muted)]">
          Rata-rata {stats.avgWinningGuesses.toFixed(1)} tebakan saat menang.
        </p>
      )}

      <section className="flex flex-col gap-2">
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
