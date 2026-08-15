"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Avatar from "@/components/Avatar";
import { useAccount } from "@/components/AccountProvider";
import type { PublicProfile } from "@/lib/profile";

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 250;

type RowState = "open" | "friends" | "outgoing" | "incoming";

/**
 * Kolom "tambah teman" dengan autolengkap: mengetik beberapa huruf
 * memunculkan daftar akun yang cocok, dan mengklik salah satunya langsung
 * mengirim permintaan pertemanan. Mengetik username lengkap lalu menekan
 * Enter/"Tambah" tetap berfungsi sebagai jalur cadangan -- lewat onSubmit
 * yang sama, jadi pesan error dan alur auto-accept yang sudah ada tidak
 * berubah sama sekali.
 */
export default function FriendSearch({
  onSubmit,
}: {
  /** Mengirim permintaan pertemanan untuk username ini; true kalau berhasil. */
  onSubmit: (username: string) => Promise<boolean>;
}) {
  const { me } = useAccount();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (trimmed.length < MIN_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      fetch(`/api/friends/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data: { results?: PublicProfile[] }) => {
          if (controller.signal.aborted) return;
          setResults(data.results ?? []);
          setHighlighted(-1);
        })
        .catch((err) => {
          if (err?.name !== "AbortError") setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmed]);

  // Timer/permintaan yang masih menggantung saat komponen dibongkar tidak
  // boleh menyentuh state lagi.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const friendIds = useMemo(() => new Set(me?.friends.map((f) => f.id)), [me?.friends]);
  const outgoingIds = useMemo(
    () => new Set(me?.outgoing.map((r) => r.profile.id)),
    [me?.outgoing],
  );
  const incomingIds = useMemo(
    () => new Set(me?.incoming.map((r) => r.profile.id)),
    [me?.incoming],
  );

  const rowState = useCallback(
    (id: string): RowState => {
      if (friendIds.has(id)) return "friends";
      if (outgoingIds.has(id)) return "outgoing";
      if (incomingIds.has(id)) return "incoming";
      return "open";
    },
    [friendIds, outgoingIds, incomingIds],
  );

  const pick = useCallback(
    async (profile: PublicProfile) => {
      setOpen(false);
      const ok = await onSubmit(profile.username);
      if (ok) {
        setQuery("");
        setResults([]);
      }
    },
    [onSubmit],
  );

  const showDropdown = open && trimmed.length >= MIN_LENGTH;

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (highlighted >= 0 && results[highlighted] && rowState(results[highlighted].id) === "open") {
            void pick(results[highlighted]);
            return;
          }
          if (!trimmed) return;
          setOpen(false);
          void onSubmit(trimmed).then((ok) => {
            if (ok) {
              setQuery("");
              setResults([]);
            }
          });
        }}
        className="flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value.toLowerCase());
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!showDropdown || results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlighted((i) => (i + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlighted((i) => (i - 1 + results.length) % results.length);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="friend-search-listbox"
          aria-autocomplete="list"
          maxLength={16}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="username teman"
          aria-label="Username teman"
          className="min-w-0 flex-1 rounded-pill border border-[var(--line)] bg-[var(--field)] px-4 py-2.5 text-[15px] outline-none placeholder:text-[var(--muted)]"
        />
        <button
          type="submit"
          className="rounded-pill bg-[var(--btn-bg)] px-5 py-2.5 text-[14px] font-bold text-[var(--btn-fg)]"
        >
          Tambah
        </button>
      </form>

      {showDropdown && (
        <div
          id="friend-search-listbox"
          role="listbox"
          aria-label="Hasil pencarian teman"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[60vh] overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--card)] shadow-lg"
        >
          {loading && results.length === 0 && (
            <p className="px-4 py-3 text-[13px] text-[var(--muted)]">Mencari…</p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-4 py-3 text-[13px] text-[var(--muted)]">
              Tidak ada hasil untuk &ldquo;{trimmed}&rdquo;.
            </p>
          )}
          {results.map((profile, i) => {
            const state = rowState(profile.id);
            const label =
              state === "friends"
                ? "Sudah berteman"
                : state === "outgoing"
                  ? "Menunggu jawaban"
                  : state === "incoming"
                    ? "Mengirim ke kamu"
                    : null;
            return (
              <button
                key={profile.id}
                type="button"
                role="option"
                aria-selected={i === highlighted}
                disabled={state === "friends" || state === "outgoing"}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => void pick(profile)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors disabled:cursor-default disabled:opacity-50 ${
                  i === highlighted ? "bg-[var(--field)]" : ""
                }`}
              >
                <Avatar
                  seed={profile.avatarSeed}
                  bg={profile.avatarBg}
                  choices={profile.avatarChoices}
                  name={profile.displayName}
                  size={32}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">{profile.displayName}</span>
                  <span className="block truncate font-mono text-[12px] text-[var(--muted)]">
                    @{profile.username}
                  </span>
                </span>
                {label && (
                  <span className="shrink-0 text-[12px] text-[var(--muted)]">{label}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
