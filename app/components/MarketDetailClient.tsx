"use client";

import { useState } from "react";
import { useAccount, useReadContracts, useReadContract } from "wagmi";
import { formatEther, type Address } from "viem";
import { Clock, Database, Copy, ExternalLink, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { MARKET_ABI } from "@/lib/contracts";
import { BuyPanel } from "@/components/BuyPanel";
import { BuySheet } from "@/components/BuySheet";
import { ResolveButton } from "@/components/ResolveButton";

const POLL_MS = 5_000;
const STALE_MS = 3_000;
const OUTCOME_COLORS = ["#836EF9", "#22c55e", "#f59e0b", "#3b82f6", "#ef4444"];

// All multicall reads for a single market
const MARKET_READS = [
  "question",        // 0
  "getOutcomes",     // 1
  "getPrices",       // 2
  "getPoolBalances", // 3
  "winningOutcome",  // 4
  "timeRemaining",   // 5
  "resolveTime",     // 6
  "pythPriceFeedId", // 7
  "isDemo",          // 8
  "creator",         // 9
  "resolverBounty",  // 10
  "creationDeposit", // 11
] as const;

function fmtPool(wei: bigint): string {
  const n = parseFloat(formatEther(wei));
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function fmtDate(secs: bigint): string {
  return new Date(Number(secs) * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function MarketDetailClient({ address: marketAddress }: { address: Address }) {
  const { address: userAddress } = useAccount();
  const [selectedOutcome, setSelectedOutcome] = useState(0);

  // Single batched multicall for all public market state
  const { data: allData, isLoading, refetch } = useReadContracts({
    contracts: MARKET_READS.map((fn) => ({
      address: marketAddress,
      abi: MARKET_ABI,
      functionName: fn,
    })),
    query: { refetchInterval: POLL_MS, staleTime: STALE_MS },
  });

  // User-specific position — separate because it requires wallet address
  const { data: userPositionRaw, refetch: refetchPosition } = useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "getUserPosition",
    args: [(userAddress ?? "0x0000000000000000000000000000000000000000") as Address],
    query: { enabled: !!userAddress, refetchInterval: POLL_MS },
  });

  const question        = allData?.[0]?.result as string | undefined;
  const outcomes        = allData?.[1]?.result as string[] | undefined;
  const prices          = allData?.[2]?.result as bigint[] | undefined;
  const poolBalances    = allData?.[3]?.result as bigint[] | undefined;
  const winningOutcome  = allData?.[4]?.result as number | undefined;
  const timeRemaining   = allData?.[5]?.result as bigint | undefined;
  const resolveTime     = allData?.[6]?.result as bigint | undefined;
  const feedId          = allData?.[7]?.result as `0x${string}` | undefined;
  const isDemo          = allData?.[8]?.result as boolean | undefined;
  const creator         = allData?.[9]?.result as Address | undefined;
  const resolverBounty  = allData?.[10]?.result as bigint | undefined;
  const creationDeposit = allData?.[11]?.result as bigint | undefined;
  const userPosition    = userPositionRaw as bigint[] | undefined;

  const zeroAddr = "0x0000000000000000000000000000000000000000";
  const userCreated = !!creator && creator.toLowerCase() !== zeroAddr;

  const resolved = winningOutcome !== undefined && (winningOutcome as number) >= 0;
  const isClosed = timeRemaining !== undefined && Number(timeRemaining) <= 0;
  const totalPool = poolBalances?.reduce((a, b) => a + b, 0n) ?? 0n;

  function handleRefresh() {
    void refetch();
    if (userAddress) void refetchPosition();
  }

  function pct(i: number): number {
    if (!prices?.[i]) return outcomes ? Math.floor(100 / outcomes.length) : 50;
    return Number((prices[i] * 100n) / BigInt(1e18));
  }

  async function copyFeed() {
    if (!feedId) return;
    await navigator.clipboard.writeText(feedId);
    toast.success("Feed ID copied");
  }

  // Shared props passed to both desktop panel and mobile sheet
  const buyPanelProps = {
    marketAddress,
    outcomes,
    prices,
    poolBalances,
    userPosition,
    winningOutcome: winningOutcome as number | undefined,
    isClosed,
    isResolved: resolved,
    selectedOutcome,
    onOutcomeChange: setSelectedOutcome,
    onClaimSuccess: handleRefresh,
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-4 w-28 rounded-lg bg-surface-2 animate-shimmer" />
        <div className="h-8 w-3/4 rounded-xl bg-surface-2 animate-shimmer" />
        <div className="grid md:grid-cols-5 gap-6">
          <div className="md:col-span-3 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-surface animate-shimmer" />
            ))}
          </div>
          <div className="hidden md:block md:col-span-2">
            <div className="h-64 rounded-xl bg-surface animate-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link
          href="/"
          className="text-txt-muted hover:text-txt-secondary transition-colors"
        >
          Markets
        </Link>
        <span className="text-txt-muted">/</span>
        <span className="font-mono text-xs text-txt-muted">
          {marketAddress.slice(0, 6)}…{marketAddress.slice(-4)}
        </span>
      </nav>

      {/* Demo banner */}
      {isDemo && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "rgba(131,110,249,0.08)",
            border: "1px solid rgba(131,110,249,0.25)",
            color: "var(--accent)",
          }}
        >
          <span className="font-semibold">Demo market</span>
          <span style={{ color: "var(--text-secondary)" }}>
            — resolvable at any time. Resolver earns a 0.5% bounty (max 1 MON).
          </span>
        </div>
      )}

      {/* User-created market banner */}
      {userCreated && !isDemo && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.2)",
            color: "var(--text-secondary)",
          }}
        >
          <span>Community market · creator</span>
          <span className="font-mono text-xs">{creator!.slice(0, 8)}…{creator!.slice(-4)}</span>
        </div>
      )}

      {/* Status pill + question */}
      <div className="space-y-3">
        {resolved ? (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: "rgba(34,197,94,0.12)",
              color: "var(--success)",
              border: "1px solid rgba(34,197,94,0.25)",
            }}
          >
            Resolved
          </span>
        ) : isClosed ? (
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: "rgba(245,158,11,0.12)",
              color: "var(--warning)",
              border: "1px solid rgba(245,158,11,0.25)",
            }}
          >
            Awaiting Resolution
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: "rgba(131,110,249,0.12)",
              color: "var(--accent)",
              border: "1px solid rgba(131,110,249,0.25)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Live
          </span>
        )}

        <h1 className="text-xl sm:text-2xl font-bold leading-snug text-txt-primary">
          {question ?? "Loading…"}
        </h1>
      </div>

      {/* 60/40 layout */}
      <div className="grid md:grid-cols-5 gap-6 items-start">
        {/* Left — 60% */}
        <div className="md:col-span-3 space-y-4">
          {/* Clickable outcome bars */}
          <div className="space-y-2">
            {outcomes?.map((label, i) => {
              const barPct = pct(i);
              const isSelected = selectedOutcome === i;
              const isWinner = resolved && (winningOutcome as number) === i;
              const isLoser =
                resolved &&
                (winningOutcome as number) >= 0 &&
                (winningOutcome as number) !== i;
              const color =
                outcomes.length === 2
                  ? i === 0
                    ? "var(--success)"
                    : "var(--danger)"
                  : OUTCOME_COLORS[i % OUTCOME_COLORS.length];
              return (
                <button
                  key={i}
                  onClick={() => setSelectedOutcome(i)}
                  className="w-full text-left rounded-xl p-4 transition-all duration-150"
                  style={{
                    background: isSelected
                      ? "rgba(131,110,249,0.06)"
                      : "var(--surface-2)",
                    border: isSelected
                      ? "1.5px solid rgba(131,110,249,0.4)"
                      : isWinner
                      ? "1px solid rgba(34,197,94,0.3)"
                      : "1px solid var(--monad-border)",
                    outline: "none",
                  }}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span
                      className="text-sm font-medium truncate"
                      style={{
                        color: isWinner
                          ? "var(--success)"
                          : isLoser
                          ? "var(--text-muted)"
                          : "var(--text-primary)",
                      }}
                    >
                      {label} {isWinner && "✓"}
                    </span>
                    <span
                      className="text-base font-bold font-mono ml-3 shrink-0"
                      style={{ color, fontFeatureSettings: '"tnum"' }}
                    >
                      {barPct}%
                    </span>
                  </div>
                  {/* Animated progress bar */}
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--monad-border)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        background: color,
                        transform: `scaleX(${barPct / 100})`,
                        transformOrigin: "left center",
                        transition: "transform 400ms ease-out",
                        willChange: "transform",
                        opacity: isLoser ? 0.4 : 1,
                      }}
                    />
                  </div>
                  {poolBalances && (
                    <p className="text-xs text-txt-muted mt-1.5">
                      {parseFloat(formatEther(poolBalances[i])).toFixed(2)} MON
                      in pool
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Market info card */}
          <div
            className="rounded-xl p-4 space-y-3 text-sm"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--monad-border)",
            }}
          >
            <h3 className="text-xs font-semibold text-txt-muted uppercase tracking-wide">
              Market Details
            </h3>

            <div className="flex items-center justify-between gap-2">
              <span className="text-txt-muted flex items-center gap-1.5">
                <Database size={13} /> Total pool
              </span>
              <span
                className="font-mono font-semibold text-txt-primary"
                style={{ fontFeatureSettings: '"tnum"' }}
              >
                {fmtPool(totalPool)} MON
              </span>
            </div>

            {/* Resolver bounty — shown after resolution */}
            {resolverBounty !== undefined && resolverBounty > 0n && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-txt-muted shrink-0">Resolver bounty</span>
                <span
                  className="font-mono text-xs"
                  style={{ color: "var(--accent)", fontFeatureSettings: '"tnum"' }}
                >
                  {fmtPool(resolverBounty)} MON
                </span>
              </div>
            )}

            {/* Creator deposit — shown on unresolved user-created markets */}
            {userCreated && !resolved && creationDeposit !== undefined && creationDeposit > 0n && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-txt-muted shrink-0">Creator deposit</span>
                <span
                  className="font-mono text-xs text-txt-secondary"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  {fmtPool(creationDeposit)} MON (refunded on resolve)
                </span>
              </div>
            )}

            {resolveTime && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-txt-muted flex items-center gap-1.5 shrink-0">
                  <Clock size={13} /> Resolves
                </span>
                <span className="text-txt-secondary text-right text-xs">
                  {fmtDate(resolveTime)}
                </span>
              </div>
            )}

            {feedId && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-txt-muted shrink-0">Price feed</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-txt-secondary">
                    {feedId.slice(0, 10)}…{feedId.slice(-6)}
                  </span>
                  <button
                    onClick={copyFeed}
                    className="p-1 rounded hover:bg-surface transition-colors"
                    aria-label="Copy feed ID"
                  >
                    <Copy size={12} style={{ color: "var(--text-muted)" }} />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="text-txt-muted shrink-0">Contract</span>
              <a
                href={`https://testnet.monadexplorer.com/address/${marketAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 font-mono text-xs hover:text-accent transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                {marketAddress.slice(0, 8)}…{marketAddress.slice(-6)}
                <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* Resolve button — multicall data passed so it skips stray reads */}
          <ResolveButton
            marketAddress={marketAddress}
            resolveTime={resolveTime}
            feedId={feedId}
            isResolved={resolved}
            isDemo={isDemo}
            onResolved={handleRefresh}
          />
        </div>

        {/* Right — 40% — desktop only */}
        <div className="hidden md:block md:col-span-2">
          <div
            className="sticky top-6 rounded-xl p-5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--monad-border)",
            }}
          >
            <h2 className="text-sm font-semibold mb-4">
              {resolved ? "Your position" : "Buy shares"}
            </h2>
            <BuyPanel {...buyPanelProps} />
          </div>
        </div>
      </div>

      {/* Mobile FAB — fixed bottom sheet trigger */}
      <div className="md:hidden fixed bottom-6 inset-x-4 z-30">
        {resolved && userPosition?.some((s) => s > 0n) ? (
          <BuySheet
            title="Your position"
            trigger={
              <button
                className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
                style={{
                  background: "rgba(34,197,94,0.15)",
                  color: "var(--success)",
                  border: "1px solid rgba(34,197,94,0.3)",
                }}
              >
                View position &amp; claim
              </button>
            }
          >
            <BuyPanel {...buyPanelProps} />
          </BuySheet>
        ) : !resolved ? (
          <BuySheet
            title={
              outcomes?.[selectedOutcome]
                ? `Buy ${outcomes[selectedOutcome]}`
                : "Buy shares"
            }
            trigger={
              <button
                className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 shadow-lg"
                style={{ background: "var(--accent)" }}
              >
                <ArrowUpRight size={16} /> Buy shares
              </button>
            }
          >
            <BuyPanel {...buyPanelProps} />
          </BuySheet>
        ) : null}
      </div>
    </div>
  );
}
