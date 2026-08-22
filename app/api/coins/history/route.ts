import { NextResponse } from "next/server";

import { currentAccount } from "@/lib/accounts";
import { coinHistory } from "@/lib/coins";

export const runtime = "nodejs";

/** Riwayat perolehan/belanja Coin milik akun yang sedang masuk. */
export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json({ history: coinHistory(account.id) });
}
