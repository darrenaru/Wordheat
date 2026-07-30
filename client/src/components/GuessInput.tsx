import { useEffect, useRef, useState } from 'react';
import { replayAnimation, usePrefersReducedMotion } from '../lib/motion.ts';

interface GuessInputProps {
  onSubmit(word: string): void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  /**
   * Bertambah setiap kali sebuah tebakan ditolak server. Memicu getaran pendek —
   * isyarat yang lebih cepat ditangkap daripada membaca toast di bawah layar.
   */
  errorSignal?: number;
}

export function GuessInput({
  onSubmit,
  disabled = false,
  busy = false,
  placeholder = 'Tebak katanya...',
  errorSignal = 0,
}: GuessInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  // Kedua kelas menganimasikan elemen yang sama, jadi yang lama harus dilepas
  // dulu — kalau tidak, getaran penolakan bisa tertimpa kilatan "terkirim".
  const flash = (className: string) => {
    const form = formRef.current;
    if (!form || reduced) return;
    form.classList.remove('guess-form--sent', 'guess-form--rejected');
    replayAnimation(form, className);
  };

  useEffect(() => {
    if (errorSignal === 0) return;
    flash('guess-form--rejected');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorSignal]);

  return (
    <form
      ref={formRef}
      className="guess-form"
      onSubmit={(event) => {
        event.preventDefault();
        const word = value.trim();
        if (!word || disabled || busy) return;
        flash('guess-form--sent');
        onSubmit(word);
        setValue('');
        // Fokus dipertahankan supaya pemain bisa menebak beruntun tanpa
        // memindahkan tangan dari keyboard.
        inputRef.current?.focus();
      }}
    >
      <input
        ref={inputRef}
        className="input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="send"
        maxLength={32}
        aria-label="Kata tebakan"
      />
      <button
        className="btn btn--brand"
        type="submit"
        disabled={disabled || busy || value.trim().length === 0}
      >
        {busy ? (
          <span className="dots" aria-label="Mengirim tebakan">
            <i />
            <i />
            <i />
          </span>
        ) : (
          'Tebak'
        )}
      </button>
    </form>
  );
}
