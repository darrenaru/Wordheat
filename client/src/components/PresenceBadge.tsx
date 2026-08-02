import { useSyncExternalStore } from 'react';
import type { Presence } from '@shared/types.ts';
import { formatLastSeen } from '../lib/relativeTime.ts';
import { getLivePresence, subscribePresence } from '../lib/presence.ts';

interface PresenceBadgeProps {
  profileId: string;
  /** Presence yang datang menumpang di fetch awal (`GET /friends`/`GET
   *  /players/:id`) — dipakai selama belum ada dorongan `presence-update`
   *  yang lebih baru untuk profil ini (lihat `lib/presence.ts`). */
  initialPresence: Presence;
}

const LABEL: Record<Presence['status'], string> = {
  online: 'Online',
  playing: 'Sedang bermain',
  offline: 'Offline',
};

/** Titik warna + label status kehadiran — dipakai di Daftar Teman, modal
 *  Chat, dan profil publik. Selalu baca nilai LIVE lewat store
 *  `lib/presence.ts` (di-patch real-time oleh `App.tsx`), jatuh balik ke
 *  `initialPresence` dari fetch sampai dorongan pertama tiba. */
export function PresenceBadge({ profileId, initialPresence }: PresenceBadgeProps) {
  const presence = useSyncExternalStore(
    subscribePresence,
    () => getLivePresence(profileId) ?? initialPresence,
    () => initialPresence,
  );

  const label =
    presence.status === 'offline' && presence.lastSeenAt !== null
      ? `Terakhir online ${formatLastSeen(presence.lastSeenAt)}`
      : LABEL[presence.status];

  return (
    <span className="presence">
      <span className={`presence__dot presence__dot--${presence.status}`} aria-hidden="true" />
      <span className="caption">{label}</span>
    </span>
  );
}
