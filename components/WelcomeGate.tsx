"use client";

import { useEffect, useRef, useState } from "react";

import GoogleSignInButton from "@/components/GoogleSignInButton";

const SEEN_KEY = "wordheat:welcome-seen";

export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // Storage diblokir: jangan tampilkan berulang setiap render.
  }
}

function markWelcomeSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Tidak ada yang bisa disimpan; gerbang akan muncul lagi lain waktu, itu tidak fatal.
  }
}

/**
 * Gerbang pilihan pertama: masuk dengan Google, atau langsung main sebagai
 * tamu. Menutup gerbang dengan cara apa pun (klik di luar, Escape, atau
 * tombol tamu) dianggap sama -- "lanjutkan sebagai tamu" -- karena tidak ada
 * progres yang bisa hilang di sini, beda dengan ConfirmModal yang menjaga
 * tindakan destruktif.
 */
export default function WelcomeGate({ onDismiss }: { onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dismiss = () => {
    markWelcomeSeen();
    onDismiss();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Selamat datang di Wordheat"
        tabIndex={-1}
        className="w-full max-w-[24rem] rounded-lg border border-[var(--line)] bg-[var(--card)] p-5 outline-none"
      >
        <p className="text-[16px] font-bold">Selamat datang di Wordheat</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--muted)]">
          Masuk dengan Google untuk menyimpan progres dan berteman, atau langsung main sebagai
          tamu.
        </p>

        {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
          <div className="mt-4 flex justify-center">
            <GoogleSignInButton onError={setNotice} onSuccess={dismiss} />
          </div>
        )}

        {notice && (
          <p role="status" className="mt-2 text-center text-[13px] text-flare">
            {notice}
          </p>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="mt-4 w-full rounded-pill border border-[var(--line)] px-4 py-2.5 text-[14px] font-bold"
        >
          Lanjutkan sebagai tamu
        </button>
      </div>
    </div>
  );
}
