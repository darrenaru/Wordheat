"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Avatar from "@/components/Avatar";
import { useAccount } from "@/components/AccountProvider";
import { SendIcon } from "@/components/icons";
import { EMOJI_NAMES, emojiSrc, renderWithEmoji } from "@/lib/emoji";
import type { PublicProfile } from "@/lib/profile";

type ChatMessage = { id: string; fromId: string; body: string; at: number };

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

/**
 * Obrolan langsung dengan satu teman.
 *
 * Riwayatnya dimuat ulang tiap kali jumlah pesan-belum-dibaca dari teman ini
 * berubah (dikabari lewat saluran pribadi di AccountProvider), bukan lewat
 * koneksi SSE sendiri -- browser membatasi jumlah koneksi serentak, dan
 * saluran pribadi itu sudah selalu terbuka.
 */
export default function ChatModal({
  friend,
  onClose,
}: {
  friend: PublicProfile;
  onClose: () => void;
}) {
  const { me } = useAccount();
  const myId = me?.account.id;
  const unread = me?.unreadMessages[friend.id] ?? 0;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/messages?friendId=${encodeURIComponent(friend.id)}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { messages: ChatMessage[] };
        setMessages(data.messages);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [friend.id, unread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sending || !myId) return;
    setSending(true);
    setError(null);

    // Optimis: pesan langsung tampil, ditimpa balikan server begitu tiba.
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, fromId: myId, body, at: Date.now() }]);
    setText("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: friend.id, text: body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Pesan gagal dikirim.");
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        return;
      }
      const data = (await res.json()) as { message: ChatMessage };
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? data.message : m)));
    } catch {
      setError("Koneksi terputus. Pesan belum terkirim.");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
      setSending(false);
    }
  }, [friend.id, myId, sending, text]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Chat dengan ${friend.displayName}`}
        tabIndex={-1}
        className="flex w-full max-w-[28rem] flex-col overflow-hidden border-[var(--line)] bg-[var(--card)] outline-none sm:h-[85dvh] sm:rounded-lg sm:border"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar
              seed={friend.avatarSeed}
              bg={friend.avatarBg}
              choices={friend.avatarChoices}
              name={friend.displayName}
              size={32}
            />
            <span className="truncate text-[15px] font-bold">{friend.displayName}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
          >
            <Icon className="size-5">
              <path d="M6 6l12 12M18 6 6 18" />
            </Icon>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
          {!loaded ? (
            <p className="text-[13px] text-[var(--muted)]">Memuat obrolan…</p>
          ) : messages.length === 0 ? (
            <p className="text-[13px] text-[var(--muted)]">
              Belum ada pesan. Sapa {friend.displayName} duluan.
            </p>
          ) : (
            messages.map((msg) => {
              const mine = msg.fromId === myId;
              return (
                <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <p
                    className={`max-w-[80%] whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-[14px] leading-relaxed ${
                      mine
                        ? "border-transparent bg-[var(--btn-bg)] text-[var(--btn-fg)]"
                        : "border-[var(--line)] bg-[var(--field)] text-[var(--fg)]"
                    }`}
                  >
                    {renderWithEmoji(msg.body)}
                  </p>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p role="status" className="shrink-0 px-4 pb-2 text-[13px] text-flare">{error}</p>}

        {pickerOpen && (
          <div className="grid max-h-[9rem] shrink-0 grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-1 overflow-y-auto border-t border-[var(--line)] p-2">
            {EMOJI_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setText((t) => `${t}:${name}: `)}
                aria-label={name.replace(/-/g, " ")}
                className="grid aspect-square place-items-center rounded-lg transition-colors hover:bg-[var(--field)]"
              >
                <img src={emojiSrc(name)} alt="" width={22} height={22} className="block" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex shrink-0 items-center gap-2 border-t border-[var(--line)] p-3"
        >
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-label="Pilih emoji"
            aria-pressed={pickerOpen}
            className={`shrink-0 rounded-full p-1 transition-colors ${
              pickerOpen ? "bg-[var(--field)]" : ""
            }`}
          >
            <img src={emojiSrc("slightly-smiling-face")} alt="" width={24} height={24} />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="Tulis pesan…"
            aria-label="Pesan"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-pill border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-[14px] outline-none placeholder:text-[var(--muted)]"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            aria-label="Kirim"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--btn-bg)] text-[var(--btn-fg)] disabled:opacity-40"
          >
            <Icon className="size-[18px]">{SendIcon}</Icon>
          </button>
        </form>
      </div>
    </div>
  );
}
