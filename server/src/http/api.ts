import { Router, type Request } from 'express';
import type { AvatarConfig, PowerupInventory } from '@shared/types.ts';
import { POWERUP_COSTS } from '@shared/types.ts';
import { getEngine } from '../semantic/engine.ts';
import { currentPuzzleDate } from '../game/words.ts';
import {
  createSoloSession,
  getSoloSession,
  revealSoloSecret,
  soloHint,
  soloNearestGuessPowerup,
  soloRevealLetter,
  submitSoloGuess,
} from '../game/solo.ts';
import { getRoom, roomCount } from '../game/rooms.ts';
import { dismissInvite, listInvites, sendInvite } from '../game/invites.ts';
import { notifyProfile, registerEventStream, unregisterEventStream } from '../realtime/events.ts';
import { addPowerup, getInventory } from '../powerup/store.ts';
import { countUnreadMessages, listConversation, sendMessage } from '../chat/store.ts';
import {
  areFriends,
  ensureUsername,
  getBio,
  getUsername,
  listFriends,
  removeFriendship,
  respondToFriendRequest,
  searchUsers,
  sendFriendRequest,
  setBio,
  setDisplayProfile,
  setUsername,
} from '../social/store.ts';
import {
  getLeaderboard,
  getPublicProfile,
  getStats,
  linkAccountProfile,
  peekAccountLink,
  verifyToken,
} from '../stats/store.ts';
import { getBalance, spendWallet } from '../wallet/store.ts';

/** Validasi longgar — cukup memastikan bentuknya avatar, bukan sembarang JSON. */
function resolveAvatar(body: unknown): AvatarConfig | undefined {
  const avatar = (body as { avatar?: unknown } | undefined)?.avatar;
  if (
    avatar &&
    typeof avatar === 'object' &&
    typeof (avatar as AvatarConfig).seed === 'string' &&
    typeof (avatar as AvatarConfig).backgroundColor === 'string'
  ) {
    return avatar as AvatarConfig;
  }
  return undefined;
}

/** Token Supabase pemain, kalau ada — dipakai menempelkan akun ke statistik. */
async function resolveUserId(req: Request): Promise<string | null> {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return verifyToken(token);
}

/** Id profil pemain (anonim maupun login) — dipakai untuk statistik & coin. */
function resolveProfileId(req: Request): string | null {
  const id = req.header('x-player-id');
  return typeof id === 'string' && id.length >= 6 ? id : null;
}

/** Nama tampilan pemain solo — dipakai buat mengisi `display_name` di statistik/leaderboard. */
function resolvePlayerName(req: Request): string | undefined {
  const raw = req.header('x-player-name');
  if (typeof raw !== 'string' || !raw) return undefined;
  try {
    return decodeURIComponent(raw).slice(0, 32) || undefined;
  } catch {
    return undefined;
  }
}

export function createApiRouter(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const engine = getEngine();
    res.json({
      ok: true,
      vocabulary: engine.vocabularySize,
      targets: engine.targets.length,
      poolSize: engine.poolSize,
      rooms: roomCount(),
      puzzleDate: currentPuzzleDate(),
    });
  });

  router.post('/solo', (req, res) => {
    const mode = req.body?.mode === 'daily' ? 'daily' : 'practice';
    res.json({ ok: true, state: createSoloSession(mode) });
  });

  router.get('/solo/:id', (req, res) => {
    const state = getSoloSession(req.params.id);
    if (!state) {
      res.status(404).json({ ok: false, code: 'not_found', message: 'Sesi tidak ditemukan.' });
      return;
    }
    res.json({ ok: true, state });
  });

  router.post('/solo/:id/guess', async (req, res) => {
    const word = typeof req.body?.word === 'string' ? req.body.word : '';
    if (!word.trim()) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Tebakan kosong.' });
      return;
    }
    const userId = await resolveUserId(req);
    const profileId = resolveProfileId(req);
    const name = resolvePlayerName(req);
    const result = await submitSoloGuess(req.params.id, word, userId, profileId, name);
    res.status(result.ok ? 200 : 400).json(result);
  });

  router.post('/solo/:id/hint', (req, res) => {
    const result = soloHint(req.params.id);
    res.status('ok' in result && result.ok === false ? 400 : 200).json(
      'word' in result ? { ok: true, word: result.word } : result,
    );
  });

  router.post('/solo/:id/powerup/nearest', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const result = await soloNearestGuessPowerup(req.params.id, profileId);
    res.status(result.ok ? 200 : 400).json(result);
  });

  router.post('/solo/:id/powerup/letter', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const result = await soloRevealLetter(req.params.id, profileId);
    res.status('letter' in result ? 200 : 400).json(
      'letter' in result ? { ok: true, ...result } : result,
    );
  });

  router.post('/solo/:id/reveal', async (req, res) => {
    const userId = await resolveUserId(req);
    const profileId = resolveProfileId(req);
    const name = resolvePlayerName(req);
    const state = revealSoloSecret(req.params.id, userId, profileId, name);
    if (!state) {
      res.status(404).json({ ok: false, code: 'not_found', message: 'Sesi tidak ditemukan.' });
      return;
    }
    res.json({ ok: true, state });
  });

  /** Statistik pribadi pemain (anonim maupun login) — dikaitkan ke `profile.id`, sama seperti coin. */
  router.get('/stats', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const stats = await getStats(profileId);
    res.json({ ok: true, stats });
  });

  /** Empat papan peringkat sekaligus: coin, kemenangan, streak, jumlah tebakan. */
  router.get('/leaderboard', async (_req, res) => {
    const leaderboard = await getLeaderboard();
    res.json({ ok: true, leaderboard });
  });

  /** Profil publik pemain lain — dibuka dari Leaderboard. Tidak butuh login,
   *  sama seperti `/leaderboard` sendiri. */
  router.get('/players/:profileId', async (req, res) => {
    const profile = await getPublicProfile(req.params.profileId);
    if (!profile) {
      res.status(404).json({ ok: false, code: 'not_found', message: 'Profil tidak ditemukan.' });
      return;
    }
    res.json({ ok: true, profile });
  });

  /**
   * Dipanggil sekali tiap kali pemain login. Menautkan profil perangkat ini
   * ke akunnya. Kalau akun itu SUDAH pernah dipakai di perangkat lain DAN
   * device ini masih tamu murni — melanjutkan akan MEMBUANG progres tamu
   * di device ini (lihat komentar `peekAccountLink`/RPC
   * `link_account_profile`), jadi dulu dulu dipeek: kalau ada konflik dan
   * client belum kirim `confirm: true`, balas `{conflict:true, canonical}`
   * TANPA menulis apa pun sama sekali, supaya client bisa menampilkan
   * prompt konfirmasi dulu ke pemain ("Kesalahan Fatal" yang harus
   * dihindari: jangan pernah diam-diam menimpa/membuang progres pemain
   * tanpa persetujuan). Kalau tidak ada konflik, atau client sudah kirim
   * `confirm: true` (pemain sudah menyetujui prompt), lanjut ke
   * `linkAccountProfile` seperti biasa.
   */
  router.post('/account/link', async (req, res) => {
    const userId = await resolveUserId(req);
    if (!userId) {
      res.status(401).json({ ok: false, code: 'unauthorized', message: 'Perlu login.' });
      return;
    }
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const name =
      typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 32) || undefined : undefined;
    const avatar = resolveAvatar(req.body);
    const confirm = req.body?.confirm === true;

    if (!confirm) {
      const conflict = await peekAccountLink(userId, profileId);
      if (conflict) {
        res.json({ ok: true, conflict: true, canonical: conflict });
        return;
      }
    }

    const linked = await linkAccountProfile(userId, profileId, name, avatar);
    res.json({
      ok: true,
      conflict: false,
      profileId: linked.profileId,
      displayName: linked.displayName,
      avatar: linked.avatar,
    });
  });

  /**
   * Username pemain sendiri (kalau sudah pernah diatur) + kapan boleh
   * diganti lagi. `ensureUsername` dipanggil dulu di sini (bukan cuma di
   * `recordGameResult`/`linkAccountProfile`) supaya Guest yang belum
   * pernah main pun langsung punya username acak begitu buka Profil Saya —
   * sebelum ini dia melihat placeholder kosong karena baris
   * `player_stats`-nya belum tercipta sama sekali.
   */
  router.get('/username', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    await ensureUsername(profileId);
    const { username, changeableAt } = await getUsername(profileId);
    res.json({ ok: true, username, changeableAt });
  });

  /** Set/ganti username sendiri — identitas publik yang dipakai Add Friend.
   *  Klaim pertama bebas; ganti berikutnya kena cooldown 7 hari (lihat
   *  `setUsername` di `social/store.ts`). Guest sengaja tidak boleh mengatur
   *  username sendiri (cuma dapat username acak dari `ensureUsername`) —
   *  mengizinkannya percuma begitu dia login Google nanti dan profilnya
   *  ditautkan (`linkAccountProfile`), karena identitas Guest itu tidak
   *  pernah terverifikasi ke akun manapun.
   */
  router.post('/username', async (req, res) => {
    const userId = await resolveUserId(req);
    if (!userId) {
      res
        .status(401)
        .json({ ok: false, code: 'unauthorized', message: 'Login dulu untuk mengatur username.' });
      return;
    }
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const username = typeof req.body?.username === 'string' ? req.body.username : '';
    const displayName =
      typeof req.body?.displayName === 'string'
        ? req.body.displayName.trim().slice(0, 32) || undefined
        : undefined;
    const avatar = resolveAvatar(req.body);
    const result = await setUsername(profileId, username, { displayName, avatar });
    if (!result.ok) {
      if (result.code === 'cooldown') {
        const days = Math.max(
          1,
          Math.ceil((new Date(result.changeableAt).getTime() - Date.now()) / 86_400_000),
        );
        res.status(400).json({
          ok: false,
          code: result.code,
          changeableAt: result.changeableAt,
          message: `Username cuma bisa diganti tiap 7 hari sekali. Coba lagi dalam ${days} hari.`,
        });
        return;
      }
      const message =
        result.code === 'taken'
          ? 'Username itu sudah dipakai.'
          : 'Username tidak valid — 3-20 karakter, diawali huruf, boleh angka/underscore.';
      res.status(400).json({ ok: false, code: result.code, message });
      return;
    }
    res.json({ ok: true });
  });

  /** Bio pemain sendiri (kalau sudah pernah diatur). */
  router.get('/bio', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const { bio } = await getBio(profileId);
    res.json({ ok: true, bio });
  });

  /** Set/ganti bio sendiri — bebas kapan saja, tidak ada cooldown. */
  router.post('/bio', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const bio = typeof req.body?.bio === 'string' ? req.body.bio : '';
    const displayName =
      typeof req.body?.displayName === 'string'
        ? req.body.displayName.trim().slice(0, 32) || undefined
        : undefined;
    const avatar = resolveAvatar(req.body);
    const result = await setBio(profileId, bio, { displayName, avatar });
    if (!result.ok) {
      res.status(400).json({ ok: false, code: result.code, message: 'Gagal menyimpan bio.' });
      return;
    }
    res.json({ ok: true });
  });

  /** Simpan Display Name + avatar sendiri (tombol "Simpan" di Profil
   *  Saya) — tanpa ini perubahannya cuma tersimpan di localStorage, tidak
   *  pernah sampai ke server sampai pemain main atau ganti username/bio. */
  router.post('/profile', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName : '';
    const avatar = resolveAvatar(req.body);
    if (!avatar) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Avatar tidak valid.' });
      return;
    }
    const result = await setDisplayProfile(profileId, displayName, avatar);
    if (!result.ok) {
      res.status(400).json({ ok: false, code: result.code, message: 'Gagal menyimpan profil.' });
      return;
    }
    res.json({ ok: true });
  });

  /** Cari pemain lewat username, buat Add Friend. */
  router.get('/users/search', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2) {
      res.json({ ok: true, users: [] });
      return;
    }
    const users = await searchUsers(q, profileId);
    res.json({ ok: true, users });
  });

  /** Teman (accepted) + permintaan masuk/keluar + undangan room menunggu. */
  router.get('/friends', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const [{ friends, incoming, outgoing }, invites, unreadMessages] = await Promise.all([
      listFriends(profileId),
      Promise.resolve(listInvites(profileId)),
      countUnreadMessages(profileId),
    ]);
    res.json({ ok: true, friends, incoming, outgoing, invites, unreadMessages });
  });

  /**
   * Saluran notifikasi real-time (Server-Sent Events) — dipakai supaya
   * permintaan pertemanan masuk langsung terasa tanpa refresh, di mana pun
   * pemain berada di app (beda dari WebSocket ruang permainan yang cuma
   * aktif selama di dalam satu ruang). `EventSource` browser tidak bisa
   * mengirim header custom, jadi identitas di sini WAJIB lewat query
   * `profileId`, bukan header `x-player-id` seperti endpoint lain.
   * `profileId` sendiri bukan rahasia (sudah dipakai apa adanya di URL
   * publik `GET /players/:profileId`) — koneksi ini cuma menerima DORONGAN
   * notifikasi, tidak pernah membocorkan data yang butuh otorisasi.
   */
  router.get('/events', (req, res) => {
    const profileId = typeof req.query.profileId === 'string' ? req.query.profileId : '';
    if (profileId.length < 6) {
      res.status(400).end();
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(':ok\n\n');
    registerEventStream(profileId, res);
    // Menjaga koneksi tetap hidup lewat proxy/load balancer yang menutup
    // koneksi idle — pola sama seperti heartbeat WebSocket di `ws/gateway.ts`.
    const heartbeat = setInterval(() => res.write(':hb\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      unregisterEventStream(profileId, res);
    });
  });

  /** Isi percakapan dengan seorang teman — sekaligus menandai pesan masuk
   *  di percakapan ini terbaca (lihat `listConversation`). */
  router.get('/messages/:profileId', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const messages = await listConversation(profileId, req.params.profileId);
    res.json({ ok: true, messages });
  });

  /** Kirim pesan chat — cuma boleh ke teman (lihat `sendMessage`). */
  router.post('/messages/:profileId', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const result = await sendMessage(profileId, req.params.profileId, text);
    res.status(result.ok ? 200 : 400).json(result);
  });

  router.post('/friends/request', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const toProfileId = typeof req.body?.toProfileId === 'string' ? req.body.toProfileId : '';
    if (!toProfileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Pemain tujuan tidak valid.' });
      return;
    }
    const result = await sendFriendRequest(profileId, toProfileId);
    if (result.ok) {
      // Dorong real-time ke penerima lewat `GET /events` — no-op kalau dia
      // sedang tidak membuka web sama sekali, `GET /friends` berikutnya
      // tetap benar dari database seperti biasa.
      notifyProfile(toProfileId, 'friend-request', { fromName: resolvePlayerName(req) ?? 'Pemain' });
    }
    res.status(result.ok ? 200 : 400).json(result);
  });

  router.post('/friends/:id/accept', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const result = await respondToFriendRequest(profileId, req.params.id, true);
    res.status(result.ok ? 200 : 400).json(result);
  });

  router.post('/friends/:id/decline', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const result = await respondToFriendRequest(profileId, req.params.id, false);
    res.status(result.ok ? 200 : 400).json(result);
  });

  /** Batalkan permintaan keluar ATAU hapus pertemanan yang sudah diterima — satu aksi untuk keduanya. */
  router.post('/friends/:id/remove', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const result = await removeFriendship(profileId, req.params.id);
    res.status(result.ok ? 200 : 400).json(result);
  });

  /** Undang teman (harus sudah berteman) ke room yang sedang dibuka — masuk kotak undangan penerima. */
  router.post('/rooms/:code/invite', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const room = getRoom(req.params.code);
    if (!room) {
      res.status(404).json({ ok: false, code: 'not_found', message: 'Kode ruang tidak ditemukan.' });
      return;
    }
    const toProfileId = typeof req.body?.toProfileId === 'string' ? req.body.toProfileId : '';
    if (!toProfileId || !(await areFriends(profileId, toProfileId))) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Cuma bisa mengundang teman.' });
      return;
    }
    const fromDisplayName =
      typeof req.body?.fromName === 'string' ? req.body.fromName.trim().slice(0, 32) || 'Pemain' : 'Pemain';
    const fromAvatar = resolveAvatar(req.body) ?? null;
    sendInvite(toProfileId, { roomCode: room.code, fromProfileId: profileId, fromDisplayName, fromAvatar });
    res.json({ ok: true });
  });

  router.post('/invites/:id/dismiss', (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    dismissInvite(profileId, req.params.id);
    res.json({ ok: true });
  });

  /** Saldo coin pemain (anonim maupun login) — 0 kalau belum pernah main/menang. */
  router.get('/wallet', async (req, res) => {
    const profileId = resolveProfileId(req);
    const balance = profileId ? await getBalance(profileId) : 0;
    res.json({ ok: true, balance });
  });

  /** Stok powerup pemain — cuma bertambah lewat `/shop/buy`. */
  router.get('/inventory', async (req, res) => {
    const profileId = resolveProfileId(req);
    const inventory = profileId
      ? await getInventory(profileId)
      : { nearestGuess: 0, letterReveal: 0 };
    res.json({ ok: true, inventory });
  });

  /**
   * Satu-satunya tempat coin ditukar jadi stok powerup. Memakai powerup di
   * dalam ronde (rute `/solo/:id/powerup/*` & pesan WS `powerup*`) tidak
   * pernah memotong saldo lagi — cuma mengurangi stok yang sudah dibeli di sini.
   */
  router.post('/shop/buy', async (req, res) => {
    const profileId = resolveProfileId(req);
    if (!profileId) {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Profil pemain tidak valid.' });
      return;
    }
    const powerup = req.body?.powerup as keyof PowerupInventory | undefined;
    if (powerup !== 'nearestGuess' && powerup !== 'letterReveal') {
      res.status(400).json({ ok: false, code: 'invalid', message: 'Powerup tidak dikenali.' });
      return;
    }
    const spent = await spendWallet(profileId, POWERUP_COSTS[powerup]);
    if (!spent) {
      res.status(400).json({ ok: false, code: 'insufficient_funds', message: 'Coin kamu tidak cukup.' });
      return;
    }
    await addPowerup(profileId, powerup);
    const [balance, inventory] = await Promise.all([
      getBalance(profileId),
      getInventory(profileId),
    ]);
    res.json({ ok: true, balance, inventory });
  });

  /** Dipakai halaman "gabung" untuk memvalidasi kode sebelum membuka WebSocket. */
  router.get('/room/:code', (req, res) => {
    const room = getRoom(req.params.code);
    if (!room) {
      res.status(404).json({ ok: false, code: 'not_found', message: 'Kode ruang tidak ditemukan.' });
      return;
    }
    res.json({
      ok: true,
      code: room.code,
      status: room.status,
      players: room.players.size,
      round: room.round,
    });
  });

  return router;
}
