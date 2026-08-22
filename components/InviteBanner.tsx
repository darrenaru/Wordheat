"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import Avatar from "@/components/Avatar";
import { useAccount } from "@/components/AccountProvider";
import type { Invite } from "@/lib/profile";

/**
 * Undangan room yang masuk.
 *
 * Ditempel di tepi layar dan bukan di halaman tertentu, karena undangan bisa
 * datang kapan saja -- termasuk saat pemain sedang di tengah permainan lain.
 */
export default function InviteBanner() {
  const { me } = useAccount();
  const router = useRouter();

  const dismiss = useCallback(async (inviteId: string) => {
    await fetch("/api/friends/invite", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    });
  }, []);

  const accept = useCallback(
    async (invite: Invite) => {
      await dismiss(invite.id);
      router.push(`/room/${invite.code}`);
    },
    [dismiss, router],
  );

  if (!me?.invites.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
      <ul className="pointer-events-auto flex w-full max-w-[30rem] flex-col gap-2">
        {me.invites.map((invite) => (
          <li
            key={invite.id}
            className="rise flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--card)] px-4 py-3 shadow-lg"
          >
            <Avatar
              seed={invite.from.avatarSeed}
              bg={invite.from.avatarBg}
              choices={invite.from.avatarChoices}
              name={invite.from.displayName}
              size={36}
            />
            <p className="min-w-0 flex-1 break-words text-[14px] leading-snug">
              <strong>{invite.from.displayName}</strong> mengundangmu ke room{" "}
              <span className="font-mono tracking-[0.12em]">{invite.code}</span>
            </p>
            <button
              type="button"
              onClick={() => void accept(invite)}
              className="shrink-0 rounded-pill bg-[var(--btn-bg)] px-4 py-2 text-[13px] font-bold text-[var(--btn-fg)]"
            >
              Gabung
            </button>
            <button
              type="button"
              onClick={() => void dismiss(invite.id)}
              aria-label="Tutup undangan"
              className="shrink-0 text-[18px] leading-none text-[var(--muted)]"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
