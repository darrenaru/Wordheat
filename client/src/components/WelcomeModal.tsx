import { useState } from 'react';
import { signInWithGoogle } from '../lib/supabase.ts';
import { markSignInMethodChosen } from '../lib/profile.ts';
import { GoogleIcon, Modal } from './ui.tsx';

interface WelcomeModalProps {
  onContinueAsGuest(): void;
}

/**
 * Layar pertama yang dilihat pemain baru — sebelum sempat menyentuh apa
 * pun. Pilihannya cuma dua, dan keduanya sah: main sebagai tamu (statistik
 * tetap tercatat, cuma terikat ke perangkat ini), atau masuk dengan Google
 * supaya progresnya ikut kalau ganti perangkat. Tandanya cuma ditulis
 * sekali — pemain tidak akan ditanya lagi di kunjungan berikutnya.
 */
export function WelcomeModal({ onContinueAsGuest }: WelcomeModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continueAsGuest = () => {
    markSignInMethodChosen();
    onContinueAsGuest();
  };

  const continueWithGoogle = async () => {
    setError(null);
    setBusy(true);
    // Tidak ada `finally`: berhasil berarti halaman ini langsung
    // ditinggalkan ke Google. Tandanya ditulis sebelum redirect supaya
    // layar ini tidak muncul lagi begitu pemain kembali sudah login.
    markSignInMethodChosen();
    const failure = await signInWithGoogle();
    if (failure) {
      setError(failure);
      setBusy(false);
    }
  };

  return (
    <Modal title="Selamat datang di Wordheat" onClose={continueAsGuest}>
      <div className="stack" style={{ gap: 16 }}>
        <p className="caption">
          Main aja sebagai tamu, atau masuk pakai Google biar coin dan statistikmu ikut kalau
          ganti perangkat.
        </p>

        <button
          className="btn btn--secondary btn--block"
          onClick={continueWithGoogle}
          disabled={busy}
        >
          <GoogleIcon />
          {busy ? 'Buka Google...' : 'Masuk dengan Google'}
        </button>

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn--ghost btn--block" onClick={continueAsGuest} disabled={busy}>
          Lanjut aja sebagai Guest
        </button>
      </div>
    </Modal>
  );
}
