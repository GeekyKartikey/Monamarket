"use client";

import { type Address, formatEther } from "viem";
import Link from "next/link";

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

export function MarketCard({ data }: Props) {
  const { address, question, outcomes, prices, poolBalances, timeRemaining, winningOutcome } = data;

  const totalPool = poolBalances?.reduce((a, b) => a + b, 0n) ?? 0n;
  const resolved  = winningOutcome !== undefined && winningOutcome >= 0;

  function formatCountdown(secs: bigint): string {
    const s = Number(secs);
    if (s <= 0) return "Closed";
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    if (d > 0) return `${d}d ${h}h`;
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }

  return (
    <Link href={`/market/${address}`}>
      <div className="bg-monad-card border border-monad-border rounded-xl p-5 hover:border-monad-purple/60 transition-all cursor-pointer h-full flex flex-col gap-4">

        {/* Question */}
        {!question ? (
          <div className="space-y-2">
            <div className="h-4 bg-monad-border rounded animate-pulse w-3/4" />
            <div className="h-4 bg-monad-border rounded animate-pulse w-1/2" />
          </div>
        ) : (
          <h3 className="text-sm font-medium text-white leading-snug line-clamp-3">
            {question}
          </h3>
        )}

        {/* Outcome bars */}
        <div className="flex flex-col gap-2">
          {outcomes && prices
            ? outcomes.map((label, i) => {
                const pct = prices[i]
                  ? Number((prices[i] * 100n) / BigInt(1e18))
                  : Math.floor(100 / outcomes.length);
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span className="truncate max-w-[70%]">{label}</span>
                      <span className="font-mono text-white">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-monad-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-monad-purple rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            : Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-5 bg-monad-border rounded animate-pulse" />
              ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-2 border-t border-monad-border">
          <span>
            Pool:{" "}
            <span className="text-white font-mono">
              {parseFloat(formatEther(totalPool)).toFixed(3)} MON
            </span>
          </span>
          {resolved ? (
            <span className="text-green-400 font-medium">Resolved</span>
          ) : (
            <span>
              {timeRemaining !== undefined ? formatCountdown(timeRemaining) : "…"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
