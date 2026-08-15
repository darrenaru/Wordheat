import { NextResponse } from "next/server";

import { currentAccount, searchAccounts } from "@/lib/accounts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "no-session" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ results: searchAccounts(q, account.id) });
}
