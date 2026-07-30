import { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import { navigate } from '../lib/router.ts';
import { Ambient } from '../components/Ambient.tsx';
import {
  ArrowIcon,
  CalendarIcon,
  HelpIcon,
  PlayIcon,
  ShopIcon,
  TrophyIcon,
  UsersIcon,
  useToast,
} from '../components/ui.tsx';
import { RulesModal } from './RulesModal.tsx';

/** Angka yang ditampilkan di chip hero — nyata, datang dari server. */
interface Health {
  vocabulary: number;
  targets: number;
  puzzleDate: string;
}

export function HomeScreen() {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [showRules, setShowRules] = useState(false);
  const toast = useToast();

  // Satu GET kecil. Kalau gagal, chip dan tanggalnya sekadar tidak muncul —
  // beranda tidak boleh bergantung padanya untuk bisa dipakai.
  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((data) => alive && setHealth(data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const joinRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return;
    setChecking(true);
    try {
      // Divalidasi lewat HTTP dulu supaya kode salah ketik langsung ketahuan,
      // bukan berupa WebSocket yang terbuka lalu tertutup lagi.
      await api.roomInfo(trimmed);
      navigate(`/ruang/${trimmed}`);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Ruang tidak ditemukan.', 'error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="home">
      <Ambient />

      {/* Hero berketinggian tetap, bukan sepenuh layar: di beranda-peluncur,
          identitas cukup memperkenalkan diri lalu menyerahkan panggung ke
          pilihan-pilihannya. */}
      <header className="launch">
        <h1 className="hero__title">
          <span className="hero__mask">
            <span className="hero__part">Word</span>
          </span>
          <span className="hero__mask">
            <em className="hero__part">heat</em>
          </span>
        </h1>

        <p className="launch__tag">
          Tebak kata rahasianya. Setiap tebakan dinilai dari kedekatan makna — makin dekat, makin
          panas.
        </p>

        {health && (
          <span className="launch__chip tnum">
            {health.vocabulary} kata di kamus · {health.targets} kata rahasia
          </span>
        )}

        <button className="btn btn--ghost btn--sm" onClick={() => setShowRules(true)}>
          <HelpIcon />
          Panduan Bermain
        </button>
      </header>

      <form
        className="join-bar"
        style={{ '--accent': 'var(--brand)' } as React.CSSProperties}
        onSubmit={joinRoom}
      >
        <label className="join-bar__title" htmlFor="kode-ruang">
          Sudah punya kode?
        </label>
        <div className="cell__row">
          <input
            id="kode-ruang"
            className="input input--code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 5))}
            placeholder="ABCDE"
            maxLength={5}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button
            className="btn btn--secondary"
            type="submit"
            disabled={code.trim().length < 4 || checking}
          >
            {checking ? 'Mencari...' : 'Gabung'}
          </button>
        </div>
      </form>

      <div className="bento">
        <button
          className="cell cell--feature"
          style={{ '--accent': 'var(--warm)' } as React.CSSProperties}
          onClick={() => navigate('/ruang/baru')}
        >
          <UsersIcon />
          <span className="cell__title">Main bareng</span>
          <span className="cell__body">Buat ruang, undang teman lewat kode.</span>
          <span className="cell__cta">
            Buat ruang
            <ArrowIcon />
          </span>
        </button>

        <button
          className="cell"
          style={{ '--accent': 'var(--cool)' } as React.CSSProperties}
          onClick={() => navigate('/harian')}
        >
          <CalendarIcon />
          <span className="cell__title">Kata harian</span>
          <span className="cell__body">
            Satu kata yang sama untuk semua orang. Berganti tiap tengah malam.
          </span>
          <span className="cell__foot">
            <span className="cell__cta">
              Mainkan
              <ArrowIcon />
            </span>
            {health && <span className="cell__meta caption tnum">{health.puzzleDate}</span>}
          </span>
        </button>

        <button
          className="cell"
          style={{ '--accent': 'var(--hot)' } as React.CSSProperties}
          onClick={() => navigate('/main')}
        >
          <PlayIcon />
          <span className="cell__title">Main sendiri</span>
          <span className="cell__body">Kata acak, tanpa batas waktu.</span>
          <span className="cell__cta">
            Mulai
            <ArrowIcon />
          </span>
        </button>

        <button
          className="cell"
          style={{ '--accent': 'var(--brand)' } as React.CSSProperties}
          onClick={() => navigate('/shop')}
        >
          <ShopIcon />
          <span className="cell__title">Shop</span>
          <span className="cell__body">Belanjakan coin untuk powerup.</span>
          <span className="cell__cta">
            Buka
            <ArrowIcon />
          </span>
        </button>

        <button
          className="cell"
          style={{ '--accent': 'var(--correct)' } as React.CSSProperties}
          onClick={() => navigate('/leaderboard')}
        >
          <TrophyIcon />
          <span className="cell__title">Leaderboard</span>
          <span className="cell__body">Lihat peringkat coin, menang, streak, dan tebakan.</span>
          <span className="cell__cta">
            Lihat
            <ArrowIcon />
          </span>
        </button>
      </div>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
