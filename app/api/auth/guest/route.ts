import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createGuestAccount, createSession, sessionCookieOptions, toPublicProfile } from "@/lib/accounts";

export const runtime = "nodejs";

/** Membuat akun tamu otomatis -- tanpa input apa pun dari klien. */
export async function POST() {
  const result = createGuestAccount();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: "Gagal membuat akun tamu. Coba lagi." },
      { status: 500 },
    );
  }

  const jar = await cookies();
  jar.set({ ...sessionCookieOptions(), value: createSession(result.account.id) });

  return NextResponse.json({
    account: toPublicProfile(result.account),
    recoveryCode: result.recoveryCode,
  });
}
