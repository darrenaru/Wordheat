/** Bentuk data profil yang dipakai bersama server dan browser. */

import type { AvatarChoices } from "@/lib/avatar";

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarSeed: string;
  avatarBg: string;
  /** Pilihan rinci avatar. Bidang kosong berarti ikut benih. */
  avatarChoices: AvatarChoices;
};

export type FriendRequestView = {
  id: string;
  createdAt: number;
  profile: PublicProfile;
};

export type Invite = {
  id: string;
  code: string;
  from: PublicProfile;
  at: number;
};

export type MeState = {
  account: PublicProfile;
  friends: PublicProfile[];
  incoming: FriendRequestView[];
  outgoing: FriendRequestView[];
  invites: Invite[];
  /** Jumlah pesan belum dibaca per teman, kunci berupa id akun teman. */
  unreadMessages: Record<string, number>;
};
