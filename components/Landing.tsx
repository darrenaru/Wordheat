"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import Avatar from "@/components/Avatar";
import HowToPlayModal from "@/components/HowToPlayModal";
import ModeCard, { type ModeCardProps } from "@/components/ModeCard";
import ThemeToggle from "@/components/ThemeToggle";
import Wordmark from "@/components/Wordmark";
import { useAccount } from "@/components/AccountProvider";
import { FriendsIcon, HelpIcon, PartyIcon, SoloIcon, TrophyIcon } from "@/components/icons";
import { rememberMembership } from "@/lib/session";

type Mode = "idle" | "creating" | "joining";

export default function Landing({ vocabSize }: { vocabSize: number }) {
  const router = useRouter();
  const { me } = useAccount();
  const [showHelp, setShowHelp] = useState(false);
  // Satu lencana untuk semua yang butuh perhatian di halaman Teman --
  // permintaan pertemanan masuk dan pesan belum dibaca sama-sama menunggu di
  // sana, jadi ikon navbar cukup menunjukkan totalnya.
  const friendsBadge = me
    ? me.incoming.length + Object.values(me.unreadMessages).reduce((a, b) => a + b, 0)
    : 0;
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<Mode>("idle");
  const [error, setError] = useState<string | null>(null);

  const createRoom = useCallback(async () => {
    if (mode !== "idle") return;
    setMode("creating");
    setError(null);
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setError("Room gagal dibuat. Coba lagi.");
        return;
      }
      const data = (await res.json()) as { playerId: string; room: { code: string } };
      rememberMembership(data.room.code, data.playerId);
      router.push(`/room/${data.room.code}`);
    } catch {
      setError("Koneksi ke server terputus.");
    } finally {
      setMode("idle");
    }
  }, [mode, router]);

  const joinRoom = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (mode !== "idle") return;
    if (!trimmed) {
      setError("Masukkan kode room lebih dulu.");
      return;
    }
    setMode("joining");
    setError(null);
    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Room tidak bisa dimasuki.");
        return;
      }
      rememberMembership(data.room.code, data.playerId);
      router.push(`/room/${data.room.code}`);
    } catch {
      setError("Koneksi ke server terputus.");
    } finally {
      setMode("idle");
    }
  }, [code, mode, router]);

  /**
   * Daftar mode permainan. Menambah fitur baru -- papan peringkat, toko,
   * tantangan harian -- cukup menambah satu entri di sini; tata letaknya
   * mengalir sendiri.
   */
  const cards: ModeCardProps[] = [
    {
      icon: SoloIcon,
      title: "Main sendiri",
      description: "Satu kata rahasia tiap hari, sama untuk semua pemain. Tanpa batas waktu.",
      action: "Mulai",
      accent: "var(--accent-warm)",
      href: "/solo",
    },
    {
      icon: PartyIcon,
      title: "Main bareng",
      description: "Buat room, bagikan kodenya, lalu berburu kata yang sama. Tercepat menang.",
      action: mode === "creating" ? "Membuat room…" : "Buat room",
      accent: "var(--accent-hot)",
      onClick: () => void createRoom(),
      disabled: mode !== "idle",
    },
    {
      icon: TrophyIcon,
      title: "Papan peringkat",
      description: "Lihat siapa paling sering menang di room multiplayer, dan di mana posisimu.",
      action: "Lihat papan",
      accent: "var(--accent-gold)",
      href: "/leaderboard",
    },
  ];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[55rem] flex-col gap-7 px-4 py-6 sm:px-6">
      <div
        className="rise flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4"
        style={{ "--step": 0 } as React.CSSProperties}
      >
        <Wordmark href={null} />
        <div className="flex items-center gap-2">
        <Link
          href="/friends"
          aria-label="Teman"
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
            {FriendsIcon}
          </svg>
          {friendsBadge > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 grid size-[18px] place-items-center rounded-full bg-flare text-[11px] font-bold text-[#150710]"
            >
              {friendsBadge}
            </span>
          )}
        </Link>
        {me ? (
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-pill border border-[var(--line)] py-1 pl-1 pr-3"
          >
            <Avatar
              seed={me.account.avatarSeed}
              bg={me.account.avatarBg}
              choices={me.account.avatarChoices}
              name={me.account.displayName}
              size={28}
            />
            <span className="max-w-[10ch] truncate text-[13px] font-bold">
              {me.account.displayName}
            </span>
          </Link>
        ) : (
          <Link
            href="/profile"
            className="rounded-pill border border-[var(--line)] px-4 py-2 text-[13px] font-bold"
          >
            Buat profil
          </Link>
        )}
        <ThemeToggle />
        </div>
      </div>

      <header
        className="rise flex flex-col items-center gap-3 text-center"
        style={{ "--step": 1 } as React.CSSProperties}
      >
        {/* Tandanya sudah dipegang bilah merek di kiri atas, jadi hero-nya
            cukup tulisan saja -- dua tanda yang sama dalam satu layar justru
            saling melemahkan. */}
        <h1 className="text-[52px] font-bold leading-none tracking-[-0.04em] sm:text-[64px]">
          <span className="hero-mask">
            <span className="hero-part">Word</span>
          </span>
          <span className="hero-mask">
            <span className="hero-part wordmark-heat hero-heat-glow">heat</span>
          </span>
        </h1>
        <p className="max-w-[34ch] text-[15px] leading-relaxed text-[var(--muted)]">
          Tebak kata rahasianya. Tiap tebakan dinilai dari seberapa dekat maknanya —
          makin dekat, makin panas.
        </p>
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-1.5 rounded-pill border border-[var(--line)] px-4 py-1.5 text-[13px] font-bold text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            {HelpIcon}
          </svg>
          Cara Bermain
        </button>
      </header>

      {showHelp && <HowToPlayModal vocabSize={vocabSize} onClose={() => setShowHelp(false)} />}

      {/* Elemen utama halaman: pemain yang sudah dikirimi kode datang ke sini
          lebih dulu, sebelum melihat apa pun yang lain. */}
      <section
        className="rise rounded-lg border border-flare/45 bg-[var(--card)] p-5"
        style={{ "--step": 3 } as React.CSSProperties}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void joinRoom();
          }}
        >
          <label htmlFor="room-code" className="block text-[17px] font-bold">
            Punya kode room?
          </label>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Masukkan kode dari temanmu untuk langsung bergabung.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              id="room-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ABCD"
              className="min-w-0 flex-1 rounded-pill border border-[var(--line)] bg-[var(--field)] px-4 py-3 text-center font-mono text-[20px] uppercase tracking-[0.35em] outline-none placeholder:text-[var(--muted)]"
            />
            <button
              type="submit"
              disabled={mode !== "idle"}
              className="shrink-0 rounded-pill bg-[var(--btn-bg)] px-6 py-3 text-[15px] font-bold text-[var(--btn-fg)] disabled:opacity-50"
            >
              {mode === "joining" ? "…" : "Gabung"}
            </button>
          </div>
        </form>

        {error && (
          <p role="status" className="mt-3 text-[14px] text-flare">
            {error}
          </p>
        )}
      </section>

      <section
        className="rise grid gap-3 sm:grid-cols-2"
        aria-label="Pilih mode permainan"
        style={{ "--step": 4 } as React.CSSProperties}
      >
        {cards.map((card) => (
          <ModeCard key={card.title} {...card} />
        ))}
      </section>
    </main>
  );
}
