"use client";

import { useCallback, useState } from "react";

import { useAccount } from "@/components/AccountProvider";
import ChatModal from "@/components/ChatModal";
import type { PublicProfile } from "@/lib/profile";

/**
 * Tombol aksi sosial di halaman profil pemain lain.
 *
 * Kosong kalau belum login atau sedang melihat profil sendiri. Status
 * pertemanan dibaca dari saluran pribadi (AccountProvider) yang sudah
 * selalu terbuka, bukan lewat permintaan server terpisah.
 */
export default function PlayerProfileActions({ profile }: { profile: PublicProfile }) {
  const { me, loaded } = useAccount();
  const [chatOpen, setChatOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  const sendRequest = useCallback(async () => {
    if (sending) return;
    setSending(true);
    setError(false);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", username: profile.username }),
      });
      if (!res.ok) setError(true);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  }, [profile.username, sending]);

  if (!loaded || !me || me.account.id === profile.id) return null;

  const isFriend = me.friends.some((f) => f.id === profile.id);
  const pending = me.outgoing.some((r) => r.profile.id === profile.id);

  if (isFriend) {
    return (
      <>
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="shrink-0 rounded-pill bg-[var(--btn-bg)] px-5 py-2.5 text-[14px] font-bold text-[var(--btn-fg)]"
        >
          Chat
        </button>
        {chatOpen && <ChatModal friend={profile} onClose={() => setChatOpen(false)} />}
      </>
    );
  }

  if (pending) {
    return (
      <span className="shrink-0 rounded-pill border border-[var(--line)] px-5 py-2.5 text-[14px] text-[var(--muted)]">
        Menunggu jawaban
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void sendRequest()}
      disabled={sending}
      className="shrink-0 rounded-pill border border-[var(--line)] px-5 py-2.5 text-[14px] font-bold disabled:opacity-50"
    >
      {sending ? "Mengirim…" : error ? "Gagal, coba lagi" : "Tambah teman"}
    </button>
  );
}
