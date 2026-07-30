/**
 * Musik latar.
 *
 * Tiga hal yang membentuk modul ini:
 *
 * 1. Berkasnya ~3,5 MB. Elemen audionya baru dibuat saat musik benar-benar
 *    dinyalakan, jadi pemain yang mematikannya tidak pernah mengunduh apa pun.
 * 2. Peramban menolak memutar audio sebelum ada interaksi pengguna. `play()`
 *    yang ditolak bukan kegagalan — kita cukup menunggu gestur pertama, lalu
 *    mencoba lagi.
 * 3. Musik yang tiba-tiba menyala keras itu kasar, dan musik yang terus jalan
 *    di tab yang tidak dilihat itu boros. Volume dinaikkan perlahan, dan
 *    pemutaran berhenti saat tab disembunyikan.
 */

const STORAGE_KEY = 'wordheat:sound';
const SRC = '/audio/soundtrack.mp3';

/** Musik latar, bukan efek utama — dijaga di bawah tingkat bicara. */
const VOLUME = 0.32;
const FADE_MS = 900;

let audio: HTMLAudioElement | null = null;
let enabled = load();
let unavailable = false;
let fadeTimer = 0;
let awaitingGesture = false;

const listeners = new Set<() => void>();

function load(): boolean {
  try {
    // Bawaannya menyala: permainan ini memang dirancang dengan musik. Yang
    // pernah mematikannya tetap dihormati.
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return false;
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    /* localStorage bisa diblokir — preferensinya cukup berlaku sesi ini */
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function element(): HTMLAudioElement {
  if (audio) return audio;
  const el = new Audio();
  el.loop = true;
  el.preload = 'none';
  el.volume = 0;
  el.src = SRC;
  el.addEventListener('error', () => {
    // Berkas tidak ada atau gagal didekode. Tombolnya disembunyikan daripada
    // membiarkan pemain menekan sesuatu yang tidak akan pernah berbunyi.
    unavailable = true;
    enabled = false;
    emit();
  });
  audio = el;
  return el;
}

function fadeTo(target: number, onDone?: () => void): void {
  const el = audio;
  if (!el) return;
  window.clearInterval(fadeTimer);

  const from = el.volume;
  const started = performance.now();
  fadeTimer = window.setInterval(() => {
    const t = Math.min(1, (performance.now() - started) / FADE_MS);
    el.volume = from + (target - from) * t;
    if (t === 1) {
      window.clearInterval(fadeTimer);
      onDone?.();
    }
  }, 40);
}

/**
 * Menunggu gestur pertama, lalu mencoba memutar lagi. Dipasang sekali saja;
 * `once` membereskan dirinya sendiri setelah dipicu.
 */
function waitForGesture(): void {
  if (awaitingGesture) return;
  awaitingGesture = true;

  const go = () => {
    awaitingGesture = false;
    for (const type of EVENTS) window.removeEventListener(type, go);
    if (enabled) void start();
  };
  const EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;
  for (const type of EVENTS) window.addEventListener(type, go, { once: true, passive: true });
}

async function start(): Promise<void> {
  if (unavailable) return;
  const el = element();
  try {
    await el.play();
    fadeTo(VOLUME);
  } catch {
    // Hampir selalu kebijakan autoplay, bukan berkas rusak.
    waitForGesture();
  }
}

export function isSoundtrackOn(): boolean {
  return enabled;
}

export function isSoundtrackAvailable(): boolean {
  return !unavailable;
}

export function subscribeSoundtrack(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toggleSoundtrack(): void {
  enabled = !enabled;
  save();
  emit();

  if (enabled) {
    void start();
  } else {
    fadeTo(0, () => audio?.pause());
  }
}

let initialised = false;

/**
 * Dipanggil saat aplikasi dimuat. Aman dipanggil berkali-kali: StrictMode
 * memasang efeknya dua kali di mode dev, dan pendengar visibilitas ini tidak
 * pernah dilepas.
 */
export function initSoundtrack(): void {
  if (initialised) return;
  initialised = true;

  document.addEventListener('visibilitychange', () => {
    if (!audio) return;
    if (document.hidden) audio.pause();
    else if (enabled) void audio.play().catch(() => {});
  });

  if (enabled) void start();
}
