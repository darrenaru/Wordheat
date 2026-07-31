import { useEffect } from 'react';
import { EMOJIS, emojiIconUrl } from '../lib/emojis.ts';

interface EmojiPickerProps {
  onPick(slug: string): void;
  onClose(): void;
}

/** Grid kecil (scroll) 112 emoji — dipakai composer `ChatScreen`. Escape
 *  menutup; memilih satu emoji juga menutup (satu emoji per klik terasa
 *  lebih wajar daripada picker yang tetap terbuka menunggu klik lagi). */
export function EmojiPicker({ onPick, onClose }: EmojiPickerProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="emoji-picker" role="dialog" aria-label="Pilih emoji">
      <div className="emoji-picker__grid">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji.slug}
            type="button"
            className="emoji-picker__item"
            onClick={() => {
              onPick(emoji.slug);
              onClose();
            }}
            title={emoji.label}
            aria-label={emoji.label}
          >
            <img src={emojiIconUrl(emoji.slug)} alt="" width={28} height={28} />
          </button>
        ))}
      </div>
    </div>
  );
}
