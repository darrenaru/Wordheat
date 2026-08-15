"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DiceIcon,
  EarringIcon,
  EyeIcon,
  EyebrowIcon,
  GlassesIcon,
  HairIcon,
  MouthIcon,
  SparkIcon,
  UndoIcon,
} from "@/components/icons";
import {
  AVATAR_BACKGROUNDS,
  AVATAR_OPTIONS,
  avatarSrc,
  randomAvatarSeed,
  type AvatarChoices,
} from "@/lib/avatar";

export type AvatarDraft = {
  seed: string;
  bg: string;
  choices: AvatarChoices;
};

/** Bagian yang wajib ada; pemain hanya memilih variannya. */
type RequiredKey = "eyes" | "eyebrows" | "mouth";
/** Bagian yang boleh ditiadakan sama sekali. */
type OptionalKey = "hair" | "glasses" | "earrings";

type Category =
  | { id: OptionalKey; label: string; icon: React.ReactNode; kind: "optional" }
  | { id: RequiredKey; label: string; icon: React.ReactNode; kind: "required" }
  | { id: "features"; label: string; icon: React.ReactNode; kind: "features" };

const CATEGORIES: Category[] = [
  { id: "hair", label: "Rambut", icon: HairIcon, kind: "optional" },
  { id: "eyebrows", label: "Alis", icon: EyebrowIcon, kind: "required" },
  { id: "eyes", label: "Mata", icon: EyeIcon, kind: "required" },
  { id: "mouth", label: "Mulut", icon: MouthIcon, kind: "required" },
  { id: "features", label: "Detail wajah", icon: SparkIcon, kind: "features" },
  { id: "glasses", label: "Kacamata", icon: GlassesIcon, kind: "optional" },
  { id: "earrings", label: "Anting", icon: EarringIcon, kind: "optional" },
];

const FEATURE_LABELS: Record<string, string> = {
  freckles: "Bintik",
  blush: "Rona pipi",
  birthmark: "Tanda lahir",
  mustache: "Kumis",
};

/** Nama varian dibuat terbaca; "short03" tidak berarti apa-apa bagi pemain. */
function humanize(value: string | null | undefined): string {
  if (value === null) return "Tanpa";
  if (!value) return "Ikut benih";
  if (value.startsWith("short")) return `Pendek ${value.slice(5)}`;
  if (value.startsWith("long")) return `Panjang ${value.slice(4)}`;
  if (value.startsWith("variant")) return `Varian ${value.slice(7)}`;
  return value;
}

function pickRandom<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

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

const THUMB = 56;

/**
 * Satu petak pilihan.
 *
 * Isinya avatar pemain sendiri dengan satu bagian ditukar, bukan contoh
 * generik: yang perlu dilihat adalah bagaimana pilihan itu tampak pada
 * wajahnya, bukan pada wajah orang lain.
 */
function Tile({
  draft,
  override,
  selected,
  label,
  text,
  onPick,
}: {
  draft: AvatarDraft;
  override?: AvatarChoices;
  selected: boolean;
  label: string;
  /** Diisi untuk petak "Tanpa", yang tidak punya gambar. */
  text?: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={label}
      aria-pressed={selected}
      className={`grid aspect-square place-items-center rounded-lg border transition-colors ${
        selected
          ? "border-flare bg-flare/10"
          : "border-[var(--line)] hover:border-[var(--fg)]/35"
      }`}
    >
      {text ? (
        <span className="text-[13px] font-bold">{text}</span>
      ) : (
        <img
          src={avatarSrc({ seed: draft.seed, bg: draft.bg, ...draft.choices, ...override }, THUMB * 2)}
          alt=""
          width={THUMB}
          height={THUMB}
          style={{ width: THUMB, height: THUMB }}
          loading="lazy"
          className="block rounded-full"
        />
      )}
    </button>
  );
}

function ColorRow({
  colors,
  value,
  onPick,
  label,
}: {
  colors: readonly string[];
  value?: string;
  onPick: (color: string) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onPick(color)}
          aria-label={`${label} #${color}`}
          aria-pressed={value === color}
          style={{ background: `#${color}` }}
          /* Penanda terpilih digambar ke dalam, bukan membesarkan petaknya:
             kolom ini bisa digulir, dan apa pun yang keluar dari kotaknya --
             termasuk hasil scale -- akan terpotong di tepi paling kiri. */
          className={`size-8 rounded-full border-2 transition-colors ${
            value === color
              ? "border-[var(--fg)] ring-2 ring-inset ring-[var(--card)]"
              : "border-[var(--line)] hover:border-[var(--fg)]/55"
          }`}
        />
      ))}
    </div>
  );
}

export default function AvatarStudio({
  initial,
  onClose,
  onSave,
}: {
  initial: AvatarDraft;
  onClose: () => void;
  onSave: (draft: AvatarDraft) => void;
}) {
  const [draft, setDraft] = useState<AvatarDraft>(initial);
  const [tab, setTab] = useState<Category["id"]>("hair");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();

    // Halaman di belakang tidak boleh ikut menggulir saat modal terbuka.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const setChoice = useCallback((patch: AvatarChoices) => {
    setDraft((prev) => ({ ...prev, choices: { ...prev.choices, ...patch } }));
  }, []);

  const randomizeAll = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      seed: randomAvatarSeed(),
      choices: {
        hair: pickRandom(AVATAR_OPTIONS.hair),
        hairColor: pickRandom(AVATAR_OPTIONS.hairColor),
        skinColor: pickRandom(AVATAR_OPTIONS.skinColor),
        eyes: pickRandom(AVATAR_OPTIONS.eyes),
        eyebrows: pickRandom(AVATAR_OPTIONS.eyebrows),
        mouth: pickRandom(AVATAR_OPTIONS.mouth),
        // Aksesori diundi terpisah supaya tidak semua orang berkacamata.
        glasses: Math.random() < 0.3 ? pickRandom(AVATAR_OPTIONS.glasses) : null,
        earrings: Math.random() < 0.3 ? pickRandom(AVATAR_OPTIONS.earrings) : null,
        features: Math.random() < 0.4 ? [pickRandom(AVATAR_OPTIONS.features)] : [],
      },
    }));
  }, []);

  const randomizeCategory = useCallback(
    (category: Category) => {
      if (category.kind === "features") {
        setChoice({ features: [pickRandom(AVATAR_OPTIONS.features)] });
        return;
      }
      setChoice({ [category.id]: pickRandom(AVATAR_OPTIONS[category.id]) });
    },
    [setChoice],
  );

  const active = useMemo(() => CATEGORIES.find((c) => c.id === tab)!, [tab]);

  const currentLabel = useMemo(() => {
    if (active.kind === "features") {
      const list = draft.choices.features;
      if (!list) return "Ikut benih";
      if (list.length === 0) return "Tanpa";
      return list.map((f) => FEATURE_LABELS[f] ?? f).join(", ");
    }
    return humanize(draft.choices[active.id]);
  }, [active, draft.choices]);

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
        aria-label="Ubah avatar"
        tabIndex={-1}
        className="flex w-full max-w-[60rem] flex-col overflow-hidden border-[var(--line)] bg-[var(--card)] outline-none sm:h-[92dvh] sm:rounded-lg sm:border"
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <h2 className="text-[20px] font-bold tracking-[-0.01em]">Ubah Avatar</h2>
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

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 pb-5 md:flex-row md:overflow-hidden">
          {/* Kolom kiri: yang sedang dibentuk, plus tindakan yang berlaku
              untuk seluruh avatar. */}
          {/* Di layar mobile kolom ini "sticky" ke atas kolom yang sama-sama
              menggulir dengan kategori, supaya pratinjau avatar tidak pernah
              tergulir keluar layar saat pemain menelusuri pilihan. Di md ke
              atas kolom ini sudah diam sendiri (hanya kategori yang
              menggulir), jadi sticky-nya dilepas lagi supaya tidak
              mengganggu tata letak dua kolom yang sudah benar. */}
          <aside className="sticky top-0 z-10 flex shrink-0 flex-col gap-3 border-b border-[var(--line)] bg-[var(--card)] pb-5 md:static md:w-[16.5rem] md:border-b-0 md:border-r md:pb-0 md:pr-6">
            {/* Pratinjau ditaruh di tengah dan diberi jarak vertikal supaya
                pendar cincinnya punya ruang; ukurannya dibatasi tinggi layar
                agar sisa isi kolom tetap muat tanpa perlu digulir. */}
            <div className="flex justify-center py-3">
              <span className="rounded-full p-1 shadow-[0_0_0_2px_var(--color-flare),0_0_20px_-4px_var(--color-flare)]">
                <img
                  src={avatarSrc({ seed: draft.seed, bg: draft.bg, ...draft.choices }, 400)}
                  alt=""
                  width={200}
                  height={200}
                  /* Kolom ini tidak menggulir, jadi pratinjau hanya boleh
                     sebesar sisa ruang setelah bagian tetap di bawahnya
                     (~270px: dua baris warna, tombol acak, dan Kembalikan).
                     Persentase layar saja tidak cukup -- bagian tetap itu
                     tidak ikut mengecil saat jendela dipendekkan. Di layar
                     normal 11rem yang menang, jadi ukurannya tidak berubah. */
                  className="block size-[9rem] rounded-full md:size-[min(11rem,calc(70vh_-_270px))]"
                />
              </span>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-bold">Warna latar</p>
              <ColorRow
                colors={AVATAR_BACKGROUNDS}
                value={draft.bg}
                onPick={(bg) => setDraft((prev) => ({ ...prev, bg }))}
                label="Warna latar"
              />
            </div>

            <div>
              <p className="mb-2 text-[13px] font-bold">Warna kulit</p>
              <ColorRow
                colors={AVATAR_OPTIONS.skinColor}
                value={draft.choices.skinColor}
                onPick={(skinColor) => setChoice({ skinColor })}
                label="Warna kulit"
              />
            </div>

            <button
              type="button"
              onClick={randomizeAll}
              className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-4 py-2.5 text-[14px] font-bold transition-colors hover:border-[var(--fg)]/35"
            >
              <Icon>{DiceIcon}</Icon>
              Acak semua
            </button>

            <button
              type="button"
              onClick={() => setDraft(initial)}
              className="flex items-center gap-2 self-start text-[13px] text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            >
              <Icon className="size-4">{UndoIcon}</Icon>
              Kembalikan
            </button>
          </aside>

          {/* Kolom kanan: kategori dan petak pilihannya. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              role="tablist"
              aria-label="Kategori avatar"
              className="no-scrollbar -mx-1 flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--line)] px-1"
            >
              {CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={category.id === tab}
                  onClick={() => setTab(category.id)}
                  className={`flex shrink-0 items-center gap-1.5 border-b-2 px-2 pb-2.5 pt-1 text-[13px] font-bold transition-colors ${
                    category.id === tab
                      ? "border-flare text-[var(--fg)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  <Icon>{category.icon}</Icon>
                  {category.label}
                </button>
              ))}
            </div>

            <div className="flex shrink-0 items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold">{active.label}</p>
                <p className="truncate text-[13px] text-[var(--muted)]">{currentLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => randomizeCategory(active)}
                aria-label={`Acak ${active.label.toLowerCase()}`}
                className="shrink-0 rounded-lg border border-[var(--line)] p-2 text-[var(--muted)] transition-colors hover:border-[var(--fg)]/35 hover:text-[var(--fg)]"
              >
                <Icon>{DiceIcon}</Icon>
              </button>
            </div>

            <div className="min-h-0 flex-1 md:overflow-y-auto">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2 pb-1">
                {active.kind === "optional" && (
                  <Tile
                    draft={draft}
                    selected={draft.choices[active.id] === null}
                    label={`Tanpa ${active.label.toLowerCase()}`}
                    text="Tanpa"
                    onPick={() => setChoice({ [active.id]: null })}
                  />
                )}

                {active.kind !== "features" &&
                  AVATAR_OPTIONS[active.id].map((value) => (
                    <Tile
                      key={value}
                      draft={draft}
                      override={{ [active.id]: value }}
                      selected={draft.choices[active.id] === value}
                      label={`${active.label} ${humanize(value)}`}
                      onPick={() => setChoice({ [active.id]: value })}
                    />
                  ))}

                {active.kind === "features" && (
                  <>
                    <Tile
                      draft={draft}
                      selected={draft.choices.features?.length === 0}
                      label="Tanpa detail wajah"
                      text="Tanpa"
                      onPick={() => setChoice({ features: [] })}
                    />
                    {AVATAR_OPTIONS.features.map((feature) => {
                      const current = draft.choices.features ?? [];
                      const on = current.includes(feature);
                      return (
                        <Tile
                          key={feature}
                          draft={draft}
                          override={{ features: on ? [] : [feature] }}
                          selected={on}
                          label={FEATURE_LABELS[feature] ?? feature}
                          onPick={() =>
                            setChoice({
                              features: on
                                ? current.filter((f) => f !== feature)
                                : [...current, feature],
                            })
                          }
                        />
                      );
                    })}
                  </>
                )}
              </div>

              {active.id === "hair" && (
                <div className="mt-5">
                  <p className="mb-2 text-[13px] font-bold">Warna rambut</p>
                  <ColorRow
                    colors={AVATAR_OPTIONS.hairColor}
                    value={draft.choices.hairColor}
                    onPick={(hairColor) => setChoice({ hairColor })}
                    label="Warna rambut"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[var(--line)] p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--line)] px-6 py-3 text-[14px] font-bold"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="flex-1 rounded-lg bg-[var(--btn-bg)] px-6 py-3 text-[15px] font-bold text-[var(--btn-fg)]"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
