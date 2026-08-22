import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/accounts";
import { soloPowerUpStatus } from "@/lib/powerups";

export const runtime = "nodejs";

/** Power-Up sekali-pakai yang sudah dipakai di puzzle ini, untuk restore setelah muat ulang. */
export async function GET(request: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({});

  const url = new URL(request.url);
  const puzzleId = Number(url.searchParams.get("puzzleId"));
  if (!Number.isFinite(puzzleId)) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  return NextResponse.json(soloPowerUpStatus(account.id, puzzleId));
}
