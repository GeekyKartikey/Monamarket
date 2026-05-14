import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export const metadata: Metadata = {
  title: "Monamarket — Prediction Markets on Monad",
  description: "Polymarket-style prediction markets on Monad testnet",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-monad-dark text-white">
        <Providers>
          {/* Testnet banner */}
          <div className="w-full bg-yellow-900/40 border-b border-yellow-700/40 text-yellow-300 text-xs text-center py-1.5 px-4">
            ⚠ Testnet only. Unaudited. Do not use with real funds.
          </div>

          {/* Nav */}
          <header className="border-b border-monad-border px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
            <a href="/" className="text-xl font-bold text-monad-purple">
              Monamarket
            </a>
            <nav className="flex items-center gap-6">
              <a
                href="/"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Markets
              </a>
              <a
                href="/portfolio"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Portfolio
              </a>
              <ConnectButton />
            </nav>
          </header>

          <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
