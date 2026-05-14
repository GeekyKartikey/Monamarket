"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { formatEther, type Address } from "viem";
import { TrendingUp, BarChart3, Zap } from "lucide-react";
import { FACTORY_ABI, FACTORY_ADDRESS, MARKET_ABI } from "@/lib/contracts";
import { MarketCard, type MarketData } from "@/components/MarketCard";

const READS_PER_MARKET = 8;
const POLL_MS  = 15_000;
const STALE_MS = 10_000;

const MARKET_FUNCTIONS = [
  "question",
  "getOutcomes",
  "getPrices",
  "getPoolBalances",
  "timeRemaining",
  "winningOutcome",
  "isDemo",
  "creator",
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────

function formatVolume(wei: bigint): string {
  const n = parseFloat(formatEther(wei));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function formatCountdown(secs: bigint): string {
  const s = Number(secs);
  if (s <= 0) return "—";
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3_600);
  const m = Math.floor((s % 3_600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Stats strip ──────────────────────────────────────────────────────────

interface StatItemProps {
  label: string;
  value: string;
  loading?: boolean;
}

function StatItem({ label, value, loading }: StatItemProps) {
  return (
    <div className="flex flex-col gap-1">
      {loading ? (
        <>
          <div className="h-7 w-20 bg-surface-2 rounded-lg animate-shimmer" />
          <div className="h-3 w-14 bg-surface-2 rounded animate-shimmer" />
        </>
      ) : (
        <>
          <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-txt-primary">
            {value}
          </span>
          <span className="text-xs text-txt-muted">{label}</span>
        </>
      )}
    </div>
  );
}

// ── Grid skeleton ────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-52 rounded-xl bg-surface animate-shimmer" />
      ))}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-20 space-y-4">
      <div className="flex justify-center items-end gap-3" style={{ color: "var(--text-muted)" }}>
        <TrendingUp size={28} />
        <BarChart3 size={40} />
        <Zap size={24} />
      </div>
      <p className="text-txt-secondary font-medium">No markets open right now.</p>
      <p className="text-sm text-txt-muted">
        Set{" "}
        <code className="text-accent/80 text-xs">NEXT_PUBLIC_FACTORY_ADDRESS</code>{" "}
        in .env.local, or check back soon.
      </p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export function MarketGridClient() {
  // Step 1: market addresses from factory
  const { data: markets, isLoading: marketsLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getAllMarkets",
    query: { staleTime: 60_000 },
  });

  const marketList = (markets as Address[] | undefined) ?? [];

  // Step 2: all market data in ONE batched multicall (Multicall3)
  const { data: allData, isLoading: dataLoading } = useReadContracts({
    contracts: marketList.flatMap((addr) =>
      MARKET_FUNCTIONS.map((fn) => ({
        address: addr,
        abi: MARKET_ABI,
        functionName: fn,
      }))
    ),
    query: {
      enabled: marketList.length > 0,
      refetchInterval: POLL_MS,  // poll every 15s — no watch:true on homepage (battery)
      staleTime: STALE_MS,
    },
  });

  // Slice flat multicall results into per-market objects
  const marketData: MarketData[] = marketList.map((addr, i) => {
    const base = i * READS_PER_MARKET;
    return {
      address:        addr,
      question:       allData?.[base + 0]?.result as string | undefined,
      outcomes:       allData?.[base + 1]?.result as string[] | undefined,
      prices:         allData?.[base + 2]?.result as bigint[] | undefined,
      poolBalances:   allData?.[base + 3]?.result as bigint[] | undefined,
      timeRemaining:  allData?.[base + 4]?.result as bigint | undefined,
      winningOutcome: allData?.[base + 5]?.result as number | undefined,
      isDemo:         allData?.[base + 6]?.result as boolean | undefined,
      creator:        allData?.[base + 7]?.result as Address | undefined,
    };
  });

  const isLoading = marketsLoading || (marketList.length > 0 && dataLoading);

  // ── Compute stats from already-fetched data (no extra reads) ──────────
  const totalVolume = marketData.reduce((acc, m) => {
    return acc + (m.poolBalances?.reduce((a, b) => a + b, 0n) ?? 0n);
  }, 0n);

  const openCount = marketData.filter(
    (m) => m.winningOutcome === undefined || (m.winningOutcome as number) < 0
  ).length;

  const soonestClose = marketData
    .filter((m) => m.timeRemaining !== undefined && Number(m.timeRemaining) > 0)
    .map((m) => m.timeRemaining as bigint)
    .sort((a, b) => Number(a - b))[0];

  return (
    <div className="space-y-8">
      {/* ── Stats strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 sm:gap-6 rounded-xl border border-monad-border bg-surface px-6 py-5">
        <StatItem
          label="Total volume"
          value={isLoading ? "" : `${formatVolume(totalVolume)} MON`}
          loading={isLoading}
        />
        <StatItem
          label="Open markets"
          value={isLoading ? "" : String(openCount)}
          loading={isLoading}
        />
        <StatItem
          label="Next close"
          value={
            isLoading
              ? ""
              : soonestClose !== undefined
              ? formatCountdown(soonestClose)
              : "—"
          }
          loading={isLoading}
        />
      </div>

      {/* ── Market grid ──────────────────────────────────────────── */}
      {isLoading ? (
        <GridSkeleton />
      ) : marketList.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {marketData.map((m) => (
            <MarketCard key={m.address} data={m} />
          ))}
        </div>
      )}
    </div>
  );
}
