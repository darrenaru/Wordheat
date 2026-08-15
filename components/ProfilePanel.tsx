"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import Avatar from "@/components/Avatar";
import ThemeToggle from "@/components/ThemeToggle";
import Wordmark from "@/components/Wordmark";
import { useAccount } from "@/components/AccountProvider";
import AvatarStudio, { type AvatarDraft } from "@/components/AvatarStudio";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import PlayerStats from "@/components/PlayerStats";
import { DEFAULT_AVATAR_BG, randomAvatarSeed } from "@/lib/avatar";
import type { PublicProfile } from "@/lib/profile";

type Notice = { tone: "error" | "info"; text: string } | null;

function Header() {
  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <Wordmark />
        <ThemeToggle />
      </header>
      <div className="flex flex-col gap-1.5">
        <Link href="/" className="text-[13px] font-bold text-[var(--muted)]">
          Kembali
        </Link>
        <p className="text-center text-[22px] font-bold tracking-[-0.01em]">Profil</p>
      </div>
    </>
  );
}

/**
 * Avatar sebagai tombol pembuka studio.
 *
 * Menekan gambarnya adalah gerakan yang paling dulu dicoba orang, jadi itulah
 * yang dijadikan pemicu -- tombol terpisah hanya menambah satu lapisan tanpa
 * menambah kejelasan.
 */
function AvatarPicker({
  draft,
  name,
  onOpen,
}: {
  draft: AvatarDraft;
  name: string;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Ubah avatar"
        className="group relative shrink-0 rounded-full"
      >
        <Avatar
          seed={draft.seed}
          bg={draft.bg}
          choices={draft.choices}
          name={name}
          size={72}
          className="transition-opacity group-hover:opacity-80"
        />
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 grid size-7 place-items-center rounded-full border-2 border-[var(--card)] bg-[var(--btn-bg)] text-[var(--btn-fg)]"
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
          </svg>
        </span>
      </button>
      <div className="min-w-0">
        <p className="text-[15px] font-bold">Avatar</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--muted)]">
          Ketuk gambarnya untuk mengubah rambut, mata, mulut, dan lainnya.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------- belum punya --

function CreateProfile() {
  const { adopt } = useAccount();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [draft, setDraft] = useState<AvatarDraft>(() => ({
    seed: randomAvatarSeed(),
    bg: DEFAULT_AVATAR_BG,
    choices: {},
  }));
  const [studioOpen, setStudioOpen] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const submit = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "create"
            ? {
                action: "signup",
                username,
                displayName,
                avatarSeed: draft.seed,
                avatarBg: draft.bg,
                avatarChoices: draft.choices,
              }
            : { action: "signin", recoveryCode },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ tone: "error", text: data?.message ?? "Gagal. Coba lagi." });
        return;
      }
      if (data.recoveryCode) {
        // Ditaruh di sessionStorage, bukan state, supaya tetap tampil setelah
        // provider memuat ulang keadaan akun dan mengganti tampilan halaman.
        sessionStorage.setItem("wordheat:new-recovery", data.recoveryCode);
      }
      adopt(data.account as PublicProfile);
    } catch {
      setNotice({ tone: "error", text: "Koneksi ke server terputus." });
    } finally {
      setBusy(false);
    }
  }, [adopt, busy, displayName, draft, mode, recoveryCode, username]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-6 px-4 py-8 sm:px-6">
      <Header />

      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-[var(--line)] bg-[var(--card)] p-5">
          <GoogleSignInButton onError={(text) => setNotice({ tone: "error", text })} />
          <div className="flex w-full items-center gap-3 text-[12px] text-[var(--muted)]">
            <div className="h-px flex-1 bg-[var(--line)]" />
            atau
            <div className="h-px flex-1 bg-[var(--line)]" />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 rounded-pill border px-4 py-2.5 text-[14px] font-bold ${
            mode === "create" ? "border-transparent bg-[var(--btn-bg)] text-[var(--btn-fg)]" : "border-[var(--line)]"
          }`}
        >
          Buat profil
        </button>
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-pill border px-4 py-2.5 text-[14px] font-bold ${
            mode === "signin" ? "border-transparent bg-[var(--btn-bg)] text-[var(--btn-fg)]" : "border-[var(--line)]"
          }`}
        >
          Punya kode pemulihan
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-5 rounded-lg border border-[var(--line)] bg-[var(--card)] p-5"
      >
        {mode === "create" ? (
          <>
            <AvatarPicker
              draft={draft}
              name={displayName || username || "?"}
              onOpen={() => setStudioOpen(true)}
            />

            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Username
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                maxLength={16}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="huruf kecil, angka, garis bawah"
                className="mt-1.5 w-full rounded-pill border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-[15px] outline-none placeholder:text-[var(--muted)]"
              />
            </label>

            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Nama tampilan
              </span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={24}
                placeholder="Opsional"
                className="mt-1.5 w-full rounded-pill border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-[15px] outline-none placeholder:text-[var(--muted)]"
              />
            </label>
          </>
        ) : (
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Kode pemulihan
            </span>
            <input
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              className="mt-1.5 w-full rounded-pill border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-center font-mono text-[15px] tracking-[0.12em] outline-none placeholder:text-[var(--muted)]"
            />
            <span className="mt-1.5 block text-[12px] text-[var(--muted)]">
              Kode yang kamu simpan saat pertama membuat profil.
            </span>
          </label>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-pill bg-[var(--btn-bg)] px-5 py-3 text-[15px] font-bold text-[var(--btn-fg)] disabled:opacity-50"
        >
          {busy ? "Sebentar…" : mode === "create" ? "Buat profil" : "Masuk"}
        </button>

        {notice && (
          <p role="status" className="text-[14px] text-flare">
            {notice.text}
          </p>
        )}
      </form>

      <p className="text-[13px] leading-relaxed text-[var(--muted)]">
        Profil dipakai untuk berteman dan saling mengundang ke room. Main
        sendiri atau ikut room lewat kode tetap bisa tanpa profil.
      </p>

      {studioOpen && (
        <AvatarStudio
          initial={draft}
          onClose={() => setStudioOpen(false)}
          onSave={(next) => {
            setDraft(next);
            setStudioOpen(false);
          }}
        />
      )}
    </main>
  );
}

// -------------------------------------------------------------- sudah ada --

function SignedIn() {
  const { me, signOut } = useAccount();
  const account = me!.account;

  const [username, setUsername] = useState(account.username);
  const [displayName, setDisplayName] = useState(account.displayName);
  const [draft, setDraft] = useState<AvatarDraft>({
    seed: account.avatarSeed,
    bg: account.avatarBg,
    choices: account.avatarChoices,
  });
  const [studioOpen, setStudioOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [freshRecovery, setFreshRecovery] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const code = sessionStorage.getItem("wordheat:new-recovery");
    if (code) setFreshRecovery(code);
  }, []);

  // Perubahan dari perangkat lain sampai lewat saluran pribadi; formulir ikut
  // menyesuaikan selama pemain tidak sedang menyunting nilai itu.
  useEffect(() => {
    setUsername(account.username);
    setDisplayName(account.displayName);
    setDraft({
      seed: account.avatarSeed,
      bg: account.avatarBg,
      choices: account.avatarChoices,
    });
  }, [account]);

  const dirty =
    username !== account.username ||
    displayName !== account.displayName ||
    draft.seed !== account.avatarSeed ||
    draft.bg !== account.avatarBg ||
    JSON.stringify(draft.choices) !== JSON.stringify(account.avatarChoices);

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          displayName,
          avatarSeed: draft.seed,
          avatarBg: draft.bg,
          avatarChoices: draft.choices,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ tone: "error", text: data?.message ?? "Profil gagal disimpan." });
        return;
      }
      setNotice({ tone: "info", text: "Profil tersimpan." });
    } catch {
      setNotice({ tone: "error", text: "Koneksi ke server terputus." });
    } finally {
      setSaving(false);
    }
  }, [displayName, draft, saving, username]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-6 px-4 py-8 sm:px-6">
      <Header />

      <section className="flex flex-col gap-5 rounded-lg border border-[var(--line)] bg-[var(--card)] p-5">
        <AvatarPicker
          draft={draft}
          name={displayName || username}
          onOpen={() => setStudioOpen(true)}
        />

        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Username
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            maxLength={16}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="mt-1.5 w-full rounded-pill border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-[15px] outline-none"
          />
        </label>

        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Nama tampilan
          </span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={24}
            className="mt-1.5 w-full rounded-pill border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-[15px] outline-none"
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="rounded-pill bg-[var(--btn-bg)] px-5 py-2.5 text-[14px] font-bold text-[var(--btn-fg)] disabled:opacity-40"
          >
            {saving ? "Menyimpan…" : "Simpan profil"}
          </button>
          {notice && (
            <span
              role="status"
              className={`text-[13px] ${notice.tone === "error" ? "text-flare" : "text-[var(--muted)]"}`}
            >
              {notice.text}
            </span>
          )}
        </div>
      </section>

      {/* Ditaruh di kaki halaman, bukan di kepala: yang pertama ingin
          dilihat pemain setelah membuat profil adalah profilnya sendiri,
          bukan sebuah peringatan. Kartunya tetap ada sampai ditutup. */}
      {freshRecovery && (
        <section className="rounded-lg border border-flare/50 bg-[var(--card)] p-5">
          <p className="text-[15px] font-bold">Simpan kode pemulihanmu</p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Ini satu-satunya cara masuk ke profil ini dari perangkat lain. Kode
            ini tidak bisa ditampilkan lagi — yang tersimpan di server hanya
            sidik jarinya.
          </p>
          <p className="mt-3 select-all break-all font-mono text-[20px] tracking-[0.1em]">
            {freshRecovery}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(freshRecovery).then(() => setCopied(true));
              }}
              className="rounded-pill border border-[var(--line)] px-4 py-2 text-[13px] font-bold"
            >
              {copied ? "Tersalin" : "Salin kode"}
            </button>
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem("wordheat:new-recovery");
                setFreshRecovery(null);
              }}
              className="rounded-pill border border-[var(--line)] px-4 py-2 text-[13px] font-bold"
            >
              Sudah disimpan
            </button>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-5 rounded-lg border border-[var(--line)] bg-[var(--card)] p-5">
        <p className="text-[15px] font-bold">Statistik</p>
        <PlayerStats username={account.username} showHeader={false} />
      </section>

      {studioOpen && (
        <AvatarStudio
          initial={draft}
          onClose={() => setStudioOpen(false)}
          onSave={(next) => {
            setDraft(next);
            setStudioOpen(false);
          }}
        />
      )}

      {/* Kartu terpisah, paling bawah -- tindakan yang mengakhiri sesi tidak
          sepatutnya berdempetan dengan tombol simpan yang dipakai sehari-hari. */}
      <section className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-5">
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-pill border border-[var(--line)] px-4 py-2.5 text-[14px] font-bold text-[var(--muted)]"
        >
          Logout
        </button>
      </section>
    </main>
  );
}

export default function ProfilePanel() {
  const { me, loaded } = useAccount();

  if (!loaded) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col gap-6 px-4 py-8 sm:px-6">
        <Header />
        <p className="text-[15px] text-[var(--muted)]">Memuat profil…</p>
      </main>
    );
  }

  return me ? <SignedIn /> : <CreateProfile />;
}
