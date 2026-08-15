import {
  getRoom,
  markConnected,
  markDisconnected,
  publicView,
  subscribe,
} from "@/lib/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Perantara suka memutus koneksi yang diam; komentar berkala menahannya tetap hidup. */
const KEEPALIVE_MS = 25_000;

/**
 * Aliran keadaan room.
 *
 * Koneksi ini sekaligus jadi penanda kehadiran: selama alirannya terbuka,
 * pemainnya dianggap ada di room.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const playerId = url.searchParams.get("playerId") ?? "";

  const room = getRoom(code);
  if (!room) {
    return new Response("room tidak ditemukan", { status: 404 });
  }
  if (!room.players.has(playerId)) {
    return new Response("bukan anggota room", { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const push = async () => {
        if (closed) return;
        const current = getRoom(code);
        if (!current) {
          controller.enqueue(encoder.encode("event: gone\ndata: {}\n\n"));
          return;
        }
        const view = await publicView(current);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(view)}\n\n`));
      };

      markConnected(code, playerId);
      await push();

      const unsubscribe = subscribe(code, () => void push());
      const keepalive = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": ping\n\n"));
      }, KEEPALIVE_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepalive);
        unsubscribe?.();
        markDisconnected(code, playerId);
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
      // Mematikan penyanggaan di proxy seperti nginx, yang kalau tidak akan
      // menahan pesan sampai penyangga penuh dan membuat aliran terasa macet.
      "X-Accel-Buffering": "no",
    },
  });
}
