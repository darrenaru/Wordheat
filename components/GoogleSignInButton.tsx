"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAccount } from "@/components/AccountProvider";
import type { PublicProfile } from "@/lib/profile";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

/**
 * Tombol resmi "Sign In With Google". Digambar oleh skrip Google sendiri
 * (bukan ikon buatan tangan seperti di components/icons.tsx) karena pedoman
 * merek Google mewajibkan aset tombol resminya.
 *
 * Kalau Client ID belum diatur atau skripnya gagal dimuat (mis. diblokir
 * pemblokir iklan), komponen ini cukup tidak menampilkan apa-apa -- jalur
 * tamu dan kode pemulihan yang sudah ada sama sekali tidak terpengaruh,
 * karena tombol ini murni tambahan dan tidak pernah menghalangi apa pun.
 */
export default function GoogleSignInButton({
  onError,
  onSuccess,
}: {
  onError: (message: string) => void;
  /** Dipanggil setelah sesi berhasil dibuat -- mis. supaya modal pemanggil menutup diri. */
  onSuccess?: () => void;
}) {
  const { adopt } = useAccount();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const handleCredential = useCallback(
    async (response: { credential: string }) => {
      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: response.credential }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          onError(data?.message ?? "Masuk dengan Google gagal.");
          return;
        }
        if (data.recoveryCode) {
          // Pola yang sama dengan pendaftaran manual di ProfilePanel: disimpan
          // di sessionStorage supaya tetap terbaca setelah provider memuat
          // ulang keadaan akun dan mengganti tampilan halaman.
          sessionStorage.setItem("wordheat:new-recovery", data.recoveryCode);
        }
        adopt(data.account as PublicProfile);
        onSuccess?.();
      } catch {
        onError("Koneksi ke server terputus.");
      }
    },
    [adopt, onError, onSuccess],
  );

  useEffect(() => {
    if (!scriptReady || !clientId || !window.google || !containerRef.current) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => void handleCredential(response),
    });

    window.google.accounts.id.renderButton(containerRef.current, {
      // "outline" (latar terang bawaan Google) dipakai alih-alih
      // "filled_black": pada varian tombol "Continue as [nama]" yang muncul
      // ketika sesi Google di browser sudah dikenali, badge logo Google
      // selalu berlatar putih -- di atas tombol gelap itu terlihat seperti
      // bentuk putih yang menabrak. Latar terang bawaan ini konsisten di
      // semua varian tombol tanpa perlu menimpa gaya resmi Google.
      theme: "outline",
      size: "large",
      // "rectangular", bukan "pill": pada varian "Continue as [nama]", badge
      // logo Google berupa kotak bersudut tegas yang tidak ikut melengkung
      // mengikuti kontainer -- di dalam kontainer "pill" (melengkung penuh)
      // sudut kotak itu terlihat menonjol keluar dari garis lengkungnya.
      // Kontainer persegi menghindari benturan bentuk itu sepenuhnya, tanpa
      // perlu menimpa gaya resmi Google.
      shape: "rectangular",
      width: 320,
      text: "continue_with",
    });
  }, [scriptReady, clientId, handleCredential]);

  if (!clientId) return null;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div ref={containerRef} />
    </>
  );
}
