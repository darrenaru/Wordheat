import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/accounts";
import { touchActivity } from "@/lib/presence";

export const runtime = "nodejs";

/**
 * Detak aktivitas nyata (mouse/keyboard) dari klien, dikirim berjeda lewat
 * AccountProvider. Ini yang membedakan "online" dari "idle" -- koneksi SSE
 * /api/me/stream saja cuma menandakan aplikasinya terbuka, bukan sedang
 * dipakai.
 */
export async function POST() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "no-session" }, { status: 401 });

  touchActivity(account.id);
  return NextResponse.json({ ok: true });
}
