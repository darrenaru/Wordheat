import { currentAccount, findAccountById, friendState, toPublicProfile } from "@/lib/accounts";
import { unreadCounts } from "@/lib/messages";
import { listInvites, subscribeToAccount } from "@/lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Perantara suka memutus koneksi yang diam; komentar berkala menahannya tetap hidup. */
const KEEPALIVE_MS = 25_000;

/**
 * Saluran pribadi pemain.
 *
 * Permintaan pertemanan dan undangan room harus sampai ke layar tanpa pemain
 * perlu menyegarkan halaman, termasuk saat mereka sedang berada di tengah
 * permainan.
 */
export async function GET(request: Request) {
  const account = await currentAccount();
  if (!account) return new Response("belum punya profil", { status: 401 });

  const accountId = account.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const push = () => {
        if (closed) return;
        // Dibaca ulang dari basis data tiap kali, bukan memakai `account`
        // yang ditangkap sekali saat koneksi dibuka -- kalau tidak, setiap
        // notifyAccount() (mis. setelah menyimpan profil) akan mengirim
        // balik cuplikan lama dan seolah membatalkan perubahan yang baru
        // saja tersimpan.
        const fresh = findAccountById(accountId);
        if (!fresh) return;
        const payload = {
          account: toPublicProfile(fresh),
          ...friendState(accountId),
          invites: listInvites(accountId),
          unreadMessages: unreadCounts(accountId),
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      push();

      const unsubscribe = subscribeToAccount(accountId, push);
      const keepalive = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": ping\n\n"));
      }, KEEPALIVE_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepalive);
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
