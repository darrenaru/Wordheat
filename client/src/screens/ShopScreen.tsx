import { useRef, useState, useSyncExternalStore } from 'react';
import type { PowerupInventory } from '@shared/types.ts';
import { POWERUP_COSTS } from '@shared/types.ts';
import { api, ApiFailure } from '../lib/api.ts';
import { fireCoinFx } from '../lib/coinFx.ts';
import { applyInventory, getInventory, subscribeInventory } from '../lib/inventory.ts';
import { applyBalance, getBalance, subscribeWallet } from '../lib/wallet.ts';
import { EyeIcon, TargetIcon, useToast } from '../components/ui.tsx';

interface Powerup {
  key: keyof PowerupInventory;
  icon: () => React.ReactElement;
  accent: string;
  title: string;
  cost: number;
  body: string;
}

const POWERUPS: Powerup[] = [
  {
    key: 'nearestGuess',
    icon: TargetIcon,
    accent: 'var(--hot)',
    title: 'Tebak Terdekat',
    cost: POWERUP_COSTS.nearestGuess,
    body: 'Otomatis mengisi & mengirim kata terdekat yang belum pernah kamu tebak sebagai satu tebakan sungguhan. Selalu sedekat mungkin, tapi tidak menjamin langsung menang.',
  },
  {
    key: 'letterReveal',
    icon: EyeIcon,
    accent: 'var(--cool)',
    title: 'Bocoran Huruf',
    cost: POWERUP_COSTS.letterReveal,
    body: 'Membuka huruf pertama kata rahasia. Sekali pakai per ronde.',
  },
];

/**
 * Satu-satunya tempat coin ditukar jadi stok powerup. Efeknya sendiri
 * (tebak terdekat / buka huruf) baru dipakai kontekstual di dalam ronde
 * lewat tombol di `SoloScreen`/`RoomScreen` — di sana cuma mengurangi stok
 * yang sudah dibeli di sini, tidak pernah memotong coin lagi.
 */
export function ShopScreen() {
  const balance = useSyncExternalStore(subscribeWallet, getBalance, () => 0);
  const inventory = useSyncExternalStore(subscribeInventory, getInventory, () => ({
    nearestGuess: 0,
    letterReveal: 0,
  }));
  const [buying, setBuying] = useState<keyof PowerupInventory | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const toast = useToast();

  const buy = async (powerup: Powerup) => {
    setBuying(powerup.key);
    try {
      const result = await api.buyPowerup(powerup.key);
      applyBalance(result.balance);
      applyInventory(result.inventory);
      fireCoinFx(cardRefs.current.get(powerup.key) ?? null);
    } catch (error) {
      toast.show(error instanceof ApiFailure ? error.message : 'Gagal membeli powerup.', 'error');
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="stack" style={{ gap: 24 }}>
      <h1>Shop</h1>

      <div className="card">
        <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
          <img src="/coin.svg" width={28} height={28} alt="" />
          <span className="result__secret" style={{ fontSize: 28 }}>
            {balance}
          </span>
        </div>
        <p className="caption" style={{ textAlign: 'center', marginTop: 4 }}>
          Beli powerup di sini pakai coin hasil menang bermain. Stok yang sudah dibeli dipakai
          langsung di dalam ronde, lewat tombol di sebelah "Petunjuk"/"Menyerah".
        </p>
      </div>

      <div className="shop-grid">
        {POWERUPS.map((powerup) => (
          <div
            key={powerup.key}
            ref={(node) => {
              if (node) cardRefs.current.set(powerup.key, node);
              else cardRefs.current.delete(powerup.key);
            }}
            className="shop-item"
            style={{ '--accent': powerup.accent } as React.CSSProperties}
          >
            <div className="shop-item__head">
              <powerup.icon />
              <span className="badge badge--plain">Dimiliki {inventory[powerup.key]}</span>
            </div>
            <span className="shop-item__title">{powerup.title}</span>
            <p className="shop-item__body">{powerup.body}</p>
            <button
              className="btn btn--secondary"
              onClick={() => void buy(powerup)}
              disabled={balance < powerup.cost || buying === powerup.key}
            >
              <img src="/coin.svg" width={16} height={16} alt="" />
              Beli — {powerup.cost} coin
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
