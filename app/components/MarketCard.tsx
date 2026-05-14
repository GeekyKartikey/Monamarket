"use client";

import { type Address, formatEther } from "viem";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";

export interface MarketData {
  address: Address;
  question?: string;
  outcomes?: string[];
  prices?: bigint[];
  poolBalances?: bigint[];
  timeRemaining?: bigint;
  winningOutcome?: number;
}

interface Props {
  data: MarketData;
}

// Binary markets: index 0 = YES (green), index 1 = NO (red).
// Multi-outcome: sequential accent palette.
function getBarColor(index: number, total: number): string {
  if (total === 2) return index === 0 ? "var(--success)" : "var(--danger)";
  const MULTI = ["#836EF9", "#22c55e", "#f59e0b", "#3b82f6", "#ef4444"];
  return MULTI[index % MULTI.length];
}

function deriveCategory(question?: string): string {
  if (!question) return "Crypto";
  const q = question.toLowerCase();
  if (q.includes("btc") || q.includes("bitcoin")) return "Bitcoin";
  if (q.includes("eth") || q.includes("ethereum")) return "Ethereum";
  if (q.includes("mon") || q.includes("monad")) return "Monad";
  return "Crypto";
}

function formatCountdown(secs: bigint): string {
  const s = Number(secs);
  if (s <= 0) return "Closed";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function countdownClass(secs: bigint): string {
  const s = Number(secs);
  if (s <= 0) return "text-txt-muted";
  if (s < 3_600) return "text-danger";    // < 1h
  if (s < 86_400) return "text-warning";  // < 24h
  return "text-txt-muted";
}

export function MarketCard({ data }: Props) {
  const { address, question, outcomes, prices, poolBalances, timeRemaining, winningOutcome } = data;

  const totalPool = poolBalances?.reduce((a, b) => a + b, 0n) ?? 0n;
  const resolved  = winningOutcome !== undefined && (winningOutcome as number) >= 0;
  const winner    = resolved ? (winningOutcome as number) : -1;

  // Leading outcome = highest probability → gets visually dominant % display
  const leadingIndex =
    prices && prices.length > 0
      ? prices.reduce((mi, p, i) => (p > prices[mi] ? i : mi), 0)
      : 0;

  return (
    <Link href={`/market/${address}`} className="group block outline-none">
      <div
        className="
          relative h-full flex flex-col gap-4
          bg-surface border border-monad-border rounded-xl p-5
          transition-all duration-150
          group-hover:-translate-y-0.5 group-hover:border-accent/50 group-hover:shadow-card
          group-focus-visible:border-accent/80 group-focus-visible:shadow-card
        "
      >
        {/* ── Header: question + category pill ──────────────────── */}
        <div className="flex items-start justify-between gap-3">
          {!question ? (
            <div className="space-y-1.5 flex-1">
              <div className="h-4 bg-surface-2 rounded animate-shimmer w-3/4" />
              <div className="h-4 bg-surface-2 rounded animate-shimmer w-1/2" />
            </div>
          ) : (
            <h3 className="text-sm font-semibold leading-snug line-clamp-2 flex-1 min-w-0">
              {question}
            </h3>
          )}
          <div className="shrink-0 mt-0.5">
            {resolved ? (
              <Pill variant="success">Resolved</Pill>
            ) : (
              <Pill>{deriveCategory(question)}</Pill>
            )}
          </div>
        </div>

        {/* ── Outcome bars ──────────────────────────────────────── */}
        <div className="flex flex-col gap-3 flex-1">
          {outcomes && prices ? (
            outcomes.map((label, i) => {
              const pct =
                prices[i] !== undefined && totalPool > 0n
                  ? Math.round(Number((prices[i] * 100n) / BigInt(1e18)))
                  : Math.round(100 / outcomes.length);
              const isWinner  = resolved && winner === i;
              const isLeading = !resolved && i === leadingIndex;
              const color     = isWinner ? "var(--success)" : getBarColor(i, outcomes.length);

              return (
                <div key={i}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className={`text-xs truncate flex-1 min-w-0 ${
                        isWinner ? "text-success font-medium" : "text-txt-secondary"
                      }`}
                    >
                      {label}{isWinner && " ✓"}
                    </span>
                    {/* Leading outcome % is larger and bolder */}
                    <span
                      className={`font-mono tabular-nums shrink-0 font-bold ${
                        isLeading ? "text-base text-txt-primary" : "text-xs text-txt-muted"
                      }`}
                    >
                      {pct}%
                    </span>
                  </div>

                  {/* Bar: scaleX transform on a full-width div — no layout thrash */}
                  <div className="h-1.5 rounded-full overflow-hidden bg-surface-2">
                    <div
                      className="h-full rounded-full will-change-transform"
                      style={{
                        background: color,
                        transform: `scaleX(${pct / 100})`,
                        transformOrigin: "left center",
                        transition: "transform 400ms ease-out",
                      }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between gap-2">
                  <div className="h-3 w-12 bg-surface-2 rounded animate-shimmer" />
                  <div className="h-3 w-8 bg-surface-2 rounded animate-shimmer" />
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full animate-shimmer" />
              </div>
            ))
          )}
        </div>

        {/* ── Footer: pool + oracle + countdown ─────────────────── */}
        <div className="flex items-center justify-between text-xs border-t border-monad-border pt-3 mt-auto">
          <span className="text-txt-muted">
            Pool{" "}
            <span className="font-mono tabular-nums text-txt-primary">
              {parseFloat(formatEther(totalPool)).toFixed(2)} MON
            </span>
          </span>

          <div className="flex items-center gap-2">
            <span className="text-txt-muted/60 text-[10px] uppercase tracking-wide">Pyth</span>

            {resolved ? (
              <Pill variant="success">Resolved</Pill>
            ) : timeRemaining !== undefined ? (
              <span className={`font-mono tabular-nums ${countdownClass(timeRemaining)}`}>
                {formatCountdown(timeRemaining)}
              </span>
            ) : (
              <div className="h-3 w-10 bg-surface-2 rounded animate-shimmer" />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
