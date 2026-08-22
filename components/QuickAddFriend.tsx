"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import Avatar from "@/components/Avatar";
import Wordmark from "@/components/Wordmark";
import { useAccount } from "@/components/AccountProvider";
import type { PublicProfile } from "@/lib/profile";

type Result =
  | { state: "pending" }
  | { state: "done"; friend: PublicProfile; alreadyFriends: boolean }
  | { state: "error"; message: string };

/**
 * Tautan "Tambah Cepat" -- membuka halaman ini langsung menjadikan pembuka
 * dan pemilik tautan berteman, tanpa proses kirim/terima. Gerbang akun
 * global (AccountGate, di layout) menjamin `hasAccount` sudah `true` sebelum
 * komponen ini sempat mount, jadi tidak perlu pilihan Login/tamu di sini --
 * hanya menunggu `me` terisi lewat SSE sebelum memicu permintaannya.
 */
export default function QuickAddFriend({ token }: { token: string }) {
  const { me, loaded } = useAccount();
  const [result, setResult] = useState<Result>({ state: "pending" });
  const attempted = useRef(false);

  useEffect(() => {
    if (!loaded || !me || attempted.current) return;
    attempted.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/friends/quick-add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setResult({
            state: "error",
            message: data?.message ?? "Tautan gagal diproses.",
          });
          return;
        }
        setResult({
          state: "done",
          friend: data.friend as PublicProfile,
          alreadyFriends: Boolean(data.alreadyFriends),
        });
      } catch {
        setResult({ state: "error", message: "Koneksi ke server terputus." });
      }
    })();
  }, [loaded, me, token]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col items-center justify-center gap-5 px-4 text-center">
      <Wordmark href={null} />
      <section className="w-full rounded-lg border border-[var(--line)] bg-[var(--card)] p-6">
        {result.state === "pending" && (
          <p className="text-[15px] text-[var(--muted)]">Menambahkan teman…</p>
        )}

        {result.state === "error" && (
          <>
            <p className="text-[17px] font-bold">Tidak berhasil</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--muted)]">
              {result.message}
            </p>
            <Link
              href="/friends"
              className="mt-4 inline-block rounded-pill bg-[var(--btn-bg)] px-5 py-2.5 text-[14px] font-bold text-[var(--btn-fg)]"
            >
              Ke daftar teman
            </Link>
          </>
        )}

        {result.state === "done" && (
          <>
            <div className="flex justify-center">
              <Avatar
                seed={result.friend.avatarSeed}
                bg={result.friend.avatarBg}
                choices={result.friend.avatarChoices}
                name={result.friend.displayName}
                size={64}
              />
            </div>
            <p className="mt-3 break-words text-[17px] font-bold">
              {result.alreadyFriends
                ? `Kalian sudah berteman dengan ${result.friend.displayName}`
                : `Kamu dan ${result.friend.displayName} sekarang berteman!`}
            </p>
            <p className="mt-1.5 font-mono text-[13px] text-[var(--muted)]">
              @{result.friend.username}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/friends"
                className="rounded-pill bg-[var(--btn-bg)] px-5 py-2.5 text-[14px] font-bold text-[var(--btn-fg)]"
              >
                Ke daftar teman
              </Link>
              <Link
                href="/"
                className="rounded-pill border border-[var(--line)] px-5 py-2.5 text-[14px] font-bold"
              >
                Main sekarang
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
