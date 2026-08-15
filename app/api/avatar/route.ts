import { createAvatar } from "@dicebear/core";
import * as adventurer from "@dicebear/adventurer";

import { AVATAR_OPTIONS, isValidAvatarBg, sanitizeChoices } from "@/lib/avatar";

export const runtime = "nodejs";

/**
 * Melayani gambar avatar.
 *
 * Dirender sendiri alih-alih menautkan ke api.dicebear.com: pemilih avatar
 * menampilkan puluhan pratinjau sekaligus, dan itu tidak pantas dilemparkan ke
 * layanan orang lain. Sekalian, avatar tetap muncul tanpa koneksi keluar.
 */

/** Gambar untuk satu susunan pilihan tidak akan pernah berubah. */
const IMMUTABLE = "public, max-age=31536000, immutable";

const MIN_SIZE = 16;
const MAX_SIZE = 512;

function readSize(raw: string | null): number {
  const size = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(size)) return 96;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, size));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const seed = (params.get("seed") ?? "").slice(0, 64);
  const bg = params.get("backgroundColor") ?? "";
  if (!seed || !isValidAvatarBg(bg)) {
    return new Response("parameter avatar tidak sah", { status: 400 });
  }

  /**
   * URLSearchParams.get mengembalikan null untuk parameter yang tidak ada,
   * sedangkan null di sini berarti "sengaja ditiadakan". Keduanya harus
   * dibedakan: kalau tidak, avatar yang tidak menyebut rambut akan dirender
   * botak alih-alih mengikuti benihnya.
   */
  const opt = (name: string) => params.get(name) ?? undefined;

  /** Bagian yang boleh ditiadakan; probability 0 adalah cara menyatakannya. */
  const optional = (name: string, probability: string) =>
    params.get(probability) === "0" ? null : opt(name);

  const choices = sanitizeChoices({
    hair: optional("hair", "hairProbability"),
    hairColor: opt("hairColor"),
    skinColor: opt("skinColor"),
    eyes: opt("eyes"),
    eyebrows: opt("eyebrows"),
    mouth: opt("mouth"),
    glasses: optional("glasses", "glassesProbability"),
    earrings: optional("earrings", "earringsProbability"),
    features: params.has("featuresProbability")
      ? params.get("featuresProbability") === "0"
        ? []
        : params.getAll("features")
      : undefined,
  });

  const svg = createAvatar(adventurer, {
    seed,
    size: readSize(params.get("size")),
    backgroundColor: [bg],
    ...(choices.skinColor ? { skinColor: [choices.skinColor] } : {}),
    ...(choices.hairColor ? { hairColor: [choices.hairColor] } : {}),
    ...(choices.hair === null
      ? { hairProbability: 0 }
      : choices.hair
        ? { hair: [choices.hair as (typeof AVATAR_OPTIONS.hair)[number]], hairProbability: 100 }
        : {}),
    ...(choices.eyes ? { eyes: [choices.eyes] } : {}),
    ...(choices.eyebrows ? { eyebrows: [choices.eyebrows] } : {}),
    ...(choices.mouth ? { mouth: [choices.mouth] } : {}),
    ...(choices.glasses === null
      ? { glassesProbability: 0 }
      : choices.glasses
        ? { glasses: [choices.glasses], glassesProbability: 100 }
        : {}),
    ...(choices.earrings === null
      ? { earringsProbability: 0 }
      : choices.earrings
        ? { earrings: [choices.earrings], earringsProbability: 100 }
        : {}),
    ...(choices.features
      ? choices.features.length === 0
        ? { featuresProbability: 0 }
        : { features: choices.features, featuresProbability: 100 }
      : {}),
  } as Parameters<typeof createAvatar>[1]).toString();

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": IMMUTABLE,
    },
  });
}
