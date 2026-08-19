"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import GuessFxLayer from "@/components/GuessFxLayer";
import GuessRow from "@/components/GuessRow";
import ThemeToggle from "@/components/ThemeToggle";
import Wordmark from "@/components/Wordmark";
import { applyAmbientHeat, flarePage } from "@/lib/ambient";
import { buildGuessFx, useReorderAnimation, type GuessFx } from "@/lib/motion";
import { normalizeWord } from "@/lib/word";

type Guess = { word: string; rank: number };

type Props = {
  puzzleId: number;
  puzzleLabel: string;
  vocabSize: number;
};

type Notice = { tone: "error" | "info"; text: string } | null;

function storageKey(puzzleId: number) {
  return `wordheat:puzzle:${puzzleId}`;
}

export default function GameBoard({ puzzleId, puzzleLabel, vocabSize }: Props) {
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [latest, setLatest] = useState<Guess | null>(null);
  const [freshWord, setFreshWord] = useState<string | null>(null);
  const [flareWord, setFlareWord] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [surrendered, setSurrendered] = useState(false);
  const [restored, setRestored] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fx, setFx] = useState<GuessFx | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  // Tebakan boleh dikirim bersamaan, jadi jawaban bisa datang tidak berurutan.
  // Penanda ini memastikan baris "terakhir" menampilkan tebakan yang paling
  // baru dikirim, bukan yang kebetulan dijawab server paling akhir.
  const submitSeq = useRef(0);
  const fxCounter = useRef(0);

  // Menyerah juga menaruh jawaban di daftar dengan peringkat 1, jadi keberadaan
  // peringkat 1 saja tidak cukup untuk menyatakan pemain menang.
  const solved = revealed !== null && !surrendered;
  const finished = revealed !== null;
  const best = guesses.length ? Math.min(...guesses.map((g) => g.rank)) : null;

  const sorted = useMemo(
    () => [...guesses].sort((a, b) => a.rank - b.rank),
    [guesses],
  );
  const registerRow = useReorderAnimation(sorted);

  // Jawaban yang dibuka karena menyerah ikut masuk daftar agar pemain melihat
  // posisinya, tetapi tidak dihitung sebagai tebakan.
  const guessCount = guesses.length - (surrendered ? 1 : 0);

  // Riwayat dipulihkan dari perangkat pemain, bukan dari server: permainan ini
  // tidak butuh akun, dan progres harian tetap aman saat halaman dimuat ulang.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(puzzleId));
      if (saved) {
        const parsed = JSON.parse(saved) as {
          guesses?: Guess[];
          revealed?: string;
          surrendered?: boolean;
        };
        if (Array.isArray(parsed.guesses)) setGuesses(parsed.guesses);
        if (parsed.revealed) setRevealed(parsed.revealed);
        if (parsed.surrendered) setSurrendered(true);
      }
    } catch {
      // Penyimpanan tidak tersedia atau isinya rusak: mulai dari kosong.
    }
    setRestored(true);
  }, [puzzleId]);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(
        storageKey(puzzleId),
        JSON.stringify({ guesses, revealed, surrendered }),
      );
    } catch {
      // Mengabaikan kuota penuh; permainan tetap bisa dilanjutkan.
    }
  }, [guesses, revealed, surrendered, puzzleId, restored]);

  useEffect(() => {
    applyAmbientHeat(best, vocabSize);
  }, [best, vocabSize]);

  const submit = useCallback(
    async (raw: string) => {
      const word = normalizeWord(raw);
      if (!word) return;

      setNotice(null);
      setCopied(false);

      const existing = guesses.find((g) => g.word === word);
      if (existing) {
        setLatest(existing);
        setFreshWord(null);
        setNotice({
          tone: "info",
          text: `Sudah ditebak — peringkat ${existing.rank.toLocaleString("id-ID")}.`,
        });
        return;
      }

      const previousBest = guesses.length ? Math.min(...guesses.map((g) => g.rank)) : null;
      const seq = ++submitSeq.current;
      try {
        const res = await fetch("/api/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ puzzleId, word }),
        });

        if (res.status === 404) {
          setNotice({
            tone: "error",
            text: `"${word}" tidak ada di kamus Wordheat. Coba kata lain.`,
          });
          return;
        }
        if (!res.ok) {
          setNotice({ tone: "error", text: "Tebakan gagal dikirim. Coba lagi." });
          return;
        }

        const result = (await res.json()) as Guess;
        setGuesses((prev) =>
          prev.some((g) => g.word === result.word) ? prev : [...prev, result],
        );
        if (seq === submitSeq.current) {
          setLatest(result);
          setFreshWord(result.word);
          fxCounter.current += 1;
          setFx(buildGuessFx(fxCounter.current, result.word, result.rank, previousBest));
        }
        if (result.rank === 1) {
          setRevealed(result.word);
          setFlareWord(result.word);
          flarePage();
        }
      } catch {
        setNotice({ tone: "error", text: "Koneksi terputus. Tebakan belum terkirim." });
      }
    },
    [guesses, puzzleId],
  );

  const askHint = useCallback(async () => {
    if (best === null || pending) return;
    setPending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzleId,
          bestRank: best,
          guessed: guesses.map((g) => g.word),
        }),
      });
      if (!res.ok) {
        setNotice({ tone: "info", text: "Tidak ada petunjuk lagi — kamu sudah sangat dekat." });
        return;
      }
      const hint = (await res.json()) as Guess;
      setGuesses((prev) => (prev.some((g) => g.word === hint.word) ? prev : [...prev, hint]));
      setLatest(hint);
      setFreshWord(hint.word);
      setNotice({ tone: "info", text: "Petunjuk terpakai." });
    } finally {
      setPending(false);
    }
  }, [best, guesses, pending, puzzleId]);

  const giveUp = useCallback(async () => {
    if (finished || pending) return;
    setPending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzleId }),
      });
      if (!res.ok) return;
      const { word } = (await res.json()) as { word: string };
      setRevealed(word);
      setSurrendered(true);
      setGuesses((prev) =>
        prev.some((g) => g.word === word) ? prev : [...prev, { word, rank: 1 }],
      );
      setFreshWord(word);
    } finally {
      setPending(false);
    }
  }, [finished, pending, puzzleId]);

  const share = useCallback(async () => {
    const summary = [
      `Wordheat #${puzzleId}`,
      solved
        ? `Ketemu dalam ${guessCount} tebakan.`
        : `Menyerah setelah ${guessCount} tebakan.`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      setNotice({ tone: "error", text: "Hasil gagal disalin." });
    }
  }, [guessCount, puzzleId, solved]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-6 px-4 py-8 sm:px-6">
      <GuessFxLayer fx={fx} vocabSize={vocabSize} />

      <header
        className="rise flex items-center justify-between gap-4"
        style={{ "--step": 0 } as React.CSSProperties}
      >
        <Wordmark />
        <ThemeToggle />
      </header>

      <div className="flex flex-col gap-1.5">
        <Link href="/" className="text-[13px] font-bold text-[var(--muted)]">
          Kembali
        </Link>
        <p className="text-center text-[22px] font-bold tracking-[-0.01em]">{puzzleLabel}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = inputRef.current?.value ?? "";
          if (inputRef.current) inputRef.current.value = "";
          void submit(value);
        }}
        className="rise flex gap-2"
        style={{ "--step": 1 } as React.CSSProperties}
      >
        <input
          ref={inputRef}
          type="text"
          name="guess"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={finished}
          placeholder={finished ? "Permainan selesai" : "Ketik tebakanmu"}
          aria-label="Kata tebakan"
          className="min-w-0 flex-1 rounded-pill border border-[var(--line)] bg-[var(--field)] px-5 py-3 text-[16px] outline-none placeholder:text-[var(--muted)] disabled:opacity-60"
        />
        {/* Sengaja tidak dinonaktifkan selama permintaan berjalan: browser
            menolak mengirim form lewat Enter kalau tombol submit-nya
            nonaktif, sehingga tebakan pemain yang mengetik cepat akan hilang
            tanpa jejak. */}
        <button
          type="submit"
          disabled={finished}
          className="rounded-pill bg-[var(--btn-bg)] px-6 py-3 text-[15px] font-bold text-[var(--btn-fg)] disabled:opacity-40"
        >
          Tebak
        </button>
      </form>

      {notice && (
        <p
          role="status"
          className={`-mt-3 text-[14px] ${notice.tone === "error" ? "text-flare" : "text-[var(--muted)]"}`}
        >
          {notice.text}
        </p>
      )}

      {finished && (
        <section className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-4">
          <p className="text-[15px]">
            {solved ? (
              <>
                Tepat. Kata rahasianya <strong>{revealed}</strong>, ketemu dalam{" "}
                <strong>{guessCount}</strong> tebakan.
              </>
            ) : (
              <>
                Kata rahasianya <strong>{revealed}</strong>.
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void share()}
              className="rounded-pill border border-[var(--line)] px-4 py-2 text-[13px] font-bold"
            >
              {copied ? "Tersalin" : "Salin hasil"}
            </button>
            <Link
              href="/"
              className="rounded-pill border border-[var(--line)] px-4 py-2 text-[13px] font-bold"
            >
              Main bersama teman
            </Link>
          </div>
        </section>
      )}

      {latest && !finished && (
        <section aria-label="Tebakan terakhir" className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Terakhir
          </p>
          <GuessRow {...latest} vocabSize={vocabSize} showLabel />
        </section>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-[var(--line)] pt-4 text-[13px]">
        <p className="text-[var(--muted)]">
          {guessCount === 0
            ? "Belum ada tebakan"
            : `${guessCount} tebakan · terdekat ${best?.toLocaleString("id-ID")}`}
        </p>
        {!finished && (
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => void askHint()}
              disabled={best === null || pending}
              className="font-bold underline underline-offset-4 disabled:opacity-35"
            >
              Petunjuk
            </button>
            <button
              type="button"
              onClick={() => void giveUp()}
              disabled={pending}
              className="text-[var(--muted)] underline underline-offset-4"
            >
              Menyerah
            </button>
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-[var(--muted)]">
          Mulai dari kata apa saja. Angka di kanan menunjukkan posisi kata itu di antara{" "}
          {vocabSize.toLocaleString("id-ID")} kata, diurutkan dari yang maknanya paling dekat
          dengan kata rahasia hari ini. Semakin kecil angkanya, semakin panas.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {sorted.map((guess) => (
            <li key={guess.word} ref={registerRow(guess.word)}>
              <GuessRow
                {...guess}
                vocabSize={vocabSize}
                fresh={guess.word === freshWord}
                flare={guess.word === flareWord}
              />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
