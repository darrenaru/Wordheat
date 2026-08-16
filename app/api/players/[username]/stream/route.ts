import { findAccountByUsername } from "@/lib/accounts";
import { getAccountStatus, subscribeToAccount } from "@/lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Perantara suka memutus koneksi yang diam; komentar berkala menahannya tetap hidup. */
const KEEPALIVE_MS = 25_000;
/** Supaya transisi "jadi idle" (murni berbasis waktu, tidak ada event untuk
 *  itu) ikut mengoreksi diri sendiri tanpa perlu penjadwal/fan-out proaktif. */
const PRESENCE_REFRESH_MS = 60_000;

/**
 * Status keaktifan satu pemain, hidup lewat SSE.
 *
 * Terpisah dari GET /api/players/[username] (yang hanya cuplikan sekali muat
 * berisi statistik game) supaya statistik yang jarang berubah tidak perlu
 * ikut ditarik ulang tiap kali status berubah. Halaman profil sudah publik
 * hari ini -- tanpa login pun statistiknya terlihat -- jadi stream ini juga
 * tidak memeriksa pertemanan, konsisten dengan itu.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const account = findAccountByUsername(username);
  if (!account) return new Response("pemain tidak ditemukan", { status: 404 });

  const accountId = account.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const push = () => {
        if (closed) return;
        const payload = { status: getAccountStatus(accountId) };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      push();

      const unsubscribe = subscribeToAccount(accountId, push);
      const keepalive = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": ping\n\n"));
      }, KEEPALIVE_MS);
      const presenceRefresh = setInterval(() => {
        if (!closed) push();
      }, PRESENCE_REFRESH_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepalive);
        clearInterval(presenceRefresh);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Aliran sudah tertutup dari sisi lain.
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
