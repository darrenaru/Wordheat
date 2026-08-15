import { NextResponse } from "next/server";

import {
  acceptFriendRequest,
  currentAccount,
  dropFriendRequest,
  findAccountById,
  friendState,
  removeFriend,
  sendFriendRequest,
  toPublicProfile,
} from "@/lib/accounts";
import { notifyAccount } from "@/lib/presence";

export const runtime = "nodejs";

const MESSAGES: Record<string, string> = {
  "not-found": "Tidak ada pemain dengan username itu.",
  self: "Itu username kamu sendiri.",
  "already-friends": "Kalian sudah berteman.",
  "already-sent": "Permintaan ke pemain itu sudah dikirim.",
};

export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "no-session" }, { status: 401 });
  return NextResponse.json(friendState(account.id));
}

/**
 * Satu titik masuk untuk semua tindakan pertemanan. Tiap tindakan menyentuh
 * dua pihak, jadi keduanya selalu diberi tahu agar layarnya sama-sama berubah.
 */
export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "no-session" }, { status: 401 });

  let body: { action?: string; username?: string; requestId?: string; friendId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  switch (body.action) {
    case "request": {
      if (typeof body.username !== "string" || !body.username.trim()) {
        return NextResponse.json({ error: "bad-request" }, { status: 400 });
      }
      const result = sendFriendRequest(account.id, body.username);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, message: MESSAGES[result.error] },
          { status: result.error === "not-found" ? 404 : 409 },
        );
      }
      notifyAccount(account.id);
      notifyAccount(result.to.id);
      return NextResponse.json({
        ...friendState(account.id),
        to: toPublicProfile(result.to),
        autoAccepted: result.autoAccepted,
      });
    }

    case "accept": {
      if (typeof body.requestId !== "string") {
        return NextResponse.json({ error: "bad-request" }, { status: 400 });
      }
      const result = acceptFriendRequest(account.id, body.requestId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
      notifyAccount(account.id);
      notifyAccount(result.friendId);
      return NextResponse.json(friendState(account.id));
    }

    case "decline": {
      if (typeof body.requestId !== "string") {
        return NextResponse.json({ error: "bad-request" }, { status: 400 });
      }
      const result = dropFriendRequest(account.id, body.requestId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
      notifyAccount(account.id);
      notifyAccount(result.otherId);
      return NextResponse.json(friendState(account.id));
    }

    case "remove": {
      if (typeof body.friendId !== "string") {
        return NextResponse.json({ error: "bad-request" }, { status: 400 });
      }
      const existed = removeFriend(account.id, body.friendId);
      if (!existed) return NextResponse.json({ error: "not-found" }, { status: 404 });
      notifyAccount(account.id);
      if (findAccountById(body.friendId)) notifyAccount(body.friendId);
      return NextResponse.json(friendState(account.id));
    }

    default:
      return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
}
