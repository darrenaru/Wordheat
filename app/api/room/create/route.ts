import { NextResponse } from "next/server";

import { currentAccount, toPublicProfile } from "@/lib/accounts";
import { createRoom, publicView } from "@/lib/rooms";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { name?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Nama boleh kosong; server yang memberi nama cadangan.
  }

  const account = await currentAccount();
  const { room, playerId } = await createRoom({
    name: body.name,
    account: account ? toPublicProfile(account) : undefined,
  });
  return NextResponse.json({ playerId, room: await publicView(room) });
}
