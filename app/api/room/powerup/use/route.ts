import { NextResponse } from "next/server";

import { isPowerUpKind } from "@/lib/powerup-catalog";
import { useRoomPowerUp } from "@/lib/rooms";
import { notifyAccount } from "@/lib/presence";

export const runtime = "nodejs";

const STATUS: Record<string, number> = {
  "not-found": 404,
  "not-playing": 409,
  "not-member": 403,
  "insufficient-stock": 402,
  "no-candidates": 409,
};

/** Pakai Power-Up selama pertandingan room. Keadaan lengkap sampai lewat aliran SSE room. */
export async function POST(request: Request) {
  let body: { code?: string; playerId?: string; kind?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  if (
    typeof body.code !== "string" ||
    typeof body.playerId !== "string" ||
    !isPowerUpKind(body.kind)
  ) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const result = await useRoomPowerUp(body.code, body.playerId, body.kind);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: STATUS[result.error] ?? 400 });
  }

  const accountId = result.value.room.players.get(body.playerId)?.accountId;
  if (accountId) notifyAccount(accountId);

  return NextResponse.json({ ok: true });
}
