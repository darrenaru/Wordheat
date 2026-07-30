import { useEffect, useRef } from 'react';
import { TEMPERATURE_LABEL, type Guess } from '@shared/types.ts';
import { heatFamily, replayAnimation, usePrefersReducedMotion } from '../lib/motion.ts';
import type { GuessFx } from '../lib/useGuessFx.ts';
import { Sparks } from './GuessFx.tsx';

interface HeatMeterProps {
  guess: Guess | null;
  poolSize: number;
  /** Kejadian animasi untuk tebakan terakhir. */
  fx?: GuessFx | null;
}

/**
 * Indikator suhu untuk tebakan terakhir.
 *
 * Warna tidak pernah jadi satu-satunya pembawa informasi: label teks, angka
 * peringkat, dan panjang bar semuanya menyampaikan hal yang sama. Animasi di
 * atasnya murni penekanan — hilang tanpa sisa saat pemain meminta gerak minimal.
 */
export function HeatMeter({ guess, poolSize, fx = null }: HeatMeterProps) {
  const temperature = guess?.temperature ?? 'freezing';
  const fill = guess ? Math.max(guess.closeness, guess.closeness > 0 ? 3 : 0) : 0;
  const family = heatFamily(temperature);
  const reduced = usePrefersReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);

  // Rekor kedekatan baru: cincin sekali putar pada seluruh panel. Dipasang
  // lewat DOM, bukan state, supaya efek ini tidak ikut memicu render ulang.
  useEffect(() => {
    if (!fx?.improved || fx.correct || reduced) return;
    replayAnimation(rootRef.current, 'heat--record');
  }, [fx, reduced]);

  return (
    <div className="heat" data-temp={temperature} ref={rootRef}>
      <div className="heat__head">
        {guess ? (
          <>
            <span key={`w${fx?.id ?? 0}`} className={`heat__word heat__word--${family}`}>
              {guess.word}
            </span>
            <span key={`l${fx?.id ?? 0}`} className="heat__label heat__label--fx">
              {TEMPERATURE_LABEL[temperature]}
            </span>
          </>
        ) : (
          <span className="heat__idle muted">Belum ada tebakan</span>
        )}
      </div>

      <div className="heat__stage">
        <div
          className="heat__track"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fill)}
          aria-valuetext={
            guess
              ? `${guess.word}: ${TEMPERATURE_LABEL[temperature]}`
              : 'Belum ada tebakan'
          }
        >
          <div className="heat__scale" aria-hidden="true" />
          <div className="heat__fill" style={{ width: `${fill}%` }}>
            {fx && !reduced && <span key={`s${fx.id}`} className="fx-sweep" />}
          </div>
        </div>

        {/* Percikan dan angka lonjakan memancar dari ujung bar, yang bergerak
            dengan transisi identik supaya keduanya tidak pernah terpisah. */}
        <div className="heat__tip" style={{ left: `${fill}%` }} aria-hidden="true">
          <Sparks fx={fx} />
          {fx?.improved && fx.delta >= 1 && !fx.correct && (
            // Dekat ujung kanan, angka digeser ke kiri titik pancar supaya
            // tidak menabrak label suhu di pojok kartu.
            <span key={`d${fx.id}`} className="heat__delta-slot" data-edge={fill > 78}>
              <span className="heat__delta tnum">+{fx.delta}</span>
            </span>
          )}
        </div>
      </div>

      <div className="heat__foot caption tnum">
        {guess ? (
          guess.temperature === 'correct' ? (
            <span>Kata rahasianya ketemu.</span>
          ) : guess.rank !== null ? (
            <span>
              Peringkat <strong>{guess.rank}</strong> dari {poolSize} kata terdekat
            </span>
          ) : (
            <span>Di luar {poolSize} kata terdekat</span>
          )
        ) : (
          <span>Ketik satu kata untuk mulai.</span>
        )}
      </div>
    </div>
  );
}
