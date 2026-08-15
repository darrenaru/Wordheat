import { heatColor, heatLevel } from "@/lib/heat";

/**
 * Pendar latar halaman.
 *
 * Warnanya mengikuti tebakan terdekat sejauh ini, sehingga seluruh layar
 * merangkak dari arang ke nyala seiring pemain mendekat. Kedua tema dihitung
 * sekaligus supaya berganti tema langsung terlihat tanpa menunggu React.
 */
export function applyAmbientHeat(bestRank: number | null, vocabSize: number) {
  const root = document.documentElement;
  const level = bestRank === null ? 0 : heatLevel(bestRank, vocabSize);

  root.style.setProperty("--heat-now-dark", heatColor(level, "dark"));
  root.style.setProperty("--heat-now-light", heatColor(level, "light"));

  // Pangkat lebih dari satu menahan pendar tetap nyaris tak terlihat selama
  // tebakan masih jauh, lalu menyalakannya dengan cepat begitu pemain
  // benar-benar mendekat. Tanpa itu halaman terlihat keruh sejak tebakan
  // pertama dan kehilangan artinya.
  root.style.setProperty("--heat-glow", String(level ** 1.6));
}

const FLARE_MS = 1500;

/** Kilatan sekali jalan di seluruh halaman saat kata rahasianya ditemukan. */
export function flarePage() {
  const field = document.querySelector(".heat-field");
  if (!(field instanceof HTMLElement)) return;

  // Atribut dilepas dulu agar animasinya benar-benar dimulai ulang kalau
  // pemain menang lagi di sesi yang sama.
  field.removeAttribute("data-flare");
  void field.offsetWidth;
  field.setAttribute("data-flare", "true");
  setTimeout(() => field.removeAttribute("data-flare"), FLARE_MS);
}
