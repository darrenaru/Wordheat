import { TEMPERATURE_LABEL, type PlayerPublicState } from '@shared/types.ts';
import { Avatar } from './Avatar.tsx';
import { formatDuration } from './PlayerList.tsx';
import { CrownIcon, Modal } from './ui.tsx';

interface PlayerProfileModalProps {
  player: PlayerPublicState;
  youId: string;
  onClose(): void;
}

/** Kartu profil pemain — semua datanya sudah ada di `PlayerPublicState` yang
 *  dikirim server; ronde tidak persisten lintas sesi, jadi statistiknya
 *  cuma untuk ronde yang sedang/baru berjalan di ruang ini. */
export function PlayerProfileModal({ player, youId, onClose }: PlayerProfileModalProps) {
  const statusText = player.solved ? 'Benar' : player.gaveUp ? 'Menyerah' : 'Masih menebak';

  return (
    <Modal title="Profil pemain" onClose={onClose}>
      <div
        className="profile"
        data-temp={player.solved ? 'correct' : (player.bestTemperature ?? 'freezing')}
      >
        <Avatar config={player.avatar} size={96} />

        <div className="profile__name">
          <span className="profile__label">{player.name}</span>
          {player.isHost && (
            <span className="player__host" title="Host">
              <CrownIcon />
            </span>
          )}
        </div>

        {(player.id === youId || !player.connected) && (
          <div className="profile__badges">
            {player.id === youId && <span className="badge badge--plain">kamu</span>}
            {!player.connected && <span className="badge badge--plain">terputus</span>}
          </div>
        )}

        <dl className="profile__stats">
          <div className="profile__stat">
            <dt className="caption">Skor</dt>
            <dd className="tnum">{player.score}</dd>
          </div>

          <div className="profile__stat">
            <dt className="caption">Tebakan</dt>
            <dd className="tnum">{player.guessCount}</dd>
          </div>

          <div className="profile__stat">
            <dt className="caption">Suhu terbaik</dt>
            <dd>
              {player.bestTemperature ? (
                <span className="badge">
                  <span className="badge__dot" />
                  {TEMPERATURE_LABEL[player.bestTemperature]}
                </span>
              ) : (
                '—'
              )}
            </dd>
          </div>

          <div className="profile__stat profile__stat--wide">
            <dt className="caption">Status</dt>
            <dd>
              {statusText}
              {player.placement !== null && ` · posisi #${player.placement}`}
              {player.solvedInMs !== null && ` · ${formatDuration(player.solvedInMs)}`}
            </dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}
