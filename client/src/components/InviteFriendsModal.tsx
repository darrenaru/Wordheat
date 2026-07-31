import { useEffect, useState, useSyncExternalStore } from 'react';
import type { PlayerProfile } from '@shared/types.ts';
import { api } from '../lib/api.ts';
import { getFriends, refreshFriends, subscribeFriends } from '../lib/friends.ts';
import { Avatar } from './Avatar.tsx';
import { Modal, useToast } from './ui.tsx';

interface InviteFriendsModalProps {
  roomCode: string;
  profile: PlayerProfile;
  onClose(): void;
}

const FALLBACK_AVATAR = { seed: 'pemain', backgroundColor: '2A2A2E' };
const EMPTY = { friends: [], incoming: [], outgoing: [], invites: [], unreadMessages: 0 };

/** Undang teman langsung dari lobi — masuk kotak undangan Friend List
 *  mereka (lihat `server/src/game/invites.ts`), bukan tautan yang harus
 *  dibagikan lewat aplikasi luar. */
export function InviteFriendsModal({ roomCode, profile, onClose }: InviteFriendsModalProps) {
  const { friends } = useSyncExternalStore(subscribeFriends, getFriends, () => EMPTY);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    refreshFriends();
  }, []);

  const invite = async (friendProfileId: string, username: string) => {
    setBusyId(friendProfileId);
    try {
      await api.inviteToRoom(roomCode, friendProfileId, profile.name, profile.avatar);
      setSentTo((current) => new Set(current).add(friendProfileId));
      toast.show(`Undangan terkirim ke @${username}.`);
    } catch {
      toast.show('Gagal mengirim undangan.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal title="Undang teman" onClose={onClose}>
      <div className="stack">
        {friends.length === 0 ? (
          <p className="empty">Belum ada teman. Tambahkan lewat halaman Teman dulu.</p>
        ) : (
          <ul className="players">
            {friends.map((friend) => {
              const sent = sentTo.has(friend.user.profileId);
              return (
                <li key={friend.friendshipId} className="player player--wrap">
                  <Avatar config={friend.user.avatar ?? FALLBACK_AVATAR} size={36} />
                  <div className="player__main">
                    <div className="player__name">
                      <span className="player__label">{friend.user.displayName}</span>
                    </div>
                    <div className="player__meta caption">@{friend.user.username}</div>
                  </div>
                  <button
                    className="btn btn--secondary btn--sm"
                    onClick={() => invite(friend.user.profileId, friend.user.username)}
                    disabled={sent || busyId === friend.user.profileId}
                  >
                    {sent ? 'Terkirim' : busyId === friend.user.profileId ? 'Mengirim...' : 'Undang'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
