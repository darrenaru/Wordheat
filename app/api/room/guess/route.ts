import { NextResponse } from "next/server";

import { submitRoomGuess } from "@/lib/rooms";

export const runtime = "nodejs";

const STATUS: Record<string, number> = {
  "not-found": 404,
  "unknown-word": 404,
  "not-playing": 409,
  "not-member": 403,
};

export async function POST(request: Request) {
  let body: { code?: string; playerId?: string; word?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  if (
    typeof body.code !== "string" ||
    typeof body.playerId !== "string" ||
    typeof body.word !== "string" ||
    !body.word.trim()
  ) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const result = await submitRoomGuess(body.code, body.playerId, body.word);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: STATUS[result.error] ?? 400 });
  }

  // Papan lengkap sampai ke klien lewat aliran SSE; balasan ini hanya
  // mengabarkan hasil tebakan yang barusan dikirim.
  return NextResponse.json({ ...result.value.result, duplicate: result.value.duplicate });
}
