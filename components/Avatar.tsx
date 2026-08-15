import { avatarSrc, type AvatarChoices } from "@/lib/avatar";

type Props = {
  seed?: string;
  bg?: string;
  choices?: AvatarChoices;
  name: string;
  size?: number;
  className?: string;
};

/**
 * Avatar profil.
 *
 * Gambarnya SVG yang dilayani route kita sendiri, jadi dipasang lewat <img>
 * biasa alih-alih next/image: tidak ada yang perlu dioptimalkan, dan
 * ukurannya sudah ditentukan lewat parameter permintaan.
 */
export default function Avatar({ seed, bg, choices, name, size = 40, className }: Props) {
  // Tamu tanpa profil tetap butuh penanda visual, jadi dipakai inisial namanya.
  if (!seed || !bg) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
        className={`grid shrink-0 place-items-center rounded-full border border-[var(--line)] font-bold text-[var(--muted)] ${className ?? ""}`}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }

  return (
    <img
      src={avatarSrc({ seed, bg, ...choices }, size * 2)}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full border border-[var(--line)] object-cover ${className ?? ""}`}
      loading="lazy"
    />
  );
}
