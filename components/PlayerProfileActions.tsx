"use client";

import { useCallback, useState } from "react";

import { useAccount } from "@/components/AccountProvider";
import ChatModal from "@/components/ChatModal";
import ConfirmModal from "@/components/ConfirmModal";
import { AddFriendIcon, ChatIcon, PendingIcon, RemoveFriendIcon } from "@/components/icons";
import type { PublicProfile } from "@/lib/profile";

function Icon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-[18px]"}
    >
      {children}
    </svg>
  );
}

const BUTTON_CLASS =
  "shrink-0 rounded-pill border border-[var(--line)] p-2.5 transition-colors hover:border-[var(--fg)]/35 hover:text-[var(--fg)] disabled:cursor-default disabled:opacity-50";

/**
 * Tombol aksi sosial di halaman profil pemain lain -- ikon saja, tanpa teks,
 * supaya tidak bersaing dengan nama/avatar di header kartu profil. Label
 * aksinya tetap ada lewat aria-label/title untuk pembaca layar dan tooltip.
 *
 * Kosong kalau belum login atau sedang melihat profil sendiri. Status
 * pertemanan dibaca dari saluran pribadi (AccountProvider) yang sudah
 * selalu terbuka, bukan lewat permintaan server terpisah.
 */
export default function PlayerProfileActions({ profile }: { profile: PublicProfile }) {
  const { me, loaded } = useAccount();
  const [chatOpen, setChatOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const friendAction = useCallback(
    async (body: Record<string, unknown>) => {
      if (busy) return false;
      setBusy(true);
      setError(false);
      try {
        const res = await fetch("/api/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          setError(true);
          return false;
        }
        return true;
      } catch {
        setError(true);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  if (!loaded || !me || me.account.id === profile.id) return null;

  const isFriend = me.friends.some((f) => f.id === profile.id);
  const outgoingRequest = me.outgoing.find((r) => r.profile.id === profile.id);

  if (isFriend) {
    return (
      <>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            aria-label={`Chat dengan ${profile.displayName}`}
            title="Chat"
            className={`${BUTTON_CLASS} text-[var(--muted)]`}
          >
            <Icon>{ChatIcon}</Icon>
          </button>
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            aria-label={`Hapus ${profile.displayName} dari daftar teman`}
            title="Hapus teman"
            className={`${BUTTON_CLASS} text-[var(--muted)]`}
          >
            <Icon>{RemoveFriendIcon}</Icon>
          </button>
        </div>
        {chatOpen && <ChatModal friend={profile} onClose={() => setChatOpen(false)} />}
        {confirmRemove && (
          <ConfirmModal
            title="Hapus teman?"
            message={`${profile.displayName} akan dihapus dari daftar temanmu. Kalian bisa berteman lagi lewat username kapan saja.`}
            confirmLabel="Ya, hapus"
            onCancel={() => setConfirmRemove(false)}
            onConfirm={() => {
              setConfirmRemove(false);
              void friendAction({ action: "remove", friendId: profile.id });
            }}
          />
        )}
      </>
    );
  }

  if (outgoingRequest) {
    return (
      <button
        type="button"
        onClick={() => void friendAction({ action: "decline", requestId: outgoingRequest.id })}
        disabled={busy}
        aria-label={`Batalkan permintaan pertemanan ke ${profile.displayName}`}
        title={error ? "Gagal, coba lagi" : "Menunggu jawaban — ketuk untuk batalkan"}
        className={`${BUTTON_CLASS} ${error ? "text-flare" : "text-[var(--muted)]"}`}
      >
        <Icon>{PendingIcon}</Icon>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void friendAction({ action: "request", username: profile.username })}
      disabled={busy}
      aria-label={`Tambah ${profile.displayName} sebagai teman`}
      title={error ? "Gagal, coba lagi" : "Tambah teman"}
      className={`${BUTTON_CLASS} ${error ? "text-flare" : "text-[var(--muted)]"}`}
    >
      <Icon>{AddFriendIcon}</Icon>
    </button>
  );
}
