import type { AvatarConfig } from '@shared/types.ts';
import { xpProgress } from '@shared/xp.ts';
import { FALLBACK_AVATAR } from '../lib/avatar.ts';
import { Avatar } from './Avatar.tsx';
import { Modal } from './ui.tsx';

interface AccountLinkConflictModalProps {
  canonical: { displayName: string; avatar: AvatarConfig | null; xp: number; totalWins: number };
  busy: boolean;
  onConfirm(): void;
  onCancel(): void;
}

/**
 * Prompt "Kesalahan Fatal" dari spesifikasi akun: akun Google yang baru
 * saja login SUDAH punya progres tersimpan (dari device/sesi lain) —
 * melanjutkan tanpa persetujuan pemain akan diam-diam MEMBUANG progres
 * Guest di device ini (lihat `peekAccountLink`/RPC `link_account_profile`
 * di server). Modal ini satu-satunya titik pemain menyetujui pertukaran
 * itu secara eksplisit sebelum server benar-benar menulis apa pun.
 */
export function AccountLinkConflictModal({
  canonical,
  busy,
  onConfirm,
  onCancel,
}: AccountLinkConflictModalProps) {
  const level = xpProgress(canonical.xp).level;

  return (
    <Modal
      title="Akun ini sudah punya progres"
      ariaLabel="Konfirmasi muat data akun Google"
      onClose={onCancel}
      footer={
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn--secondary" onClick={onCancel} disabled={busy}>
            Batal
          </button>
          <button className="btn btn--primary" style={{ flex: 1 }} onClick={onConfirm} disabled={busy}>
            {busy ? 'Memuat...' : 'Muat Data Google'}
          </button>
        </div>
      }
    >
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <Avatar config={canonical.avatar ?? FALLBACK_AVATAR} size={72} alt={canonical.displayName} />
        <p style={{ margin: 0 }}>
          Akun Google ini sudah memiliki data permainan sebagai{' '}
          <strong>{canonical.displayName}</strong> (Level {level}).
        </p>
        <p className="caption" style={{ margin: 0 }}>
          Muat data ini? Progres Guest di perangkat ini tidak akan disimpan.
        </p>
      </div>
    </Modal>
  );
}
