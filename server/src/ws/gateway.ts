import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { AvatarConfig, ClientMessage, ServerMessage } from '@shared/types.ts';
import {
  createRoom,
  getRoom,
  giveUp,
  joinRoom,
  kickPlayer,
  leaveRoom,
  notifyRoom,
  playerGuesses,
  resetToLobby,
  startRound,
  submitRoomGuess,
  toRoomState,
  updateSettings,
  useRoomLetterReveal,
  useRoomNearestGuess,
  type CloseReason,
  type PlayerChannel,
  type Room,
} from '../game/rooms.ts';
import { getInventory } from '../powerup/store.ts';
import { verifyProfileOwnership } from '../http/identity.ts';
import { verifyToken } from '../stats/store.ts';

interface Connection {
  socket: WebSocket;
  playerId: string | null;
  room: Room | null;
  /** Kanal milik koneksi INI — dipakai untuk membedakannya dari socket pengganti. */
  channel: PlayerChannel | null;
  alive: boolean;
  /** Jumlah pesan di jendela rate-limit berjalan — lihat `checkMessageRate`. */
  msgCount: number;
  msgWindowStart: number;
}

/** Batas laju pesan WebSocket per koneksi — jalur tebakan ruang tidak
 *  lewat Express (lihat `guessLimiter` di `http/api.ts`), jadi tidak
 *  kena rate limit HTTP sama sekali tanpa ini. 40 pesan/10 detik jauh di
 *  atas kecepatan mengetik manusia wajar, tapi menahan skrip yang
 *  membanjiri tebakan/powerup. */
const MSG_WINDOW_MS = 10_000;
const MSG_LIMIT = 40;

function checkMessageRate(conn: Connection): boolean {
  const now = Date.now();
  if (now - conn.msgWindowStart > MSG_WINDOW_MS) {
    conn.msgWindowStart = now;
    conn.msgCount = 0;
  }
  conn.msgCount += 1;
  return conn.msgCount <= MSG_LIMIT;
}

/**
 * Kode penutupan di rentang privat (4000-4999). Klien memakainya untuk
 * membedakan gangguan jaringan — yang harus disambung ulang — dari penutupan
 * yang disengaja server, yang tidak boleh.
 */
const CLOSE_CODES: Record<CloseReason, number> = {
  superseded: 4001,
  kicked: 4002,
};

const MAX_NAME_LENGTH = 18;
const HEARTBEAT_MS = 30_000;

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function notice(socket: WebSocket, level: 'info' | 'error', message: string): void {
  send(socket, { type: 'notice', level, message });
}

function sanitizeName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  return name.slice(0, MAX_NAME_LENGTH) || 'Pemain';
}

/** Batas jumlah bagian yang diterima — gaya avatarnya sendiri hanya punya 9. */
const MAX_AVATAR_PARTS = 16;
const PART_KEY = /^[a-zA-Z]{1,24}$/;
const PART_VALUE = /^[a-zA-Z0-9]{1,24}$/;

/**
 * Konfigurasi avatar disiarkan apa adanya ke semua pemain di ruang dan dipakai
 * merender SVG di perangkat mereka. Karena itu bentuknya disaring di sini,
 * bukan sekadar dipercaya: hanya kunci dan nilai berpola sederhana yang lolos,
 * dan jumlahnya dibatasi supaya satu klien tidak bisa mengirim objek raksasa.
 */
function sanitizeParts(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const parts: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(parts).length >= MAX_AVATAR_PARTS) break;
    if (!PART_KEY.test(key)) continue;
    if (typeof value !== 'string' || !PART_VALUE.test(value)) continue;
    parts[key] = value;
  }
  return Object.keys(parts).length > 0 ? parts : undefined;
}

function sanitizeAvatar(raw: unknown): AvatarConfig {
  const fallback: AvatarConfig = { seed: 'pemain', backgroundColor: '2A2A2E' };
  if (!raw || typeof raw !== 'object') return fallback;
  const candidate = raw as Partial<AvatarConfig>;
  return {
    seed: typeof candidate.seed === 'string' ? candidate.seed.slice(0, 64) : fallback.seed,
    backgroundColor: /^[0-9a-fA-F]{6}$/.test(String(candidate.backgroundColor))
      ? String(candidate.backgroundColor)
      : fallback.backgroundColor,
    parts: sanitizeParts(candidate.parts),
  };
}

export function attachGateway(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const liveness = new Map<WebSocket, Connection>();

  wss.on('connection', (socket) => {
    const conn: Connection = {
      socket,
      playerId: null,
      room: null,
      channel: null,
      alive: true,
      msgCount: 0,
      msgWindowStart: Date.now(),
    };
    liveness.set(socket, conn);

    socket.on('pong', () => {
      conn.alive = true;
    });

    socket.on('message', (raw) => {
      if (!checkMessageRate(conn)) {
        notice(socket, 'error', 'Terlalu banyak permintaan, coba lagi sebentar.');
        return;
      }
      let message: ClientMessage;
      try {
        message = JSON.parse(String(raw)) as ClientMessage;
      } catch {
        notice(socket, 'error', 'Pesan tidak dikenali.');
        return;
      }
      try {
        handle(conn, message);
      } catch (error) {
        console.error('[ws] gagal memproses pesan', error);
        notice(socket, 'error', 'Terjadi kesalahan di server.');
      }
    });

    socket.on('close', () => {
      liveness.delete(socket);
      if (conn.room && conn.playerId && conn.channel) {
        leaveRoom(conn.room, conn.playerId, conn.channel);
      }
      conn.room = null;
    });
  });

  // Koneksi yang mati diam-diam (laptop ditutup, sinyal hilang) tidak pernah
  // memicu event `close`, jadi kursinya perlu dibersihkan lewat heartbeat.
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      const conn = liveness.get(socket);
      if (!conn) continue;
      if (!conn.alive) {
        socket.terminate();
        continue;
      }
      conn.alive = false;
      socket.ping();
    }
  }, HEARTBEAT_MS);

  wss.on('close', () => clearInterval(heartbeat));
}

function handle(conn: Connection, message: ClientMessage): void {
  const { socket } = conn;

  if (message.type === 'ping') {
    send(socket, { type: 'pong' });
    return;
  }

  if (message.type === 'hello') {
    void handleHello(conn, message);
    return;
  }

  if (!conn.room || !conn.playerId) {
    notice(socket, 'error', 'Kamu belum bergabung ke ruang mana pun.');
    return;
  }
  const room = conn.room;
  const playerId = conn.playerId;

  switch (message.type) {
    case 'start': {
      const error = startRound(room, playerId);
      if (error) notice(socket, 'error', error);
      break;
    }
    case 'guess':
      void handleGuess(socket, room, playerId, String(message.word ?? ''));
      break;
    case 'giveUp':
      giveUp(room, playerId);
      break;
    case 'powerupNearestGuess':
      void handleNearestGuessPowerup(socket, room, playerId);
      break;
    case 'powerupLetterReveal':
      void handleLetterRevealPowerup(socket, room, playerId);
      break;
    case 'settings': {
      const error = updateSettings(room, playerId, message.settings ?? {});
      if (error) notice(socket, 'error', error);
      break;
    }
    case 'playAgain': {
      const error = resetToLobby(room, playerId);
      if (error) notice(socket, 'error', error);
      break;
    }
    case 'kick': {
      const error = kickPlayer(room, playerId, String(message.playerId ?? ''));
      if (error) notice(socket, 'error', error);
      break;
    }
    default:
      notice(socket, 'error', 'Perintah tidak dikenali.');
  }
}

async function handleHello(
  conn: Connection,
  message: Extract<ClientMessage, { type: 'hello' }>,
): Promise<void> {
  const { socket } = conn;
  const profile = message.profile;
  if (!profile || typeof profile.id !== 'string' || profile.id.length < 6) {
    notice(socket, 'error', 'Profil pemain tidak valid.');
    socket.close();
    return;
  }

  const name = sanitizeName(profile.name);
  const avatar = sanitizeAvatar(profile.avatar);
  const userId = message.authToken ? await verifyToken(message.authToken) : null;

  // `profile.id` sendiri tidak rahasia (lihat komentar `secret` di
  // `shared/types.ts`) — tanpa verifikasi ini, siapa pun yang tahu id
  // pemain lain (mis. dari leaderboard) bisa "menyambung ulang" ke room
  // itu dan mengambil-alih kursinya (server memperlakukan sambungan kedua
  // dengan id yang sama sebagai reconnect sah, lihat `joinRoom`).
  const owned = await verifyProfileOwnership(profile.id, { userId, secret: message.secret ?? null });
  if (!owned) {
    notice(socket, 'error', 'Profil pemain tidak valid.');
    socket.close();
    return;
  }

  let room: Room | null;
  if (message.create) {
    try {
      room = createRoom(message.settings ?? {});
    } catch (error) {
      notice(socket, 'error', error instanceof Error ? error.message : 'Gagal membuat ruang.');
      return;
    }
  } else {
    room = getRoom(String(message.roomCode ?? ''));
    if (!room) {
      notice(socket, 'error', 'Kode ruang tidak ditemukan.');
      return;
    }
  }

  const channel: PlayerChannel = {
    send: (payload: ServerMessage) => send(socket, payload),
    close: (reason?: CloseReason) => socket.close(reason ? CLOSE_CODES[reason] : 1000),
  };
  const result = joinRoom(room, profile.id, name, avatar, channel, userId);
  if (!result.ok) {
    notice(socket, 'error', result.message);
    return;
  }

  conn.room = room;
  conn.playerId = profile.id;
  conn.channel = channel;

  send(socket, { type: 'joined', room: toRoomState(room), you: profile.id });
  // Pemain yang menyambung ulang di tengah ronde harus melihat riwayatnya lagi.
  const guesses = playerGuesses(room, profile.id);
  if (guesses.length > 0) {
    send(socket, { type: 'guessResult', guess: guesses[0], guesses });
  }
  // Sama seperti riwayat tebakan — bocoran huruf yang sudah dipakai sebelum
  // koneksi putus tidak boleh "hilang" begitu pemain menyambung ulang.
  const player = room.players.get(profile.id);
  if (player?.letterRevealed && room.secret) {
    send(socket, { type: 'letterReveal', letter: room.secret[0], wordLength: room.secret.length });
  }
  notifyRoom(room);
}

/** Tebakan manual — mengabari saldo terbaru lewat pesan `wallet` terpisah
 *  kalau tebakan ini kebetulan kemenangan, supaya chip saldo di header
 *  langsung ter-update tanpa perlu memuat ulang halaman. */
async function handleGuess(socket: WebSocket, room: Room, playerId: string, word: string): Promise<void> {
  const result = await submitRoomGuess(room, playerId, word);
  if (!result.ok) {
    notice(socket, 'error', result.message);
    return;
  }
  send(socket, { type: 'guessResult', guess: result.guess, guesses: result.guesses });
  if (result.balance !== undefined) send(socket, { type: 'wallet', balance: result.balance });
}

/** Hasil tebakan powerup dikirim ke pemain ini lewat cara yang sama seperti
 *  tebakan manual (`guessResult`); pemain lain sudah diberi tahu lewat
 *  `broadcastRoom` di dalam `useRoomNearestGuess` itu sendiri. */
async function handleNearestGuessPowerup(socket: WebSocket, room: Room, playerId: string): Promise<void> {
  const result = await useRoomNearestGuess(room, playerId);
  if (!result.ok) {
    notice(socket, 'error', result.message);
    return;
  }
  send(socket, { type: 'guessResult', guess: result.guess, guesses: result.guesses });
  send(socket, { type: 'inventory', inventory: await getInventory(playerId) });
}

/** Huruf bocoran cuma dikirim ke pemain yang memakainya, tidak pernah disiarkan —
 *  lewat pesan `letterReveal` terstruktur (bukan `notice` teks bebas) supaya
 *  klien bisa menampilkan huruf+placeholder sisa kata, bukan cuma teks. */
async function handleLetterRevealPowerup(socket: WebSocket, room: Room, playerId: string): Promise<void> {
  const result = await useRoomLetterReveal(room, playerId);
  if ('error' in result) {
    notice(socket, 'error', result.error);
    return;
  }
  send(socket, { type: 'letterReveal', letter: result.letter, wordLength: result.wordLength });
  send(socket, { type: 'inventory', inventory: result.inventory });
}
