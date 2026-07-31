import type { PlayerStats } from '@shared/types.ts';
import { BoltIcon, FlameIcon, PlayIcon, StarIcon, TargetIcon, TrophyIcon } from './ui.tsx';

interface StatsGridProps {
  stats: PlayerStats | null | undefined;
  /** Lewati wrapper `.field`+label+`.profile__stats-card` — dipakai saat
   *  pemanggil (kartu bento `Profil Saya`) sudah menyediakan judul dan
   *  bungkus kartunya sendiri. `ViewProfileModal` tidak memakai ini. */
  bare?: boolean;
}

/**
 * Grid kotak statistik — dipakai `ProfileModal` (profil sendiri) maupun
 * `ViewProfileModal` (profil pemain lain). Sama-sama sumbernya `PlayerStats`,
 * cuma bedanya profil sendiri fetch lewat `/stats` (header `x-player-id`)
 * sedangkan profil lain lewat `/players/:id` (publik, tanpa auth).
 */
export function StatsGrid({ stats, bare = false }: StatsGridProps) {
  const avgGuesses =
    stats && stats.totalGames > 0 ? (stats.totalGuesses / stats.totalGames).toFixed(1) : '—';

  if (!stats) return null;

  const grid = (
    <dl className="profile__stats">
      <div className="profile__stat">
        <span className="profile__stat-icon">
          <PlayIcon />
        </span>
        <div>
          <dt className="caption">Total main</dt>
          <dd className="tnum">{stats.totalGames}</dd>
        </div>
      </div>
      <div className="profile__stat">
        <span className="profile__stat-icon">
          <TrophyIcon />
        </span>
        <div>
          <dt className="caption">Menang</dt>
          <dd className="tnum">{stats.totalWins}</dd>
        </div>
      </div>
      <div className="profile__stat">
        <span className="profile__stat-icon">
          <TargetIcon />
        </span>
        <div>
          <dt className="caption">Rata-rata tebakan</dt>
          <dd className="tnum">{avgGuesses}</dd>
        </div>
      </div>
      <div className="profile__stat">
        <span className="profile__stat-icon">
          <StarIcon />
        </span>
        <div>
          <dt className="caption">Tebakan tersedikit</dt>
          <dd className="tnum">{stats.bestGuessCount ?? '—'}</dd>
        </div>
      </div>
      <div className="profile__stat">
        <span className="profile__stat-icon">
          <FlameIcon />
        </span>
        <div>
          <dt className="caption">Streak sekarang</dt>
          <dd className="tnum">{stats.currentStreak}</dd>
        </div>
      </div>
      <div className="profile__stat">
        <span className="profile__stat-icon">
          <BoltIcon />
        </span>
        <div>
          <dt className="caption">Streak terpanjang</dt>
          <dd className="tnum">{stats.longestStreak}</dd>
        </div>
      </div>
    </dl>
  );

  if (bare) return grid;

  return (
    <div className="field">
      <span className="field__label">Statistik</span>
      <div className="profile__stats-card">{grid}</div>
    </div>
  );
}
