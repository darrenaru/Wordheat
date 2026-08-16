"use client";

import { useCallback, useState } from "react";

import GoogleSignInButton from "@/components/GoogleSignInButton";
import Wordmark from "@/components/Wordmark";
import { useAccount } from "@/components/AccountProvider";
import type { PublicProfile } from "@/lib/profile";

/**
 * Gerbang wajib: tidak ada halaman yang dirender sampai pengunjung punya
 * akun (Google atau tamu). Beda sengaja dari WelcomeGate lama -- tidak ada
 * Escape/backdrop-click, dan ini pengganti konten (bukan modal di atasnya),
 * jadi tidak ada apa pun untuk diintip sebelum akun ada.
 */
export default function AccountGate({ children }: { children: React.ReactNode }) {
  const { loaded, hasAccount, adopt } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continueAsGuest = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "Gagal membuat akun tamu. Coba lagi.");
        return;
      }
      if (data.recoveryCode) {
        sessionStorage.setItem("wordheat:new-recovery", data.recoveryCode);
      }
      adopt(data.account as PublicProfile);
    } catch {
      setError("Koneksi ke server terputus.");
    } finally {
      setBusy(false);
    }
  }, [adopt, busy]);

  if (!loaded) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Wordmark href={null} />
      </main>
    );
  }

  if (!hasAccount) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col items-center justify-center gap-4 px-4 text-center">
        <Wordmark href={null} />
        <div className="w-full rounded-lg border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="text-[17px] font-bold">Selamat datang di Wordheat</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--muted)]">
            Masuk dengan Google supaya progres dan daftar temanmu tersimpan,
            atau langsung main sebagai tamu.
          </p>
          <div className="mt-4 flex justify-center">
            <GoogleSignInButton onError={setError} />
          </div>
          <button
            type="button"
            onClick={() => void continueAsGuest()}
            disabled={busy}
            className="mt-3 w-full rounded-pill border border-[var(--line)] px-5 py-3 text-[15px] font-bold disabled:opacity-50"
          >
            {busy ? "Menyiapkan akun…" : "Lanjutkan sebagai tamu"}
          </button>
          {error && (
            <p role="status" className="mt-3 text-[14px] text-flare">
              {error}
            </p>
          )}
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
