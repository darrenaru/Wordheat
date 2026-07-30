import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

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
        dirty ? (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn--secondary" onClick={onClose}>
              Batal
            </button>
            <button className="btn btn--primary" style={{ flex: 1 }} onClick={save}>
              Simpan
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="stack">
        <div className="profile__identity">
          <button
            type="button"
            className="avatar-edit-btn"
            onClick={() => setShowAvatarStudio(true)}
            aria-label="Ubah avatar"
          >
            <Avatar config={draft.avatar} size={96} alt="Avatar kamu" />
            <span className="avatar-edit-btn__overlay" aria-hidden="true">
              <EditIcon />
            </span>
          </button>

          {editingName ? (
            <input
              ref={nameInputRef}
              id="display-name"
              className="identity-name"
              value={draft.name}
              maxLength={18}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              onBlur={() => setEditingName(false)}
              placeholder="Nama kamu"
              aria-label="Display Name"
              style={{ width: `${(draft.name.length || 'Nama kamu'.length) + 1.5}ch` }}
            />
          ) : (
            <div className="identity-editable">
              <span className="identity-name-display">{draft.name || 'Nama kamu'}</span>
              <button
                type="button"
                className="identity-editable__icon"
                onClick={() => setEditingName(true)}
                aria-label="Ubah Display Name"
              >
                <EditIcon />
              </button>
            </div>
          )}

          <UsernameField displayName={profile.name} avatar={profile.avatar} />
          <BioField displayName={profile.name} avatar={profile.avatar} />
        </div>

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

function cooldownMessage(changeableAt: string): string {
  const days = Math.max(1, Math.ceil((new Date(changeableAt).getTime() - Date.now()) / 86_400_000));
  return `Username cuma bisa diganti tiap 7 hari sekali. Coba lagi dalam ${days} hari.`;
}

/**
 * Identitas unik yang dipakai teman untuk menemukanmu lewat Add Friend —
 * diperiksa dan disimpan otomatis begitu pemain berhenti mengetik sejenak
 * (tanpa tombol Simpan terpisah), ikon berputar menandai lagi diperiksa.
 */
function UsernameField({ displayName, avatar }: { displayName: string; avatar: PlayerProfile['avatar'] }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [changeableAt, setChangeableAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    let alive = true;
    api
      .username()
      .then((current) => {
        if (!alive) return;
        setValue(current.username ?? '');
        setSaved(current.username);
        setChangeableAt(current.changeableAt);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const trimmed = value.trim();
  const locked = changeableAt !== null && new Date(changeableAt).getTime() > Date.now();

  useEffect(() => {
    if (trimmed === (saved ?? '') || trimmed.length < 3) {
      setError(null);
      setBusy(false);
      return;
    }
    // Cooldown dicek duluan di sini (sebelum debounce jalan) supaya pesannya
    // langsung muncul saat pengguna mencoba mengubah, bukan menunggu 600ms
    // cuma untuk dapat penolakan yang sudah pasti dari server.
    if (locked) {
      setError(cooldownMessage(changeableAt!));
      setBusy(false);
      return;
    }
    let alive = true;
    setError(null);
    setBusy(true);
    const timer = window.setTimeout(async () => {
      try {
        await api.setUsername(trimmed, displayName, avatar);
        if (alive) {
          setSaved(trimmed);
          // Server baru saja mencatat waktu ganti ini — 7 hari dari sekarang
          // dihitung ulang secara lokal, tidak perlu fetch ulang.
          setChangeableAt(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());
        }
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiFailure && err.code === 'cooldown') {
          setChangeableAt(err.changeableAt ?? null);
        }
        setError(err instanceof ApiFailure ? err.message : 'Gagal menyimpan username.');
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

  if (!editing) {
    return (
      <div className="identity-username">
        <div className="identity-editable">
          <span className="identity-username-display">@{saved || 'username_kamu'}</span>
          <button
            type="button"
            className="identity-editable__icon"
            onClick={() => setEditing(true)}
            aria-label="Ubah username"
          >
            <EditIcon />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="identity-username">
      <div className="identity-username__row">
        <span className="identity-username__at">@</span>
        <input
          ref={inputRef}
          id="username"
          className="identity-username__input"
          value={value}
          maxLength={20}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => setEditing(false)}
          placeholder="username_kamu"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Username"
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
      {error && (
        <p className="form-error" style={{ textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}

const BIO_MAX_LENGTH = 140;

/**
 * Bio bebas, tidak ada cooldown (beda dari username) — disimpan otomatis
 * begitu pemain berhenti mengetik sejenak, pola debounce sama seperti
 * `UsernameField` tapi tanpa validasi keunikan.
 */
function BioField({ displayName, avatar }: { displayName: string; avatar: PlayerProfile['avatar'] }) {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    let alive = true;
    api
      .bio()
      .then((bio) => {
        if (!alive) return;
        setValue(bio ?? '');
        setSaved(bio ?? '');
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const trimmed = value.trim();

  useEffect(() => {
    if (trimmed === saved) {
      setError(null);
      setBusy(false);
      return;
    }
    let alive = true;
    setError(null);
    setBusy(true);
    const timer = window.setTimeout(async () => {
      try {
        await api.setBio(trimmed, displayName, avatar);
        if (alive) setSaved(trimmed);
      } catch (err) {
        if (alive) setError(err instanceof ApiFailure ? err.message : 'Gagal menyimpan bio.');
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

  if (!editing) {
    return (
      <div className="bio-field">
        <button
          type="button"
          className="bio-field__display"
          onClick={() => setEditing(true)}
          aria-label="Ubah bio"
        >
          <span className="bio-field__text">{saved || 'No bio'}</span>
          <span className="bio-field__icon" aria-hidden="true">
            <EditIcon />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="bio-field">
      <textarea
        ref={textareaRef}
        className="bio-field__textarea"
        value={value}
        maxLength={BIO_MAX_LENGTH}
        rows={2}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => setEditing(false)}
        placeholder="Tulis bio singkat tentang kamu..."
        aria-label="Bio"
      />
      <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
        {busy && <span className="spinner" aria-hidden="true" />}
        {!busy && !error && trimmed === saved && (
          <span className="input-status__icon input-status__icon--ok" aria-hidden="true">
            <CheckIcon />
          </span>
        )}
        <span className="caption">
          {value.length} / {BIO_MAX_LENGTH}
        </span>
      </div>
      {error && (
        <p className="form-error" style={{ textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}
