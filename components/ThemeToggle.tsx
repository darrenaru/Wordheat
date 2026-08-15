"use client";

import { useEffect, useState } from "react";

import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

/**
 * Pengalih tema gelap/terang.
 *
 * Tema dibaca dari atribut yang sudah dipasang skrip anti-kedip di layout,
 * bukan dari nilai awal komponen, supaya tombolnya tidak pernah menampilkan
 * ikon yang berlawanan dengan tampilan halaman.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Penyimpanan diblokir: tema tetap berganti untuk sesi ini saja.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Beralih ke tema terang" : "Beralih ke tema gelap"}
      className="grid shrink-0 place-items-center p-1 text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
    >
      {theme === "dark" ? (
        // Matahari: menunjukkan ke mana tombol ini membawa, bukan keadaan kini.
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8.3" y="8.3" width="7.4" height="7.4" rx="2.4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
