"use client";

import { useEffect, useRef, useState } from "react";

import Avatar from "@/components/Avatar";
import type { AvatarChoices } from "@/lib/avatar";

type VotePlayer = {
  id: string;
  name: string;
  username?: string;
  avatarSeed?: string;
  avatarBg?: string;
  avatarChoices?: AvatarChoices;
};

/**
 * Muncul di layar SEMUA pemain begitu satu orang mengajak menyerah -- bukan
 * cuma yang mengajak. Tidak bisa ditutup manual (tidak ada tombol X/Escape):
 * ajakannya menyangkut semua orang di room, jadi keputusannya cuma dua --
 * ikut menjawab, atau biarkan waktunya habis -- bukan sekadar menyingkirkan
 * modalnya dari layar sendiri sementara pemain lain masih menunggu.
 */
export default function SurrenderVoteModal({
  players,
  startedBy,
  deadline,
  responses,
  myPlayerId,
  myResponse,
  responding,
  onRespond,
}: {
  players: VotePlayer[];
  startedBy: string;
  deadline: number;
  responses: Record<string, "accept" | "reject">;
  myPlayerId: string;
  myResponse?: "accept" | "reject";
  responding: boolean;
  onRespond: (response: "accept" | "reject") => void;
}) {
  // Durasi total ditangkap sekali saat modal pertama muncul, dipakai sebagai
  // penyebut supaya bar-nya mulai penuh lalu mengosong linear sampai
  // `deadline`, bukan cuma menampilkan angka detik yang tersisa.
  const totalMsRef = useRef(Math.max(1, deadline - Date.now()));
  const [progress, setProgress] = useState(1);

  // Tidak ada penutup manual (lihat catatan komponen), tapi tetap mengunci
  // gulir latar seperti modal lain selama masih terbuka.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const left = deadline - Date.now();
      setProgress(Math.max(0, Math.min(1, left / totalMsRef.current)));
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [deadline]);

  const starter = players.find((p) => p.id === startedBy);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Ajakan menyerah"
        className="flex w-full max-w-[26rem] flex-col gap-4 rounded-lg border border-[var(--line)] bg-[var(--card)] p-5"
      >
        <div>
          <p className="text-[17px] font-bold">Ajakan menyerah</p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            <strong className="text-[var(--fg)]">{starter?.name ?? "Seseorang"}</strong> mengajak
            semua pemain menyerah.
          </p>
        </div>

        <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {players.map((player) => {
            const response = responses[player.id];
            return (
              <li key={player.id} className="flex w-[76px] shrink-0 flex-col items-center gap-1 text-center">
                <Avatar
                  seed={player.avatarSeed}
                  bg={player.avatarBg}
                  choices={player.avatarChoices}
                  name={player.name}
                  size={44}
                  className={player.id === myPlayerId ? "ring-2 ring-flare ring-offset-2 ring-offset-[var(--card)]" : ""}
                />
                <span className="w-full truncate text-[13px]">
                  {player.id === myPlayerId ? "Kamu" : player.name}
                </span>
                {player.username && (
                  <span className="w-full truncate font-mono text-[11px] text-[var(--muted)]">
                    @{player.username}
                  </span>
                )}
                <span
                  className={`text-[11px] font-bold ${
                    response === "accept" ? "text-flare" : "text-[var(--muted)]"
                  }`}
                >
                  {response === "accept" ? "Terima" : response === "reject" ? "Tolak" : "Menunggu…"}
                </span>
              </li>
            );
          })}
        </ul>

        {myResponse ? (
          <p className="text-center text-[13px] text-[var(--muted)]">
            Kamu memilih {myResponse === "accept" ? "menerima" : "menolak"}. Menunggu pemain lain…
          </p>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onRespond("reject")}
              disabled={responding}
              className="flex-1 rounded-pill border border-[var(--line)] px-4 py-2.5 text-[14px] font-bold text-[var(--muted)] disabled:opacity-50"
            >
              Tolak
            </button>
            <button
              type="button"
              onClick={() => onRespond("accept")}
              disabled={responding}
              className="flex-1 rounded-pill bg-flare px-4 py-2.5 text-[14px] font-bold text-[#150710] disabled:opacity-50"
            >
              Terima
            </button>
          </div>
        )}

        <div role="timer" aria-label="Sisa waktu" className="h-1 w-full overflow-hidden rounded-full bg-[var(--track)]">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${progress * 100}%`, transition: "width 100ms linear" }}
          />
        </div>
      </div>
    </div>
  );
}
