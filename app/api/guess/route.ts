import { NextResponse } from "next/server";

import { getPuzzleById, loadManifest, rankGuess } from "@/lib/puzzles";

/**
 * Menilai satu tebakan.
 *
 * Penilaian sengaja dilakukan di server: mengirim tabel peringkat ke browser
 * sama saja dengan mengirimkan jawabannya.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const { puzzleId, word } = (body ?? {}) as { puzzleId?: number; word?: string };

  if (typeof puzzleId !== "number" || typeof word !== "string" || !word.trim()) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle) {
    return NextResponse.json({ error: "unknown-puzzle" }, { status: 404 });
  }

  const result = await rankGuess(puzzleId, word);
  if (!result) {
    return NextResponse.json({ error: "unknown-word" }, { status: 404 });
  }

  const { vocabSize } = await loadManifest();
  return NextResponse.json({ ...result, vocabSize });
}
