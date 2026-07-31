/**
 * Rank — progres BERBEDA dari Level (`shared/xp.ts`). Level dihitung dari
 * XP (kuadratik, sengaja lambat, ukuran keaktifan jangka panjang). Rank
 * dihitung dari `totalWins` (langkah tetap, jauh lebih cepat kesampaian) —
 * ukuran pencapaian menang, bukan duplikat Level.
 *
 * Aset ikonnya di `public/ranks/rank-{tier}-{n}.svg` (Vector Ranks Pack v2,
 * varian Outline, CC0 — https://creativecommons.org/publicdomain/zero/1.0/).
 */
export const RANK_TIERS = [
  { slug: 'stone', label: 'Stone' },
  { slug: 'wood', label: 'Wood' },
  { slug: 'bronze', label: 'Bronze' },
  { slug: 'silver', label: 'Silver' },
  { slug: 'gold', label: 'Gold' },
  { slug: 'platinum', label: 'Platinum' },
  { slug: 'amethyst', label: 'Amethyst' },
  { slug: 'onyx', label: 'Onyx' },
] as const;

const SUB_LEVELS = 7;
const WINS_PER_STEP = 3;
const TOTAL_STEPS = RANK_TIERS.length * SUB_LEVELS;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function labelFor(rankIndex: number): string {
  const tier = RANK_TIERS[Math.floor(rankIndex / SUB_LEVELS)];
  const subLevel = (rankIndex % SUB_LEVELS) + 1;
  return `${tier.label} ${ROMAN[subLevel - 1]}`;
}

export interface RankInfo {
  tierSlug: string;
  tierLabel: string;
  /** 1-7 di dalam tier. */
  subLevel: number;
  roman: string;
  /** "Bronze III". */
  label: string;
  iconUrl: string;
  rankIndex: number;
  isMaxRank: boolean;
  /** `null` kalau sudah rank tertinggi. */
  winsToNext: number | null;
  /** `null` kalau sudah rank tertinggi. */
  nextLabel: string | null;
}

export function rankForWins(totalWins: number): RankInfo {
  const rankIndex = Math.min(
    Math.floor(Math.max(0, totalWins) / WINS_PER_STEP),
    TOTAL_STEPS - 1,
  );
  const tierIndex = Math.floor(rankIndex / SUB_LEVELS);
  const subLevel = (rankIndex % SUB_LEVELS) + 1;
  const tier = RANK_TIERS[tierIndex];
  const isMaxRank = rankIndex === TOTAL_STEPS - 1;

  return {
    tierSlug: tier.slug,
    tierLabel: tier.label,
    subLevel,
    roman: ROMAN[subLevel - 1],
    label: `${tier.label} ${ROMAN[subLevel - 1]}`,
    iconUrl: `/ranks/rank-${tier.slug}-${subLevel}.svg`,
    rankIndex,
    isMaxRank,
    winsToNext: isMaxRank ? null : (rankIndex + 1) * WINS_PER_STEP - totalWins,
    nextLabel: isMaxRank ? null : labelFor(rankIndex + 1),
  };
}
