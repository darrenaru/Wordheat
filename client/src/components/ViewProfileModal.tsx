import { useEffect, useState } from 'react';
import type { PublicProfile } from '@shared/types.ts';
import { xpProgress } from '@shared/xp.ts';
import { api } from '../lib/api.ts';
import { FALLBACK_AVATAR } from '../lib/avatar.ts';
import { AddFriendButton } from './AddFriendButton.tsx';
import { Avatar } from './Avatar.tsx';
import { Modal } from './ui.tsx';
import { PresenceBadge } from './PresenceBadge.tsx';
import { RankBadge } from './RankBadge.tsx';
import { StatsGrid } from './StatsGrid.tsx';
import { XpBar } from './XpBar.tsx';

interface ViewProfileModalProps {
  profileId: string;
  onClose(): void;
}

/**
 * Kartu profil publik pemain lain — dibuka dari Leaderboard (klik nama
 * pemain). Selalu read-only (tidak ada tombol ubah apa pun): beda dari
 * `ProfileModal` (profil sendiri, bisa diedit) dan dari `PlayerProfileModal`
 * (profil pemain DALAM satu ronde ruang yang sedang berjalan — datanya
 * ephemeral per-ronde, bukan statistik jangka panjang seperti di sini).
 */
export function ViewProfileModal({ profileId, onClose }: ViewProfileModalProps) {
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setProfile(undefined);
    api
      .playerProfile(profileId)
      .then((result) => alive && setProfile(result))
      .catch(() => alive && setProfile(null));
    return () => {
      alive = false;
    };
  }, [profileId]);

  const level = xpProgress(profile?.stats.xp ?? 0).level;

  return (
    <Modal title={profile?.displayName ?? 'Profil Pemain'} onClose={onClose}>
      {profile === undefined && <p className="empty">Memuat profil...</p>}
      {profile === null && <p className="empty">Profil tidak ditemukan.</p>}
      {profile && (
        <div className="view-profile">
          <div className="view-profile__header">
            <div className="view-profile__action">
              <AddFriendButton profileId={profile.profileId} variant="icon" />
            </div>
            <div className="view-profile__avatar">
              <Avatar
                config={profile.avatar ?? FALLBACK_AVATAR}
                size={72}
                alt={profile.displayName}
              />
              <span className="view-profile__badge">Lv. {level}</span>
            </div>
            <div className="view-profile__identity">
              <span className="view-profile__name">{profile.displayName}</span>
              <span className="view-profile__username">
                {profile.username ? `@${profile.username}` : 'Belum punya username'}
              </span>
              <PresenceBadge profileId={profile.profileId} initialPresence={profile.presence} />
              <RankBadge totalWins={profile.stats.totalWins} />
              {profile.bio && <p className="view-profile__bio">{profile.bio}</p>}
            </div>
          </div>

          <div className="field">
            <div className="profile__level-card">
              <XpBar xp={profile.stats.xp} />
            </div>
          </div>

          <StatsGrid stats={profile.stats} />
        </div>
      )}
    </Modal>
  );
}
