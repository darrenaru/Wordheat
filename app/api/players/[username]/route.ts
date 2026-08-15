import { NextResponse } from "next/server";

import { playerStats, recentGames } from "@/lib/leaderboard";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const stats = playerStats(username);
  if (!stats) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const games = stats.gamesPlayed > 0 ? recentGames(stats.profile.id) : [];
  return NextResponse.json({ stats, games });
}
