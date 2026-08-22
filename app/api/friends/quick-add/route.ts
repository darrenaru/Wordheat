import { NextResponse } from "next/server";

import { currentAccount, friendState, quickAddFriend, toPublicProfile } from "@/lib/accounts";
import { notifyAccount } from "@/lib/presence";

export const runtime = "nodejs";

const MESSAGES: Record<string, string> = {
  "not-found": "Tautan tidak valid, atau sudah tidak berlaku.",
  self: "Ini tautanmu sendiri -- bagikan ke teman, bukan ke diri sendiri.",
};

/** Menjadikan dua akun berteman langsung lewat token tautan "Tambah Cepat". */
export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "no-session" }, { status: 401 });

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (typeof body.token !== "string" || !body.token.trim()) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const result = quickAddFriend(account.id, body.token);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: MESSAGES[result.error] },
      { status: result.error === "not-found" ? 404 : 400 },
    );
  }

  if (!result.alreadyFriends) {
    notifyAccount(account.id);
    notifyAccount(result.friend.id);
  }

  return NextResponse.json({
    ...friendState(account.id),
    friend: toPublicProfile(result.friend),
    alreadyFriends: result.alreadyFriends,
  });
}
