"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Avatar from "@/components/Avatar";
import GuessRow from "@/components/GuessRow";
import PlayerProfileModal from "@/components/PlayerProfileModal";
import RoomChatModal from "@/components/RoomChatModal";
import ThemeToggle from "@/components/ThemeToggle";
import Wordmark from "@/components/Wordmark";
import { useAccount } from "@/components/AccountProvider";
import { ChatIcon } from "@/components/icons";
import type { AvatarChoices } from "@/lib/avatar";
import { applyAmbientHeat, flarePage } from "@/lib/ambient";
import { forgetMembership, readMembership, readPlayerName, rememberMembership, storePlayerName } from "@/lib/session";
import { normalizeWord } from "@/lib/word";

type FeedEntry = { word: string; rank: number; by: string; byId: string; at: number };

type ChatEntry = { id: string; playerId: string; text: string; at: number };

type RoomView = {
  code: string;
  status: "lobby" | "playing" | "finished";
  hostId: string;
  puzzleId: number;
  vocabSize: number;
  players: {
    id: string;
    accountId?: string;
    username?: string;
    name: string;
    avatarSeed?: string;
    avatarBg?: string;
    avatarChoices?: AvatarChoices;
    isHost: boolean;
    online: boolean;
    guessCount: number;
    bestRank: number | null;
    solvedAt?: number;
  }[];
  feed: FeedEntry[];
  chat: ChatEntry[];
  winner?: { id: string; name: string; guessCount: number };
  answer?: string;
};

type Notice = { tone: "error" | "info"; text: string } | null;

export default function RoomBoard({ code }: { code: string }) {
  const { me } = useAccount();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [invited, setInvited] = useState<Record<string, boolean>>({});
  const [room, setRoom] = useState<RoomView | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [connection, setConnection] = useState<"connecting" | "live" | "lost">("connecting");
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [freshWord, setFreshWord] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [seenChatCount, setSeenChatCount] = useState(0);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const submitSeq = useRef(0);
  const flaredFor = useRef<string | null>(null);

  useEffect(() => {
    setPlayerId(readMembership(code));
    setJoinName(readPlayerName() ?? "");
  }, [code]);

  // Satu koneksi SSE sekaligus jadi penanda kehadiran: selama alirannya
  // terbuka, server menganggap pemain ini ada di room.
  useEffect(() => {
    if (!playerId) return;

    const source = new EventSource(
      `/api/room/stream?code=${encodeURIComponent(code)}&playerId=${encodeURIComponent(playerId)}`,
    );

    source.onopen = () => setConnection("live");
    source.onmessage = (event) => {
      try {
        setRoom(JSON.parse(event.data) as RoomView);
        setConnection("live");
      } catch {
        // Potongan pesan rusak: abaikan dan tunggu kiriman berikutnya.
      }
    };
    source.addEventListener("gone", () => {
      forgetMembership(code);
      setPlayerId(null);
      setNotice({ tone: "error", text: "Room ini sudah ditutup." });
      source.close();
    });
    source.onerror = () => setConnection("lost");

    return () => source.close();
  }, [code, playerId]);

  // Kursi pemain ini di dalam room, berbeda dari `me` yang berisi akunnya:
  // seseorang bisa ikut room tanpa punya profil sama sekali.
  const mySeat = room?.players.find((p) => p.id === playerId);
  const isHost = Boolean(mySeat?.isHost);
  const feed = useMemo(
    () => (room ? [...room.feed].sort((a, b) => a.rank - b.rank) : []),
    [room],
  );
  const best = feed.length ? feed[0].rank : null;

  useEffect(() => {
    if (!room) return;
    applyAmbientHeat(best, room.vocabSize);
  }, [best, room]);

  // Kilatan kemenangan dijalankan sekali per room, dan tidak ikut menyala lagi
  // ketika pemain lain menyegarkan halaman setelah permainan usai.
  useEffect(() => {
    if (room?.status !== "finished" || !room.answer) return;
    if (flaredFor.current === room.code) return;
    flaredFor.current = room.code;
    if (freshWord) flarePage();
  }, [room, freshWord]);

  const join = useCallback(async () => {
    if (joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      storePlayerName(joinName);
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: joinName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data?.message ?? "Room tidak bisa dimasuki.");
        return;
      }
      rememberMembership(code, data.playerId);
      setPlayerId(data.playerId);
      setRoom(data.room as RoomView);
    } catch {
      setJoinError("Koneksi ke server terputus.");
    } finally {
      setJoining(false);
    }
  }, [code, joinName, joining]);

  const start = useCallback(async () => {
    if (!playerId) return;
    await fetch("/api/room/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, playerId }),
    });
  }, [code, playerId]);

  const submit = useCallback(
    async (raw: string) => {
      const word = normalizeWord(raw);
      if (!word || !playerId) return;
      setNotice(null);

      const seq = ++submitSeq.current;
      try {
        const res = await fetch("/api/room/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, playerId, word }),
        });

        if (!res.ok) {
          const { error } = (await res.json().catch(() => ({}))) as { error?: string };
          // Tebakan yang dikirim berbarengan bisa tiba setelah pemain lain
          // menang dan room ditutup. Itu bukan kegagalan jaringan, jadi jangan
          // menyuruh pemain mencoba lagi.
          setNotice({
            tone: error === "not-playing" ? "info" : "error",
            text:
              error === "unknown-word"
                ? `"${word}" tidak ada di kamus Wordheat. Coba kata lain.`
                : error === "not-playing"
                  ? "Permainan sudah selesai."
                  : "Tebakan gagal dikirim. Coba lagi.",
          });
          return;
        }

        const result = (await res.json()) as { word: string; rank: number; duplicate: boolean };
        if (result.duplicate) {
          setNotice({
            tone: "info",
            text: `Sudah kamu tebak — peringkat ${result.rank.toLocaleString("id-ID")}.`,
          });
          return;
        }
        if (seq === submitSeq.current) setFreshWord(result.word);
      } catch {
        setNotice({ tone: "error", text: "Koneksi terputus. Tebakan belum terkirim." });
      }
    },
    [code, playerId],
  );

  const inviteFriend = useCallback(
    async (friendId: string) => {
      const res = await fetch("/api/friends/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId, code }),
      });
      if (res.ok) {
        setInvited((prev) => ({ ...prev, [friendId]: true }));
      } else {
        setNotice({ tone: "error", text: "Undangan gagal dikirim." });
      }
    },
    [code],
  );

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice({ tone: "error", text: "Kode gagal disalin." });
    }
  }, [code]);

  const sendChat = useCallback(
    async (text: string) => {
      if (!playerId) return;
      await fetch("/api/room/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, playerId, text }),
      });
    },
    [code, playerId],
  );

  // Lencana belum-terbaca dihitung dari selisih dengan panjang obrolan
  // terakhir yang terlihat; membuka modal langsung menyamakan keduanya, jadi
  // lencananya hilang tanpa perlu tanda "sudah dibaca" di server.
  const chatCount = room?.chat.length ?? 0;
  useEffect(() => {
    if (chatOpen) setSeenChatCount(chatCount);
  }, [chatOpen, chatCount]);
  const unreadChat = Math.max(0, chatCount - seenChatCount);

  const header = (
    <>
      <header
        className="rise flex items-center justify-between gap-4"
        style={{ "--step": 0 } as React.CSSProperties}
      >
        <Wordmark />
        <div className="flex items-center gap-2">
          {playerId && (
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              aria-label="Chat room"
              className="relative p-1 text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
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
              {unreadChat > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 grid size-[16px] place-items-center rounded-full bg-flare text-[10px] font-bold text-[#150710]"
                >
                  {unreadChat}
                </span>
              )}
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-col gap-1.5">
        <Link href="/" className="text-[13px] font-bold text-[var(--muted)]">
          Kembali
        </Link>
        <p className="text-center text-[22px] font-bold tracking-[-0.01em]">Room {code}</p>
      </div>
    </>
  );

  // Belum jadi anggota: minta nama, lalu masuk lewat tautan yang dibagikan host.
  if (!playerId) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-6 px-4 py-8 sm:px-6">
        {header}
        <section className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="text-[17px] font-bold">Gabung ke room {code}</p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Kamu akan menunggu di ruang tunggu sampai host memulai permainan.
          </p>
          {me ? (
            <p className="mt-4 flex items-center gap-2 text-[13px] text-[var(--muted)]">
              <Avatar
                seed={me.account.avatarSeed}
                bg={me.account.avatarBg}
                choices={me.account.avatarChoices}
                name={me.account.displayName}
                size={24}
              />
              Masuk sebagai <strong className="text-[var(--fg)]">{me.account.displayName}</strong>
            </p>
          ) : (
            <label className="mt-4 block">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Nama kamu
              </span>
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                maxLength={18}
                placeholder="Opsional"
                className="mt-1.5 w-full rounded-pill border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-[15px] outline-none placeholder:text-[var(--muted)]"
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => void join()}
            disabled={joining}
            className="mt-3 w-full rounded-pill bg-[var(--btn-bg)] px-5 py-3 text-[15px] font-bold text-[var(--btn-fg)] disabled:opacity-50"
          >
            {joining ? "Bergabung…" : "Gabung"}
          </button>
          {(joinError || notice) && (
            <p role="status" className="mt-3 text-[14px] text-flare">
              {joinError ?? notice?.text}
            </p>
          )}
        </section>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-6 px-4 py-8 sm:px-6">
        {header}
        <p className="text-[15px] text-[var(--muted)]">Menyambung ke room…</p>
      </main>
    );
  }

  const playing = room.status === "playing";
  const finished = room.status === "finished";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-6 px-4 py-8 sm:px-6">
      {header}

      {connection === "lost" && (
        <p role="status" className="text-[14px] text-flare">
          Sambungan ke room terputus. Menyambung ulang…
        </p>
      )}

      {room.status === "lobby" && (
        <section
          className="rise rounded-lg border border-[var(--line)] bg-[var(--card)] p-5"
          style={{ "--step": 1 } as React.CSSProperties}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Kode room
          </p>
          <div className="mt-2 flex items-center gap-3">
            <p className="font-mono text-[40px] font-medium leading-none tracking-[0.22em]">
              {room.code}
            </p>
            <button
              type="button"
              onClick={() => void copyCode()}
              className="rounded-pill border border-[var(--line)] px-4 py-2 text-[13px] font-bold"
            >
              {copied ? "Tersalin" : "Salin"}
            </button>
          </div>
          <p className="mt-3 text-[13px] text-[var(--muted)]">
            Bagikan kode ini. Pemain lain memasukkannya di halaman depan untuk
            bergabung.
          </p>

          {isHost ? (
            <button
              type="button"
              onClick={() => void start()}
              disabled={room.players.length < 1}
              className="mt-5 w-full rounded-pill bg-[var(--btn-bg)] px-5 py-3 text-[15px] font-bold text-[var(--btn-fg)] disabled:opacity-50"
            >
              Mulai permainan
            </button>
          ) : (
            <p className="mt-5 text-[15px]">Menunggu host memulai permainan…</p>
          )}
        </section>
      )}

      {/* Undang teman: hanya muncul di ruang tunggu, karena room yang sudah
          dimulai tidak menerima pemain baru. */}
      {room.status === "lobby" && me && (
        <section
          className="rise flex flex-col gap-2 rounded-lg border border-[var(--line)] p-5"
          style={{ "--step": 1.5 } as React.CSSProperties}
        >
          <p className="text-[15px] font-bold">Undang teman</p>
          {me.friends.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-[var(--muted)]">
              Belum ada teman di daftarmu.{" "}
              <Link href="/friends" className="underline underline-offset-4">
                Tambah teman lewat username
              </Link>{" "}
              supaya bisa langsung diundang lain kali.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {me.friends.map((friend) => {
                const alreadyHere = room.players.some((p) => p.accountId === friend.id);
                return (
                  <li key={friend.id} className="flex items-center gap-3 py-1">
                    <Avatar
                      seed={friend.avatarSeed}
                      bg={friend.avatarBg}
                      choices={friend.avatarChoices}
                      name={friend.displayName}
                      size={32}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{friend.displayName}</span>
                      <span className="block truncate font-mono text-[12px] text-[var(--muted)]">
                        @{friend.username}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void inviteFriend(friend.id)}
                      disabled={alreadyHere || invited[friend.id]}
                      className="shrink-0 rounded-pill border border-[var(--line)] px-4 py-2 text-[13px] font-bold disabled:opacity-40"
                    >
                      {alreadyHere ? "Sudah di sini" : invited[friend.id] ? "Terkirim" : "Undang"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section
        className="rise flex flex-col gap-2"
        style={{ "--step": 2 } as React.CSSProperties}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Pemain · {room.players.length}
        </p>
        <ul className="flex flex-col gap-1">
          {room.players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 py-2 text-[15px]"
            >
              <span className="flex min-w-0 items-center gap-2">
                {player.username ? (
                  <button
                    type="button"
                    onClick={() => setProfileUsername(player.username!)}
                    className="flex min-w-0 items-center gap-2 text-left hover:underline"
                  >
                    <span className="relative shrink-0">
                      <Avatar
                        seed={player.avatarSeed}
                        bg={player.avatarBg}
                        choices={player.avatarChoices}
                        name={player.name}
                        size={32}
                      />
                      <span
                        aria-hidden="true"
                        className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[var(--bg)] ${
                          player.online ? "bg-flare" : "bg-[var(--muted)]"
                        }`}
                      />
                    </span>
                    <span className="truncate">{player.name}</span>
                  </button>
                ) : (
                  <>
                    <span className="relative shrink-0">
                      <Avatar
                        seed={player.avatarSeed}
                        bg={player.avatarBg}
                        choices={player.avatarChoices}
                        name={player.name}
                        size={32}
                      />
                      <span
                        aria-hidden="true"
                        className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[var(--bg)] ${
                          player.online ? "bg-flare" : "bg-[var(--muted)]"
                        }`}
                      />
                    </span>
                    <span className="truncate">{player.name}</span>
                  </>
                )}
                {player.isHost && (
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    host
                  </span>
                )}
                {player.id === playerId && (
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    kamu
                  </span>
                )}
              </span>
              <span className="shrink-0 font-mono text-[13px] tabular-nums text-[var(--muted)]">
                {room.status === "lobby"
                  ? "siap"
                  : player.bestRank === null
                    ? "—"
                    : `${player.guessCount} · ${player.bestRank.toLocaleString("id-ID")}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {finished && (
        <section className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-4">
          <p className="text-[15px]">
            {room.winner ? (
              <>
                <strong>{room.winner.name}</strong> menemukannya dalam{" "}
                <strong>{room.winner.guessCount}</strong> tebakan. Kata rahasianya{" "}
                <strong>{room.answer}</strong>.
              </>
            ) : (
              <>
                Kata rahasianya <strong>{room.answer}</strong>.
              </>
            )}
          </p>
          <Link
            href="/"
            className="mt-3 inline-block rounded-pill border border-[var(--line)] px-4 py-2 text-[13px] font-bold"
          >
            Buat room baru
          </Link>
        </section>
      )}

      {playing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = inputRef.current?.value ?? "";
            if (inputRef.current) inputRef.current.value = "";
            void submit(value);
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Ketik tebakanmu"
            aria-label="Kata tebakan"
            className="min-w-0 flex-1 rounded-pill border border-[var(--line)] bg-[var(--field)] px-5 py-3 text-[16px] outline-none placeholder:text-[var(--muted)]"
          />
          <button
            type="submit"
            className="rounded-pill bg-[var(--btn-bg)] px-6 py-3 text-[15px] font-bold text-[var(--btn-fg)]"
          >
            Tebak
          </button>
        </form>
      )}

      {notice && (
        <p
          role="status"
          className={`-mt-3 text-[14px] ${notice.tone === "error" ? "text-flare" : "text-[var(--muted)]"}`}
        >
          {notice.text}
        </p>
      )}

      {(playing || finished) && (
        <section className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Papan bersama · {feed.length} kata
          </p>
          {feed.length === 0 ? (
            <p className="text-[15px] leading-relaxed text-[var(--muted)]">
              Belum ada yang menebak. Kata dari pemain mana pun akan muncul di
              sini, lengkap dengan peringkatnya.
            </p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {feed.map((entry) => (
                <li key={entry.word}>
                  <GuessRow
                    word={entry.word}
                    rank={entry.rank}
                    by={entry.by}
                    vocabSize={room.vocabSize}
                    fresh={entry.word === freshWord}
                    flare={finished && entry.rank === 1 && entry.word === freshWord}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {chatOpen && playerId && (
        <RoomChatModal
          chat={room.chat}
          players={room.players}
          myPlayerId={playerId}
          onSend={(text) => void sendChat(text)}
          onClose={() => setChatOpen(false)}
        />
      )}

      {profileUsername && (
        <PlayerProfileModal username={profileUsername} onClose={() => setProfileUsername(null)} />
      )}
    </main>
  );
}
