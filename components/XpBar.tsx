import { xpProgress } from "@/lib/xp";

/** Progres XP menuju level berikutnya, dipakai di kartu profil (sendiri maupun pemain lain). */
export default function XpBar({ xp }: { xp: number }) {
  const progress = xpProgress(xp);
  const remaining = progress.nextLevelXp - progress.xp;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-bold">Level {progress.level}</span>
        <span className="font-mono text-[12px] text-[var(--muted)]">
          {progress.xp.toLocaleString("id-ID")} / {progress.nextLevelXp.toLocaleString("id-ID")} XP
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
        <span
          className="block h-full rounded-full bg-[var(--accent-gold)] transition-[width] duration-300"
          style={{ width: `${Math.round(progress.progress * 100)}%` }}
        />
      </div>
      <p className="text-center text-[12px] text-[var(--muted)]">
        {remaining.toLocaleString("id-ID")} XP lagi menuju{" "}
        <strong className="text-[var(--fg)]">Level {progress.level + 1}</strong>
      </p>
    </div>
  );
}
