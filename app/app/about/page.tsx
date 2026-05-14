import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "About — Monamarket",
  description:
    "How Monamarket works: parimutuel prediction markets on Monad testnet, resolved by Pyth oracle.",
};

const EXPLORER = "https://testnet.monadexplorer.com/address";

const CONTRACTS = [
  {
    label: "Market Factory",
    address: "0xB629D6EAF379A8484b5E669BFe35dCaF8017b852",
    description: "Deploys new prediction market contracts",
  },
  {
    label: "BTC/USD Market",
    address: "0x2b2892586573b1414DfDebB7A2DA70972e118749",
    description: "Will BTC exceed $120,000 by Jun 30 2026?",
  },
  {
    label: "ETH/USD Market",
    address: "0xA407c17012a6242E3a8763D6915f6c6C97a5b0BA",
    description: "Will ETH exceed $5,000 by Jun 30 2026?",
  },
  {
    label: "MON/USD Market",
    address: "0x91580C797b97523652B5722DD9B504972e9F8fc2",
    description: "Where will MON/USD land by Jul 15 2026?",
  },
] as const;

const STEPS = [
  {
    n: "1",
    title: "Browse markets",
    body: "Each market poses a binary or multi-outcome question about an asset price at a future date.",
  },
  {
    n: "2",
    title: "Buy outcome shares",
    body: "Connect your wallet and deposit MON into the outcome you believe will win. Your deposit becomes your shares.",
  },
  {
    n: "3",
    title: "Wait for resolution",
    body: "At the resolve time, anyone can call resolve() on the contract — no admin required. The contract fetches a verified Pyth price proof.",
  },
  {
    n: "4",
    title: "Claim your payout",
    body: "Winners split the total pool proportionally to their shares. Connect and visit Portfolio to claim.",
  },
] as const;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-txt-primary">{title}</h2>
      {children}
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-12 pb-12">
      {/* Hero */}
      <div className="space-y-3 pt-2">
        <h1 className="text-3xl font-bold leading-tight">
          Prediction markets on{" "}
          <span style={{ color: "var(--accent)" }}>Monad testnet</span>
        </h1>
        <p
          className="text-base leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Monamarket is a Polymarket-style prediction market dApp. Browse open
          markets, buy outcome shares with MON, and let a Pyth oracle settle the
          result — no admin keys required for resolution.
        </p>
      </div>

      {/* How it works */}
      <Section title="How it works">
        <div className="grid sm:grid-cols-2 gap-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-xl p-4 space-y-2"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--monad-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(131,110,249,0.15)",
                    color: "var(--accent)",
                    border: "1px solid rgba(131,110,249,0.3)",
                  }}
                >
                  {s.n}
                </span>
                <span className="text-sm font-semibold text-txt-primary">
                  {s.title}
                </span>
              </div>
              <p className="text-sm text-txt-muted leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Share accounting */}
      <Section title="Share accounting (parimutuel)">
        <div
          className="rounded-xl p-5 space-y-3 text-sm"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--monad-border)",
          }}
        >
          <p style={{ color: "var(--text-secondary)" }}>
            Monamarket v1 uses a simple parimutuel model — no order book, no
            market maker.
          </p>
          <ul
            className="space-y-2 list-none"
            style={{ color: "var(--text-secondary)" }}
          >
            <li className="flex gap-2">
              <span style={{ color: "var(--accent)" }}>→</span>
              <span>
                <strong className="text-txt-primary">Buy:</strong> deposit X MON
                into outcome i. You receive X shares of that outcome.
              </span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: "var(--accent)" }}>→</span>
              <span>
                <strong className="text-txt-primary">Price:</strong> each
                outcome&apos;s displayed % is its pool balance divided by the total
                pool — the market&apos;s implied probability.
              </span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: "var(--accent)" }}>→</span>
              <span>
                <strong className="text-txt-primary">Payout:</strong> your
                shares ÷ winning pool × total pool. Winners share the losers&apos;
                money.
              </span>
            </li>
          </ul>
          <p className="text-xs text-txt-muted border-t pt-3" style={{ borderColor: "var(--monad-border)" }}>
            LMSR (logarithmic market scoring rule) is planned for v2 to provide
            better price discovery.
          </p>
        </div>
      </Section>

      {/* The oracle */}
      <Section title="Resolution via Pyth oracle">
        <div
          className="rounded-xl p-5 space-y-3 text-sm"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--monad-border)",
          }}
        >
          <p style={{ color: "var(--text-secondary)" }}>
            Markets resolve permissionlessly using{" "}
            <a
              href="https://pyth.network"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
              style={{ color: "var(--accent)" }}
            >
              Pyth Network
            </a>{" "}
            price feeds — no admin can influence or delay settlement.
          </p>
          <ul
            className="space-y-2 list-none"
            style={{ color: "var(--text-secondary)" }}
          >
            <li className="flex gap-2">
              <span style={{ color: "var(--accent)" }}>→</span>
              <span>
                Anyone calls <code className="text-accent/80 text-xs">resolve()</code> after the market&apos;s
                resolve time, passing a signed Pyth price update as calldata.
              </span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: "var(--accent)" }}>→</span>
              <span>
                The contract verifies the proof on-chain via the Pyth contract
                and accepts prices within ±1 hour of the resolve timestamp.
              </span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: "var(--accent)" }}>→</span>
              <span>
                Pyth charges a tiny fee (~0.000001 MON) to verify the proof; the
                contract refunds any excess sent.
              </span>
            </li>
          </ul>
          <div
            className="grid grid-cols-2 gap-2 pt-1 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <div>
              <span className="text-txt-secondary font-medium block mb-0.5">
                BTC / ETH feeds
              </span>
              Pyth main contract on Monad testnet
            </div>
            <div>
              <span className="text-txt-secondary font-medium block mb-0.5">
                MON / USD feed
              </span>
              Pyth beta contract (newer feed)
            </div>
          </div>
        </div>
      </Section>

      {/* Contracts */}
      <Section title="Deployed contracts">
        <div className="space-y-2">
          {CONTRACTS.map(({ label, address, description }) => (
            <div
              key={address}
              className="rounded-xl px-4 py-3 flex items-center justify-between gap-4"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--monad-border)",
              }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-txt-primary">{label}</p>
                <p className="text-xs text-txt-muted truncate">{description}</p>
              </div>
              <a
                href={`${EXPLORER}/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 font-mono text-xs shrink-0 hover:text-accent transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                {address.slice(0, 8)}…{address.slice(-6)}
                <ExternalLink size={11} />
              </a>
            </div>
          ))}
        </div>
      </Section>

      {/* Disclaimer */}
      <div
        className="rounded-xl px-5 py-4 text-xs leading-relaxed"
        style={{
          background: "rgba(245,158,11,0.07)",
          border: "1px solid rgba(245,158,11,0.2)",
          color: "var(--text-muted)",
        }}
      >
        <strong className="text-warning">Testnet only.</strong> All markets run
        on Monad testnet. MON tokens have no real-world value. This is an
        experimental dApp for learning and demonstration purposes — not financial
        advice, not audited, not production-ready. Use at your own risk.
      </div>
    </div>
  );
}
