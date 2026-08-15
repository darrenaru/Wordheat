export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "wordheat:theme";

export const DEFAULT_THEME: Theme = "dark";

/**
 * Dijalankan sebagai skrip sinkron di dalam <head>, sebelum browser melukis
 * apa pun. Tanpa ini, halaman sempat tampil dengan tema bawaan lebih dulu lalu
 * berkedip ke pilihan pemain.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;
