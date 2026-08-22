"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import Avatar from "@/components/Avatar";
import ThemeToggle from "@/components/ThemeToggle";
import Wordmark from "@/components/Wordmark";
import { useAccount } from "@/components/AccountProvider";
import ChatModal from "@/components/ChatModal";
import ConfirmModal from "@/components/ConfirmModal";
import FriendSearch from "@/components/FriendSearch";
import PlayerProfileModal from "@/components/PlayerProfileModal";
import PresenceDot from "@/components/PresenceDot";
import { AddFriendIcon, ChatIcon } from "@/components/icons";
import type { FriendPresence, PublicProfile } from "@/lib/profile";

type Notice = { tone: "error" | "info"; text: string } | null;

function Header() {
  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
        <Wordmark />
        <ThemeToggle />
      </header>
      <div className="flex flex-col gap-1.5">
        <Link href="/" className="text-[13px] font-bold text-[var(--muted)]">
          Kembali
        </Link>
        <p className="text-center text-[22px] font-bold tracking-[-0.01em]">Teman</p>
      </div>
    </>
  );
}

/** Avatar+nama yang bisa diklik untuk membuka profil publik pemain itu. */
function ProfileButton({ profile }: { profile: FriendPresence | PublicProfile }) {
  const [open, setOpen] = useState(false);
  const status = "status" in profile ? profile.status : undefined;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left hover:underline"
      >
        <Avatar
          seed={profile.avatarSeed}
          bg={profile.avatarBg}
          choices={profile.avatarChoices}
          name={profile.displayName}
          size={36}
        />
        <span className="min-w-0">
          <span className="block truncate text-[15px]">{profile.displayName}</span>
          <span className="block truncate font-mono text-[12px] text-[var(--muted)]">
            @{profile.username}
          </span>
          {status && <PresenceDot status={status} withLabel className="mt-0.5" />}
        </span>
      </button>
      {open && <PlayerProfileModal username={profile.username} onClose={() => setOpen(false)} />}
    </>
  );
}

function NeedsProfile() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-6 px-4 py-8 sm:px-6">
      <Header />
      <section className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-5">
        <p className="text-[15px] font-bold">Butuh profil dulu</p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
          Berteman dan chat butuh profil supaya kamu bisa dikenali pemain lain.
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded-pill bg-[var(--btn-bg)] px-5 py-2.5 text-[14px] font-bold text-[var(--btn-fg)]"
        >
          Buat profil
        </Link>
      </section>
    </main>
  );
}

function QuickAddCard({ token }: { token: string }) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [regenerating, setRegenerating] = useState(false);

  const shareLink = useCallback(async () => {
    if (!token) return;
    const url = `${window.location.origin}/friend/${token}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Wordheat",
          text: "Yuk berteman denganku di Wordheat!",
          url,
        });
      } catch {
        // Dibatalkan pengguna atau gagal diam-diam -- tidak perlu ditindaklanjuti.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setNotice({ tone: "error", text: "Tautan gagal disalin." });
    }
  }, [token]);

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    setNotice(null);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate-quick-add" }),
      });
      if (!res.ok) throw new Error();
      setNotice({ tone: "info", text: "Tautan lama berhenti berfungsi. Bagikan yang baru." });
    } catch {
      setNotice({ tone: "error", text: "Tautan gagal diperbarui." });
    } finally {
      setRegenerating(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--line)] bg-[var(--field)] p-3">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-[var(--muted)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[18px]"
          >
            {AddFriendIcon}
          </svg>
        </span>
        <p className="text-[14px] font-bold">Tambah cepat</p>
      </div>
      <p className="text-[13px] leading-relaxed text-[var(--muted)]">
        Bagikan tautan ini ke teman lewat WhatsApp, Telegram, atau platform apa pun -- mereka
        langsung jadi temanmu begitu tautannya dibuka, tanpa permintaan pertemanan.
      </p>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void shareLink()}
          disabled={!token}
          className="rounded-pill bg-[var(--btn-bg)] px-4 py-2 text-[13px] font-bold text-[var(--btn-fg)] disabled:opacity-50"
        >
          {linkCopied ? "Tautan tersalin" : "Bagikan tautan"}
        </button>
        <button
          type="button"
          onClick={() => void regenerate()}
          disabled={regenerating}
          className="text-[12px] text-[var(--muted)] underline decoration-dotted disabled:opacity-50"
        >
          Buat tautan baru
        </button>
      </div>
      {notice && (
        <p
          role="status"
          className={`text-[12px] ${notice.tone === "error" ? "text-flare" : "text-[var(--muted)]"}`}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}

function FriendsView() {
  const { me } = useAccount();
  const account = me!.account;

  const [friendNotice, setFriendNotice] = useState<Notice>(null);
  const [chatWith, setChatWith] = useState<PublicProfile | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<PublicProfile | null>(null);

  const friendAction = useCallback(
    async (body: Record<string, unknown>, successText?: string) => {
      setFriendNotice(null);
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFriendNotice({ tone: "error", text: data?.message ?? "Tidak berhasil." });
        return false;
      }
      if (successText) setFriendNotice({ tone: "info", text: successText });
      return true;
    },
    [],
  );

  const addFriend = useCallback(async (username: string): Promise<boolean> => {
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", username }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFriendNotice({ tone: "error", text: data?.message ?? "Tidak berhasil." });
      return false;
    }
    setFriendNotice({
      tone: "info",
      text: data.autoAccepted
        ? `Kalian sekarang berteman — ${data.to.displayName} ternyata sudah mengirim permintaan lebih dulu.`
        : `Permintaan dikirim ke ${data.to.displayName}.`,
    });
    return true;
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-6 px-4 py-8 sm:px-6">
      <Header />

      <section className="flex flex-col gap-4 rounded-lg border border-[var(--line)] bg-[var(--card)] p-5">
        <div>
          <p className="text-[17px] font-bold">Teman</p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Bagikan tautan tambah cepat, atau cari lewat username.
          </p>
        </div>

        <QuickAddCard token={me!.quickAddToken} />

        <FriendSearch onSubmit={addFriend} />

        {friendNotice && (
          <p
            role="status"
            className={`text-[13px] ${friendNotice.tone === "error" ? "text-flare" : "text-[var(--muted)]"}`}
          >
            {friendNotice.text}
          </p>
        )}

        {me!.incoming.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Permintaan masuk · {me!.incoming.length}
            </p>
            {me!.incoming.map((request) => (
              <div
                key={request.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2.5"
              >
                <ProfileButton profile={request.profile} />
                <button
                  type="button"
                  onClick={() => void friendAction({ action: "accept", requestId: request.id })}
                  className="shrink-0 rounded-pill bg-[var(--btn-bg)] px-4 py-2 text-[13px] font-bold text-[var(--btn-fg)]"
                >
                  Terima
                </button>
                <button
                  type="button"
                  onClick={() => void friendAction({ action: "decline", requestId: request.id })}
                  className="shrink-0 rounded-pill border border-[var(--line)] px-3 py-2 text-[13px] text-[var(--muted)]"
                >
                  Tolak
                </button>
              </div>
            ))}
          </div>
        )}

        {me!.outgoing.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Menunggu jawaban · {me!.outgoing.length}
            </p>
            {me!.outgoing.map((request) => (
              <div
                key={request.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2.5"
              >
                <ProfileButton profile={request.profile} />
                <button
                  type="button"
                  onClick={() => void friendAction({ action: "decline", requestId: request.id })}
                  className="shrink-0 rounded-pill border border-[var(--line)] px-3 py-2 text-[13px] text-[var(--muted)]"
                >
                  Batalkan
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Berteman · {me!.friends.length}
          </p>
          {me!.friends.length === 0 ? (
            <p className="text-[14px] leading-relaxed text-[var(--muted)]">
              Belum ada teman. Bagikan username <strong>@{account.username}</strong> supaya
              mereka bisa menemukanmu.
            </p>
          ) : (
            me!.friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2.5"
              >
                <ProfileButton profile={friend} />
                <button
                  type="button"
                  onClick={() => setChatWith(friend)}
                  aria-label={`Buka chat dengan ${friend.displayName}`}
                  className="relative shrink-0 rounded-pill border border-[var(--line)] p-2 text-[var(--muted)] transition-colors hover:border-[var(--fg)]/35 hover:text-[var(--fg)]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-[18px]"
                  >
                    {ChatIcon}
                  </svg>
                  {(me!.unreadMessages[friend.id] ?? 0) > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 grid size-[16px] place-items-center rounded-full bg-flare text-[10px] font-bold text-[#150710]"
                    >
                      {me!.unreadMessages[friend.id]}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(friend)}
                  className="shrink-0 rounded-pill border border-[var(--line)] px-3 py-2 text-[13px] text-[var(--muted)]"
                >
                  Hapus
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {chatWith && <ChatModal friend={chatWith} onClose={() => setChatWith(null)} />}

      {confirmRemove && (
        <ConfirmModal
          title="Hapus teman?"
          message={`${confirmRemove.displayName} akan dihapus dari daftar temanmu. Kalian bisa berteman lagi lewat username kapan saja.`}
          confirmLabel="Ya, hapus"
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => {
            void friendAction({ action: "remove", friendId: confirmRemove.id });
            setConfirmRemove(null);
          }}
        />
      )}
    </main>
  );
}

export default function FriendsPanel() {
  const { me, loaded } = useAccount();

  if (!loaded) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-6 px-4 py-8 sm:px-6">
        <Header />
        <p className="text-[15px] text-[var(--muted)]">Memuat…</p>
      </main>
    );
  }

  return me ? <FriendsView /> : <NeedsProfile />;
}
