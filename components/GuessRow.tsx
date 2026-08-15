import {
  heatColor,
  heatFill,
  heatHalo,
  heatLabel,
  heatLevel,
  heatTextColor,
} from "@/lib/heat";

type Props = {
  word: string;
  rank: number;
  vocabSize: number;
  /** Baru ditebak barusan: hanya baris ini yang beranimasi. */
  fresh?: boolean;
  /** Menyalakan animasi kemenangan sekali jalan. */
  flare?: boolean;
  /** Tampilkan label suhu; dipakai pada baris sorotan, bukan di daftar. */
  showLabel?: boolean;
  /** Nama penebak, ditampilkan di papan bersama mode multiplayer. */
  by?: string;
};

export default function GuessRow({
  word,
  rank,
  vocabSize,
  fresh,
  flare,
  showLabel,
  by,
}: Props) {
  const level = heatLevel(rank, vocabSize);
  const solved = rank === 1;

  // Kedua tema dihitung sekaligus. Stylesheet yang memilih salah satunya,
  // sehingga berganti tema langsung terlihat tanpa menunggu render ulang.
  const style = {
    "--fill": `${heatFill(level)}%`,
    "--heat-dark": heatColor(level, "dark"),
    "--heat-light": heatColor(level, "light"),
    "--on-heat-dark": heatTextColor(level, "dark"),
    "--on-heat-light": heatTextColor(level, "light"),
    "--halo-dark": `${heatHalo(level)}px`,
  } as React.CSSProperties;

  const line = (
    <>
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-[17px] font-medium tracking-tight">{word}</span>
        {by && (
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] opacity-80">
            {by}
          </span>
        )}
      </span>
      {/* Label dan angka dikelompokkan di kanan. Kalau label diletakkan tepat
          setelah kata, tepi isian sering jatuh di tengah label dan
          memotongnya jadi dua warna. */}
      <span className="flex items-baseline gap-2.5 font-mono">
        {showLabel && (
          <span className="text-[11px] uppercase tracking-[0.14em] opacity-70">
            {heatLabel(rank)}
          </span>
        )}
        <span className="text-[15px] tabular-nums">{rank.toLocaleString("id-ID")}</span>
      </span>
    </>
  );

  return (
    <div
      className="guess-row"
      style={style}
      data-fresh={fresh}
      data-flare={flare}
      data-solved={solved}
    >
      <div className="row-line">{line}</div>
      <div className="row-line row-line-lit" aria-hidden="true">
        {line}
      </div>
    </div>
  );
}
