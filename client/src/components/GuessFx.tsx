import { useMemo, type CSSProperties } from 'react';
import { between, heatFamily, usePrefersReducedMotion } from '../lib/motion.ts';
import type { GuessFx } from '../lib/useGuessFx.ts';

/* ---------------------------------------------------------------- partikel */

interface Particle {
  shape: 'ember' | 'shard' | 'confetti';
  style: CSSProperties;
}

/** Warna serpihan kemenangan — seluruh spektrum suhu ikut merayakan. */
const WIN_COLORS = [
  'var(--correct)',
  'var(--warm)',
  'var(--hot)',
  'var(--cool)',
  'var(--cold)',
  'var(--very-hot)',
];

function vars(record: Record<string, string>): CSSProperties {
  return record as CSSProperties;
}

function buildParticles(fx: GuessFx, base: number): Particle[] {
  const family = heatFamily(fx.temperature);

  // Lonjakan kedekatan yang besar layak dirayakan lebih ramai daripada
  // kemajuan satu-dua angka.
  const bonus = Math.min(8, Math.round(fx.delta / 7));
  const total = family === 'correct' ? 30 : base + bonus;

  return Array.from({ length: total }, (): Particle => {
    if (family === 'correct') {
      const angle = between(0, Math.PI * 2);
      const radius = between(70, 190);
      return {
        shape: 'confetti',
        style: vars({
          '--dx': `${Math.cos(angle) * radius}px`,
          '--dy': `${Math.sin(angle) * radius - 30}px`,
          '--rot': `${between(-540, 540)}deg`,
          '--sz': `${between(5, 9).toFixed(1)}px`,
          '--life': `${Math.round(between(760, 1250))}ms`,
          '--delay': `${Math.round(between(0, 140))}ms`,
          '--spark': WIN_COLORS[Math.floor(Math.random() * WIN_COLORS.length)],
        }),
      };
    }

    if (family === 'warm') {
      // Bara: naik, menyempit, sedikit goyang ke samping.
      return {
        shape: 'ember',
        style: vars({
          '--dx': `${between(-26, 26).toFixed(1)}px`,
          '--dy': `${between(-78, -34).toFixed(1)}px`,
          '--rot': '0deg',
          '--sz': `${between(3, 6).toFixed(1)}px`,
          '--life': `${Math.round(between(680, 1080))}ms`,
          '--delay': `${Math.round(between(0, 220))}ms`,
          '--spark': 'var(--temp-color, var(--warm))',
        }),
      };
    }

    // Serpihan es: melayang turun pelan sambil berputar.
    return {
      shape: 'shard',
      style: vars({
        '--dx': `${between(-34, 34).toFixed(1)}px`,
        '--dy': `${between(16, 48).toFixed(1)}px`,
        '--rot': `${between(-200, 200)}deg`,
        '--sz': `${between(3, 5.5).toFixed(1)}px`,
        '--life': `${Math.round(between(900, 1400))}ms`,
        '--delay': `${Math.round(between(0, 240))}ms`,
        '--spark': 'var(--temp-color, var(--cold))',
      }),
    };
  });
}

/**
 * Semburan partikel di titik tertentu. Elemen induk harus `position: relative`
 * — partikel memancar dari titik (0, 0) miliknya.
 */
export function Sparks({ fx, count = 9 }: { fx: GuessFx | null; count?: number }) {
  const reduced = usePrefersReducedMotion();
  const particles = useMemo(() => (fx ? buildParticles(fx, count) : []), [fx, count]);

  if (!fx || reduced || particles.length === 0) return null;

  return (
    <span className="fx-sparks" key={fx.id} aria-hidden="true">
      {particles.map((particle, index) => (
        <span key={index} className={`fx-spark fx-spark--${particle.shape}`} style={particle.style} />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------- lapis layar */

/**
 * Efek selebar layar: kilat warna suhu tiap tebakan, dan semburan kemenangan
 * saat kata rahasianya ketemu. Selalu di belakang modal dan toast.
 */
export function GuessFxLayer({ fx }: { fx: GuessFx | null }) {
  const reduced = usePrefersReducedMotion();
  if (!fx || reduced) return null;

  return (
    <div className="fx-layer" data-temp={fx.temperature} aria-hidden="true">
      <span
        key={`flash-${fx.id}`}
        className={`fx-flash${fx.correct ? ' fx-flash--win' : ''}${
          fx.improved && !fx.correct ? ' fx-flash--improved' : ''
        }`}
      />

      {fx.correct && (
        <span key={`burst-${fx.id}`} className="fx-burst">
          <span className="fx-ring" />
          <span className="fx-ring fx-ring--late" />
          <Sparks fx={fx} />
        </span>
      )}
    </div>
  );
}
