import { NextResponse } from "next/server";

import { sendRoomChat } from "@/lib/rooms";

export const runtime = "nodejs";

const STATUS: Record<string, number> = {
  "not-found": 404,
  "not-member": 403,
  empty: 400,
  "too-long": 400,
};

export async function POST(request: Request) {
  let body: { code?: string; playerId?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  if (
    typeof body.code !== "string" ||
    typeof body.playerId !== "string" ||
    typeof body.text !== "string"
  ) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const result = sendRoomChat(body.code, body.playerId, body.text);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: STATUS[result.error] ?? 400 });
  }

  // Pesannya sendiri sampai ke semua anggota room lewat aliran SSE; balasan
  // ini hanya mengabarkan pengirim bahwa kirimannya berhasil.
  return NextResponse.json({ ok: true });
}
