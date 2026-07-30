import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type {
  Guess,
  PlayerProfile,
  PlayerPublicState,
  PowerupInventory,
  RoomSettings,
  RoomState,
  ServerMessage,
} from '@shared/types.ts';
import { RoomSocket, type ConnectionStatus } from '../lib/ws.ts';
import { applyInventory, getInventory, subscribeInventory } from '../lib/inventory.ts';
import { navigate } from '../lib/router.ts';
import { useGuessFx, type GuessFx } from '../lib/useGuessFx.ts';
import { applyBalance } from '../lib/wallet.ts';
import { Ambient } from '../components/Ambient.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { GuessFxLayer } from '../components/GuessFx.tsx';
import { GuessInput } from '../components/GuessInput.tsx';
import { GuessList } from '../components/GuessList.tsx';
import { HeatMeter } from '../components/HeatMeter.tsx';
import { PlayerList } from '../components/PlayerList.tsx';
import { PlayerProfileModal } from '../components/PlayerProfileModal.tsx';
import { CopyIcon, EyeIcon, FlagIcon, ShareIcon, TargetIcon, useToast } from '../components/ui.tsx';

interface RoomScreenProps {
  /** Kode ruang, atau "BARU" untuk membuat ruang baru. */
  code: string;
  profile: PlayerProfile;
}

/**
 * StrictMode (mode dev) me-mount layar ini dua kali. Tanpa penanda ini,
 * mount kedua akan membuat ruang kedua dan menelantarkan yang pertama.
 * Berguna juga di produksi: klik ganda pada "Main bareng" tidak lagi
 * menghasilkan dua ruang.
 */
let recentlyCreated: { code: string; at: number } | null = null;
const CREATE_DEDUPE_MS = 2500;

const CONNECTION_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Menyambungkan...',
  open: 'Tersambung',
  reconnecting: 'Menyambung ulang...',
  closed: 'Terputus',
};

export function RoomScreen({ code, profile }: RoomScreenProps) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [latest, setLatest] = useState<Guess | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [fatal, setFatal] = useState<string | null>(null);
  /** Naik tiap tebakan ditolak — memicu getaran pada kolom input. */
  const [rejections, setRejections] = useState(0);
  /** Pemain yang kartu profilnya sedang dibuka lewat daftar Pemain. */
  const [viewingPlayer, setViewingPlayer] = useState<PlayerPublicState | null>(null);
  /** Status "Bocoran Huruf" bersifat privat (tidak ada di `PlayerPublicState`),
   *  jadi dilacak lokal di sini — direset tiap ronde baru. */
  const [letterRevealed, setLetterRevealed] = useState(false);
  const pendingLetterReveal = useRef(false);
  const socketRef = useRef<RoomSocket | null>(null);
  const toast = useToast();
  const inventory = useSyncExternalStore(subscribeInventory, getInventory, () => ({
    nearestGuess: 0,
    letterReveal: 0,
  }));

  useEffect(() => {
    const reusable =
      recentlyCreated && Date.now() - recentlyCreated.at < CREATE_DEDUPE_MS
        ? recentlyCreated.code
        : null;
    const wantsNewRoom = code.toUpperCase() === 'BARU' && reusable === null;
    const joinCode = code.toUpperCase() === 'BARU' ? (reusable ?? undefined) : code;
    let joined = false;

    const socket = new RoomSocket({
      onStatus: setStatus,
      onFatal: setFatal,
      onMessage: (message: ServerMessage) => {
        switch (message.type) {
          case 'joined':
            joined = true;
            if (wantsNewRoom) recentlyCreated = { code: message.room.code, at: Date.now() };
            setRoom(message.room);
            setFatal(null);
            socket.bindRoomCode(message.room.code);
            // URL diganti tanpa memicu hashchange supaya layar tidak
            // ter-mount ulang dan koneksi ruang tidak terputus.
            history.replaceState(null, '', `#/ruang/${message.room.code}`);
            break;
          case 'room':
            setRoom(message.room);
            break;
          case 'roundEnded':
            setRoom(message.room);
            break;
          case 'guessResult':
            setGuesses(message.guesses);
            setLatest(message.guess);
            break;
          case 'inventory':
            applyInventory(message.inventory);
            break;
          case 'wallet':
            applyBalance(message.balance);
            break;
          case 'notice':
            // Error sebelum berhasil masuk (kode salah, ruang penuh, ronde
            // sedang berjalan) bukan gangguan sesaat — hentikan di situ
            // daripada membiarkan klien mencoba menyambung terus-menerus.
            if (message.level === 'error' && !joined) {
              setFatal(message.message);
              socket.close();
            } else {
              if (message.level === 'error') setRejections((count) => count + 1);
              if (pendingLetterReveal.current) {
                pendingLetterReveal.current = false;
                if (message.level !== 'error') setLetterRevealed(true);
              }
              toast.show(message.message, message.level);
            }
            break;
          default:
            break;
        }
      },
    });

    socketRef.current = socket;
    socket.connect({ type: 'hello', profile, create: wantsNewRoom, roomCode: joinCode });

    return () => {
      socket.close();
      socketRef.current = null;
    };
    // `profile` sengaja tidak jadi dependensi: mengganti avatar di tengah ronde
    // tidak boleh memutus dan menyambung ulang koneksi ruang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Ronde baru harus mengosongkan riwayat lokal, kalau tidak tebakan ronde
  // sebelumnya ikut terbawa ke papan yang baru.
  const round = room?.round ?? 0;
  useEffect(() => {
    if (room?.status === 'playing') {
      setGuesses([]);
      setLatest(null);
      setLetterRevealed(false);
    }
  }, [round]);

  const fx = useGuessFx(latest, guesses, round);

  const playerAvatars = useMemo(
    () => new Map(room?.players.map((p) => [p.id, p.avatar]) ?? []),
    [room?.players],
  );

  const send = (message: Parameters<RoomSocket['send']>[0]) => socketRef.current?.send(message);

  const useNearestGuess = () => send({ type: 'powerupNearestGuess' });
  const useLetterReveal = () => {
    pendingLetterReveal.current = true;
    send({ type: 'powerupLetterReveal' });
  };

  const you = room?.players.find((p) => p.id === profile.id) ?? null;
  const isHost = you?.isHost ?? false;

  if (fatal) {
    return (
      <div className="card stack" style={{ textAlign: 'center' }}>
        <p>{fatal}</p>
        <button className="btn btn--secondary" onClick={() => navigate('/')}>
          Kembali ke beranda
        </button>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="stack" style={{ alignItems: 'center', paddingTop: 48 }}>
        <p className="muted">{CONNECTION_LABEL[status]}</p>
        {status === 'reconnecting' && (
          <button className="btn btn--ghost btn--sm" onClick={() => navigate('/')}>
            Batal
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <Ambient temperature={latest?.temperature ?? null} />
      <GuessFxLayer fx={fx} />

      <div className="row">
        <h1>Ruang {room.code}</h1>
        <span className="spacer" />
        <span className={`conn conn--${status}`}>
          <span className="conn__dot" />
          {CONNECTION_LABEL[status]}
        </span>
      </div>

      {room.status === 'lobby' && (
        <Lobby
          room={room}
          isHost={isHost}
          onStart={() => send({ type: 'start' })}
          onSettings={(settings) => send({ type: 'settings', settings })}
        />
      )}

      {room.status === 'starting' && <Starting room={room} />}

      {room.status === 'playing' && (
        <Playing
          room={room}
          guesses={guesses}
          latest={latest}
          fx={fx}
          rejections={rejections}
          finished={Boolean(you?.solved || you?.gaveUp)}
          inventory={inventory}
          letterRevealed={letterRevealed}
          onGuess={(word) => send({ type: 'guess', word })}
          onGiveUp={() => send({ type: 'giveUp' })}
          onUseNearestGuess={useNearestGuess}
          onUseLetterReveal={useLetterReveal}
        />
      )}

      {room.status === 'playing' && room.guesses.length > 0 && (
        <div className="stack" style={{ gap: 12 }}>
          <h2>Papan tebakan</h2>
          <GuessList
            guesses={room.guesses}
            latestWord={latest?.word ?? null}
            latestPlayerId={profile.id}
            poolSize={room.poolSize}
            playerAvatars={playerAvatars}
          />
        </div>
      )}

      {room.status === 'finished' && (
        <RoundResult
          room={room}
          isHost={isHost}
          onPlayAgain={() => send({ type: 'playAgain' })}
        />
      )}

      <div className="stack" style={{ gap: 12 }}>
        <div className="row">
          <h2>Pemain</h2>
          <span className="spacer" />
          <span className="caption tnum">{room.players.length} orang</span>
        </div>
        <PlayerList
          players={room.players}
          status={room.status}
          youId={profile.id}
          canKick={isHost && room.status !== 'playing'}
          onKick={(playerId) => send({ type: 'kick', playerId })}
          onSelectPlayer={setViewingPlayer}
        />
      </div>

      {viewingPlayer && (
        <PlayerProfileModal
          player={viewingPlayer}
          youId={profile.id}
          onClose={() => setViewingPlayer(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ lobi */

function Lobby({
  room,
  isHost,
  onStart,
  onSettings,
}: {
  room: RoomState;
  isHost: boolean;
  onStart(): void;
  onSettings(settings: Partial<RoomSettings>): void;
}) {
  const toast = useToast();
  const inviteUrl = `${location.origin}/#/ruang/${room.code}`;

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.show(message);
    } catch {
      toast.show('Tidak bisa menyalin. Salin manual dari layar.', 'error');
    }
  };

  const share = async () => {
    const text = `Ayo main Wordheat bareng. Kode ruang: ${room.code}\n${inviteUrl}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await copy(text, 'Undangan disalin ke papan klip.');
    } catch {
      /* dialog berbagi dibatalkan */
    }
  };

  return (
    <div className="stack">
      <div className="card stack">
        <div className="room-code">
          <div>
            <div className="caption">Kode ruang</div>
            <div className="room-code__value tnum">{room.code}</div>
          </div>
          <button
            className="btn btn--ghost btn--icon"
            onClick={() => copy(room.code, 'Kode ruang disalin.')}
            aria-label="Salin kode ruang"
          >
            <CopyIcon />
          </button>
        </div>

        <button className="btn btn--secondary btn--block" onClick={share}>
          <ShareIcon />
          Bagikan undangan
        </button>

        <p className="caption" style={{ textAlign: 'center' }}>
          Teman yang membuka tautan ini langsung masuk ke ruangmu.
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 8 }}>Pengaturan ronde</h2>

        <div className="setting">
          <span className="setting__text">
            <span>Batas waktu</span>
            <span className="caption">Ronde berhenti otomatis saat waktu habis</span>
          </span>
          <Segmented
            disabled={!isHost}
            value={room.settings.timeLimit}
            options={[
              { value: 0, label: 'Bebas' },
              { value: 180, label: '3 m' },
              { value: 300, label: '5 m' },
              { value: 600, label: '10 m' },
            ]}
            onChange={(timeLimit) => onSettings({ timeLimit })}
          />
        </div>

        <div className="setting">
          <span className="setting__text">
            <span>Batas tebakan</span>
            <span className="caption">Jatah tebakan per pemain</span>
          </span>
          <Segmented
            disabled={!isHost}
            value={room.settings.maxGuesses}
            options={[
              { value: 0, label: 'Bebas' },
              { value: 20, label: '20' },
              { value: 40, label: '40' },
              { value: 80, label: '80' },
            ]}
            onChange={(maxGuesses) => onSettings({ maxGuesses })}
          />
        </div>
      </div>

      {isHost ? (
        <button className="btn btn--primary btn--block" onClick={onStart}>
          Mulai ronde {room.round + 1}
        </button>
      ) : (
        <p className="empty">Menunggu host memulai ronde...</p>
      )}
    </div>
  );
}

function Segmented<T extends number>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange(value: T): void;
  disabled?: boolean;
}) {
  return (
    <div className="seg" role="group">
      {options.map((option) => (
        <button
          key={option.value}
          aria-pressed={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------ hitung mundur */

/** Jeda singkat sebelum ronde benar-benar mulai, supaya semua pemain sadar
 *  (host maupun tamu) — dihitung dari `room.startsAt` yang disiarkan server,
 *  pola yang sama dengan `useCountdown` untuk batas waktu ronde. */
function Starting({ room }: { room: RoomState }) {
  const remaining = useCountdown(room.startsAt) ?? 0;
  return (
    <div className="card starting">
      <span className="starting__label">Ronde {room.round + 1} dimulai dalam</span>
      <span className="starting__number tnum" key={remaining}>
        {remaining > 0 ? remaining : 'Mulai!'}
      </span>
    </div>
  );
}

/* --------------------------------------------------------------- bermain */

function Playing({
  room,
  guesses,
  latest,
  fx,
  rejections,
  finished,
  inventory,
  letterRevealed,
  onGuess,
  onGiveUp,
  onUseNearestGuess,
  onUseLetterReveal,
}: {
  room: RoomState;
  guesses: Guess[];
  latest: Guess | null;
  fx: GuessFx | null;
  rejections: number;
  finished: boolean;
  inventory: PowerupInventory;
  letterRevealed: boolean;
  onGuess(word: string): void;
  onGiveUp(): void;
  onUseNearestGuess(): void;
  onUseLetterReveal(): void;
}) {
  const remaining = useCountdown(room.deadline);
  const guessesLeft =
    room.settings.maxGuesses > 0 ? room.settings.maxGuesses - guesses.length : null;

  return (
    <div className="stack">
      <div className="row">
        <span className="badge badge--plain tnum">Ronde {room.round}</span>
        {remaining !== null && (
          <span
            className={`badge badge--plain tnum${remaining <= 10 ? ' badge--urgent' : ''}`}
            data-temp={remaining < 30 ? 'very-hot' : undefined}
          >
            {formatClock(remaining)}
          </span>
        )}
        {guessesLeft !== null && (
          <span className="badge badge--plain tnum">{Math.max(0, guessesLeft)} tebakan tersisa</span>
        )}
      </div>

      <div className={`card${latest?.temperature === 'correct' ? ' heat--won' : ''}`}>
        <HeatMeter guess={latest} poolSize={room.poolSize} fx={fx} />
      </div>

      {finished ? (
        <p className="empty">
          Kamu sudah selesai. Tunggu pemain lain — kata rahasianya dibuka setelah ronde berakhir.
        </p>
      ) : (
        <>
          <GuessInput onSubmit={onGuess} errorSignal={rejections} />
          <div className="row">
            <button
              className="btn btn--ghost btn--sm"
              onClick={onUseNearestGuess}
              disabled={inventory.nearestGuess < 1}
              title={inventory.nearestGuess < 1 ? 'Beli di Shop' : `${inventory.nearestGuess} tersisa`}
            >
              <TargetIcon />
              Tebak Terdekat
              <span className="badge badge--plain tnum">{inventory.nearestGuess}</span>
            </button>
            <button
              className="btn btn--ghost btn--sm"
              onClick={onUseLetterReveal}
              disabled={letterRevealed || inventory.letterReveal < 1}
              title={
                letterRevealed
                  ? 'Sudah dipakai di ronde ini'
                  : inventory.letterReveal < 1
                    ? 'Beli di Shop'
                    : `${inventory.letterReveal} tersisa`
              }
            >
              <EyeIcon />
              Bocoran Huruf
              <span className="badge badge--plain tnum">{inventory.letterReveal}</span>
            </button>
          </div>

          {/* Baris sendiri, jauh dari tombol "Tebak" di ujung kolom tebakan —
              sebelumnya didorong ke kanan lewat spacer dan malah persis
              menumpuk di bawah "Tebak", jadi gampang salah pencet. */}
          <div className="row">
            <button className="btn btn--ghost btn--sm" onClick={onGiveUp}>
              <FlagIcon />
              Menyerah
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function useCountdown(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  if (deadline === null) return null;
  return Math.max(0, Math.round((deadline - now) / 1000));
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ----------------------------------------------------------------- hasil */

function RoundResult({
  room,
  isHost,
  onPlayAgain,
}: {
  room: RoomState;
  isHost: boolean;
  onPlayAgain(): void;
}) {
  const winner = useMemo(
    () => room.players.find((p) => p.placement === 1) ?? null,
    [room.players],
  );

  // Sudah selesai duluan dari posisi 1; yang belum selesai diurut dari yang
  // paling dekat maknanya, supaya peringkat tetap masuk akal.
  const ranked = useMemo(
    () =>
      [...room.players].sort((a, b) => {
        if (a.placement !== null && b.placement !== null) return a.placement - b.placement;
        if (a.placement !== null) return -1;
        if (b.placement !== null) return 1;
        return b.bestCloseness - a.bestCloseness;
      }),
    [room.players],
  );

  return (
    <div className="card card--cream" data-temp="correct">
      <div className="result">
        <span className="caption">Kata rahasianya</span>
        <span className="result__secret">{room.secret ?? '—'}</span>

        <p className="small muted">
          {winner
            ? `${winner.name} menemukannya lebih dulu dalam ${winner.guessCount} tebakan.`
            : 'Tidak ada yang menemukan kata ini. Ronde berikutnya, ya.'}
        </p>

        <ol className="result-ranks">
          {ranked.map((player) => (
            <li key={player.id} className="result-rank">
              <span className="result-rank__place tnum">{player.placement ?? '—'}</span>
              <Avatar config={player.avatar} size={28} />
              <span className="result-rank__name">{player.name}</span>
              <span className="caption tnum">
                {player.solved
                  ? `${player.guessCount} tebakan`
                  : player.gaveUp
                    ? 'Menyerah'
                    : 'Belum selesai'}
              </span>
              <span className="tnum">{player.score}</span>
            </li>
          ))}
        </ol>

        {isHost ? (
          <button className="btn btn--primary" onClick={onPlayAgain} style={{ marginTop: 8 }}>
            Siapkan ronde berikutnya
          </button>
        ) : (
          <p className="caption">Menunggu host menyiapkan ronde berikutnya...</p>
        )}
      </div>
    </div>
  );
}
