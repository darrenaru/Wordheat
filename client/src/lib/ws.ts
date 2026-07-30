import type { ClientMessage, ServerMessage } from '@shared/types.ts';
import { getAuthToken } from './supabase.ts';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

interface RoomSocketOptions {
  onMessage(message: ServerMessage): void;
  onStatus(status: ConnectionStatus): void;
  /** Dipanggil saat server menutup koneksi dengan sengaja — jangan sambung ulang. */
  onFatal(message: string): void;
}

const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

/**
 * Kode penutupan yang berarti "berhenti di sini". Menyambung ulang setelah
 * menerima salah satu dari ini hanya akan mengulang situasi yang sama —
 * dua tab yang berbagi profil, misalnya, akan saling menendang tanpa henti.
 */
const FATAL_CLOSE_CODES: Record<number, string> = {
  4001: 'Ruang ini dibuka di tab atau perangkat lain.',
  4002: 'Kamu dikeluarkan dari ruang oleh host.',
};

/**
 * Koneksi ruang dengan sambung-ulang otomatis.
 *
 * `handshake` dikirim ulang setiap kali koneksi terbuka, jadi pemain yang
 * jaringannya putus sebentar kembali ke kursinya sendiri di server tanpa
 * kehilangan riwayat tebakan ronde berjalan.
 */
export class RoomSocket {
  private socket: WebSocket | null = null;
  private handshake: ClientMessage | null = null;
  private attempt = 0;
  private timer: number | null = null;
  private closedByUs = false;

  constructor(private readonly options: RoomSocketOptions) {}

  connect(handshake: ClientMessage): void {
    this.handshake = handshake;
    this.closedByUs = false;
    this.attempt = 0;
    this.open();
  }

  private open(): void {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws`);
    this.socket = socket;
    this.options.onStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');

    socket.addEventListener('open', () => {
      this.attempt = 0;
      this.options.onStatus('open');
      if (this.handshake) {
        // Token diambil segar di setiap (re)koneksi, bukan disimpan di
        // handshake sejak awal — sesi bisa berubah (login/refresh) sementara
        // koneksi ini hidup lama.
        const authToken = getAuthToken();
        const message =
          this.handshake.type === 'hello' && authToken
            ? { ...this.handshake, authToken }
            : this.handshake;
        socket.send(JSON.stringify(message));
      }
    });

    socket.addEventListener('message', (event) => {
      try {
        this.options.onMessage(JSON.parse(event.data as string) as ServerMessage);
      } catch {
        /* pesan rusak diabaikan */
      }
    });

    socket.addEventListener('close', (event) => {
      this.socket = null;
      const fatal = FATAL_CLOSE_CODES[event.code];
      if (fatal) {
        this.closedByUs = true;
        this.options.onStatus('closed');
        this.options.onFatal(fatal);
        return;
      }
      if (this.closedByUs) {
        this.options.onStatus('closed');
        return;
      }
      // Sambung ulang selalu memakai kode ruang, bukan `create`, supaya
      // percobaan ulang tidak diam-diam membuat ruang baru.
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    const delay = RECONNECT_DELAYS_MS[Math.min(this.attempt, RECONNECT_DELAYS_MS.length - 1)];
    this.attempt += 1;
    this.options.onStatus('reconnecting');
    this.timer = window.setTimeout(() => this.open(), delay);
  }

  /** Setelah ruang terbentuk, handshake berikutnya harus memakai kodenya. */
  bindRoomCode(code: string): void {
    if (this.handshake?.type === 'hello') {
      this.handshake = { ...this.handshake, create: false, roomCode: code };
    }
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  close(): void {
    this.closedByUs = true;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.socket?.close();
    this.socket = null;
  }
}
