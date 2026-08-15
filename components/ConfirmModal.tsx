"use client";

import { useEffect, useRef } from "react";

/**
 * Modal konfirmasi generik untuk tindakan yang tidak mudah dibatalkan.
 *
 * Dipakai pertama kali untuk menghapus teman -- tombol Chat dan Hapus
 * berdempetan di baris yang sama, dan sekali salah pencet langsung memutus
 * pertemanan tanpa jalan mundur.
 */
export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Ya, hapus",
  cancelLabel = "Batal",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-[22rem] rounded-lg border border-[var(--line)] bg-[var(--card)] p-5 outline-none"
      >
        <p className="text-[16px] font-bold">{title}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--muted)]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-pill border border-[var(--line)] px-4 py-2 text-[13px] font-bold"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-pill bg-flare px-4 py-2 text-[13px] font-bold text-[#150710]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
