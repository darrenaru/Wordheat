import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/accounts";
import { isPowerUpKind } from "@/lib/powerup-catalog";
import { useSoloClosestGuess, useSoloRevealPowerUp } from "@/lib/powerups";
import { notifyAccount } from "@/lib/presence";

export const runtime = "nodejs";

const STATUS: Record<string, number> = {
  "insufficient-stock": 402,
  "no-candidates": 409,
  "bad-kind": 400,
};

/**
 * Pakai satu Power-Up di mode solo. Untuk reveal_initial/reveal_digits,
 * dipanggil ulang pada puzzle yang sudah pernah dipakai bersifat idempoten
 * -- mengembalikan hasil yang tersimpan tanpa memotong stok lagi (lihat
 * lib/powerups.ts useSoloRevealPowerUp).
 */
export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { puzzleId?: number; kind?: string; guessed?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  if (typeof body.puzzleId !== "number" || !isPowerUpKind(body.kind)) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  if (body.kind === "closest_guess") {
    const result = await useSoloClosestGuess(
      account.id,
      body.puzzleId,
      Array.isArray(body.guessed) ? body.guessed : [],
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: STATUS[result.error] ?? 400 });
    }
    notifyAccount(account.id);
    return NextResponse.json({ ok: true, ...result.result, inventory: result.inventory });
  }

  const result = await useSoloRevealPowerUp(account.id, body.puzzleId, body.kind);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: STATUS[result.error] ?? 400 });
  }
  if (!result.alreadyUsed) notifyAccount(account.id);
  return NextResponse.json({ ok: true, result: result.result, alreadyUsed: result.alreadyUsed });
}
