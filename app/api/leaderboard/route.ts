import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/accounts";
import { topPlayers } from "@/lib/leaderboard";

export const runtime = "nodejs";

/** Publik: siapa saja boleh melihat papan peringkat, login atau tidak. */
export async function GET() {
  const account = await currentAccount();
  return NextResponse.json({ entries: topPlayers(), myId: account?.id ?? null });
}
