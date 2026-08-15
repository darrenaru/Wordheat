import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  SESSION_COOKIE,
  createAccount,
  createSession,
  currentAccount,
  destroySession,
  findAccountByRecoveryCode,
  sessionCookieOptions,
  toPublicProfile,
} from "@/lib/accounts";

export const runtime = "nodejs";

const MESSAGES: Record<string, string> = {
  "bad-username": "Username hanya boleh huruf kecil, angka, dan garis bawah, 3–16 karakter.",
  "username-taken": "Username itu sudah dipakai. Coba yang lain.",
  "bad-code": "Kode pemulihan itu tidak dikenali.",
};

/** Profil pemilik permintaan ini, atau null kalau belum punya. */
export async function GET() {
  const account = await currentAccount();
  return NextResponse.json({ account: account ? toPublicProfile(account) : null });
}

/**
 * Membuat profil baru, atau masuk kembali dengan kode pemulihan.
 *
 * Keduanya berakhir sama: satu sesi baru dipasang sebagai cookie HttpOnly,
 * sehingga token-nya tidak bisa dibaca skrip di halaman.
 */
export async function POST(request: Request) {
  let body: {
    action?: "signup" | "signin";
    username?: string;
    displayName?: string;
    avatarSeed?: string;
    avatarBg?: string;
    avatarChoices?: unknown;
    recoveryCode?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const jar = await cookies();

  if (body.action === "signin") {
    if (typeof body.recoveryCode !== "string" || !body.recoveryCode.trim()) {
      return NextResponse.json({ error: "bad-request" }, { status: 400 });
    }
    const account = findAccountByRecoveryCode(body.recoveryCode);
    if (!account) {
      return NextResponse.json(
        { error: "bad-code", message: MESSAGES["bad-code"] },
        { status: 404 },
      );
    }
    jar.set({ ...sessionCookieOptions(), value: createSession(account.id) });
    return NextResponse.json({ account: toPublicProfile(account) });
  }

  if (typeof body.username !== "string") {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const result = createAccount({
    username: body.username,
    displayName: body.displayName,
    avatarSeed: body.avatarSeed,
    avatarBg: body.avatarBg,
    avatarChoices: body.avatarChoices,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: MESSAGES[result.error] },
      { status: 409 },
    );
  }

  jar.set({ ...sessionCookieOptions(), value: createSession(result.account.id) });

  // Kode pemulihan hanya dikirim sekali ini. Yang tersimpan di server cuma
  // sidik jarinya, jadi kode aslinya memang tidak bisa ditampilkan lagi nanti.
  return NextResponse.json({
    account: toPublicProfile(result.account),
    recoveryCode: result.recoveryCode,
  });
}

/** Keluar: sesi dihapus di server, bukan sekadar cookie-nya dibuang. */
export async function DELETE() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) destroySession(token);
  jar.set({ ...sessionCookieOptions(0), value: "" });
  return NextResponse.json({ ok: true });
}
