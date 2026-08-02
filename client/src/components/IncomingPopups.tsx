import { useEffect } from 'react';
import type { FriendRequestSummary, RoomInviteSummary } from '@shared/types.ts';
import { api } from '../lib/api.ts';
import { refreshFriends } from '../lib/friends.ts';
import { navigate } from '../lib/router.ts';
import { Avatar } from './Avatar.tsx';
import { CheckIcon, CloseIcon, PlayIcon, UserPlusIcon } from './ui.tsx';

const FALLBACK_AVATAR = { seed: 'pemain', backgroundColor: '2A2A2E' };

/** Berapa lama popup dibiarkan sebelum hilang sendiri kalau tidak
 *  disentuh — permintaan/undangannya sendiri TETAP ada (masih kelihatan
 *  di halaman Teman), ini cuma alert singkatnya yang lewat. */
const AUTO_DISMISS_MS = 12_000;

/** Maksimal popup yang ditumpuk sekaligus — sama seperti `.toasts`
 *  (`ui.tsx`), supaya kalau permintaan datang beruntun tidak memenuhi
 *  layar. */
const MAX_STACK = 3;

interface IncomingPopupsProps {
  requests: FriendRequestSummary[];
  invites: RoomInviteSummary[];
  onDismissRequest(id: string): void;
  onDismissInvite(id: string): void;
}

/**
 * Popup yang muncul dari ATAS layar begitu ada permintaan pertemanan atau
 * undangan room masuk (didorong real-time lewat SSE — lihat listener
 * `friend-request`/`room-invite` di `App.tsx`), supaya pemain bisa
 * langsung menerima/menolak tanpa membuka halaman Teman atau refresh.
 * Selalu dirender di `App.tsx` (bukan terikat ke satu layar) — persis
 * pola `ToastProvider`, tapi non-blocking dan actionable (bukan cuma info).
 *
 * State daftarnya (`requests`/`invites`) dipegang App.tsx, bukan di sini —
 * supaya tetap ada satu sumber kebenaran yang sama dipakai badge topbar
 * (lewat `refreshFriends()` yang tetap dipanggil begitu SSE tiba).
 */
export function IncomingPopups({ requests, invites, onDismissRequest, onDismissInvite }: IncomingPopupsProps) {
  const visibleRequests = requests.slice(-MAX_STACK);
  const visibleInvites = invites.slice(-MAX_STACK);

  return (
    <div className="incoming-popups" aria-live="polite">
      {visibleRequests.map((request) => (
        <FriendRequestPopup key={request.id} request={request} onDismiss={() => onDismissRequest(request.id)} />
      ))}
      {visibleInvites.map((invite) => (
        <RoomInvitePopup key={invite.id} invite={invite} onDismiss={() => onDismissInvite(invite.id)} />
      ))}
    </div>
  );
}

function useAutoDismiss(onDismiss: () => void): void {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function FriendRequestPopup({ request, onDismiss }: { request: FriendRequestSummary; onDismiss(): void }) {
  useAutoDismiss(onDismiss);

  const respond = async (accept: boolean) => {
    onDismiss();
    try {
      await api.respondFriendRequest(request.id, accept);
    } finally {
      refreshFriends();
    }
  };

  return (
    <div className="incoming-popup incoming-popup--request">
      <Avatar config={request.user.avatar ?? FALLBACK_AVATAR} size={40} alt="" />
      <div className="incoming-popup__body">
        <span className="incoming-popup__kicker">
          <UserPlusIcon />
          Permintaan Pertemanan
        </span>
        <p className="incoming-popup__text">
          <strong>{request.user.displayName}</strong> ingin berteman denganmu.
        </p>
        <div className="row" style={{ gap: 14, justifyContent: 'center' }}>
          <button className="btn btn--primary btn--sm" onClick={() => respond(true)}>
            <CheckIcon />
            Terima
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => respond(false)}>
            Tolak
          </button>
        </div>
      </div>
      <button className="incoming-popup__close" onClick={onDismiss} aria-label="Tutup">
        <CloseIcon />
      </button>
    </div>
  );
}

function RoomInvitePopup({ invite, onDismiss }: { invite: RoomInviteSummary; onDismiss(): void }) {
  useAutoDismiss(onDismiss);

  const join = () => {
    onDismiss();
    navigate(`/ruang/${invite.roomCode}`);
    void api.dismissInvite(invite.id).catch(() => {});
  };

  const decline = async () => {
    onDismiss();
    try {
      await api.dismissInvite(invite.id);
    } finally {
      refreshFriends();
    }
  };

  return (
    <div className="incoming-popup incoming-popup--invite">
      <Avatar config={invite.from.avatar ?? FALLBACK_AVATAR} size={40} alt="" />
      <div className="incoming-popup__body">
        <span className="incoming-popup__kicker">
          <PlayIcon />
          Undangan Ruang
        </span>
        <p className="incoming-popup__text">
          <strong>{invite.from.displayName}</strong> mengundangmu ke ruang <strong>{invite.roomCode}</strong>.
        </p>
        <div className="row" style={{ gap: 14, justifyContent: 'center' }}>
          <button className="btn btn--primary btn--sm" onClick={join}>
            Gabung
          </button>
          <button className="btn btn--ghost btn--sm" onClick={decline}>
            Tolak
          </button>
        </div>
      </div>
      <button className="incoming-popup__close" onClick={onDismiss} aria-label="Tutup">
        <CloseIcon />
      </button>
    </div>
  );
}
