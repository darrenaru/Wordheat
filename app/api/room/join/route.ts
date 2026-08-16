import { NextResponse } from "next/server";

import { currentAccount, toPublicProfile } from "@/lib/accounts";
import { withPlayerPresence } from "@/lib/presence";
import { joinRoom, publicView } from "@/lib/rooms";

export const runtime = "nodejs";

const MESSAGES: Record<string, string> = {
  "not-found": "Kode room tidak ditemukan.",
  "already-started": "Permainan di room itu sudah dimulai.",
  full: "Room itu sudah penuh.",
};

export async function POST(request: Request) {
  let body: { code?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  if (typeof body.code !== "string" || !body.code.trim()) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const account = await currentAccount();
  const result = await joinRoom(body.code, {
    name: body.name,
    account: account ? toPublicProfile(account) : undefined,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: MESSAGES[result.error] },
      { status: result.error === "not-found" ? 404 : 409 },
    );
  }

  return NextResponse.json({
    playerId: result.value.playerId,
    room: withPlayerPresence(await publicView(result.value.room)),
  });
}
