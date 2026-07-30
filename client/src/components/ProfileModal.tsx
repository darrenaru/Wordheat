import { useEffect, useState, useSyncExternalStore } from 'react';
import type { PlayerProfile } from '@shared/types.ts';
import { api, ApiFailure } from '../lib/api.ts';
import {
  getAuthSession,
  isAuthAvailable,
  signInWithGoogle,
  signOut,
  subscribeAuth,
} from '../lib/supabase.ts';
import { Avatar } from './Avatar.tsx';
import { GoogleIcon, Modal } from './ui.tsx';
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
          <Avatar config={draft.avatar} size={64} square alt="Avatar kamu" />
          <button className="btn btn--secondary" onClick={() => setShowAvatarStudio(true)}>
            Ubah Avatar
          </button>
        </div>

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
        </div>

        <UsernameField displayName={profile.name} avatar={profile.avatar} />

        <div className="field field--soon">
          <span className="field__label">Tema</span>
          <div className="row">
            <button className="btn btn--secondary" disabled>
              Light
            </button>
            <button className="btn btn--secondary" disabled>
              Dark
            </button>
          </div>
        </div>

        {isAuthAvailable() && <AccountField />}
      </div>
    </Modal>
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
        <>
          <p className="caption">{session.user.email}</p>
          <button className="btn btn--secondary btn--block" onClick={logout} disabled={busy}>
            {busy ? 'Keluar...' : 'Logout'}
          </button>
        </>
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
 * disimpan sendiri, terpisah dari tombol Simpan utama Display Name/avatar,
 * supaya gagal karena sudah dipakai orang lain tidak mengganggu alur itu.
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
  const dirty = trimmed !== (saved ?? '');

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.setUsername(trimmed, displayName, avatar);
      setSaved(trimmed);
    } catch (err) {
      setError(err instanceof ApiFailure ? err.message : 'Gagal menyimpan username.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field">
      <label className="field__label" htmlFor="username">
        Username
      </label>
      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <input
          id="username"
          className="input"
          style={{ flex: 1 }}
          value={value}
          maxLength={20}
          onChange={(event) => setValue(event.target.value)}
          placeholder="username_kamu"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={save}
          disabled={!dirty || busy || trimmed.length < 3}
        >
          {busy ? 'Menyimpan...' : 'Simpan'}
        </button>
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
