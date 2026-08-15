"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { MeState, PublicProfile } from "@/lib/profile";

type AccountContextValue = {
  me: MeState | null;
  loaded: boolean;
  /** Dipanggil setelah membuat profil atau masuk, agar saluran pribadi terbuka. */
  adopt: (account: PublicProfile) => void;
  signOut: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

/**
 * Satu sumber kebenaran untuk akun pemain di seluruh aplikasi.
 *
 * Dipasang sekali di layout, bukan per komponen: saluran pribadi memakai
 * koneksi SSE yang panjang umurnya, dan browser membatasi jumlah koneksi
 * serentak per origin. Membuka satu aliran per komponen akan menabrak batas
 * itu berbarengan dengan aliran room.
 */
export default function AccountProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth", { cache: "no-store" });
        const data = (await res.json()) as { account: PublicProfile | null };
        if (cancelled) return;
        setHasAccount(Boolean(data.account));
        if (!data.account) setMe(null);
      } catch {
        if (!cancelled) setHasAccount(false);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionKey]);

  useEffect(() => {
    if (!hasAccount) return;

    const source = new EventSource("/api/me/stream");
    source.onmessage = (event) => {
      try {
        setMe(JSON.parse(event.data) as MeState);
      } catch {
        // Potongan pesan rusak: tunggu kiriman berikutnya.
      }
    };
    return () => source.close();
  }, [hasAccount, sessionKey]);

  const adopt = useCallback((account: PublicProfile) => {
    setMe({ account, friends: [], incoming: [], outgoing: [], invites: [], unreadMessages: {} });
    setHasAccount(true);
    setSessionKey((k) => k + 1);
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setMe(null);
    setHasAccount(false);
    setSessionKey((k) => k + 1);
  }, []);

  const value = useMemo(
    () => ({ me, loaded, adopt, signOut }),
    [me, loaded, adopt, signOut],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount dipakai di luar AccountProvider");
  return value;
}
