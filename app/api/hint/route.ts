import { NextResponse } from "next/server";

import { findHint, getPuzzleById, loadManifest } from "@/lib/puzzles";

/** Mengembalikan satu kata yang lebih dekat daripada tebakan terbaik pemain. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const { puzzleId, bestRank, guessed } = (body ?? {}) as {
    puzzleId?: number;
    bestRank?: number;
    guessed?: string[];
  };

  if (typeof puzzleId !== "number" || typeof bestRank !== "number") {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle) {
    return NextResponse.json({ error: "unknown-puzzle" }, { status: 404 });
  }

  const hint = await findHint(puzzleId, bestRank, Array.isArray(guessed) ? guessed : []);
  if (!hint) {
    return NextResponse.json({ error: "no-hint" }, { status: 404 });
  }

  const { vocabSize } = await loadManifest();
  return NextResponse.json({ ...hint, vocabSize });
}
