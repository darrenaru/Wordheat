import { useEffect, useState } from 'react';
import type { Leaderboard, LeaderboardEntry } from '@shared/types.ts';
import { api } from '../lib/api.ts';
import { FALLBACK_AVATAR } from '../lib/avatar.ts';
import { Avatar } from '../components/Avatar.tsx';
import { RankBadge } from '../components/RankBadge.tsx';
import { ViewProfileModal } from '../components/ViewProfileModal.tsx';

type Category = keyof Leaderboard;

const CATEGORIES: Array<{ key: Category; label: string; unit: string }> = [
  { key: 'coins', label: 'Coin Terbanyak', unit: 'coin' },
  { key: 'wins', label: 'Jumlah Kemenangan', unit: 'menang' },
  { key: 'streak', label: 'Streak Terpanjang', unit: 'hari' },
  { key: 'guesses', label: 'Jumlah Tebakan', unit: 'tebakan' },
  { key: 'xp', label: 'XP Terbanyak', unit: 'XP' },
];

const EMPTY: Leaderboard = { coins: [], wins: [], streak: [], guesses: [], xp: [] };

export function LeaderboardScreen() {
  const [category, setCategory] = useState<Category>('coins');
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .leaderboard()
      .then((data) => alive && setLeaderboard(data))
      .catch(() => alive && setError('Gagal memuat leaderboard.'));
    return () => {
      alive = false;
    };
  }, []);

  const active = CATEGORIES.find((c) => c.key === category)!;
  const entries: LeaderboardEntry[] = leaderboard?.[category] ?? EMPTY[category];

  return (
    <div className="stack" style={{ gap: 24 }}>
      <h1>Leaderboard</h1>

      <div className="seg" role="group" style={{ flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            aria-pressed={category === cat.key}
            onClick={() => setCategory(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="card">
        {error && <p className="empty">{error}</p>}

        {!error && leaderboard === null && <p className="empty">Memuat...</p>}

        {!error && leaderboard !== null && entries.length === 0 && (
          <p className="empty">Belum ada yang tercatat di kategori ini. Jadilah yang pertama!</p>
        )}

        {!error && entries.length > 0 && (
          <ol className="result-ranks">
            {entries.map((entry, index) => (
              <li
                key={entry.profileId}
                className="result-rank"
                data-rank={index < 3 ? index + 1 : undefined}
              >
                <span className="result-rank__place tnum">{index + 1}</span>
                <button
                  type="button"
                  className="result-rank__trigger"
                  onClick={() => setViewingProfileId(entry.profileId)}
                  aria-label={`Lihat profil ${entry.name}`}
                >
                  <Avatar config={entry.avatar ?? FALLBACK_AVATAR} size={28} />
                  <RankBadge totalWins={entry.totalWins} variant="icon" />
                  <span className="result-rank__name">{entry.name}</span>
                </button>
                <span className="tnum">
                  {entry.value} {active.unit}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {viewingProfileId && (
        <ViewProfileModal
          profileId={viewingProfileId}
          onClose={() => setViewingProfileId(null)}
        />
      )}
    </div>
  );
}
