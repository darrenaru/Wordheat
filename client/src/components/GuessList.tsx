import { useLayoutEffect, useRef } from 'react';
import { TEMPERATURE_LABEL, type AvatarConfig, type Guess, type RoomGuessPlayer } from '@shared/types.ts';
import { usePrefersReducedMotion } from '../lib/motion.ts';
import { Avatar } from './Avatar.tsx';

/** Tebakan yang boleh membawa info siapa yang menebak (dipakai di ruang). */
type AttributedGuess = Guess & { players?: RoomGuessPlayer[] };

interface GuessListProps {
  guesses: AttributedGuess[];
  /** Tebakan terakhir yang dikirim — disorot sebentar agar mudah ditemukan. */
  latestWord?: string | null;
  /** Pemilik `latestWord`. Perlu diisi di papan bersama supaya highlight tidak
   *  salah baris kalau ada dua pemain kebetulan menebak kata yang sama. */
  latestPlayerId?: string | null;
  poolSize: number;
  /** Avatar tiap pemain, untuk ditampilkan di samping nama penebak. */
  playerAvatars?: Map<string, AvatarConfig>;
}

const SHIFT_MS = 340;

export function GuessList({
  guesses,
  latestWord,
  latestPlayerId,
  poolSize,
  playerAvatars,
}: GuessListProps) {
  const reduced = usePrefersReducedMotion();
  const rows = useRef(new Map<string, HTMLLIElement>());
  const lastTop = useRef(new Map<string, number>());

  /**
   * Daftar diurut ulang tiap tebakan masuk. Tanpa animasi, baris-baris
   * "berteleportasi" dan pemain kehilangan jejak kata yang tadi dilihatnya —
   * jadi tiap baris digeser balik ke posisi lamanya lalu dilepas ke posisi baru.
   *
   * `offsetTop` dipakai, bukan `getBoundingClientRect`, karena halaman ikut
   * bergeser saat daftar bertambah panjang dan koordinat viewport jadi menipu.
   */
  useLayoutEffect(() => {
    const current = new Map<string, number>();

    rows.current.forEach((row, word) => {
      const top = row.offsetTop;
      current.set(word, top);

      const previous = lastTop.current.get(word);
      if (reduced || previous === undefined) return;

      const shift = previous - top;
      if (Math.abs(shift) < 1) return;

      row.animate(
        [{ transform: `translateY(${shift}px)` }, { transform: 'translateY(0)' }],
        { duration: SHIFT_MS, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
      );
    });

    lastTop.current = current;
  }, [guesses, reduced]);

  if (guesses.length === 0) {
    return (
      <p className="empty">
        Riwayat tebakanmu muncul di sini, diurutkan dari yang paling dekat maknanya.
      </p>
    );
  }

  return (
    <ol className="guesses" aria-label="Riwayat tebakan">
      {guesses.map((guess) => {
        const isLatest =
          guess.word === latestWord &&
          (!guess.players || guess.players.some((p) => p.id === latestPlayerId));

        return (
          <li
            key={guess.word}
            ref={(node) => {
              if (node) rows.current.set(guess.word, node);
              else rows.current.delete(guess.word);
            }}
            className={`guess${isLatest ? ' guess--latest' : ''}`}
            data-temp={guess.temperature}
          >
            <span className="guess__order caption tnum">{guess.order}</span>
            <span className="guess__word">
              {guess.word}
              {guess.players && guess.players.length > 0 && (
                <span className="guess__players">
                  {guess.players.map((player) => (
                    <span className="guess__player caption" key={player.id}>
                      {playerAvatars?.get(player.id) && (
                        <Avatar config={playerAvatars.get(player.id)!} size={14} />
                      )}
                      {player.name}
                    </span>
                  ))}
                </span>
              )}
            </span>

            <span className="guess__bar" aria-hidden="true">
              <span className="guess__bar-fill" style={{ width: `${guess.closeness}%` }} />
            </span>

            <span className="guess__rank caption tnum">
              {guess.temperature === 'correct'
                ? '—'
                : guess.rank !== null
                  ? `#${guess.rank}`
                  : `>${poolSize}`}
            </span>

            <span className="badge">
              <span className="badge__dot" />
              {TEMPERATURE_LABEL[guess.temperature]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
