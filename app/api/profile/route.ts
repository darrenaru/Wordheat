import { NextResponse } from "next/server";

import { currentAccount, listFriends, toPublicProfile, updateProfile } from "@/lib/accounts";
import { notifyAccount } from "@/lib/presence";

export const runtime = "nodejs";

const MESSAGES: Record<string, string> = {
  "bad-username": "Username hanya boleh huruf kecil, angka, dan garis bawah, 3–16 karakter.",
  "username-taken": "Username itu sudah dipakai. Coba yang lain.",
  "bad-avatar": "Warna latar avatar itu tidak dikenali.",
};

export async function PATCH(request: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "no-session" }, { status: 401 });

  let body: {
    username?: string;
    displayName?: string;
    avatarSeed?: string;
    avatarBg?: string;
    avatarChoices?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const result = updateProfile(account.id, body);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: MESSAGES[result.error] },
      { status: 409 },
    );
  }

  // Teman melihat nama dan avatar ini di daftar mereka, jadi layar mereka
  // perlu ikut diperbarui tanpa menunggu muat ulang.
  notifyAccount(account.id);
  for (const friend of listFriends(account.id)) notifyAccount(friend.id);

  return NextResponse.json({ account: toPublicProfile(result.account) });
}
