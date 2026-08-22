"use client";

import { useEffect, useRef, useState } from "react";

import { heatColor, heatLabel, heatLevel } from "@/lib/heat";

/**
 * Titik sampel untuk legenda skala suhu -- satu peringkat representatif per
 * label dari `heatLabel`, bukan seluruh rentang. Cukup untuk menunjukkan arah
 * dingin→panas tanpa menghitung ulang seluruh kurva log di sini.
 */
const SCALE_SAMPLES = [50000, 3000, 700, 150, 20, 1];

type Step = {
  title: string;
  body: React.ReactNode;
};

/**
 * Tutorial cara bermain, dibuka dari tombol "Cara Bermain" di landing page
 * (menggantikan chip "Sekian kata di kamus" yang lama -- angka mentah tidak
 * menjelaskan apa-apa ke pemain baru, sedangkan tombol ini membuka panduan
 * yang sungguh menjelaskan).
 *
 * Langkah kedua memakai GIF rekaman gameplay ASLI (bukan rekreasi CSS),
 * diambil langsung dari room sungguhan -- lihat public/tutorial/.
 */
export default function HowToPlayModal({
  vocabSize,
  onClose,
}: {
  vocabSize: number;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  /** 1 = maju ("Lanjut"), -1 = mundur ("Sebelumnya") -- menentukan arah slide-nya. */
  const [direction, setDirection] = useState<1 | -1>(1);
  const dialogRef = useRef<HTMLDivElement>(null);

  const goNext = () => {
    setDirection(1);
    setStep((s) => s + 1);
  };
  const goBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const steps: Step[] = [
    {
      title: "Satu kata rahasia",
      body: (
        <>
          <p className="text-[14px] leading-relaxed text-[var(--muted)]">
            Ada satu <strong className="text-[var(--fg)]">kata rahasia</strong>. Tiap kali kamu
            menebak, tebakanmu dinilai dari{" "}
            <strong className="text-[var(--fg)]">seberapa dekat maknanya</strong> dengan kata itu
            — bukan dari mirip hurufnya.
          </p>
          <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--field)] p-4">
            <p className="text-[13px] text-[var(--muted)]">
              Misalnya kata rahasianya <strong className="text-[var(--fg)]">topi</strong>:
            </p>
            <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-[var(--muted)]">
              <li>
                <strong className="text-[var(--fg)]">kepala</strong> → hangat, soalnya topi
                dipakai di kepala
              </li>
              <li>
                <strong className="text-[var(--fg)]">sepatu</strong> → panas, sama-sama barang
                yang dipakai
              </li>
              <li>
                <strong className="text-[var(--fg)]">makan</strong> → beku, tidak nyambung sama
                sekali
              </li>
            </ul>
          </div>
        </>
      ),
    },
    {
      title: "Ketik, lalu lihat baris memanas",
      body: (
        <>
          <p className="text-[14px] leading-relaxed text-[var(--muted)]">
            Ketik satu kata di kotak tebakan lalu tekan <strong className="text-[var(--fg)]">Tebak</strong>{" "}
            (atau Enter). Baris barunya langsung muncul dan mengisi sesuai jarak maknanya ke kata
            rahasia.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- GIF gameplay statis, bukan aset yang perlu dioptimasi next/image */}
          <img
            src="/tutorial/guess-demo.gif"
            alt="Rekaman mengetik tebakan lalu menekan tombol Tebak, baris baru muncul dengan warna sesuai kedekatan maknanya"
            className="mt-4 w-full rounded-lg border border-[var(--line)]"
          />
        </>
      ),
    },
    {
      title: "Baca peringkatnya",
      body: (
        <>
          <p className="text-[14px] leading-relaxed text-[var(--muted)]">
            Angka di kanan itu <strong className="text-[var(--fg)]">peringkat</strong> — posisi
            tebakanmu di antara kata-kata terdekat dari jawabannya. Makin kecil angkanya, makin
            dekat maknanya; peringkat 1 artinya tepat.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- screenshot statis dari papan sungguhan */}
          <img
            src="/tutorial/rank-scale.png"
            alt="Daftar tebakan sungguhan yang diurutkan dari peringkat terdekat ke terjauh"
            className="mt-4 w-full rounded-lg border border-[var(--line)]"
          />
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            {SCALE_SAMPLES.map((rank) => {
              const level = heatLevel(rank, vocabSize);
              return (
                <span key={rank} className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ background: heatColor(level, "dark") }}
                  />
                  {heatLabel(rank)}
                </span>
              );
            })}
          </div>
        </>
      ),
    },
    {
      title: "Main bareng teman",
      body: (
        <p className="text-[14px] leading-relaxed text-[var(--muted)]">
          Buat room, bagikan kodenya, lalu semua pemain menebak kata yang sama bersama-sama. Kamu
          bisa lihat seberapa dekat tebakan lawanmu — tapi tidak pernah tahu kata apa yang mereka
          ketik.
        </p>
      ),
    },
  ];

  const last = step === steps.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Cara bermain"
        tabIndex={-1}
        // `h-[42rem]` dipatok tetap -- tanpa ini dialog cuma menyusut/melebar
        // mengikuti konten tiap langkah (GIF di langkah 2 jauh lebih tinggi
        // daripada satu paragraf di langkah 4), jadi ukurannya melompat tiap
        // "Lanjut" ditekan. `max-h-[86dvh]` tetap jadi batas aman di layar
        // pendek -- begitu terpotong, area konten (flex-1 + overflow-y-auto
        // di bawah) yang menggulir sendiri, bukan dialognya yang berubah tinggi.
        className="flex h-[42rem] max-h-[86dvh] w-full max-w-[30rem] flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--card)] outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <p className="text-[13px] font-mono uppercase tracking-[0.12em] text-[var(--muted)]">
            Cara bermain · {step + 1}/{steps.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-full p-1 text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-4">
              <path d="M5 5l14 14M19 5 5 19" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-4">
          {/* `key={step}` bikin React memasang ulang elemen ini tiap langkah
              berganti (bukan sekadar memperbarui isinya) -- itu yang membuat
              animasi CSS-nya main lagi dari awal setiap "Lanjut"/"Sebelumnya"
              ditekan, alih-alih cuma sekali di kunjungan pertama. */}
          <div key={step} data-direction={direction} className="step-content">
            <p className="text-[18px] font-bold tracking-[-0.01em]">{steps[step].title}</p>
            <div className="mt-2">{steps[step].body}</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] px-5 py-4">
          <div className="flex gap-1.5">
            {steps.map((s, i) => (
              <span
                key={s.title}
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: i === step ? "var(--fg)" : "var(--line)" }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-pill border border-[var(--line)] px-4 py-2 text-[13px] font-bold"
              >
                Sebelumnya
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? onClose() : goNext())}
              className="rounded-pill bg-[var(--btn-bg)] px-4 py-2 text-[13px] font-bold text-[var(--btn-fg)]"
            >
              {last ? "Main sekarang" : "Lanjut"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
