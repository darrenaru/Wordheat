import { NextResponse } from "next/server";

import {
  currentAccount,
  findAccountByGoogleSub,
  linkGoogleCredential,
} from "@/lib/accounts";
import { verifyGoogleCredential } from "@/lib/google";
import { notifyAccount } from "@/lib/presence";

export const runtime = "nodejs";

/** Menempelkan credential Google ke akun yang sedang login -- bukan mencari-atau-membuat akun baru. */
export async function POST(request: Request) {
  const account = await currentAccount();
  if (!account) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { credential?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (typeof body.credential !== "string" || !body.credential) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const claims = await verifyGoogleCredential(body.credential);
  if (!claims) {
    return NextResponse.json(
      { error: "bad-token", message: "Menghubungkan ke Google gagal. Coba lagi." },
      { status: 401 },
    );
  }

  const existing = findAccountByGoogleSub(claims.sub);
  if (existing && existing.id !== account.id) {
    return NextResponse.json(
      {
        error: "already-linked",
        message: "Akun Google ini sudah terhubung ke akun Wordheat lain.",
      },
      { status: 409 },
    );
  }

  if (!existing) {
    linkGoogleCredential(account.id, claims.sub);
    notifyAccount(account.id);
  }

  return NextResponse.json({ ok: true });
}
