import "server-only";

import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client();

export type GoogleClaims = { sub: string; email?: string; name?: string };

/** Menukar ID-token dari tombol "Sign In With Google" dengan klaim identitasnya, atau null kalau tidak valid. */
export async function verifyGoogleCredential(credential: string): Promise<GoogleClaims | null> {
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) return null;
    return { sub: payload.sub, email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}
