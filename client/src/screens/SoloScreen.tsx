import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { Guess, SoloSessionState } from '@shared/types.ts';
import { api, ApiFailure } from '../lib/api.ts';
import { applyInventory, getInventory, subscribeInventory } from '../lib/inventory.ts';
import { useGuessFx } from '../lib/useGuessFx.ts';
import { applyBalance } from '../lib/wallet.ts';
import { Ambient } from '../components/Ambient.tsx';
import { GuessFxLayer } from '../components/GuessFx.tsx';
import { GuessInput } from '../components/GuessInput.tsx';
import { GuessList } from '../components/GuessList.tsx';
import { HeatMeter } from '../components/HeatMeter.tsx';
import { LetterRevealBanner } from '../components/LetterRevealBanner.tsx';
import { formatDuration } from '../components/PlayerList.tsx';
import { BulbIcon, EyeIcon, FlagIcon, ShareIcon, TargetIcon, useToast } from '../components/ui.tsx';

interface SoloScreenProps {
  mode: 'practice' | 'daily';
}

const storageKey = (mode: string) => `wordheat:solo:${mode}`;

export function SoloScreen({ mode }: SoloScreenProps) {
  const [state, setState] = useState<SoloSessionState | null>(null);
  const [latest, setLatest] = useState<Guess | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Naik tiap tebakan ditolak — memicu getaran pada kolom input. */
  const [rejections, setRejections] = useState(0);
  const toast = useToast();
  const inventory = useSyncExternalStore(subscribeInventory, getInventory, () => ({
    nearestGuess: 0,
    letterReveal: 0,
  }));

  const fx = useGuessFx(latest, state?.guesses ?? [], state?.sessionId ?? '');

  const start = useCallback(
    async (fresh: boolean) => {
      setLoadError(null);
      setLatest(null);
      try {
        const stored = fresh ? null : localStorage.getItem(storageKey(mode));
        if (stored) {
          try {
            const resumed = await api.getSolo(stored);
            // Kata harian berganti tiap tengah malam WIB; sesi kemarin tidak
            // boleh dilanjutkan karena kata rahasianya sudah bukan yang berlaku.
            const stale =
              resumed.mode === 'daily' &&
              resumed.puzzleDate !== (await api.health()).puzzleDate;
            if (!stale) {
              setState(resumed);
              return;
            }
          } catch {
            /* sesi tersimpan sudah kedaluwarsa — buat baru saja */
          }
        }
        const created = await api.newSolo(mode);
        localStorage.setItem(storageKey(mode), created.sessionId);
        setState(created);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Gagal memuat permainan.');
      }
    },
    [mode],
  );

  useEffect(() => {
    void start(false);
  }, [start]);

  const submit = async (word: string) => {
    if (!state || busy) return;
    setBusy(true);
    try {
      const result = await api.guess(state.sessionId, word);
      setState(result.state);
      setLatest(result.guess);
      if (result.balance !== undefined) applyBalance(result.balance);
    } catch (error) {
      setRejections((count) => count + 1);
      if (error instanceof ApiFailure) toast.show(error.message, 'error');
      else toast.show('Gagal mengirim tebakan.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const askHint = async () => {
    if (!state) return;
    try {
      const word = await api.hint(state.sessionId);
      toast.show(`Petunjuk: coba kata yang berkaitan dengan "${word}".`);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Petunjuknya belum tersedia.', 'error');
    }
  };

  const surrender = async () => {
    if (!state) return;
    try {
      setState(await api.reveal(state.sessionId));
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Gagal menyerah, coba lagi.', 'error');
    }
  };

  const useNearestGuess = async () => {
    if (!state) return;
    try {
      const result = await api.soloPowerupNearest(state.sessionId);
      setState(result.state);
      setLatest(result.guess);
      applyInventory(result.inventory);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Powerup-nya belum tersedia.', 'error');
    }
  };

  const useLetterReveal = async () => {
    if (!state) return;
    try {
      const result = await api.soloPowerupLetter(state.sessionId);
      setState({ ...state, revealedLetter: result.letter, secretLength: result.wordLength });
      applyInventory(result.inventory);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Powerup-nya belum tersedia.', 'error');
    }
  };

  const playAgain = () => {
    localStorage.removeItem(storageKey(mode));
    void start(true);
  };

  if (loadError) {
    return (
      <div className="card stack" style={{ textAlign: 'center' }}>
        <p>{loadError}</p>
        <button className="btn btn--secondary" onClick={() => void start(true)}>
          Coba lagi
        </button>
      </div>
    );
  }

  if (!state) {
    return <p className="empty">Menyiapkan permainan...</p>;
  }

  const finished = state.solved || state.revealed;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <Ambient temperature={latest?.temperature ?? null} />
      <GuessFxLayer fx={fx} />

      <div className="row">
        <h1>{mode === 'daily' ? 'Kata harian' : 'Main sendiri'}</h1>
        <span className="spacer" />
        {mode === 'daily' && <span className="badge badge--plain tnum">{state.puzzleDate}</span>}
        <span className="badge badge--plain tnum">{state.guesses.length} tebakan</span>
      </div>

      {finished ? (
        <ResultPanel state={state} mode={mode} onPlayAgain={playAgain} />
      ) : (
        <div className={`card${latest?.temperature === 'correct' ? ' heat--won' : ''}`}>
          <HeatMeter guess={latest} poolSize={state.poolSize} fx={fx} />
        </div>
      )}

      {!finished && (
        <>
          <GuessInput onSubmit={submit} busy={busy} errorSignal={rejections} />
          <div className="row">
            <button className="btn btn--ghost btn--sm" onClick={askHint}>
              <BulbIcon />
              Petunjuk
            </button>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => void useNearestGuess()}
              disabled={inventory.nearestGuess < 1}
              title={inventory.nearestGuess < 1 ? 'Beli di Shop' : `${inventory.nearestGuess} tersisa`}
            >
              <TargetIcon />
              Tebak Terdekat
              <span className="badge badge--plain tnum">{inventory.nearestGuess}</span>
            </button>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => void useLetterReveal()}
              disabled={state.revealedLetter !== null || inventory.letterReveal < 1}
              title={
                state.revealedLetter !== null
                  ? 'Udah dipakai di ronde ini'
                  : inventory.letterReveal < 1
                    ? 'Beli di Shop'
                    : `${inventory.letterReveal} tersisa`
              }
            >
              <EyeIcon />
              Bocoran Huruf
              <span className="badge badge--plain tnum">{inventory.letterReveal}</span>
            </button>
          </div>

          {/* Baris sendiri, jauh dari tombol "Tebak" di ujung kolom tebakan —
              sebelumnya didorong ke kanan lewat spacer dan malah persis
              menumpuk di bawah "Tebak", jadi gampang salah pencet. */}
          <div className="row">
            <button className="btn btn--ghost btn--sm" onClick={surrender}>
              <FlagIcon />
              Menyerah
            </button>
          </div>
        </>
      )}

      {state.revealedLetter !== null && state.secretLength !== null && (
        <LetterRevealBanner letter={state.revealedLetter} wordLength={state.secretLength} />
      )}

      <GuessList
        guesses={state.guesses}
        latestWord={latest?.word ?? null}
        poolSize={state.poolSize}
      />
    </div>
  );
}

function ResultPanel({
  state,
  mode,
  onPlayAgain,
}: {
  state: SoloSessionState;
  mode: 'practice' | 'daily';
  onPlayAgain(): void;
}) {
  const toast = useToast();
  const durationMs = (state.finishedAt ?? Date.now()) - state.startedAt;

  const share = async () => {
    const headline = state.solved
      ? `Aku menemukan kata "${state.secret}" dalam ${state.guesses.length} tebakan!`
      : `Aku menyerah di kata "${state.secret}" setelah ${state.guesses.length} tebakan.`;
    const text = `Wordheat${mode === 'daily' ? ` — ${state.puzzleDate}` : ''}\n${headline}\n${location.origin}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.show('Hasil udah disalin ke clipboard.');
      }
    } catch {
      /* pengguna membatalkan dialog berbagi */
    }
  };

  return (
    <div
      className={`card card--cream${state.solved ? ' heat--won' : ''}`}
      data-temp={state.solved ? 'correct' : 'freezing'}
    >
      <div className="result">
        <span className="caption">{state.solved ? 'Kata rahasianya' : 'Ternyata katanya'}</span>
        <span className={`result__secret${state.solved ? '' : ' result__secret--lost'}`}>
          {state.secret}
        </span>

        <div className="result__stats">
          <span className="stat">
            <span className="stat__value tnum">{state.guesses.length}</span>
            <span className="caption">tebakan</span>
          </span>
          <span className="stat">
            <span className="stat__value tnum">{formatDuration(durationMs)}</span>
            <span className="caption">waktu</span>
          </span>
        </div>

        <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <button className="btn btn--secondary" onClick={share}>
            <ShareIcon />
            Bagikan
          </button>
          {mode === 'practice' && (
            <button className="btn btn--primary" onClick={onPlayAgain}>
              Main lagi
            </button>
          )}
        </div>

        {mode === 'daily' && (
          <p className="caption">Kata harian berikutnya muncul besok pagi, ya.</p>
        )}
      </div>
    </div>
  );
}
