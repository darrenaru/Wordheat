import { NextResponse } from "next/server";

import { respondToSurrenderVote } from "@/lib/rooms";

export const runtime = "nodejs";

const STATUS: Record<string, number> = {
  "not-found": 404,
  "not-playing": 409,
  "not-member": 403,
  "no-active-vote": 409,
  "already-responded": 409,
};

/** Menjawab ajakan menyerah yang sedang berjalan: terima atau tolak. */
export async function POST(request: Request) {
  let body: { code?: string; playerId?: string; response?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  if (
    typeof body.code !== "string" ||
    typeof body.playerId !== "string" ||
    (body.response !== "accept" && body.response !== "reject")
  ) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const result = respondToSurrenderVote(body.code, body.playerId, body.response);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: STATUS[result.error] ?? 400 });
  }

  return NextResponse.json({ ok: true });
}
