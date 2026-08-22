import Link from "next/link";

export type ModeCardProps = {
  /** Ikon garis 24×24; dipakai apa adanya di dalam <svg> pembungkus. */
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  /** Warna aksen ikon dan panah, membedakan satu kartu dari yang lain. */
  accent: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Baris kecil di kaki kartu, misalnya tanggal kata harian. */
  footnote?: string;
  /** Kartu unggulan: lebih besar, berdiri sendiri di baris atas grid. */
  featured?: boolean;
};

/**
 * Satu pintu masuk ke sebuah mode permainan.
 *
 * Sengaja dibuat seragam dan digerakkan data supaya menambah fitur baru cukup
 * menambah satu entri di daftar kartu, bukan menyusun ulang tata letaknya.
 */
export default function ModeCard({
  icon,
  title,
  description,
  action,
  accent,
  href,
  onClick,
  disabled,
  footnote,
  featured,
}: ModeCardProps) {
  const body = (
    <>
      <span
        aria-hidden="true"
        style={{ color: accent }}
        className="block"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={featured ? "size-7" : "size-6"}
        >
          {icon}
        </svg>
      </span>

      <span
        className={
          featured
            ? "mt-4 block text-[26px] font-bold tracking-[-0.01em]"
            : "mt-3 block text-[19px] font-bold tracking-[-0.01em]"
        }
      >
        {title}
      </span>
      <span
        className={
          featured
            ? "mt-1.5 block max-w-[28rem] text-[14px] leading-relaxed text-[var(--muted)]"
            : "mt-1 block text-[13px] leading-relaxed text-[var(--muted)]"
        }
      >
        {description}
      </span>

      <span className="mt-auto flex items-baseline gap-1.5 pt-4 text-[14px] font-bold" style={{ color: accent }}>
        {action}
        <span aria-hidden="true" className="mode-card__arrow">
          →
        </span>
      </span>

      {footnote && (
        <span className="mt-2 block font-mono text-[11px] tracking-[0.1em] text-[var(--muted)]">
          {footnote}
        </span>
      )}
    </>
  );

  const className = `mode-card group flex h-full flex-col rounded-xl border border-[var(--line)] bg-[var(--card)] text-left disabled:opacity-50 ${
    featured ? "p-6 sm:p-7" : "p-5"
  }`;
  const style = { "--accent": accent } as React.CSSProperties;

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className} style={style}>
      {body}
    </button>
  );
}
