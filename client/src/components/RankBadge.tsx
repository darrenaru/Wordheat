import { rankForWins } from '../lib/ranks.ts';

interface RankBadgeProps {
  totalWins: number;
  /** `full` (ikon+label+caption progres, Profil Saya/View Profile) atau
   *  `icon` (cuma ikon kecil + tooltip, baris Leaderboard yang sempit). */
  variant?: 'full' | 'icon';
}

export function RankBadge({ totalWins, variant = 'full' }: RankBadgeProps) {
  const rank = rankForWins(totalWins);

  if (variant === 'icon') {
    return (
      <img
        className="rank-badge__icon rank-badge__icon--sm"
        src={rank.iconUrl}
        alt={rank.label}
        title={rank.label}
        width={20}
        height={20}
      />
    );
  }

  return (
    <div className="rank-badge">
      <img className="rank-badge__icon" src={rank.iconUrl} alt="" width={32} height={32} />
      <span className="rank-badge__label">{rank.label}</span>
    </div>
  );
}
