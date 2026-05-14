import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { NetworkGuard } from "@/components/NetworkGuard";
import "./globals.css";

// Self-hosted via next/font — no external font request, zero FOUT, display:swap
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Monamarket — Prediction Markets on Monad",
  description:
    "Polymarket-style prediction markets on Monad testnet. Buy outcome shares with MON. Resolves automatically via Pyth oracle.",
};

const EXPLORER = "https://testnet.monadexplorer.com/address";
const GITHUB   = "https://github.com/GeekyKartikey/Monamarket";

const CONTRACTS = [
  { label: "Factory",  address: "0xB629D6EAF379A8484b5E669BFe35dCaF8017b852" },
  { label: "BTC/USD",  address: "0x2b2892586573b1414DfDebB7A2DA70972e118749" },
  { label: "ETH/USD",  address: "0xA407c17012a6242E3a8763D6915f6c6C97a5b0BA" },
  { label: "MON/USD",  address: "0x91580C797b97523652B5722DD9B504972e9F8fc2" },
] as const;

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="min-h-screen flex flex-col bg-bg text-txt-primary">
        <Providers>
          {/* ── Testnet banner — non-dismissable, always visible ─────────── */}
          <div className="w-full bg-warning/10 border-b border-warning/20 text-warning text-xs text-center py-1.5 px-4 font-medium shrink-0">
            Testnet only — these are play funds, not real money.
          </div>

          {/* ── Navigation ───────────────────────────────────────────────── */}
          <header className="border-b border-monad-border/60 px-6 py-4 shrink-0">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <a
                href="/"
                className="text-xl font-bold tracking-tight"
                style={{ color: "var(--accent)" }}
              >
                Monamarket
              </a>
              <nav className="flex items-center gap-6">
                <a
                  href="/"
                  className="text-sm text-txt-secondary hover:text-txt-primary transition-colors"
                >
                  Markets
                </a>
                <a
                  href="/portfolio"
                  className="text-sm text-txt-secondary hover:text-txt-primary transition-colors"
                >
                  Portfolio
                </a>
                <a
                  href="/create"
                  className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    color: "var(--accent)",
                    background: "rgba(131,110,249,0.10)",
                    border: "1px solid rgba(131,110,249,0.25)",
                  }}
                >
                  + Create
                </a>
                <a
                  href="/about"
                  className="text-sm text-txt-secondary hover:text-txt-primary transition-colors"
                >
                  About
                </a>
                <ConnectButton />
              </nav>
            </div>
          </header>

          {/* ── Main content ─────────────────────────────────────────────── */}
          <main className="max-w-7xl mx-auto px-6 py-8 w-full flex-1">
            {children}
          </main>

          {/* ── Wrong-chain banner ───────────────────────────────────────── */}
          <NetworkGuard />

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <footer className="border-t border-monad-border/40 mt-auto shrink-0">
            <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-xs text-txt-muted">
              {/* Left — branding + github */}
              <div className="flex flex-col gap-1.5">
                <span className="font-semibold text-txt-secondary">
                  Monamarket
                </span>
                <a
                  href={GITHUB}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-txt-primary transition-colors"
                >
                  GitHub ↗
                </a>
              </div>

              {/* Center — contract addresses */}
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {CONTRACTS.map(({ label, address }) => (
                  <span key={address}>
                    {label}:{" "}
                    <a
                      href={`${EXPLORER}/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono hover:text-txt-primary transition-colors"
                    >
                      {truncate(address)}
                    </a>
                  </span>
                ))}
              </div>

              {/* Right — badges */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="px-2 py-0.5 rounded-full border border-accent/30 text-accent/80">
                  Built on Monad
                </span>
                <span className="px-2 py-0.5 rounded-full border border-monad-border/60 text-txt-muted">
                  Powered by Pyth
                </span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
