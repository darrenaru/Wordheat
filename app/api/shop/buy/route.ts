import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/accounts";
import { isPowerUpKind } from "@/lib/powerup-catalog";
import { buyPowerUp } from "@/lib/powerups";
import { notifyAccount } from "@/lib/presence";

export const runtime = "nodejs";

const STATUS: Record<string, number> = {
  "insufficient-funds": 402,
};

/** Membeli satu Power-Up: coin -> stok. */
export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { kind?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  if (!isPowerUpKind(body.kind)) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const result = buyPowerUp(account.id, body.kind);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: STATUS[result.error] ?? 400 });
  }

  notifyAccount(account.id);
  return NextResponse.json({ ok: true, balance: result.balance, inventory: result.inventory });
}
