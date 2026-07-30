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
import { addPowerup, getInventory } from '../powerup/store.ts';
import { getLeaderboard, getStats, linkAccountProfile, verifyToken } from '../stats/store.ts';
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

  /**
   * Dipanggil sekali tiap kali pemain login. Menautkan profil perangkat ini
   * ke akunnya — kalau akun itu sudah pernah dipakai di perangkat lain,
   * saldo/statistik/stok profil ini digabung ke profil kanonik akun
   * tersebut dan `profileId` baru inilah yang wajib dipakai client ke depan.
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
    const canonicalProfileId = await linkAccountProfile(userId, profileId, name, avatar);
    res.json({ ok: true, profileId: canonicalProfileId });
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
