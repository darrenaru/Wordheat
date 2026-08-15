import { NextResponse } from "next/server";

import { areFriends, currentAccount, findAccountById, toPublicProfile } from "@/lib/accounts";
import { addInvite, dismissInvite } from "@/lib/presence";
import { getRoom } from "@/lib/rooms";

export const runtime = "nodejs";

/** Mengundang seorang teman ke room yang sedang dibuka. */
export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "no-session" }, { status: 401 });

  let body: { friendId?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  if (typeof body.friendId !== "string" || typeof body.code !== "string") {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  // Undangan hanya boleh ke teman: tanpa syarat ini, siapa pun yang tahu id
  // akun bisa mengirim tautan ke orang asing.
  if (!areFriends(account.id, body.friendId)) {
    return NextResponse.json({ error: "not-friends" }, { status: 403 });
  }
  if (!findAccountById(body.friendId)) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const room = getRoom(body.code);
  if (!room) {
    return NextResponse.json({ error: "unknown-room" }, { status: 404 });
  }
  if (room.status !== "lobby") {
    return NextResponse.json({ error: "already-started" }, { status: 409 });
  }

  addInvite(body.friendId, toPublicProfile(account), room.code);
  return NextResponse.json({ ok: true });
}

/** Menutup undangan yang sudah ditindaklanjuti atau tidak diinginkan. */
export async function DELETE(request: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "no-session" }, { status: 401 });

  let body: { inviteId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (typeof body.inviteId !== "string") {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  dismissInvite(account.id, body.inviteId);
  return NextResponse.json({ ok: true });
}
