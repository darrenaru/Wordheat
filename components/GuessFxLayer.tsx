"use client";

import { useMemo } from "react";
import { heatColor, heatLevel } from "@/lib/heat";
import { between, usePrefersReducedMotion, type GuessFx } from "@/lib/motion";

type Particle = {
  shape: "ember" | "shard" | "confetti";
  style: React.CSSProperties;
};

/** Confetti kemenangan memakai spektrum aksen situs, bukan warna panas tunggal -- perayaan, bukan pengukuran. */
const WIN_COLORS = ["var(--color-flare)", "var(--color-ember)", "var(--color-gold)"];

function buildParticles(fx: GuessFx, color: string, base: number): Particle[] {
  if (fx.family === "correct") {
    return Array.from({ length: 26 }, (): Particle => {
      const angle = between(0, Math.PI * 2);
      const radius = between(70, 190);
      return {
        shape: "confetti",
        style: {
          "--dx": `${Math.cos(angle) * radius}px`,
          "--dy": `${Math.sin(angle) * radius - 30}px`,
          "--rot": `${between(-540, 540)}deg`,
          "--sz": `${between(5, 9).toFixed(1)}px`,
          "--life": `${Math.round(between(760, 1250))}ms`,
          "--delay": `${Math.round(between(0, 140))}ms`,
          "--spark": WIN_COLORS[Math.floor(Math.random() * WIN_COLORS.length)],
        } as React.CSSProperties,
      };
    });
  }

  if (fx.family === "warm") {
    // Bara: naik, menyempit, sedikit goyang ke samping.
    return Array.from({ length: base }, (): Particle => ({
      shape: "ember",
      style: {
        "--dx": `${between(-26, 26).toFixed(1)}px`,
        "--dy": `${between(-78, -34).toFixed(1)}px`,
        "--rot": "0deg",
        "--sz": `${between(3, 6).toFixed(1)}px`,
        "--life": `${Math.round(between(680, 1080))}ms`,
        "--delay": `${Math.round(between(0, 220))}ms`,
        "--spark": color,
      } as React.CSSProperties,
    }));
  }

  // Serpihan es: melayang turun pelan sambil berputar.
  return Array.from({ length: base }, (): Particle => ({
    shape: "shard",
    style: {
      "--dx": `${between(-34, 34).toFixed(1)}px`,
      "--dy": `${between(16, 48).toFixed(1)}px`,
      "--rot": `${between(-200, 200)}deg`,
      "--sz": `${between(3, 5.5).toFixed(1)}px`,
      "--life": `${Math.round(between(900, 1400))}ms`,
      "--delay": `${Math.round(between(0, 240))}ms`,
      "--spark": color,
    } as React.CSSProperties,
  }));
}

/**
 * Umpan balik seluruh layar untuk satu tebakan: kilatan warna suhu, plus
 * semburan partikel -- bara/serpihan es untuk tebakan biasa, confetti dan
 * cincin memuai saat kata rahasianya ketemu. Warnanya diambil dari fungsi
 * suhu yang sama dipakai baris tebakan (`lib/heat.ts`), jadi kilatan layar
 * tidak pernah berseberangan dengan warna baris yang baru saja masuk.
 */
export default function GuessFxLayer({ fx, vocabSize }: { fx: GuessFx | null; vocabSize: number }) {
  const reduced = usePrefersReducedMotion();
  const level = fx ? heatLevel(fx.rank, vocabSize) : 0;
  const color = fx ? heatColor(level, "dark") : "";
  const particles = useMemo(
    () => (fx && !reduced ? buildParticles(fx, color, fx.family === "warm" ? 6 : 5) : []),
    [fx, color, reduced],
  );

  if (!fx || reduced) return null;

  return (
    <div className="guess-fx-layer" aria-hidden="true">
      <span
        key={`flash-${fx.id}`}
        className={`guess-fx-flash guess-fx-flash--${fx.family}`}
        style={{ "--fx-color": color } as React.CSSProperties}
      />

      <span key={`sparks-${fx.id}`} className="guess-fx-sparks">
        {particles.map((particle, index) => (
          <span
            key={index}
            className={`guess-fx-spark guess-fx-spark--${particle.shape}`}
            style={particle.style}
          />
        ))}
      </span>

      {fx.correct && (
        <span key={`burst-${fx.id}`} className="guess-fx-burst">
          <span className="guess-fx-ring" />
          <span className="guess-fx-ring guess-fx-ring--late" />
        </span>
      )}
    </div>
  );
}
