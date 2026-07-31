import { xpProgress } from '@shared/xp.ts';

/**
 * Progres level — dihitung dari `xp` lewat kurva di `shared/xp.ts`, tidak
 * ada kolom "level" terpisah di database supaya tidak ada dua sumber
 * kebenaran yang bisa tidak sinkron. Dipakai `ProfileModal` (profil sendiri)
 * maupun `ViewProfileModal` (profil pemain lain) — widget-nya sama persis,
 * cuma `xp` yang beda sumbernya.
 */
export function XpBar({ xp }: { xp: number }) {
  const progress = xpProgress(xp);
  const remaining = progress.nextLevelXp - progress.xp;
  return (
    <div className="xp-summary">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="caption">Level {progress.level}</span>
        <span className="caption tnum">
          {progress.xp} / {progress.nextLevelXp} XP
        </span>
      </div>
      <div className="xp-bar">
        <span style={{ width: `${Math.round(progress.progress * 100)}%` }} />
      </div>
      <p className="xp-summary__caption">
        {remaining} XP lagi untuk naik ke <strong>Level {progress.level + 1}</strong>
      </p>
    </div>
  );
}
