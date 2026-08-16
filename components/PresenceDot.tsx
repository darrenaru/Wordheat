import { GamepadIcon } from "@/components/icons";
import type { AccountStatus } from "@/lib/profile";

const LABEL: Record<AccountStatus, string> = {
  online: "Online",
  idle: "Jauh dari keyboard",
  "in-game": "Sedang bermain",
  offline: "Offline",
};

/** Titik polos untuk online/idle/offline -- warna lembut, bukan warna aksen tajam milik sisa antarmuka. */
const DOT_CLASS: Record<"online" | "idle" | "offline", string> = {
  online: "bg-green-400",
  idle: "bg-amber-300",
  offline: "bg-[var(--muted)]",
};

/**
 * Indikator status keaktifan pemain: Online, Idle, Sedang bermain, atau
 * Offline. "Sedang bermain" digambar sebagai ikon gamepad (bukan titik
 * polos) supaya langsung terbaca beda dari sekadar "online" -- warna
 * sendiri tidak pernah jadi satu-satunya penanda, selalu ada
 * `title`/`aria-label` berisi label di atas.
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

  const indicator =
    status === "in-game" ? (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3 shrink-0 text-green-400"
      >
        {GamepadIcon}
      </svg>
    ) : (
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT_CLASS[status]}`} />
    );

  if (withLabel) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
        {indicator}
        <span className="text-[12px] text-[var(--muted)]">{label}</span>
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center ${
        status === "in-game"
          ? "size-4 rounded-full bg-[var(--bg)]"
          : "size-2.5 rounded-full border-2 border-[var(--bg)]"
      } ${status === "in-game" ? "" : DOT_CLASS[status]} ${className ?? ""}`}
    >
      {status === "in-game" && (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 text-green-400"
        >
          {GamepadIcon}
        </svg>
      )}
    </span>
  );
}
