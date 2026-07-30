import { useEffect, useRef } from 'react';
import { TEMPERATURE_LABEL, type PlayerPublicState, type RoomStatus } from '@shared/types.ts';
import { replayAnimation, usePrefersReducedMotion } from '../lib/motion.ts';
import { Avatar } from './Avatar.tsx';
import { CrownIcon } from './ui.tsx';

interface PlayerListProps {
  players: PlayerPublicState[];
  status: RoomStatus;
  youId: string;
  canKick: boolean;
  onKick(playerId: string): void;
  /** Buka kartu profil pemain itu. Opsional — kalau tidak diisi, baris tidak bisa diklik. */
  onSelectPlayer?(player: PlayerPublicState): void;
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}m ${seconds}d` : `${seconds}d`;
}

export function PlayerList({
  players,
  status,
  youId,
  canKick,
  onKick,
  onSelectPlayer,
}: PlayerListProps) {
  const reduced = usePrefersReducedMotion();
  const rows = useRef(new Map<string, HTMLLIElement>());
  const progress = useRef(new Map<string, number>());

  /**
   * Kata tebakan lawan sengaja dirahasiakan, jadi satu-satunya kabar yang bisa
   * disampaikan adalah "ada yang maju". Kilatan singkat pada barisnya membuat
   * perlombaan terasa berlangsung, bukan sekadar tabel yang diam-diam berubah.
   */
  useEffect(() => {
    players.forEach((player) => {
      const before = progress.current.get(player.id);
      progress.current.set(player.id, player.solved ? 101 : player.bestCloseness);
      if (reduced || before === undefined) return;

      const now = player.solved ? 101 : player.bestCloseness;
      if (now <= before) return;
      replayAnimation(
        rows.current.get(player.id) ?? null,
        player.solved ? 'player--solved' : 'player--advanced',
      );
    });
  }, [players, reduced]);

  // Belum ada progres buat ditampilkan sebelum ronde benar-benar berjalan —
  // "starting" (hitung mundur) diperlakukan sama seperti lobi di sini.
  const isPreRound = status === 'lobby' || status === 'starting';

  // Ronde baru mengulang dari nol; tanpa ini semua baris ikut berkilat sekali
  // saat papan direset.
  useEffect(() => {
    if (isPreRound) progress.current.clear();
  }, [isPreRound]);

  // Saat ronde berjalan, urutkan berdasarkan kemajuan supaya papan terasa hidup.
  // Di lobi/hitung mundur dan layar hasil, urutan skor total yang relevan.
  const ordered = [...players].sort((a, b) => {
    if (isPreRound) return b.score - a.score;
    if (a.solved !== b.solved) return a.solved ? -1 : 1;
    if (a.solved && b.solved) return (a.placement ?? 99) - (b.placement ?? 99);
    return b.bestCloseness - a.bestCloseness || a.guessCount - b.guessCount;
  });

  return (
    <ul className="players" aria-label="Pemain di ruang ini">
      {ordered.map((player) => {
        // Baris cuma bisa diklik kalau `onSelectPlayer` diisi — dipilih lewat
        // tag dinamis supaya isinya tidak perlu ditulis dua kali per kondisi.
        const Trigger = onSelectPlayer ? 'button' : 'div';
        return (
        <li
          key={player.id}
          ref={(node) => {
            if (node) rows.current.set(player.id, node);
            else rows.current.delete(player.id);
          }}
          className={`player${player.id === youId ? ' player--you' : ''}${
            player.connected ? '' : ' player--away'
          }`}
          data-temp={player.solved ? 'correct' : (player.bestTemperature ?? 'freezing')}
        >
          <Trigger
            type={onSelectPlayer ? 'button' : undefined}
            className="player__trigger"
            onClick={onSelectPlayer ? () => onSelectPlayer(player) : undefined}
            aria-label={onSelectPlayer ? `Lihat profil ${player.name}` : undefined}
          >
            <Avatar config={player.avatar} size={36} />

            <div className="player__main">
              <div className="player__name">
                <span className="player__label">{player.name}</span>
                {player.isHost && (
                  <span className="player__host" title="Host">
                    <CrownIcon />
                  </span>
                )}
                {player.id === youId && <span className="badge badge--plain">kamu</span>}
                {!player.connected && <span className="badge badge--plain">terputus</span>}
              </div>

              <div className="player__meta caption tnum">
                {isPreRound ? (
                  <span>{player.score > 0 ? `${player.score} poin` : 'Siap bermain'}</span>
                ) : player.solved ? (
                  <span>
                    Benar dalam {player.guessCount} tebakan
                    {player.solvedInMs !== null && ` · ${formatDuration(player.solvedInMs)}`}
                  </span>
                ) : player.gaveUp ? (
                  <span>Menyerah setelah {player.guessCount} tebakan</span>
                ) : (
                  <span>
                    {player.guessCount} tebakan
                    {player.bestTemperature && ` · terbaik: ${TEMPERATURE_LABEL[player.bestTemperature]}`}
                  </span>
                )}
              </div>

              {!isPreRound && (
                <div className="player__bar" aria-hidden="true">
                  <span style={{ width: `${player.solved ? 100 : player.bestCloseness}%` }} />
                </div>
              )}
            </div>
          </Trigger>

          {player.solved && player.placement !== null && (
            <span className="player__place tnum" title={`Posisi ${player.placement}`}>
              #{player.placement}
            </span>
          )}

          {canKick && player.id !== youId && (
            <button
              className="btn btn--ghost btn--sm btn--danger"
              onClick={() => onKick(player.id)}
              aria-label={`Keluarkan ${player.name}`}
            >
              Keluarkan
            </button>
          )}
        </li>
        );
      })}
    </ul>
  );
}
