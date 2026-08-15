import { NextResponse } from "next/server";

import { areFriends, currentAccount } from "@/lib/accounts";
import { listConversation, markConversationRead, sendMessage } from "@/lib/messages";

export const runtime = "nodejs";

const MESSAGES: Record<string, string> = {
  "not-friends": "Kalian belum berteman.",
  empty: "Pesan tidak boleh kosong.",
  "too-long": "Pesan kepanjangan.",
};

export async function GET(request: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "no-session" }, { status: 401 });

  const friendId = new URL(request.url).searchParams.get("friendId") ?? "";
  if (!friendId || !areFriends(account.id, friendId)) {
    return NextResponse.json({ error: "not-friends" }, { status: 403 });
  }

  // Membuka obrolan berarti membacanya.
  markConversationRead(account.id, friendId);
  return NextResponse.json({ messages: listConversation(account.id, friendId) });
}

export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "no-session" }, { status: 401 });

  let body: { friendId?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (typeof body.friendId !== "string" || typeof body.text !== "string") {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const result = sendMessage(account.id, body.friendId, body.text);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: MESSAGES[result.error] },
      { status: result.error === "not-friends" ? 403 : 400 },
    );
  }
  return NextResponse.json({ message: result.message });
}
