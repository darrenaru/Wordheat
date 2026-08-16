"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Avatar from "@/components/Avatar";
import { SendIcon } from "@/components/icons";
import type { AvatarChoices } from "@/lib/avatar";
import { EMOJI_NAMES, emojiSrc, renderWithEmoji } from "@/lib/emoji";

type ChatEntry = { id: string; playerId: string; text: string; at: number };

type RoomPlayer = {
  id: string;
  name: string;
  avatarSeed?: string;
  avatarBg?: string;
  avatarChoices?: AvatarChoices;
};

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
 * Obrolan bersama satu room.
 *
 * Isi obrolannya sepenuhnya dikendalikan dari luar (props) -- RoomBoard sudah
 * punya aliran SSE room yang hidup, jadi modal ini tidak perlu koneksi atau
 * pengambilan datanya sendiri, tinggal menampilkan apa yang sudah mengalir
 * masuk.
 */
export default function RoomChatModal({
  chat,
  players,
  myPlayerId,
  onSend,
  onClose,
}: {
  chat: ChatEntry[];
  players: RoomPlayer[];
  myPlayerId: string;
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
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
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [chat]);

  // Di layar sempit modal ini penuh satu layar, tapi Safari iOS punya dua bug
  // sekaligus saat papan ketik terbuka: elemen `fixed` tidak ikut menyusut ke
  // tinggi yang benar-benar terlihat (masih memakai ukuran sebelum keyboard
  // muncul), DAN halamannya sendiri ikut digeser (scroll) supaya kolom yang
  // difokus tetap terlihat di atas keyboard -- padahal elemen `fixed` tetap
  // menempel ke titik asal viewport tata letak (bukan viewport yang benar-
  // benar terlihat), sehingga ia ikut "terbang" ke luar layar mengikuti
  // pergeseran itu. Memperbaiki tinggi saja (versi sebelumnya) tidak cukup
  // untuk bug kedua ini -- overlay-nya sendiri perlu disamakan persis dengan
  // posisi & ukuran visualViewport (offsetTop/offsetLeft ikut diperhitungkan,
  // bukan cuma height), baru dialognya (lewat items-stretch) ikut pas.
  useEffect(() => {
    const overlay = overlayRef.current;
    const vv = window.visualViewport;
    if (!overlay || !vv) return;

    const reset = () => {
      overlay.style.top = "";
      overlay.style.left = "";
      overlay.style.right = "";
      overlay.style.bottom = "";
      overlay.style.width = "";
      overlay.style.height = "";
    };

    const applyViewport = () => {
      if (window.innerWidth >= 640) {
        reset();
        return;
      }
      overlay.style.top = `${vv.offsetTop}px`;
      overlay.style.left = `${vv.offsetLeft}px`;
      overlay.style.right = "auto";
      overlay.style.bottom = "auto";
      overlay.style.width = `${vv.width}px`;
      overlay.style.height = `${vv.height}px`;
    };

    applyViewport();
    vv.addEventListener("resize", applyViewport);
    vv.addEventListener("scroll", applyViewport);
    return () => {
      vv.removeEventListener("resize", applyViewport);
      vv.removeEventListener("scroll", applyViewport);
      reset();
    };
  }, []);

  const playerOf = useCallback((id: string) => players.find((p) => p.id === id), [players]);

  const send = useCallback(() => {
    const body = text.trim();
    if (!body) return;
    onSend(body);
    setText("");
  }, [onSend, text]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Chat room"
        tabIndex={-1}
        className="flex w-full flex-col overflow-hidden border-[var(--line)] bg-[var(--card)] outline-none sm:h-[85dvh] sm:max-w-[28rem] sm:rounded-lg sm:border"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <span className="text-[15px] font-bold">Chat room</span>
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

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {chat.length === 0 ? (
            <p className="text-[13px] text-[var(--muted)]">
              Belum ada obrolan. Sapa pemain lain di room ini.
            </p>
          ) : (
            chat.map((msg) => {
              const mine = msg.playerId === myPlayerId;
              const sender = playerOf(msg.playerId);
              const name = sender?.name ?? "Pemain";
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                  <Avatar
                    seed={sender?.avatarSeed}
                    bg={sender?.avatarBg}
                    choices={sender?.avatarChoices}
                    name={name}
                    size={26}
                  />
                  <div className={`flex max-w-[72%] flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
                    {!mine && <span className="px-1 text-[11px] text-[var(--muted)]">{name}</span>}
                    <p
                      className={`whitespace-pre-wrap break-words rounded-lg border px-3 py-2 text-[14px] leading-relaxed ${
                        mine
                          ? "border-transparent bg-[var(--btn-bg)] text-[var(--btn-fg)]"
                          : "border-[var(--line)] bg-[var(--field)] text-[var(--fg)]"
                      }`}
                    >
                      {renderWithEmoji(msg.text)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

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
            send();
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
            maxLength={300}
            placeholder="Tulis pesan…"
            aria-label="Pesan"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-pill border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-[14px] outline-none placeholder:text-[var(--muted)]"
          />
          <button
            type="submit"
            disabled={!text.trim()}
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
