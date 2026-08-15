import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans } from "next/font/google";

import AccountProvider from "@/components/AccountProvider";
import Ambient from "@/components/Ambient";
import InviteBanner from "@/components/InviteBanner";
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from "@/lib/theme";

import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

// Angka peringkat adalah data yang dibandingkan pemain baris demi baris, jadi
// butuh lebar digit tetap. DM Mono sekeluarga dengan DM Sans, sehingga
// penambahan ini tetap menyatu dengan sistem tipografi di DESIGN.md.
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wordheat — tebak kata lewat kedekatan makna",
  description:
    "Temukan kata rahasia. Setiap tebakan diberi peringkat berdasarkan kedekatan maknanya, bukan ejaannya. Main sendiri atau adu cepat bersama teman.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
    { media: "(prefers-color-scheme: light)", color: "#0b0b0d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      data-theme={DEFAULT_THEME}
      className={`${dmSans.variable} ${dmMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Ambient />
        <div className="heat-field" aria-hidden="true" />
        <AccountProvider>
          {children}
          <InviteBanner />
        </AccountProvider>
      </body>
    </html>
  );
}
