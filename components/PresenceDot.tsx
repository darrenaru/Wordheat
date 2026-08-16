import type { AccountStatus } from "@/lib/profile";

const LABEL: Record<AccountStatus, string> = {
  online: "Online",
  idle: "Jauh dari keyboard",
  "in-game": "Sedang bermain",
  offline: "Offline",
};

const DOT_CLASS: Record<AccountStatus, string> = {
  online: "bg-flare",
  idle: "bg-gold",
  "in-game": "bg-ember",
  offline: "bg-[var(--muted)]",
};

/**
 * Indikator status keaktifan pemain: Online, Idle, Sedang bermain, atau
 * Offline. Warna tidak pernah jadi satu-satunya penanda -- selalu ada
 * `title`/`aria-label` berisi label di atas, supaya tetap terbaca walau
 * warnanya sulit dibedakan.
 */
export default function PresenceDot({
  status,
  withLabel = false,
  className,
}: {
  status: AccountStatus;
  /** Tampilkan teks label di sebelah dot -- dipakai saat tata letak punya ruang. */
  withLabel?: boolean;
  className?: string;
}) {
  const label = LABEL[status];

  if (withLabel) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT_CLASS[status]}`} />
        <span className="text-[12px] text-[var(--muted)]">{label}</span>
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-block size-2.5 shrink-0 rounded-full border-2 border-[var(--bg)] ${DOT_CLASS[status]} ${className ?? ""}`}
    />
  );
}
