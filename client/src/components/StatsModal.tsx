import { useEffect, useState } from 'react';
import type { PlayerStats } from '@shared/types.ts';
import { api } from '../lib/api.ts';
import { signOut } from '../lib/supabase.ts';
import { Modal } from './ui.tsx';

interface StatsModalProps {
  email: string;
  onClose(): void;
  onSignedOut(): void;
}

export function StatsModal({ email, onClose, onSignedOut }: StatsModalProps) {
  const [stats, setStats] = useState<PlayerStats | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api
      .stats()
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const avgGuesses =
    stats && stats.totalGames > 0 ? (stats.totalGuesses / stats.totalGames).toFixed(1) : '—';

  return (
    <Modal title="Statistik saya" onClose={onClose}>
      <div className="stats-modal">
        <p className="caption">{email}</p>

        {stats === undefined && <p className="caption">Memuat...</p>}

        {stats === null && <p className="caption">Belum ada statistik tercatat.</p>}

        {stats && (
          <dl className="profile__stats">
            <div className="profile__stat">
              <dt className="caption">Total main</dt>
              <dd className="tnum">{stats.totalGames}</dd>
            </div>
            <div className="profile__stat">
              <dt className="caption">Menang</dt>
              <dd className="tnum">{stats.totalWins}</dd>
            </div>
            <div className="profile__stat">
              <dt className="caption">Rata-rata tebakan</dt>
              <dd className="tnum">{avgGuesses}</dd>
            </div>
            <div className="profile__stat">
              <dt className="caption">Tebakan tersedikit</dt>
              <dd className="tnum">{stats.bestGuessCount ?? '—'}</dd>
            </div>
            <div className="profile__stat">
              <dt className="caption">Streak sekarang</dt>
              <dd className="tnum">{stats.currentStreak}</dd>
            </div>
            <div className="profile__stat">
              <dt className="caption">Streak terpanjang</dt>
              <dd className="tnum">{stats.longestStreak}</dd>
            </div>
          </dl>
        )}

        <button
          className="btn btn--ghost btn--sm"
          onClick={async () => {
            await signOut();
            onSignedOut();
          }}
        >
          Keluar
        </button>
      </div>
    </Modal>
  );
}
