import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'solo'; mode: 'practice' | 'daily' }
  | { name: 'room'; code: string }
  | { name: 'shop' }
  | { name: 'leaderboard' };

/**
 * Router hash sederhana. Cukup untuk empat layar, dan yang lebih penting:
 * tautan undangan (#/ruang/ABCDE) bisa dibagikan tanpa perlu konfigurasi
 * rewrite di sisi hosting.
 */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  const [head, param] = path.split('/');

  if (head === 'main') return { name: 'solo', mode: 'practice' };
  if (head === 'harian') return { name: 'solo', mode: 'daily' };
  if (head === 'ruang' && param) return { name: 'room', code: param.toUpperCase() };
  if (head === 'shop') return { name: 'shop' };
  if (head === 'leaderboard') return { name: 'leaderboard' };
  return { name: 'home' };
}

export function navigate(path: string): void {
  if (location.hash === `#${path}`) return;
  location.hash = path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
