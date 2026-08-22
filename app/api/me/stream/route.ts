import {
  accountHasGoogle,
  currentAccount,
  findAccountById,
  friendState,
  quickAddLinkToken,
  toPublicProfile,
} from "@/lib/accounts";
import { coinBalance } from "@/lib/coins";
import { unreadCounts } from "@/lib/messages";
import { inventoryOf } from "@/lib/powerups";
import {
  getAccountStatus,
  listInvites,
  markAccountConnected,
  markAccountDisconnected,
  subscribeToAccount,
} from "@/lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Perantara suka memutus koneksi yang diam; komentar berkala menahannya tetap hidup. */
const KEEPALIVE_MS = 25_000;
/**
 * Penyegaran penuh berkala, terpisah dari komentar `: ping` di atas --
 * itu murni penahan proxy dan tidak membawa data baru. Ini yang membuat
 * status idle teman mengoreksi diri sendiri seiring waktu tanpa perlu
 * penjadwal/fan-out proaktif untuk arah "jadi idle".
 */
const PRESENCE_REFRESH_MS = 60_000;

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
        const { friends, incoming, outgoing } = friendState(accountId);
        const withStatus = <T extends { id: string }>(profile: T) => ({
          ...profile,
          status: getAccountStatus(profile.id),
        });
        const payload = {
          account: toPublicProfile(fresh),
          hasGoogle: accountHasGoogle(accountId),
          quickAddToken: quickAddLinkToken(accountId),
          coins: coinBalance(accountId),
          powerUps: inventoryOf(accountId),
          status: getAccountStatus(accountId),
          friends: friends.map(withStatus),
          incoming: incoming.map((r) => ({ ...r, profile: withStatus(r.profile) })),
          outgoing: outgoing.map((r) => ({ ...r, profile: withStatus(r.profile) })),
          invites: listInvites(accountId),
          unreadMessages: unreadCounts(accountId),
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      markAccountConnected(accountId);
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
        markAccountDisconnected(accountId);
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
