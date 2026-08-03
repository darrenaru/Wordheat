import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { RoomInviteSummary, UserSummary } from '@shared/types.ts';
import { api, ApiFailure } from '../lib/api.ts';
import { getFriends, refreshFriends, subscribeFriends } from '../lib/friends.ts';
import { FALLBACK_AVATAR } from '../lib/avatar.ts';
import { loadProfile } from '../lib/profile.ts';
import { navigate } from '../lib/router.ts';
import { Avatar } from '../components/Avatar.tsx';
import { ChatModal } from '../components/ChatModal.tsx';
import { PresenceBadge } from '../components/PresenceBadge.tsx';
import { MessageIcon, useToast } from '../components/ui.tsx';

const EMPTY = { friends: [], incoming: [], outgoing: [], invites: [], unreadMessages: 0 };

export function FriendListScreen() {
  const payload = useSyncExternalStore(subscribeFriends, getFriends, () => EMPTY);
  const toast = useToast();
  // Chat dibuka sebagai modal DI ATAS halaman Teman (bukan navigasi ke
  // halaman lain) — pemain tidak kehilangan konteks daftar teman/
  // permintaan di baliknya.
  const [chatProfileId, setChatProfileId] = useState<string | null>(null);

  useEffect(() => {
    refreshFriends();
  }, []);

  const respond = async (id: string, accept: boolean) => {
    try {
      await api.respondFriendRequest(id, accept);
    } catch {
      toast.show('Gagal merespons permintaan.', 'error');
    } finally {
      refreshFriends();
    }
  };

  const removeOrCancel = async (id: string) => {
    try {
      await api.removeFriendship(id);
    } catch {
      toast.show('Gagal menghapus.', 'error');
    } finally {
      refreshFriends();
    }
  };

  const joinInvite = (invite: RoomInviteSummary) => {
    navigate(`/ruang/${invite.roomCode}`);
    void api.dismissInvite(invite.id).catch(() => {});
  };

  const dismissInvite = async (id: string) => {
    try {
      await api.dismissInvite(id);
    } catch {
      toast.show('Gagal mengabaikan undangan.', 'error');
    } finally {
      refreshFriends();
    }
  };

  return (
    <div className="stack" style={{ gap: 24 }}>
      <h1>Teman</h1>

      <AddFriendCard
        excludeProfileIds={
          new Set([
            ...payload.friends.map((f) => f.user.profileId),
            ...payload.outgoing.map((r) => r.user.profileId),
          ])
        }
        onSent={refreshFriends}
      />

      {payload.invites.length > 0 && (
        <Section title="Undangan room">
          <ul className="players">
            {payload.invites.map((invite) => (
              <li key={invite.id} className="player player--wrap">
                <Avatar config={invite.from.avatar ?? FALLBACK_AVATAR} size={36} />
                <div className="player__main">
                  <div className="player__name">
                    <span className="player__label">{invite.from.displayName}</span>
                  </div>
                  <div className="player__meta caption tnum">Kode ruang {invite.roomCode}</div>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <button className="btn btn--primary btn--sm" onClick={() => joinInvite(invite)}>
                    Gabung
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => dismissInvite(invite.id)}
                  >
                    Abaikan
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {payload.incoming.length > 0 && (
        <Section title="Permintaan masuk">
          <ul className="players">
            {payload.incoming.map((request) => (
              <li key={request.id} className="player player--wrap">
                <Avatar config={request.user.avatar ?? FALLBACK_AVATAR} size={36} />
                <div className="player__main">
                  <div className="player__name">
                    <span className="player__label">{request.user.displayName}</span>
                  </div>
                  <div className="player__meta caption">@{request.user.username}</div>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => respond(request.id, true)}
                  >
                    Terima
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => respond(request.id, false)}>
                    Tolak
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {payload.outgoing.length > 0 && (
        <Section title="Permintaan terkirim">
          <ul className="players">
            {payload.outgoing.map((request) => (
              <li key={request.id} className="player player--wrap">
                <Avatar config={request.user.avatar ?? FALLBACK_AVATAR} size={36} />
                <div className="player__main">
                  <div className="player__name">
                    <span className="player__label">{request.user.displayName}</span>
                  </div>
                  <div className="player__meta caption">@{request.user.username} · menunggu</div>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => removeOrCancel(request.id)}>
                  Batalkan
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Daftar teman">
        {payload.friends.length === 0 ? (
          <p className="empty">Belum ada teman. Coba cari lewat username di atas.</p>
        ) : (
          <ul className="players">
            {payload.friends.map((friend) => (
              <li key={friend.friendshipId} className="player player--wrap">
                <Avatar config={friend.user.avatar ?? FALLBACK_AVATAR} size={36} />
                <div className="player__main">
                  <div className="player__name">
                    <span className="player__label">{friend.user.displayName}</span>
                  </div>
                  <div className="player__meta caption">@{friend.user.username}</div>
                  <PresenceBadge profileId={friend.user.profileId} initialPresence={friend.user.presence} />
                </div>
                <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setChatProfileId(friend.user.profileId)}
                    aria-label={`Chat dengan ${friend.user.displayName}`}
                  >
                    <MessageIcon />
                    Chat
                  </button>
                  <button
                    className="btn btn--ghost btn--sm btn--danger"
                    onClick={() => removeOrCancel(friend.friendshipId)}
                  >
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {chatProfileId && (
        <ChatModal profileId={chatProfileId} onClose={() => setChatProfileId(null)} />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card stack">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function AddFriendCard({
  excludeProfileIds,
  onSent,
}: {
  excludeProfileIds: Set<string>;
  onSent(): void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  // Debounce ringan — cukup untuk tidak memukul server tiap ketukan tombol,
  // tanpa perlu library terpisah untuk satu kotak cari yang sederhana ini.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      api
        .searchUsers(q)
        .then((users) => alive && setResults(users))
        .catch(() => {});
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  // Sudah berteman atau permintaannya masih menunggu — jangan tawarkan
  // "Tambah" lagi, tombolnya cuma akan berakhir dengan error dari server.
  const visibleResults = results.filter((user) => !excludeProfileIds.has(user.profileId));

  const add = async (user: UserSummary) => {
    setError(null);
    setBusyId(user.profileId);
    try {
      await api.sendFriendRequest(user.profileId, loadProfile().avatar);
      toast.show(`Permintaan udah terkirim ke @${user.username}.`);
      setResults((current) => current.filter((u) => u.profileId !== user.profileId));
      onSent();
    } catch (err) {
      setError(err instanceof ApiFailure ? err.message : 'Gagal mengirim permintaan.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card stack">
      <h2>Cari teman</h2>
      <input
        className="input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Cari lewat username..."
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {error && <p className="form-error">{error}</p>}
      {visibleResults.length > 0 && (
        <ul className="players">
          {visibleResults.map((user) => (
            <li key={user.profileId} className="player player--wrap">
              <Avatar config={user.avatar ?? FALLBACK_AVATAR} size={36} />
              <div className="player__main">
                <div className="player__name">
                  <span className="player__label">{user.displayName}</span>
                </div>
                <div className="player__meta caption">@{user.username}</div>
              </div>
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => add(user)}
                disabled={busyId === user.profileId}
              >
                {busyId === user.profileId ? 'Mengirim...' : 'Tambah'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
