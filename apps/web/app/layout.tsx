import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { CommandBar } from "@/components/command-bar";
import { MobileTabs } from "@/components/mobile-tabs";
import { NavRail } from "@/components/nav-rail";
import { TransactionTape } from "@/components/transaction-tape";
import { Providers } from "./providers";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "NETFOLD | Stablecoin net settlement on Arc",
  description:
    "Multilateral obligation clearing and residual stablecoin settlement for crypto-native operators.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${instrumentSans.variable} ${plexMono.variable}`}>
        <Providers>
          <div className="app-shell">
            <CommandBar />
            <div className="workspace-frame">
              <NavRail />
              <main className="workspace-main">{children}</main>
            </div>
            <TransactionTape />
            <MobileTabs />
          </div>
        </Providers>
      </body>
    </html>
  );
}

