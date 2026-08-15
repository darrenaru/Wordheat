import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { OAuth2Client } from "google-auth-library";

import {
  createSession,
  findOrCreateGoogleAccount,
  sessionCookieOptions,
  toPublicProfile,
} from "@/lib/accounts";

export const runtime = "nodejs";

const client = new OAuth2Client();

const MESSAGES: Record<string, string> = {
  "bad-token": "Masuk dengan Google gagal. Coba lagi.",
  "bad-request": "Masuk dengan Google gagal. Coba lagi.",
};

/** Menukar ID-token dari tombol "Sign In With Google" dengan sesi kita sendiri. */
export async function POST(request: Request) {
  let body: { credential?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (typeof body.credential !== "string" || !body.credential) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  let claims: { sub: string; email?: string; name?: string };
  try {
    const ticket = await client.verifyIdToken({
      idToken: body.credential,
      audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new Error("no-sub");
    claims = { sub: payload.sub, email: payload.email, name: payload.name };
  } catch {
    return NextResponse.json(
      { error: "bad-token", message: MESSAGES["bad-token"] },
      { status: 401 },
    );
  }

  const result = findOrCreateGoogleAccount(claims);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: MESSAGES[result.error] },
      { status: 500 },
    );
  }

  const jar = await cookies();
  jar.set({ ...sessionCookieOptions(), value: createSession(result.account.id) });

  return NextResponse.json({
    account: toPublicProfile(result.account),
    ...(result.recoveryCode ? { recoveryCode: result.recoveryCode } : {}),
  });
}
