import { useSyncExternalStore } from 'react';
import type { AvatarConfig } from '@shared/types.ts';
import {
  avatarDataUri,
  avatarEngineVersion,
  ensureAvatarEngine,
  initialsFor,
  subscribeAvatarEngine,
} from '../lib/avatar.ts';

interface AvatarProps {
  config: AvatarConfig;
  size?: number;
  alt?: string;
}

export function Avatar({ config, size = 36, alt = '' }: AvatarProps) {
  // Berlangganan ke pemuatan mesin avatar supaya placeholder berganti jadi
  // avatar asli begitu chunk-nya selesai diunduh.
  useSyncExternalStore(subscribeAvatarEngine, avatarEngineVersion, () => 0);
  ensureAvatarEngine();

  const uri = avatarDataUri(config);
  const className = 'avatar';
  const style = { width: size, height: size };

  if (!uri) {
    return (
      <span
        className={`${className} avatar--placeholder`}
        style={{ ...style, background: `#${config.backgroundColor}`, fontSize: size * 0.36 }}
        aria-hidden={alt === '' ? true : undefined}
        aria-label={alt || undefined}
        role={alt ? 'img' : undefined}
      >
        {initialsFor(config.seed)}
      </span>
    );
  }

  return (
    <img
      className={className}
      src={uri}
      width={size}
      height={size}
      style={style}
      alt={alt}
      /* Avatar dekoratif tidak perlu diumumkan pembaca layar; namanya sudah
         disebut sebagai teks di sebelahnya. */
      aria-hidden={alt === '' ? true : undefined}
      draggable={false}
    />
  );
}
