/**
 * Uji asap alur multiplayer lewat dua klien WebSocket sungguhan.
 *
 * Jalankan dengan server hidup:  npm run smoke
 *
 * Yang diperiksa:
 *  - dua pemain bisa masuk ruang yang sama
 *  - ronde bisa dimulai host
 *  - tebakan benar menghasilkan `correct`, placement, dan skor
 *  - papan tebakan dibagikan ke semua pemain selagi ronde berjalan
 *  - ronde langsung berakhir begitu ada yang benar (kompetitif — tidak
 *    menunggu pemain lain), dan kata rahasia dibuka saat itu juga
 *  - jumlah pesan tetap wajar (menangkap banjir siaran yang membekukan klien)
 */
import { WebSocket } from 'ws';
import type { ClientMessage, RoomState, ServerMessage } from '../shared/types.ts';
import { getEngine } from '../server/src/semantic/engine.ts';

const BASE = process.env.SMOKE_URL ?? 'ws://localhost:8787/ws';

class TestClient {
  readonly received: ServerMessage[] = [];
  room: RoomState | null = null;
  private socket!: WebSocket;

  constructor(
    readonly label: string,
    readonly id: string,
  ) {}

  connect(handshake: Omit<Extract<ClientMessage, { type: 'hello' }>, 'profile'>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(BASE);
      this.socket.on('error', reject);
      this.socket.on('message', (raw) => {
        const message = JSON.parse(String(raw)) as ServerMessage;
        this.received.push(message);
        if (message.type === 'joined' || message.type === 'room' || message.type === 'roundEnded') {
          this.room = message.room;
        }
      });
      this.socket.on('open', () => {
        this.send({
          ...handshake,
          type: 'hello',
          profile: {
            id: this.id,
            name: this.label,
            avatar: { seed: this.id, backgroundColor: '2A2A2E' },
          },
        });
        resolve();
      });
    });
  }

  send(message: ClientMessage): void {
    this.socket.send(JSON.stringify(message));
  }

  close(): void {
    this.socket.close();
  }

  /**
   * Tunggu sampai keadaan ruang TERKINI memenuhi syarat.
   *
   * Sengaja tidak memindai riwayat pesan: kondisi seperti "status = lobby"
   * akan keliru cocok dengan pesan lobi lama sebelum ronde dimulai.
   */
  waitUntilRoom(predicate: (room: RoomState) => boolean, timeoutMs = 8000): Promise<RoomState> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      const poll = () => {
        if (this.room && predicate(this.room)) resolve(this.room);
        else if (Date.now() > deadline) {
          reject(new Error(`${this.label}: timeout menunggu keadaan ruang`));
        } else setTimeout(poll, 25);
      };
      poll();
    });
  }

  waitForMessage<T extends ServerMessage['type']>(
    type: T,
    timeoutMs = 8000,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;
      const poll = () => {
        const found = this.received.find((m) => m.type === type);
        if (found) resolve(found as never);
        else if (Date.now() > deadline) {
          reject(new Error(`${this.label}: timeout menunggu pesan "${type}"`));
        } else setTimeout(poll, 25);
      };
      poll();
    });
  }

  /**
   * Tunggu balasan `guessResult` untuk kata tertentu. Dipakai alih-alih jeda
   * tetap (`sleep`) supaya observasi tidak hilang kalau round-trip jaringan
   * lebih lambat dari jeda yang diasumsikan — penting saat probing banyak
   * kata sekaligus untuk menyimpulkan target lewat peringkat.
   */
  waitForGuessResult(word: string, timeoutMs = 8000): Promise<number | null> | Promise<undefined> {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const poll = () => {
        const found = this.received.find((m) => m.type === 'guessResult' && m.guess.word === word);
        if (found && found.type === 'guessResult') resolve(found.guess.rank);
        else if (Date.now() > deadline) resolve(undefined);
        else setTimeout(poll, 10);
      };
      poll();
    });
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let failures = 0;

function check(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ok   ${message}`);
  } else {
    failures += 1;
    console.log(`  GAGAL ${message}`);
  }
}

async function main() {
  const engine = getEngine();

  const host = new TestClient('Host', 'smoke-host-000000');
  await host.connect({ create: true });
  const joined = await host.waitForMessage('joined');
  const code = joined.room.code;
  console.log(`Ruang dibuat: ${code}`);

  const guest = new TestClient('Tamu', 'smoke-guest-00000');
  await guest.connect({ roomCode: code });
  await guest.waitForMessage('joined');

  await host.waitUntilRoom((room) => room.players.length === 2);
  check(host.room?.players.length === 2, 'dua pemain berada di ruang yang sama');

  host.send({ type: 'start' });
  await host.waitUntilRoom((room) => room.status === 'starting');
  check(host.room?.status === 'starting', 'hitung mundur "starting" muncul sebelum ronde bermain');

  await host.waitUntilRoom((room) => room.status === 'playing');
  check(host.room?.status === 'playing', 'ronde dimulai setelah hitung mundur selesai');

  // Dua pemain menebak kata yang PERSIS sama — harus digabung jadi satu baris
  // di papan tebakan bersama, bukan diduplikasi. Dipilih dari kosakata yang
  // bukan target sama sekali, supaya tidak mungkin kebetulan jadi kata rahasia
  // dan mengacaukan alur di bawah.
  const dummyWord = engine.lexicon.words.find((w) => !engine.targets.includes(w));
  if (dummyWord) {
    host.send({ type: 'guess', word: dummyWord });
    await host.waitForGuessResult(dummyWord);
    guest.send({ type: 'guess', word: dummyWord });
    await guest.waitForGuessResult(dummyWord);
    await sleep(200);
    const merged = (host.room?.guesses ?? []).filter((g) => g.word === dummyWord);
    check(merged.length === 1, `kata yang sama dari dua pemain digabung jadi satu baris ("${dummyWord}": ${merged.length} baris)`);
    check(
      (merged[0]?.players.length ?? 0) === 2,
      `baris gabungan mencatat kedua pemain (${merged[0]?.players.length ?? 0} pemain)`,
    );
  }

  // Kata rahasia tidak diketahui klien, persis seperti pemain sungguhan.
  // Alih-alih menebak seluruh daftar (yang bisa melewati batas tebakan),
  // kirim beberapa kata penyelidik lalu simpulkan targetnya dari peringkat
  // yang dikembalikan server. Ini juga sekaligus memverifikasi bahwa peringkat
  // yang dikirim ke pemain benar-benar konsisten dengan mesin similarity.
  const before = host.received.length + guest.received.length;
  const isSolved = () =>
    host.received.some((m) => m.type === 'guessResult' && m.guess.temperature === 'correct');

  // Sebar probe merata ke seluruh daftar target (bukan cuma sepertiga awal) —
  // dengan kosakata target yang besar, sinyal "in-pool" (bukan null) makin
  // jarang per probe, jadi butuh cakupan penuh + jumlah probe lebih banyak
  // supaya penyempitan tetap dapat diandalkan dan tidak konvergen ke kandidat
  // yang salah karena kebetulan cocok pada observasi yang serba null.
  const PROBE_COUNT = Math.min(60, engine.targets.length);
  const probeIndexes = new Set<number>();
  for (let i = 0; i < PROBE_COUNT; i++) {
    probeIndexes.add(Math.floor((i * engine.targets.length) / PROBE_COUNT));
  }
  const probes = [...probeIndexes].map((i) => engine.targets[i]);
  const observations: Array<[string, number | null]> = [];

  for (const word of probes) {
    host.send({ type: 'guess', word });
    const rank = await host.waitForGuessResult(word);
    if (rank !== undefined) observations.push([word, rank]);
  }

  // Salah satu probe itu sendiri bisa kebetulan ADALAH target — kalau begitu
  // probe itu langsung kembali "correct" (rank 0) dan isSolved() sudah true;
  // tidak perlu (dan tidak boleh) masuk fase penyempitan kandidat sama sekali.
  if (!isSolved()) {
    // Kata probe mana pun yang SUDAH ditebak dan hasilnya BUKAN "correct" sudah
    // terbukti pasti bukan target (kalau dia targetnya, guess itu akan langsung
    // "correct" saat diprobe — kasus itu ditangani di atas). Ini sinyal pasti,
    // bukan probabilistik — jangan sampai dilewatkan, kalau tidak kata itu bisa
    // lolos jadi "kandidat" hanya karena kebetulan konsisten dengan probe lain,
    // padahal sudah dibuktikan salah lewat probing-nya sendiri.
    const provenNotTarget = new Set(observations.map(([word]) => word));
    const candidates = engine.targets.filter((target) => {
      if (provenNotTarget.has(target)) return false;
      return observations.every(([word, rank]) => engine.score(target, word).rank === rank);
    });
    check(candidates.length >= 1, `target berhasil dipersempit (${candidates.length} kandidat)`);
    if (process.env.SMOKE_DEBUG) console.log(`  debug candidates: ${JSON.stringify(candidates)}`);

    // Tebak semua kandidat tersisa (bukan cuma beberapa pertama) — total probe +
    // kandidat tetap jauh di bawah batas keras 300 tebakan/pemain.
    for (const candidate of candidates) {
      host.send({ type: 'guess', word: candidate });
      const r = await host.waitForGuessResult(candidate);
      if (process.env.SMOKE_DEBUG) console.log(`  debug guess "${candidate}" -> rank=${r}`);
      if (isSolved()) break;
    }
    if (process.env.SMOKE_DEBUG) {
      console.log(`  debug guessCount host=${host.room?.players.find((p) => p.id === host.id)?.guessCount}`);
    }
  }
  // SMOKE_DEBUG=1 npm run smoke: kalau penyempitan tetap gagal menemukan target
  // (harusnya tidak lagi terjadi, lihat catatan di atas candidates), keduanya
  // menyerah supaya ronde berakhir dan kata rahasia kebuka untuk dibandingkan
  // dengan observasi rank yang terekam — memudahkan diagnosis kalau muncul lagi.
  if (!isSolved() && process.env.SMOKE_DEBUG) {
    guest.send({ type: 'giveUp' });
    host.send({ type: 'giveUp' });
    const debugEnded = await host.waitForMessage('roundEnded');
    const secret = String(debugEnded.secret);
    console.log(`  debug kata rahasia sebenarnya: "${secret}"`);
    for (const [word, liveRank] of observations) {
      const localRank = engine.score(secret, word).rank;
      const mark = localRank === liveRank ? '' : '  <== MISMATCH';
      console.log(`    probe ${word}: live-rank=${liveRank} local-rank=${localRank}${mark}`);
    }
    process.exit(1);
  }
  check(isSolved(), 'tebakan benar terdeteksi sebagai "correct"');

  // Ronde kompetitif: begitu ada yang benar, ronde langsung berakhir untuk
  // semua orang — tidak perlu (dan tidak boleh) menunggu pemain lain menyerah.
  const ended = await host.waitForMessage('roundEnded');
  const winner = ended.room.players.find((p) => p.id === 'smoke-host-000000');
  check(winner?.solved === true, 'pemain yang benar ditandai solved');
  check(winner?.placement === 1, 'placement pemenang = 1');
  check((winner?.score ?? 0) > 0, `skor pemenang tercatat (${winner?.score})`);
  check(Boolean(ended.secret), `ronde berakhir seketika dan kata dibuka: "${ended.secret}"`);

  // Papan tebakan sengaja dibagikan ke semua pemain (mode kooperatif) selama
  // ronde berjalan — dicek dari riwayat ronde yang baru saja berakhir.
  check(
    (ended.room.guesses ?? []).some((g) => g.players.some((p) => p.id === 'smoke-host-000000')),
    'tebakan host ikut terlihat di papan tebakan bersama pemain lain',
  );

  // Pemeriksaan yang menangkap banjir siaran: satu ronde dengan ratusan tebakan
  // seharusnya menghasilkan pesan dalam orde ribuan, bukan jutaan.
  const total = host.received.length + guest.received.length - before;
  console.log(`  info  total pesan selama ronde: ${total}`);
  check(total < 20000, 'jumlah pesan siaran wajar (tidak ada banjir)');

  host.send({ type: 'playAgain' });
  await host.waitUntilRoom((room) => room.status === 'lobby');
  check(host.room?.status === 'lobby', 'host bisa menyiapkan ronde berikutnya');

  host.close();
  guest.close();

  if (failures > 0) {
    console.log(`\n${failures} pemeriksaan gagal.`);
    process.exit(1);
  }
  console.log('\nSemua pemeriksaan lolos.');
  process.exit(0);
}

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
