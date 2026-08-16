"use client";

import { useEffect, useState } from "react";

import PresenceDot from "@/components/PresenceDot";
import type { AccountStatus } from "@/lib/profile";

/**
 * PresenceDot yang menyambung sendiri ke status hidup seorang pemain lewat
 * GET /api/players/[username]/stream. Dipakai bareng oleh halaman penuh
 * `/players/[username]` (server component, hanya bisa memberi cuplikan awal)
 * dan modal profil (`PlayerStats.tsx`) -- supaya logika langganannya tidak
 * dobel di dua tempat.
 */
export default function LivePresenceDot({
  username,
  initialStatus,
  withLabel = false,
  className,
}: {
  username: string;
  initialStatus: AccountStatus;
  withLabel?: boolean;
  className?: string;
}) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    setStatus(initialStatus);
  }, [username, initialStatus]);

  useEffect(() => {
    const source = new EventSource(`/api/players/${encodeURIComponent(username)}/stream`);
    source.onmessage = (event) => {
      try {
        const { status: next } = JSON.parse(event.data) as { status: AccountStatus };
        setStatus(next);
      } catch {
        // Potongan pesan rusak: tunggu kiriman berikutnya.
      }
    };
    return () => source.close();
  }, [username]);

  return <PresenceDot status={status} withLabel={withLabel} className={className} />;
}
