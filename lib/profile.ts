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

export type Invite = {
  id: string;
  code: string;
  from: PublicProfile;
  at: number;
};

/**
 * Status keaktifan seorang akun. "in-game" hanya berlaku saat pemain benar-
 * benar di tengah pertandingan aktif (bukan sekadar duduk di ruang tunggu),
 * dan menang atas status koneksi -- lihat lib/presence.ts `getAccountStatus`.
 */
export type AccountStatus = "online" | "idle" | "in-game" | "offline";

export type FriendPresence = PublicProfile & { status: AccountStatus };

export type FriendRequestView = {
  id: string;
  createdAt: number;
  profile: FriendPresence;
};

export type MeState = {
  account: PublicProfile;
  status: AccountStatus;
  friends: FriendPresence[];
  incoming: FriendRequestView[];
  outgoing: FriendRequestView[];
  invites: Invite[];
  /** Jumlah pesan belum dibaca per teman, kunci berupa id akun teman. */
  unreadMessages: Record<string, number>;
};
