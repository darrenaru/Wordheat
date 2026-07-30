import { randomUUID } from 'node:crypto';
import type { AvatarConfig, RoomInviteSummary } from '@shared/types.ts';

/**
 * Kotak masuk undangan room, in-memory — pola sama seperti `rooms` di
 * `rooms.ts` (`Map` + sapuan berkala). Room cuma hidup di memori server dan
 * tidak ada saluran push real-time di aplikasi ini, jadi undangan sekadar
 * "menunggu" sampai pemain yang dituju membuka halaman Friend List.
 */
interface StoredInvite {
  id: string;
  roomCode: string;
  fromProfileId: string;
  fromDisplayName: string;
  fromAvatar: AvatarConfig | null;
  createdAt: number;
}

const INVITE_TTL_MS = 10 * 60_000;
const MAX_INVITES_PER_PLAYER = 20;

const inbox = new Map<string, StoredInvite[]>();

export function sendInvite(
  toProfileId: string,
  invite: {
    roomCode: string;
    fromProfileId: string;
    fromDisplayName: string;
    fromAvatar: AvatarConfig | null;
  },
): void {
  const list = inbox.get(toProfileId) ?? [];
  list.unshift({ id: randomUUID(), createdAt: Date.now(), ...invite });
  inbox.set(toProfileId, list.slice(0, MAX_INVITES_PER_PLAYER));
}

export function listInvites(profileId: string): RoomInviteSummary[] {
  const now = Date.now();
  const fresh = (inbox.get(profileId) ?? []).filter((invite) => now - invite.createdAt < INVITE_TTL_MS);
  inbox.set(profileId, fresh);
  return fresh.map(toSummary);
}

export function dismissInvite(profileId: string, inviteId: string): void {
  const list = inbox.get(profileId);
  if (!list) return;
  inbox.set(
    profileId,
    list.filter((invite) => invite.id !== inviteId),
  );
}

function toSummary(invite: StoredInvite): RoomInviteSummary {
  return {
    id: invite.id,
    roomCode: invite.roomCode,
    from: {
      profileId: invite.fromProfileId,
      username: '',
      displayName: invite.fromDisplayName,
      avatar: invite.fromAvatar,
    },
    createdAt: invite.createdAt,
  };
}

export function sweepInvites(now = Date.now()): void {
  for (const [profileId, list] of inbox) {
    const kept = list.filter((invite) => now - invite.createdAt < INVITE_TTL_MS);
    if (kept.length === 0) inbox.delete(profileId);
    else if (kept.length !== list.length) inbox.set(profileId, kept);
  }
}
