import { NextResponse } from "next/server";

import { startSurrenderVote } from "@/lib/rooms";

export const runtime = "nodejs";

const STATUS: Record<string, number> = {
  "not-found": 404,
  "not-playing": 409,
  "not-member": 403,
  "already-active": 409,
};

/** Mengajukan menyerah: membuka ajakan baru untuk seluruh pemain di room. */
export async function POST(request: Request) {
  let body: { code?: string; playerId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  if (typeof body.code !== "string" || typeof body.playerId !== "string") {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const result = startSurrenderVote(body.code, body.playerId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: STATUS[result.error] ?? 400 });
  }

  // Papan lengkap (termasuk ajakan yang baru dibuka) sampai lewat aliran SSE room.
  return NextResponse.json({ ok: true });
}
