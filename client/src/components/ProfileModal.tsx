import { useEffect, useState, useSyncExternalStore } from 'react';
import type { PlayerProfile, PlayerStats } from '@shared/types.ts';
import { xpProgress } from '@shared/xp.ts';
import { api, ApiFailure } from '../lib/api.ts';
import {
  getAuthSession,
  isAuthAvailable,
  signInWithGoogle,
  signOut,
  subscribeAuth,
} from '../lib/supabase.ts';
import { Avatar } from './Avatar.tsx';
import { CheckIcon, CloseIcon, EditIcon, GoogleIcon, Modal } from './ui.tsx';
import { AvatarStudio } from '../screens/AvatarStudio.tsx';

interface ProfileModalProps {
  profile: PlayerProfile;
  onSave(profile: PlayerProfile): void;
  onClose(): void;
}

/**
 * Pusat pengaturan akun. Ubah avatar sengaja tidak ditaruh di sini sebagai
 * field biasa — pemilihan bagian wajah butuh ruang sendiri (lihat
 * `AvatarStudio`), jadi di sini cuma ada tombol yang membuka tampilan itu
 * di atas modal ini, lalu kembali ke sini begitu selesai.
 */
export function ProfileModal({ profile, onSave, onClose }: ProfileModalProps) {
  const [draft, setDraft] = useState<PlayerProfile>(profile);
  const [showAvatarStudio, setShowAvatarStudio] = useState(false);

  const dirty = draft.name !== profile.name || draft.avatar !== profile.avatar;

  const save = () => {
    onSave({ ...draft, name: draft.name.trim() || 'Pemain' });
    onClose();
  };

  if (showAvatarStudio) {
    return (
      <AvatarStudio
        avatar={draft.avatar}
        onSave={(avatar) => setDraft({ ...draft, avatar })}
        onClose={() => setShowAvatarStudio(false)}
      />
    );
  }

  return (
    <Modal
      title="Profil Saya"
      onClose={onClose}
      footer={
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn--secondary" onClick={onClose}>
            Batal
          </button>
          <button
            className="btn btn--primary"
            style={{ flex: 1 }}
            onClick={save}
            disabled={!dirty}
          >
            Simpan
          </button>
        </div>
      }
    >
      <div className="stack">
        <div className="profile__avatar-row">
          <Avatar config={draft.avatar} size={84} square alt="Avatar kamu" />
          <div className="field">
            <label className="field__label" htmlFor="display-name">
              Display Name
            </label>
            <input
              id="display-name"
              className="input"
              value={draft.name}
              maxLength={18}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Nama kamu"
            />
            <button
              className="btn btn--ghost btn--sm"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setShowAvatarStudio(true)}
            >
              <EditIcon />
              Ubah Avatar
            </button>
          </div>
        </div>

        <UsernameField displayName={profile.name} avatar={profile.avatar} />

        <hr className="divider" />

        <StatsSummaryField />

        {isAuthAvailable() && (
          <>
            <hr className="divider" />
            <AccountField />
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * Statistik pribadi (anonim maupun login, sama seperti coin) — dulu ada di
 * modal "Statistik" terpisah yang cuma bisa dibuka setelah login; sekarang
 * ditarik ke sini supaya satu-satunya tempat melihat statistik ya Profil
 * Saya, dan Guest pun bisa melihatnya.
 */
function StatsSummaryField() {
  const [stats, setStats] = useState<PlayerStats | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    api
      .stats()
      .then((result) => {
        if (alive) setStats(result);
      })
      .catch(() => {
        if (alive) setStats(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const avgGuesses =
    stats && stats.totalGames > 0 ? (stats.totalGuesses / stats.totalGames).toFixed(1) : '—';

  return (
    <div className="field">
      <span className="field__label">Statistik</span>
      {stats === undefined && <p className="caption">Memuat...</p>}
      {stats === null && <p className="caption">Belum ada statistik tercatat.</p>}
      {stats && (
        <>
          <XpBar xp={stats.xp} />

          <dl className="profile__stats">
            <div className="profile__stat">
              <dt className="caption">Total main</dt>
              <dd className="tnum">{stats.totalGames}</dd>
            </div>
            <div className="profile__stat">
              <dt className="caption">Menang</dt>
              <dd className="tnum">{stats.totalWins}</dd>
            </div>
            <div className="profile__stat">
              <dt className="caption">Rata-rata tebakan</dt>
              <dd className="tnum">{avgGuesses}</dd>
            </div>
            <div className="profile__stat">
              <dt className="caption">Tebakan tersedikit</dt>
              <dd className="tnum">{stats.bestGuessCount ?? '—'}</dd>
            </div>
            <div className="profile__stat">
              <dt className="caption">Streak sekarang</dt>
              <dd className="tnum">{stats.currentStreak}</dd>
            </div>
            <div className="profile__stat">
              <dt className="caption">Streak terpanjang</dt>
              <dd className="tnum">{stats.longestStreak}</dd>
            </div>
          </dl>
        </>
      )}
    </div>
  );
}

/**
 * Progres level — dihitung dari `stats.xp` lewat kurva di `shared/xp.ts`,
 * tidak ada kolom "level" terpisah di database supaya tidak ada dua sumber
 * kebenaran yang bisa tidak sinkron.
 */
function XpBar({ xp }: { xp: number }) {
  const progress = xpProgress(xp);
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
    </div>
  );
}

/**
 * Login/logout Google langsung dari Profil Saya — tombol yang sama
 * berganti peran mengikuti status sesi, dipakai ulang persis fungsi yang
 * sudah dipakai `AuthModal`/`WelcomeModal` (masuk) dan `StatsModal`
 * (keluar), cuma ditempatkan di sini supaya tidak perlu buka modal lain.
 */
function AccountField() {
  const session = useSyncExternalStore(subscribeAuth, getAuthSession, () => null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    setError(null);
    setBusy(true);
    // Tidak ada `finally` yang mematikan `busy`: berhasil berarti halaman
    // ini langsung ditinggalkan ke Google. Cuma direset kalau Supabase
    // menolak sebelum sempat redirect.
    const failure = await signInWithGoogle();
    if (failure) {
      setError(failure);
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
  };

  return (
    <div className="field">
      <span className="field__label">Akun</span>
      {session ? (
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <p className="caption" style={{ flex: 1, minWidth: 0, margin: 0 }}>
            {session.user.email}
          </p>
          <button className="btn btn--ghost btn--sm" onClick={logout} disabled={busy}>
            {busy ? 'Keluar...' : 'Logout'}
          </button>
        </div>
      ) : (
        <>
          <p className="caption">Kamu main sebagai Guest.</p>
          <button className="btn btn--secondary btn--block" onClick={login} disabled={busy}>
            <GoogleIcon />
            {busy ? 'Membuka Google...' : 'Login dengan Google'}
          </button>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

/**
 * Identitas unik yang dipakai teman untuk menemukanmu lewat Add Friend —
 * diperiksa dan disimpan otomatis begitu pemain berhenti mengetik sejenak
 * (tanpa tombol Simpan terpisah), ikon berputar menandai lagi diperiksa.
 */
function UsernameField({ displayName, avatar }: { displayName: string; avatar: PlayerProfile['avatar'] }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .username()
      .then((current) => {
        if (!alive) return;
        setValue(current ?? '');
        setSaved(current);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const trimmed = value.trim();

  useEffect(() => {
    if (trimmed === (saved ?? '') || trimmed.length < 3) {
      setError(null);
      setBusy(false);
      return;
    }
    let alive = true;
    setError(null);
    setBusy(true);
    const timer = window.setTimeout(async () => {
      try {
        await api.setUsername(trimmed, displayName, avatar);
        if (alive) setSaved(trimmed);
      } catch (err) {
        if (alive) setError(err instanceof ApiFailure ? err.message : 'Gagal menyimpan username.');
      } finally {
        if (alive) setBusy(false);
      }
    }, 600);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed]);

  return (
    <div className="field">
      <label className="field__label" htmlFor="username">
        Username
      </label>
      <div className="input-status">
        <input
          id="username"
          className="input"
          value={value}
          maxLength={20}
          onChange={(event) => setValue(event.target.value)}
          placeholder="username_kamu"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {busy && <span className="spinner" aria-hidden="true" />}
        {!busy && !error && saved !== null && trimmed === saved && trimmed.length >= 3 && (
          <span className="input-status__icon input-status__icon--ok" aria-hidden="true">
            <CheckIcon />
          </span>
        )}
        {!busy && error && (
          <span className="input-status__icon input-status__icon--error" aria-hidden="true">
            <CloseIcon />
          </span>
        )}
      </div>
      {error ? (
        <p className="form-error">{error}</p>
      ) : (
        <p className="caption">
          {saved
            ? 'Dipakai teman untuk menemukanmu lewat Add Friend.'
            : '3-20 karakter, diawali huruf, boleh angka/underscore.'}
        </p>
      )}
    </div>
  );
}
