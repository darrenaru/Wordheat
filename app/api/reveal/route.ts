import { NextResponse } from "next/server";

import { getPuzzleById } from "@/lib/puzzles";

/** Membuka jawaban ketika pemain memilih menyerah. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const { puzzleId } = (body ?? {}) as { puzzleId?: number };
  if (typeof puzzleId !== "number") {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle) {
    return NextResponse.json({ error: "unknown-puzzle" }, { status: 404 });
  }

  return NextResponse.json({ word: puzzle.word, neighbours: puzzle.neighbours });
}
