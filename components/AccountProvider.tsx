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
  /**
   * Sudah pasti punya akun atau tidak, begitu `loaded` true -- beda dari
   * `me`, yang untuk pemilik akun baru terisi belakangan lewat SSE. Dipakai
   * saat sebuah keputusan UI ("tampilkan gerbang tamu?") tidak boleh keliru
   * hanya karena `me` belum sempat terisi.
   */
  hasAccount: boolean | null;
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
export default function AccountProvider({
  children,
  initialHasAccount,
}: {
  children: React.ReactNode;
  /** Sudah diketahui dari cookie sesi di server -- menghindari flash gate/"Memuat…" pada tiap hard-load. */
  initialHasAccount: boolean;
}) {
  const [me, setMe] = useState<MeState | null>(null);
  const [loaded, setLoaded] = useState(true);
  const [sessionKey, setSessionKey] = useState(0);
  const [hasAccount, setHasAccount] = useState<boolean | null>(initialHasAccount);

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

  // Pembeda "online" dari "idle": server cuma tahu koneksi SSE-nya masih
  // terbuka, bukan apakah pemainnya benar-benar menggerakkan mouse/keyboard.
  // Detak dikirim berjeda supaya tidak membanjiri server walau aktivitasnya
  // terus-menerus, dan hanya saat tab benar-benar terlihat -- tab yang
  // di-background dibiarkan hanyut ke idle seiring waktu.
  useEffect(() => {
    if (!hasAccount) return;

    const HEARTBEAT_INTERVAL_MS = 30_000;
    let lastSentAt = 0;

    const send = () => {
      const now = Date.now();
      if (now - lastSentAt < HEARTBEAT_INTERVAL_MS) return;
      lastSentAt = now;
      void fetch("/api/me/heartbeat", { method: "POST" }).catch(() => {
        // Detak yang gagal terkirim tidak masalah -- yang berikutnya akan mencoba lagi.
      });
    };

    const onActivity = () => {
      if (document.visibilityState === "visible") send();
    };
    const onVisibilityChange = () => {
      // Kembali dari tab lain langsung mengirim detak, tidak menunggu jeda,
      // supaya status "kembali online" tidak terasa lambat.
      if (document.visibilityState === "visible") {
        lastSentAt = 0;
        send();
      }
    };

    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("pointerdown", onActivity);
    document.addEventListener("visibilitychange", onVisibilityChange);
    send();

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("pointerdown", onActivity);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [hasAccount, sessionKey]);

  const adopt = useCallback((account: PublicProfile) => {
    setMe({
      account,
      status: "online",
      friends: [],
      incoming: [],
      outgoing: [],
      invites: [],
      unreadMessages: {},
    });
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
    () => ({ me, loaded, hasAccount, adopt, signOut }),
    [me, loaded, hasAccount, adopt, signOut],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount dipakai di luar AccountProvider");
  return value;
}
