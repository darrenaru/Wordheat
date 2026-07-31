import { useState, useSyncExternalStore } from 'react';
import type { FriendsPayload } from '@shared/types.ts';
import { api, ApiFailure } from '../lib/api.ts';
import { getFriends, refreshFriends, subscribeFriends } from '../lib/friends.ts';
import { loadProfile } from '../lib/profile.ts';
import { CheckIcon, useToast, UserIcon, UserMinusIcon, UserPlusIcon } from './ui.tsx';

const EMPTY: FriendsPayload = { friends: [], incoming: [], outgoing: [], invites: [], unreadMessages: 0 };

interface AddFriendButtonProps {
  profileId: string;
  /** `full` (label teks, dipakai `PlayerProfileModal`) atau `icon` (cuma
   *  ikon bulat, dipakai pojok kanan-atas header `ViewProfileModal`). */
  variant?: 'full' | 'icon';
}

/**
 * Tombol "Tambah Teman" sadar-status, dipakai di kartu profil pemain lain
 * (`ViewProfileModal`, `PlayerProfileModal`) — bacaannya dari store global
 * `friends.ts` yang sama dipakai badge "Teman" di header, jadi tidak ada
 * fetch tambahan. Logiknya digeneralisasi dari `AddFriendCard` di
 * `FriendListScreen.tsx`, bukan dibuat ulang dari nol.
 */
export function AddFriendButton({ profileId, variant = 'full' }: AddFriendButtonProps) {
  const payload = useSyncExternalStore(subscribeFriends, getFriends, () => EMPTY);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (profileId === loadProfile().id) return null;

  const isFriend = payload.friends.some((f) => f.user.profileId === profileId);
  const outgoing = payload.outgoing.find((r) => r.user.profileId === profileId);
  const incoming = payload.incoming.find((r) => r.user.profileId === profileId);
  const icon = variant === 'icon';

  if (isFriend) {
    if (icon) {
      return (
        <span
          className="btn btn--ghost btn--icon"
          style={{ cursor: 'default' }}
          title="Sudah berteman"
          aria-label="Sudah berteman"
        >
          <UserIcon />
        </span>
      );
    }
    return (
      <span className="badge badge--plain">
        <UserIcon />
        Sudah berteman
      </span>
    );
  }

  if (outgoing) {
    const cancel = async () => {
      setBusy(true);
      try {
        await api.removeFriendship(outgoing.id);
        toast.show('Permintaan pertemanan dibatalkan.');
        refreshFriends();
      } catch {
        toast.show('Gagal membatalkan permintaan.', 'error');
      } finally {
        setBusy(false);
      }
    };
    return (
      <button
        className={`btn btn--ghost ${icon ? 'btn--icon' : 'btn--sm'}`}
        onClick={cancel}
        disabled={busy}
        title="Batalkan permintaan"
        aria-label="Batalkan permintaan"
      >
        <UserMinusIcon />
        {!icon && (busy ? 'Membatalkan...' : 'Batalkan Permintaan')}
      </button>
    );
  }

  if (incoming) {
    const accept = async () => {
      setBusy(true);
      try {
        await api.respondFriendRequest(incoming.id, true);
        toast.show('Permintaan pertemanan diterima.');
        refreshFriends();
      } catch {
        toast.show('Gagal menerima permintaan.', 'error');
      } finally {
        setBusy(false);
      }
    };
    return (
      <button
        className={`btn btn--primary ${icon ? 'btn--icon' : 'btn--sm'}`}
        onClick={accept}
        disabled={busy}
        title="Terima Permintaan"
        aria-label="Terima Permintaan"
      >
        <CheckIcon />
        {!icon && (busy ? 'Menerima...' : 'Terima Permintaan')}
      </button>
    );
  }

  const send = async () => {
    setBusy(true);
    try {
      await api.sendFriendRequest(profileId);
      toast.show('Permintaan pertemanan terkirim.');
      refreshFriends();
    } catch (err) {
      toast.show(err instanceof ApiFailure ? err.message : 'Gagal mengirim permintaan.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className={`btn btn--secondary ${icon ? 'btn--icon' : 'btn--sm'}`}
      onClick={send}
      disabled={busy}
      title="Tambah Teman"
      aria-label="Tambah Teman"
    >
      <UserPlusIcon />
      {!icon && (busy ? 'Mengirim...' : 'Tambah Teman')}
    </button>
  );
}
