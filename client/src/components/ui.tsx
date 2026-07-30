import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/* ------------------------------------------------------------------ toast */

interface Toast {
  id: number;
  message: string;
  level: 'info' | 'error';
}

interface ToastApi {
  show(message: string, level?: 'info' | 'error'): void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, level: 'info' | 'error' = 'info') => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, message, level }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast${toast.level === 'error' ? ' toast--error' : ''}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ modal */

interface ModalProps {
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  /** Melebarkan panel untuk isi dua kolom. Opsional supaya modal lain tetap ramping. */
  wide?: boolean;
  /** Kelas tambahan pada `.modal__body` — dipakai isi yang mau mengatur area
   *  gulirnya sendiri (mis. `AvatarStudio`) alih-alih memakai satu gulir bawaan. */
  bodyClassName?: string;
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
  bodyClassName,
}: ModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal${wide ? ' modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal__head">
          <h2>{title}</h2>
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Tutup">
            <CloseIcon />
          </button>
        </div>
        <div className={`modal__body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ ikon */
/* Line-style, stroke 1.75 — selaras dengan karakter geometris Inter. */

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const CloseIcon = () => (
  <svg {...iconProps}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const HelpIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4" />
    <path d="M12 17h.01" />
  </svg>
);

export const BackIcon = () => (
  <svg {...iconProps}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export const ShareIcon = () => (
  <svg {...iconProps}>
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path d="M16 6l-4-4-4 4M12 2v13" />
  </svg>
);

export const DiceIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M8.5 8.5h.01M15.5 8.5h.01M8.5 15.5h.01M15.5 15.5h.01M12 12h.01" />
  </svg>
);

export const BulbIcon = () => (
  <svg {...iconProps}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .9 1.6h5.4c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3Z" />
  </svg>
);

export const FlagIcon = () => (
  <svg {...iconProps}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
);

export const CopyIcon = () => (
  <svg {...iconProps}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

export const UsersIcon = () => (
  <svg {...iconProps}>
    <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
    <circle cx="9" cy="7" r="3.2" />
    <path d="M22 20v-1.5a4 4 0 0 0-3-3.87M16.5 4.2a3.2 3.2 0 0 1 0 5.9" />
  </svg>
);

export const CrownIcon = () => (
  <svg {...iconProps} width={14} height={14}>
    <path d="M3 18h18M4 8l4 3 4-6 4 6 4-3-1.5 8h-13L4 8Z" />
  </svg>
);

export const CalendarIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

export const PlayIcon = () => (
  <svg {...iconProps}>
    <path d="M7 4.5 19 12 7 19.5v-15Z" />
  </svg>
);

export const ShopIcon = () => (
  <svg {...iconProps}>
    <path d="M4 9 5.5 4h13L20 9" />
    <path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z" />
    <path d="M9 13a3 3 0 0 0 6 0" />
  </svg>
);

export const TargetIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="8.25" />
    <circle cx="12" cy="12" r="4.75" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const HairIcon = () => (
  <svg {...iconProps}>
    <path d="M4 11c0-4.5 3.5-8 8-8s8 3.5 8 8v2" />
    <path d="M6 10.5v6M10 9.5v8M14 9.5v8M18 10.5v6" />
  </svg>
);

export const DropletIcon = () => (
  <svg {...iconProps}>
    <path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3Z" />
  </svg>
);

export const EyebrowIcon = () => (
  <svg {...iconProps}>
    <path d="M3.5 14.5c2-4 6-6.5 9-6.5s6 1.5 8 4" />
  </svg>
);

export const MouthIcon = () => (
  <svg {...iconProps}>
    <path d="M3.5 10.5c2.8 2 5.6 3 8.5 3s5.7-1 8.5-3" />
    <path d="M8 14c1.3 2.3 2.7 3.5 4 3.5s2.7-1.2 4-3.5" />
  </svg>
);

export const GlassesIcon = () => (
  <svg {...iconProps}>
    <circle cx="6.5" cy="13" r="3.5" />
    <circle cx="17.5" cy="13" r="3.5" />
    <path d="M10 13h4M3 13l-1.5-5M21 13l1.5-5M2 8h2.5M19.5 8H22" />
  </svg>
);

export const EarringIcon = () => (
  <svg {...iconProps}>
    <path d="M12 3v4" />
    <circle cx="12" cy="11" r="4" />
    <path d="M9.5 14.5 8 20h8l-1.5-5.5" />
  </svg>
);

export const SparkleIcon = () => (
  <svg {...iconProps}>
    <path d="M12 3c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6Z" />
    <path d="M19 15c.3 1.7 1.1 2.5 2.8 2.8-1.7.3-2.5 1.1-2.8 2.8-.3-1.7-1.1-2.5-2.8-2.8 1.7-.3 2.5-1.1 2.8-2.8Z" />
  </svg>
);

export const EyeIcon = () => (
  <svg {...iconProps}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const TrophyIcon = () => (
  <svg {...iconProps}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5" />
    <path d="M12 14v3M9 21h6M8.5 21c0-2 1-3 1-3h5s1 1 1 3" />
  </svg>
);

export const ArrowIcon = () => (
  <svg {...iconProps} width={16} height={16}>
    <path d="M5 12h13M12 5l7 7-7 7" />
  </svg>
);

export const UndoIcon = () => (
  <svg {...iconProps}>
    <path d="M4 5v6h6" />
    <path d="M4.5 11a8 8 0 1 1 1.2 6" />
  </svg>
);

export const EditIcon = () => (
  <svg {...iconProps}>
    <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="M13.5 8 16 10.5" />
  </svg>
);

export const FlameIcon = () => (
  <svg {...iconProps}>
    <path d="M17.7 18.7A8 8 0 0 1 6.3 7.3C7 9 9 10 9 10c0-2 .5-5 3-7 1 2 3 2.8 4.7 4.3A8 8 0 0 1 17.7 18.7Z" />
    <path d="M9.9 16.1a3 3 0 1 0 2.1-5.1L11 14H9c0 .8.3 1.5.9 2.1Z" />
  </svg>
);

export const BoltIcon = () => (
  <svg {...iconProps}>
    <path d="M13 3 4 14h6l-1 7 9-11h-6l1-7Z" />
  </svg>
);

export const StarIcon = () => (
  <svg {...iconProps}>
    <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7L12 3Z" />
  </svg>
);

export const CheckIcon = () => (
  <svg {...iconProps}>
    <path d="M5 12.5 9.5 17 19 6.5" />
  </svg>
);

/** Logo resmi Google — empat warnanya bagian dari merek, bukan ikut palet aplikasi. */
export const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.87 2.68-6.61Z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z"
    />
    <path
      fill="#FBBC05"
      d="M3.97 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33Z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
    />
  </svg>
);

export const SoundOnIcon = () => (
  <svg {...iconProps}>
    <path d="M4 9v6h3.5L12 19V5L7.5 9H4Z" />
    <path d="M15.5 8.8a4.5 4.5 0 0 1 0 6.4M18.4 6a8 8 0 0 1 0 12" />
  </svg>
);

export const SoundOffIcon = () => (
  <svg {...iconProps}>
    <path d="M4 9v6h3.5L12 19V5L7.5 9H4Z" />
    <path d="M16 9.5l4.5 5M20.5 9.5l-4.5 5" />
  </svg>
);
