import { TEMPERATURE_LABEL, TEMPERATURE_ORDER } from '@shared/types.ts';
import { Modal } from '../components/ui.tsx';

export function RulesModal({ onClose }: { onClose(): void }) {
  return (
    <Modal title="Cara bermain" onClose={onClose}>
      <div className="stack">
        <p className="small">
          Ada satu <strong>kata rahasia</strong>. Setiap tebakanmu dinilai dari{' '}
          <strong>kedekatan maknanya</strong> dengan kata itu — bukan dari kemiripan hurufnya.
        </p>

        <div className="card card--tight">
          <p className="small" style={{ marginBottom: 8 }}>
            Kalau kata rahasianya <strong>topi</strong>:
          </p>
          <ul className="small stack" style={{ paddingLeft: 18, gap: 4 }}>
            <li>
              <strong>kepala</strong> → hangat, karena topi dipakai di kepala
            </li>
            <li>
              <strong>sepatu</strong> → panas, sama-sama barang yang dipakai
            </li>
            <li>
              <strong>makan</strong> → beku, tidak ada kaitannya
            </li>
          </ul>
        </div>

        <div>
          <h3 style={{ marginBottom: 8 }}>Skala suhu</h3>
          <div className="row">
            {TEMPERATURE_ORDER.map((temp) => (
              <span key={temp} className="badge" data-temp={temp}>
                <span className="badge__dot" />
                {TEMPERATURE_LABEL[temp]}
              </span>
            ))}
          </div>
        </div>

        <p className="small muted">
          Angka peringkat menunjukkan posisi tebakanmu di antara kata-kata terdekat dari kata
          rahasia. Peringkat 1 berarti kata itu adalah kata paling dekat maknanya — tinggal
          selangkah lagi.
        </p>

        <hr className="divider" />

        <div>
          <h3 style={{ marginBottom: 8 }}>Main bareng</h3>
          <p className="small muted">
            Buat ruang, bagikan kodenya, lalu semua pemain menebak kata yang sama secara bersamaan.
            Kamu bisa melihat seberapa dekat lawanmu — tapi tidak pernah kata apa yang mereka
            tebak.
          </p>
        </div>
      </div>
    </Modal>
  );
}
