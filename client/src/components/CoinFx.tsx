import { useEffect, useState, type CSSProperties } from 'react';
import { between, usePrefersReducedMotion } from '../lib/motion.ts';
import { subscribeCoinFx, type CoinFxEvent } from '../lib/coinFx.ts';

const LIFE_MS = 650;

/**
 * Lapisan tetap selebar viewport, dipasang sekali di `App.tsx`. Tiap event
 * dari `fireCoinFx` menetas jadi beberapa ikon koin yang terbang dari chip
 * saldo di header menuju tombol powerup yang baru dibeli, lalu menghilang.
 */
export function CoinFxLayer() {
  const [events, setEvents] = useState<CoinFxEvent[]>([]);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    return subscribeCoinFx((event) => {
      setEvents((current) => [...current, event]);
      window.setTimeout(() => {
        setEvents((current) => current.filter((e) => e.id !== event.id));
      }, LIFE_MS + 300);
    });
  }, [reduced]);

  if (reduced || events.length === 0) return null;

  return (
    <div className="coin-fx-layer" aria-hidden="true">
      {events.map((event) =>
        Array.from({ length: event.count }, (_, i) => {
          // Sedikit sebaran acak di titik asal & tenggang waktu supaya
          // koinnya terlihat sebagai serombongan, bukan satu garis kaku.
          const originX = event.from.x + between(-16, 16);
          const originY = event.from.y + between(-10, 10);
          const style: CSSProperties = {
            left: originX,
            top: originY,
            '--dx': `${event.to.x - originX}px`,
            '--dy': `${event.to.y - originY}px`,
            '--delay': `${i * 45}ms`,
          } as CSSProperties;
          return <img key={`${event.id}-${i}`} src="/coin.svg" className="coin-fx" style={style} alt="" />;
        }),
      )}
    </div>
  );
}
