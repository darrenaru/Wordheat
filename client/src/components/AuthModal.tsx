import { useState, type FormEvent } from 'react';
import { signIn, signInWithGoogle, signUp } from '../lib/supabase.ts';
import { GoogleIcon, Modal } from './ui.tsx';

interface AuthModalProps {
  onClose(): void;
  /** Dipanggil setelah masuk/daftar berhasil — modal ditutup oleh pemanggil. */
  onSignedIn(): void;
}

/**
 * Login/daftar opsional lewat email+password. Statistik pribadi cuma
 * tersimpan untuk pemain yang login lewat modal ini — main tanpa akun tetap
 * bekerja persis seperti sebelumnya.
 */
export function AuthModal({ onClose, onSignedIn }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const submitGoogle = async () => {
    setError(null);
    setInfo(null);
    setGoogleBusy(true);
    // Tidak ada `finally` yang mematikan `googleBusy`: berhasil berarti
    // halaman ini langsung ditinggalkan ke Google. Cuma direset kalau
    // Supabase menolak sebelum sempat redirect (mis. provider belum aktif).
    const failure = await signInWithGoogle();
    if (failure) {
      setError(failure);
      setGoogleBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const failure = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
      if (failure) {
        setError(failure);
        return;
      }
      if (mode === 'signup') {
        setInfo('Akun sudah dibuat. Cek email untuk konfirmasi, lalu masuk.');
        setMode('signin');
        return;
      }
      onSignedIn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={mode === 'signin' ? 'Masuk' : 'Buat akun'} onClose={onClose}>
      <form className="auth-form" onSubmit={submit}>
        <p className="caption">
          Login itu opsional — cuma dipakai untuk menyimpan statistik pribadimu lintas perangkat.
        </p>

        <button
          type="button"
          className="btn btn--secondary btn--block"
          onClick={submitGoogle}
          disabled={googleBusy || busy}
        >
          <GoogleIcon />
          {googleBusy ? 'Buka Google...' : 'Lanjutkan dengan Google'}
        </button>

        <div className="auth-divider">
          <span>atau</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            className="input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="auth-password">
            Kata sandi
          </label>
          <input
            id="auth-password"
            className="input"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error && <p className="form-error">{error}</p>}
        {info && <p className="caption">{info}</p>}

        <button className="btn btn--primary" type="submit" disabled={busy || googleBusy}>
          {mode === 'signin' ? 'Masuk' : 'Daftar'}
        </button>

        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setInfo(null);
          }}
        >
          {mode === 'signin' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
        </button>
      </form>
    </Modal>
  );
}
