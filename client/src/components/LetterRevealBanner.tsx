interface LetterRevealBannerProps {
  /** Huruf pertama kata rahasia yang sudah dibuka lewat powerup. */
  letter: string;
  /** Panjang kata rahasia — dipakai menentukan jumlah kotak placeholder. */
  wordLength: number;
}

/**
 * Bocoran huruf pertama ditampilkan sebagai kotak-kotak kata (huruf terbuka
 * + placeholder untuk sisa huruf, mis. "M ␣ ␣ ␣ ␣"), BUKAN sekadar teks
 * sekali lewat — supaya posisi huruf & panjang kata tetap terlihat selama
 * pemain menebak, sama seperti papan tebakan di bawahnya yang juga
 * persisten. Dipakai di `SoloScreen`/`RoomScreen`, ditaruh tepat di atas
 * `GuessList`.
 */
export function LetterRevealBanner({ letter, wordLength }: LetterRevealBannerProps) {
  const tiles = Array.from({ length: Math.max(1, wordLength) }, (_, i) => (i === 0 ? letter : null));

  return (
    <div className="letter-reveal">
      <span className="letter-reveal__label">Bocoran huruf pertama</span>
      <div className="letter-reveal__tiles">
        {tiles.map((ch, i) => (
          <span
            key={i}
            className={`letter-reveal__tile${ch ? '' : ' letter-reveal__tile--empty'}`}
            aria-hidden={ch ? undefined : true}
          >
            {ch ? ch.toUpperCase() : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
