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
import { ChartIcon, CheckIcon, CloseIcon, EditIcon, GoogleIcon, LayersIcon, Modal, UsersIcon } from './ui.tsx';
import { AvatarStudio } from '../screens/AvatarStudio.tsx';
import { RankBadge } from './RankBadge.tsx';
import { StatsGrid } from './StatsGrid.tsx';
import { XpBar } from './XpBar.tsx';

interface ProfileModalProps {
  profile: PlayerProfile;
  onSave(profile: PlayerProfile): void;
  onClose(): void;
}

/** Referensi stabil (bukan `() => {}` inline di JSX) — `Modal` memasang
 *  ulang listener Escape tiap kali `onClose` berganti identitas
 *  (`useEffect(..., [onClose])` di `ui.tsx`), jadi fungsi baru tiap render
 *  selama `AvatarStudio` terbuka berarti attach/detach berulang-ulang
 *  tanpa perlu. */
const NOOP = () => {};

/**
 * Pusat pengaturan akun. Ubah avatar sengaja tidak ditaruh di sini sebagai
 * field biasa — pemilihan bagian wajah butuh ruang sendiri (lihat
 * `AvatarStudio`), jadi di sini cuma ada tombol yang membuka tampilan itu
 * di atas modal ini, lalu kembali ke sini begitu selesai.
 *
 * Tata letak: header identitas polos (avatar/nama/username/bio, bisa
 * diedit) diikuti dashboard bento — pola visual yang sama seperti grid
 * menu Beranda (`HomeScreen`/`.bento`/`.cell`), supaya Profil Saya terasa
 * senada dengan identitas visual app alih-alih jadi hero terpisah sendiri.
 * Kartu di sini murni informatif (bukan navigasi), jadi dirender sebagai
 * `<div className="cell cell--static">`, BUKAN `<button>` seperti kartu
 * Beranda — beberapa isinya (kartu Akun) punya tombol sungguhan sendiri,
 * dan tombol tidak boleh bersarang di dalam tombol.
 */
export function ProfileModal({ profile, onSave, onClose }: ProfileModalProps) {
  const [draft, setDraft] = useState<PlayerProfile>(profile);
  const [showAvatarStudio, setShowAvatarStudio] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [stats, setStats] = useState<PlayerStats | null | undefined>(undefined);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const session = useSyncExternalStore(subscribeAuth, getAuthSession, () => null);
  const loggedIn = session !== null;

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

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

  const level = xpProgress(stats?.xp ?? 0).level;

  const dirty = draft.name !== profile.name || draft.avatar !== profile.avatar;

  const save = () => {
    const trimmedName = draft.name.trim() || 'Pemain';
    onSave({ ...draft, name: trimmedName });
    // Best-effort — localStorage (di atas) sudah cukup untuk pengalaman
    // pemain saat ini; ini cuma menyamakan `player_stats` di server supaya
    // tidak ketinggalan kalau nanti login Google sebelum sempat main lagi
    // (lihat komentar `setDisplayProfile`).
    void api.setProfile(trimmedName, draft.avatar).catch(() => {});
    onClose();
  };

  return (
    <>
      <Modal
        title="Profil Saya"
        // Dibuat no-op selagi AvatarStudio terbuka di atasnya — kalau tidak,
        // menekan Escape akan memanggil KEDUA listener sekaligus (modal ini
        // ikut menutup, bukan cuma AvatarStudio-nya) karena keduanya tetap
        // sama-sama terpasang di `window` selama keduanya dirender bersamaan
        // (lihat komentar di bawah kenapa modal ini tidak lagi di-unmount).
        onClose={showAvatarStudio ? NOOP : onClose}
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
          <div className="profile__hero">
            <div className="profile__avatar-wrap">
              <button
                type="button"
                className="avatar-edit-btn"
                onClick={() => setShowAvatarStudio(true)}
                aria-label="Ubah avatar"
              >
                <Avatar config={draft.avatar} size={96} alt="Avatar kamu" />
              </button>
              <span className="avatar-edit-badge" aria-hidden="true">
                <EditIcon />
              </span>
              <span className="profile__level-badge">Lv. {level}</span>
            </div>

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

            <UsernameField displayName={profile.name} avatar={profile.avatar} loggedIn={loggedIn} />
            <BioField displayName={profile.name} avatar={profile.avatar} />
          </div>

          <div className="profile-bento">
            <div className="cell cell--static" style={{ '--accent': 'var(--correct)' } as React.CSSProperties}>
              <LayersIcon />
              <span className="cell__title">Level</span>
              {stats === undefined && <p className="caption">Memuat...</p>}
              {stats === null && <p className="caption">Belum ada statistik tercatat.</p>}
              {stats && <XpBar xp={stats.xp} />}
            </div>

            <div
              className="cell cell--static"
              style={{ '--accent': 'var(--border-strong)' } as React.CSSProperties}
            >
              <span className="cell__title">Rank</span>
              {stats && <RankBadge totalWins={stats.totalWins} />}
            </div>

            <div
              className="cell cell--static cell--wide"
              style={{ '--accent': 'var(--border-strong)' } as React.CSSProperties}
            >
              <ChartIcon />
              <span className="cell__title">Statistik</span>
              <StatsGrid stats={stats} bare />
            </div>

            {isAuthAvailable() && (
              <div
                className="cell cell--static cell--wide"
                style={{ '--accent': 'var(--border-strong)' } as React.CSSProperties}
              >
                <UsersIcon />
                <span className="cell__title">Akun</span>
                <AccountField />
              </div>
            )}
          </div>
        </div>
      </Modal>
      {/*
        Dirender DI ATAS `<Modal>` di atas (bukan menggantikannya lewat early
        return seperti sebelumnya) — modal ini SENGAJA tetap mounted di
        belakangnya selagi AvatarStudio terbuka. Alasannya: `UsernameField`/
        `BioField`/grid statistik masing-masing fetch datanya sendiri sekali
        saat mount; kalau seluruh modal ini di-unmount (early return), semua
        field itu ikut lenyap dan begitu AvatarStudio ditutup, semuanya
        remount dari nol — sempat menampilkan "username_kamu"/"No bio"
        (placeholder kosong) sebelum fetch ulang selesai, alih-alih langsung
        menampilkan data yang sudah dimuat sebelumnya. AvatarStudio sendiri
        juga `<Modal>` dengan backdrop penuh layar, jadi tetap menutupi modal
        ini secara visual sama seperti sebelumnya.
      */}
      {showAvatarStudio && (
        <AvatarStudio
          avatar={draft.avatar}
          onSave={(avatar) => setDraft({ ...draft, avatar })}
          onClose={() => setShowAvatarStudio(false)}
        />
      )}
    </>
  );
}

/**
 * Login/logout Google langsung dari Profil Saya — tombol yang sama
 * berganti peran mengikuti status sesi, dipakai ulang persis fungsi yang
 * sudah dipakai `AuthModal`/`WelcomeModal` (masuk) dan `StatsModal`
 * (keluar), cuma ditempatkan di sini supaya tidak perlu buka modal lain.
 * Judul "Akun" datang dari kartu bento pembungkusnya, bukan dari komponen
 * ini sendiri — makanya tidak ada wrapper `.field`/`field__label` di sini.
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
    <>
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
          <p className="caption">Kamu lagi main sebagai Guest.</p>
          <button className="btn btn--secondary btn--block" onClick={login} disabled={busy}>
            <GoogleIcon />
            {busy ? 'Buka Google...' : 'Login dengan Google'}
          </button>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </>
  );
}

function cooldownMessage(changeableAt: string): string {
  const days = Math.max(1, Math.ceil((new Date(changeableAt).getTime() - Date.now()) / 86_400_000));
  return `Username cuma bisa diganti tiap 7 hari sekali. Coba lagi ${days} hari lagi, ya.`;
}

/**
 * Identitas unik yang dipakai teman untuk menemukanmu lewat Add Friend —
 * diperiksa dan disimpan otomatis begitu pemain berhenti mengetik sejenak
 * (tanpa tombol Simpan terpisah), ikon berputar menandai lagi diperiksa.
 *
 * Guest (`!loggedIn`) cuma bisa MELIHAT username acak yang sudah diberikan
 * server (`ensureUsername` di `social/store.ts`) — tombol ubah disembunyikan
 * dan server sendiri menolak `POST /username` tanpa sesi login (lihat
 * `router.post('/username', ...)` di `http/api.ts`), supaya identitas unik
 * itu tidak bisa diklaim lalu ditinggal begitu saja oleh Guest yang tidak
 * pernah terverifikasi ke akun manapun.
 */
function UsernameField({
  displayName,
  avatar,
  loggedIn,
}: {
  displayName: string;
  avatar: PlayerProfile['avatar'];
  loggedIn: boolean;
}) {
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
          {loggedIn && (
            <button
              type="button"
              className="identity-editable__icon"
              onClick={() => setEditing(true)}
              aria-label="Ubah username"
            >
              <EditIcon />
            </button>
          )}
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
          <span className="bio-field__text">{saved || 'Belum ada bio'}</span>
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
