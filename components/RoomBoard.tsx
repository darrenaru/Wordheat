"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Avatar from "@/components/Avatar";
import GuessFxLayer from "@/components/GuessFxLayer";
import GuessRow from "@/components/GuessRow";
import PlayerProfileModal from "@/components/PlayerProfileModal";
import PresenceDot from "@/components/PresenceDot";
import RoomChatModal from "@/components/RoomChatModal";
import SurrenderResultModal from "@/components/SurrenderResultModal";
import SurrenderVoteModal from "@/components/SurrenderVoteModal";
import ThemeToggle from "@/components/ThemeToggle";
import WinResultModal from "@/components/WinResultModal";
import Wordmark from "@/components/Wordmark";
import { useAccount } from "@/components/AccountProvider";
import { ChatIcon, CopyIcon } from "@/components/icons";
import type { AvatarChoices } from "@/lib/avatar";
import { applyAmbientHeat, flarePage } from "@/lib/ambient";
import { buildGuessFx, useReorderAnimation, type GuessFx } from "@/lib/motion";
import type { AccountStatus } from "@/lib/profile";
import { forgetMembership, readMembership, rememberMembership } from "@/lib/session";
import { normalizeWord } from "@/lib/word";

type FeedEntry = { word: string; rank: number; by: string; byId: string; at: number };

type ChatEntry = { id: string; playerId: string; text: string; at: number };

type RoomView = {
  code: string;
  status: "lobby" | "countdown" | "playing" | "finished";
  hostId: string;
  puzzleId: number;
  vocabSize: number;
  countdownEndsAt?: number;
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
    status?: AccountStatus;
  }[];
  feed: FeedEntry[];
  chat: ChatEntry[];
  winner?: { id: string; name: string; guessCount: number };
  answer?: string;
  surrenderThreshold: number;
  surrenderRequest?: {
    startedBy: string;
    deadline: number;
    responses: Record<string, "accept" | "reject">;
  };
};

type Notice = { tone: "error" | "info"; text: string } | null;

export default function RoomBoard({ code }: { code: string }) {
  const { me, loaded } = useAccount();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [invited, setInvited] = useState<Record<string, boolean>>({});
  const [room, setRoom] = useState<RoomView | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [connection, setConnection] = useState<"connecting" | "live" | "lost">("connecting");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [freshWord, setFreshWord] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [seenChatCount, setSeenChatCount] = useState(0);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [connectAttempt, setConnectAttempt] = useState(0);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [startingSurrender, setStartingSurrender] = useState(false);
  const [respondingSurrender, setRespondingSurrender] = useState(false);
  const [surrenderModalOpen, setSurrenderModalOpen] = useState(false);
  const [winModalOpen, setWinModalOpen] = useState(false);
  const [fx, setFx] = useState<GuessFx | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const submitSeq = useRef(0);
  const flaredFor = useRef<string | null>(null);
  const surrenderNoticeFor = useRef<string | null>(null);
  const wonNoticeFor = useRef<string | null>(null);
  const autoJoinAttempted = useRef(false);
  const fxCounter = useRef(0);

  useEffect(() => {
    setPlayerId(readMembership(code));
  }, [code]);

  // Satu koneksi SSE sekaligus jadi penanda kehadiran: selama alirannya
  // terbuka, server menganggap pemain ini ada di room.
  useEffect(() => {
    if (!playerId) return;

    let cancelled = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (cancelled) return;
      setConnection((prev) => (prev === "live" ? prev : "connecting"));

      source = new EventSource(
        `/api/room/stream?code=${encodeURIComponent(code)}&playerId=${encodeURIComponent(playerId)}`,
      );

      source.onopen = () => {
        attempt = 0;
        setConnectAttempt(0);
        setConnection("live");
      };
      source.onmessage = (event) => {
        try {
          setRoom(JSON.parse(event.data) as RoomView);
          setConnection("live");
          attempt = 0;
          setConnectAttempt(0);
        } catch {
          // Potongan pesan rusak: abaikan dan tunggu kiriman berikutnya.
        }
      };
      source.addEventListener("gone", () => {
        forgetMembership(code);
        setPlayerId(null);
        setNotice({ tone: "error", text: "Room ini sudah ditutup." });
        source?.close();
      });
      // EventSource bawaan hanya mencoba ulang sendiri kalau koneksi sempat
      // tersambung lalu putus di tengah jalan -- kegagalan pada percobaan
      // pertama (sinyal goyah, proxy menutup koneksi sesaat) membuatnya
      // berhenti total tanpa mencoba lagi, jadi layar "Menyambung ke
      // room..." bisa macet selamanya. Penyambungan ulang jadi tanggung
      // jawab kode ini sendiri, dengan jeda yang makin panjang tiap gagal.
      source.onerror = () => {
        source?.close();
        setConnection("lost");
        if (cancelled) return;
        attempt += 1;
        setConnectAttempt(attempt);
        const delay = Math.min(1000 * 2 ** (attempt - 1), 10_000);
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [code, playerId, reconnectNonce]);

  // Kursi pemain ini di dalam room, berbeda dari `me` yang berisi akunnya:
  // seseorang bisa ikut room tanpa punya profil sama sekali.
  const mySeat = room?.players.find((p) => p.id === playerId);
  const isHost = Boolean(mySeat?.isHost);
  const feed = useMemo(
    () => (room ? [...room.feed].sort((a, b) => a.rank - b.rank) : []),
    [room],
  );
  const registerFeedRow = useReorderAnimation(feed);
  const best = feed.length ? feed[0].rank : null;
  const myResponse = playerId ? room?.surrenderRequest?.responses[playerId] : undefined;

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

  // Permainan yang berakhir lewat suara menyerah (bukan kemenangan) memicu
  // modal hasil sekali per room, persis seperti kilatan kemenangan di atas --
  // tidak boleh muncul lagi tiap pemain lain menyegarkan halaman.
  useEffect(() => {
    if (room?.status !== "finished" || room.winner) return;
    if (surrenderNoticeFor.current === room.code) return;
    surrenderNoticeFor.current = room.code;
    setSurrenderModalOpen(true);
  }, [room]);

  // Permainan yang berakhir karena ada yang menemukan kata rahasianya
  // memicu modal hasil sekali per room -- pola yang sama seperti modal
  // menyerah di atas, supaya pemain yang sedang tidak melihat papan (mis.
  // sedang mengetik atau membuka chat) langsung tahu siapa yang menang dan
  // bagaimana performa semua orang, bukan cuma baris teks kecil di papan.
  useEffect(() => {
    if (room?.status !== "finished" || !room.winner) return;
    if (wonNoticeFor.current === room.code) return;
    wonNoticeFor.current = room.code;
    setWinModalOpen(true);
  }, [room]);

  // Begitu host memulai hitung mundur, semua pemain difokuskan ke papan:
  // obrolan dan profil yang sedang terbuka ditutup paksa.
  useEffect(() => {
    if (room?.status !== "countdown") return;
    setChatOpen(false);
    setProfileUsername(null);
  }, [room?.status]);

  // Angka hitung mundur dihitung di klien dari waktu akhir yang dikirim
  // server, supaya semua pemain melihatnya turun bersamaan tanpa perlu
  // menunggu tiap detak dari server.
  useEffect(() => {
    if (room?.status !== "countdown" || !room.countdownEndsAt) {
      setCountdownLeft(null);
      return;
    }
    const endsAt = room.countdownEndsAt;
    const tick = () => setCountdownLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [room?.status, room?.countdownEndsAt]);

  const join = useCallback(async () => {
    if (joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
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
  }, [code, joining]);

  // Tautan undangan (/room/[code]) sudah membawa kode room-nya sendiri di
  // URL -- pemain yang sudah punya akun tidak perlu mengetik apa pun lagi,
  // jadi langsung digabungkan begitu identitas akunnya diketahui. Guard
  // lewat ref (bukan sekadar mengandalkan `joining`/`playerId`) supaya
  // percobaan gagal (mis. room penuh) tidak diulang otomatis tanpa henti.
  //
  // Sengaja mengecek localStorage langsung di sini (bukan cuma bergantung
  // pada state `playerId`) -- sejak akun selalu ada begitu halaman ini
  // mount (gerbang akun global), efek pembaca localStorage di atas dan efek
  // ini sama-sama melihat `playerId` yang masih null pada render pertama
  // (state barunya belum sempat mengalir sebelum render berikutnya), yang
  // tanpa pengecekan ulang ini bisa memicu bergabung dua kali ke room yang
  // sama sebelum efek satunya sempat mengisi playerId dari penyimpanan.
  useEffect(() => {
    if (!loaded || playerId || autoJoinAttempted.current || !me) return;
    if (readMembership(code)) return;
    autoJoinAttempted.current = true;
    void join();
  }, [loaded, me, playerId, join, code]);

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

      const previousBest = best;
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
        if (seq === submitSeq.current) {
          setFreshWord(result.word);
          fxCounter.current += 1;
          setFx(buildGuessFx(fxCounter.current, result.word, result.rank, previousBest));
        }
      } catch {
        setNotice({ tone: "error", text: "Koneksi terputus. Tebakan belum terkirim." });
      }
    },
    [code, playerId, best],
  );

  const startSurrender = useCallback(async () => {
    if (!playerId || startingSurrender) return;
    setStartingSurrender(true);
    try {
      await fetch("/api/room/surrender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, playerId }),
      });
      // Papan lengkap (termasuk ajakan yang baru dibuka) sampai lewat aliran
      // SSE; tidak perlu membaca balasan ini.
    } catch {
      setNotice({ tone: "error", text: "Ajakan menyerah gagal terkirim. Coba lagi." });
    } finally {
      setStartingSurrender(false);
    }
  }, [code, playerId, startingSurrender]);

  const respondSurrender = useCallback(
    async (response: "accept" | "reject") => {
      if (!playerId || respondingSurrender) return;
      setRespondingSurrender(true);
      try {
        await fetch("/api/room/surrender/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, playerId, response }),
        });
      } catch {
        setNotice({ tone: "error", text: "Jawaban gagal terkirim. Coba lagi." });
      } finally {
        setRespondingSurrender(false);
      }
    },
    [code, playerId, respondingSurrender],
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

  // Tautan (bukan cuma kode telanjang) supaya siapa pun yang membukanya --
  // di WhatsApp, Telegram, atau ke mana pun dibagikan -- langsung mendarat
  // di room ini, bukan perlu mengetik ulang kodenya di halaman depan.
  const shareRoom = useCallback(async () => {
    const url = `${window.location.origin}/room/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Wordheat", text: `Gabung ke room ${code} di Wordheat!`, url });
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
        <ThemeToggle />
      </header>
      <div className="flex flex-col gap-1.5">
        <Link href="/" className="text-[13px] font-bold text-[var(--muted)]">
          Kembali
        </Link>
        <p className="text-center text-[22px] font-bold tracking-[-0.01em]">Room {code}</p>
      </div>
    </>
  );

  // Belum jadi anggota. Gerbang akun global (AccountGate, di layout)
  // menjamin `me` selalu ada sebelum komponen ini sempat mount, jadi
  // bergabung selalu otomatis lewat efek auto-join di atas -- tidak perlu
  // pilihan Login/tamu di sini lagi.
  if (!playerId) {
    if (!loaded || !me) {
      return (
        <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-6 px-4 py-8 sm:px-6">
          {header}
          <p className="text-[15px] text-[var(--muted)]">Memuat…</p>
        </main>
      );
    }

    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-6 px-4 py-8 sm:px-6">
        {header}
        <section className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-5">
          <p className="flex items-center gap-2 text-[15px]">
            <Avatar
              seed={me.account.avatarSeed}
              bg={me.account.avatarBg}
              choices={me.account.avatarChoices}
              name={me.account.displayName}
              size={24}
            />
            Bergabung ke room {code} sebagai{" "}
            <strong className="text-[var(--fg)]">{me.account.displayName}</strong>…
          </p>
          {joinError && (
            <>
              <p role="status" className="mt-3 text-[14px] text-flare">
                {joinError}
              </p>
              <button
                type="button"
                onClick={() => void join()}
                disabled={joining}
                className="mt-3 w-full rounded-pill border border-[var(--line)] px-5 py-3 text-[15px] font-bold disabled:opacity-50"
              >
                {joining ? "Mencoba lagi…" : "Coba lagi"}
              </button>
            </>
          )}
        </section>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-6 px-4 py-8 sm:px-6">
        {header}
        <p className="text-[15px] text-[var(--muted)]">
          {connectAttempt > 0 ? "Koneksi bermasalah, menyambung lagi…" : "Menyambung ke room…"}
        </p>
        {connectAttempt >= 4 && (
          <div className="flex flex-col items-start gap-2">
            <p className="text-[13px] text-[var(--muted)]">
              Sudah dicoba beberapa kali tapi belum berhasil. Periksa koneksi
              internetmu, lalu coba lagi.
            </p>
            <button
              type="button"
              onClick={() => {
                setConnectAttempt(0);
                setReconnectNonce((n) => n + 1);
              }}
              className="rounded-pill border border-[var(--line)] px-4 py-2 text-[13px] font-bold"
            >
              Coba lagi
            </button>
          </div>
        )}
      </main>
    );
  }

  const countingDown = room.status === "countdown";
  const playing = room.status === "playing";
  const finished = room.status === "finished";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-6 px-4 py-8 sm:px-6">
      <GuessFxLayer fx={fx} vocabSize={room.vocabSize} />

      {header}

      {room.status !== "countdown" && (
        <div className="-mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            aria-label="Buka chat room"
            className="relative shrink-0 rounded-pill border border-[var(--line)] p-2.5 text-[var(--muted)] transition-colors hover:border-[var(--fg)]/35 hover:text-[var(--fg)]"
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
          {playing && !room.surrenderRequest && (
            <button
              type="button"
              onClick={() => void startSurrender()}
              disabled={startingSurrender}
              className="shrink-0 rounded-pill border border-red-500/30 bg-red-500/15 px-4 py-2 text-[13px] font-bold text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-50"
            >
              Menyerah
            </button>
          )}
        </div>
      )}

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
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Kode room
          </p>
          <button
            type="button"
            onClick={() => void copyCode()}
            aria-label="Salin kode room"
            className="mt-2 flex w-full items-center justify-center gap-2.5 rounded-lg py-1 text-[var(--fg)] transition-opacity hover:opacity-70 active:opacity-55"
          >
            <span className="font-mono text-[40px] font-medium leading-none tracking-[0.22em]">
              {room.code}
            </span>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5 shrink-0 text-[var(--muted)]"
            >
              {CopyIcon}
            </svg>
          </button>
          <button
            type="button"
            onClick={() => void shareRoom()}
            className="mt-3 w-full rounded-pill bg-[var(--btn-bg)] px-5 py-3 text-[15px] font-bold text-[var(--btn-fg)]"
          >
            {linkCopied ? "Tautan tersalin" : "Bagikan tautan room"}
          </button>
          <p className="mt-3 text-[13px] text-[var(--muted)]">
            Siapa pun yang membuka tautannya langsung masuk ke room ini --
            tidak perlu mengetik kode secara manual.
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

      {countingDown && (
        <section
          className="rise flex flex-col items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--card)] p-8 text-center"
          style={{ "--step": 1 } as React.CSSProperties}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Bersiap-siap
          </p>
          <p className="font-mono text-[64px] font-bold leading-none tabular-nums">
            {countdownLeft ?? "…"}
          </p>
          <p className="text-[13px] text-[var(--muted)]">
            Permainan segera dimulai. Obrolan dan aktivitas lain ditutup sementara
            supaya semua orang fokus bermain.
          </p>
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
                      <PresenceDot
                        status={player.status ?? (player.online ? "online" : "offline")}
                        className="absolute -bottom-0.5 -right-0.5"
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
                      <PresenceDot
                        status={player.status ?? (player.online ? "online" : "offline")}
                        className="absolute -bottom-0.5 -right-0.5"
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
                <li key={entry.word} ref={registerFeedRow(entry.word)}>
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

      {playing && room.surrenderRequest && playerId && (
        <SurrenderVoteModal
          players={room.players}
          startedBy={room.surrenderRequest.startedBy}
          deadline={room.surrenderRequest.deadline}
          responses={room.surrenderRequest.responses}
          myPlayerId={playerId}
          myResponse={myResponse}
          responding={respondingSurrender}
          onRespond={(response) => void respondSurrender(response)}
        />
      )}

      {surrenderModalOpen && room.answer && (
        <SurrenderResultModal
          players={room.players}
          answer={room.answer}
          voteCount={
            room.surrenderRequest
              ? Object.values(room.surrenderRequest.responses).filter((r) => r === "accept").length
              : 0
          }
          totalPlayers={room.players.length}
          onClose={() => setSurrenderModalOpen(false)}
        />
      )}

      {winModalOpen && room.answer && room.winner && (
        <WinResultModal
          players={room.players}
          winnerId={room.winner.id}
          winnerName={room.winner.name}
          winnerGuessCount={room.winner.guessCount}
          answer={room.answer}
          onClose={() => setWinModalOpen(false)}
        />
      )}

      {copied && (
        <p role="status" className="room-toast">
          Kode room berhasil disalin
        </p>
      )}
    </main>
  );
}
