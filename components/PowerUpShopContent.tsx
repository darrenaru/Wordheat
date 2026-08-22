"use client";

import { useState } from "react";

import { useAccount } from "@/components/AccountProvider";
import { RevealDigitsIcon, RevealInitialIcon, TargetIcon } from "@/components/icons";
import { POWER_UP_CATALOG, POWER_UP_KINDS, type PowerUpKind } from "@/lib/powerup-catalog";

const ICONS: Record<PowerUpKind, React.ReactNode> = {
  reveal_initial: RevealInitialIcon,
  reveal_digits: RevealDigitsIcon,
  closest_guess: TargetIcon,
};

/** Warna aksen per Power-Up, sama polanya dengan tiga ModeCard di beranda. */
const ACCENTS: Record<PowerUpKind, string> = {
  reveal_initial: "var(--accent-warm)",
  reveal_digits: "var(--accent-gold)",
  closest_guess: "var(--accent-hot)",
};

/**
 * Isi Toko Power-Up: saldo + kartu-kartu pembelian. Dipisah dari
 * PowerUpShop.tsx (halaman penuh /shop) supaya bisa dipakai ulang persis
 * sama di PowerUpShopModal.tsx (dibuka di atas papan permainan, tanpa
 * meninggalkan game).
 */
export default function PowerUpShopContent() {
  const { me } = useAccount();
  const [busy, setBusy] = useState<PowerUpKind | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const buy = async (kind: PowerUpKind) => {
    if (busy) return;
    setBusy(kind);
    setNotice(null);
    try {
      const res = await fetch("/api/shop/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(
          data?.error === "insufficient-funds" ? "Coin kamu tidak cukup." : "Pembelian gagal.",
        );
        return;
      }
      // Saldo dan stok terbaru sampai lewat aliran /api/me/stream.
    } finally {
      setBusy(null);
    }
  };

  const coins = me?.coins ?? 0;

  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--line)] bg-[var(--card)] px-5 py-3.5">
        <p className="text-[13px] font-bold text-[var(--muted)]">Saldo</p>
        <span className="flex items-center gap-1.5 font-mono text-[17px] font-bold">
          <img src="/coin.svg" alt="" width={20} height={20} aria-hidden="true" />
          {coins.toLocaleString("id-ID")}
        </span>
      </div>

      {notice && <p className="text-[13px] text-flare">{notice}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {POWER_UP_KINDS.map((kind) => {
          const entry = POWER_UP_CATALOG[kind];
          const owned = me?.powerUps[kind] ?? 0;
          const affordable = coins >= entry.cost;
          const accent = ACCENTS[kind];
          return (
            <div
              key={kind}
              className="mode-card flex h-full flex-col rounded-xl border border-[var(--line)] bg-[var(--card)] p-5"
              style={{ "--accent": accent } as React.CSSProperties}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-6"
                style={{ color: accent }}
              >
                {ICONS[kind]}
              </svg>

              <p className="mt-3 text-[16px] font-bold tracking-[-0.01em]">{entry.label}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                {entry.description}
              </p>
              <p className="mt-2 font-mono text-[11px] tracking-[0.1em] text-[var(--muted)]">
                DIMILIKI {owned}
              </p>

              <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                <span className="flex items-center gap-1 font-mono text-[13px] font-bold" style={{ color: accent }}>
                  <img src="/coin.svg" alt="" width={14} height={14} aria-hidden="true" />
                  {entry.cost}
                </span>
                <button
                  type="button"
                  onClick={() => void buy(kind)}
                  disabled={!affordable || busy !== null}
                  className="shrink-0 rounded-pill bg-[var(--btn-bg)] px-4 py-2 text-[13px] font-bold text-[var(--btn-fg)] disabled:opacity-40"
                >
                  {busy === kind ? "…" : "Beli"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
