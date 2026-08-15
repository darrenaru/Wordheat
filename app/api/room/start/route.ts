import { NextResponse } from "next/server";

import { publicView, startRoom } from "@/lib/rooms";

export const runtime = "nodejs";

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

  const result = startRoom(body.code, body.playerId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "not-found" ? 404 : 403 },
    );
  }

  return NextResponse.json({ room: await publicView(result.value.room) });
}
