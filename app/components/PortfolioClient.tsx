"use client";

import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, type Address } from "viem";
import { Loader2, TrendingUp, ExternalLink } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { FACTORY_ABI, FACTORY_ADDRESS, MARKET_ABI } from "@/lib/contracts";

const READS_PER_MARKET = 5;
const STALE_MS = 15_000;

// Per-market reads: question, getOutcomes, winningOutcome, getPoolBalances, getUserPosition
const POSITION_FUNCTIONS = [
  "question",
  "getOutcomes",
  "winningOutcome",
  "getPoolBalances",
  "getUserPosition",
] as const;

interface MarketRow {
  address: Address;
  question?: string;
  outcomes?: string[];
  winningOutcome?: number;
  poolBalances?: bigint[];
  userPosition?: bigint[];
}

function fmtMon(wei: bigint): string {
  const n = parseFloat(formatEther(wei));
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(4);
}

function estimatePayout(row: MarketRow): bigint {
  const { winningOutcome, poolBalances, userPosition } = row;
  if (
    winningOutcome === undefined ||
    winningOutcome < 0 ||
    !poolBalances ||
    !userPosition
  )
    return 0n;
  const w = winningOutcome;
  const shares = userPosition[w] ?? 0n;
  const pool = poolBalances[w] ?? 0n;
  if (shares === 0n || pool === 0n) return 0n;
  const totalPool = poolBalances.reduce((a, b) => a + b, 0n);
  return (shares * totalPool) / pool;
}

// ── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  loading?: boolean;
}

function StatCard({ label, value, sub, accent, loading }: StatCardProps) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{
        background: accent ? "rgba(131,110,249,0.08)" : "var(--surface-2)",
        border: accent
          ? "1px solid rgba(131,110,249,0.25)"
          : "1px solid var(--monad-border)",
      }}
    >
      {loading ? (
        <>
          <div className="h-6 w-20 rounded-lg bg-surface animate-shimmer" />
          <div className="h-3 w-14 rounded bg-surface animate-shimmer mt-1" />
        </>
      ) : (
        <>
          <span
            className="text-xl font-bold font-mono tabular-nums"
            style={{
              color: accent ? "var(--accent)" : "var(--text-primary)",
              fontFeatureSettings: '"tnum"',
            }}
          >
            {value}
          </span>
          <span className="text-xs text-txt-muted">{label}</span>
          {sub && (
            <span className="text-xs" style={{ color: "var(--success)" }}>
              {sub}
            </span>
          )}
        </>
      )}
    </div>
  );
}

// ── Position card ─────────────────────────────────────────────────────────────

function PositionCard({
  row,
  onClaimed,
}: {
  row: MarketRow;
  onClaimed: () => void;
}) {
  const resolved =
    row.winningOutcome !== undefined && (row.winningOutcome as number) >= 0;
  const winner = resolved ? (row.winningOutcome as number) : -1;
  const payout = estimatePayout(row);
  const hasWinningShares = winner >= 0 && payout > 0n;

  const { writeContract, data: claimHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  function handleClaim() {
    const toastId = toast.loading("Submitting claim…");
    writeContract(
      {
        address: row.address,
        abi: MARKET_ABI,
        functionName: "claim",
        args: [],
      },
      {
        onSuccess: () => {
          toast.success("Claimed!", { id: toastId });
          import("canvas-confetti").then(({ default: confetti }) => {
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
          });
          onClaimed();
        },
        onError: (e) => toast.error(e.message.slice(0, 100), { id: toastId }),
      }
    );
  }

  const statusColor = resolved
    ? hasWinningShares
      ? "var(--success)"
      : "var(--danger)"
    : "var(--accent)";
  const statusLabel = resolved
    ? hasWinningShares
      ? "Won ✓"
      : "Lost"
    : "Open";

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: hasWinningShares
          ? "rgba(34,197,94,0.06)"
          : "var(--surface-2)",
        border: hasWinningShares
          ? "1px solid rgba(34,197,94,0.2)"
          : "1px solid var(--monad-border)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/market/${row.address}`}
          className="text-sm font-medium line-clamp-2 hover:text-accent transition-colors"
          style={{ color: "var(--text-primary)" }}
        >
          {row.question ?? "…"}
        </Link>
        <span
          className="text-xs font-semibold shrink-0"
          style={{ color: statusColor }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Per-outcome rows */}
      <div className="space-y-1">
        {row.outcomes?.map((label, i) => {
          const shares = row.userPosition?.[i] ?? 0n;
          if (shares === 0n) return null;
          const isWinner = winner === i;
          const isLoser = winner >= 0 && winner !== i;
          return (
            <div
              key={i}
              className="flex items-center justify-between text-xs gap-2"
            >
              <span
                style={{
                  color: isWinner
                    ? "var(--success)"
                    : isLoser
                    ? "var(--text-muted)"
                    : "var(--text-secondary)",
                }}
              >
                {label} {isWinner && "✓"}
              </span>
              <span
                className="font-mono"
                style={{
                  color: isLoser ? "var(--text-muted)" : "var(--text-primary)",
                  fontFeatureSettings: '"tnum"',
                }}
              >
                {fmtMon(shares)} MON
              </span>
            </div>
          );
        })}
      </div>

      {/* Claim row */}
      {hasWinningShares && (
        <div
          className="flex items-center justify-between pt-3 border-t"
          style={{ borderColor: "rgba(34,197,94,0.2)" }}
        >
          <div>
            <p className="text-xs text-txt-muted">Payout</p>
            <p
              className="text-sm font-bold font-mono"
              style={{ color: "var(--success)", fontFeatureSettings: '"tnum"' }}
            >
              {fmtMon(payout)} MON
            </p>
          </div>
          <button
            onClick={handleClaim}
            disabled={isPending || isConfirming}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{
              background: "rgba(34,197,94,0.15)",
              color: "var(--success)",
              border: "1px solid rgba(34,197,94,0.3)",
            }}
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Claiming…
              </>
            ) : (
              "Claim"
            )}
          </button>
        </div>
      )}

      {/* Explorer link */}
      <a
        href={`https://testnet.monadexplorer.com/address/${row.address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.color =
            "var(--text-secondary)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.color =
            "var(--text-muted)")
        }
      >
        {row.address.slice(0, 8)}…{row.address.slice(-6)}
        <ExternalLink size={10} />
      </a>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-sm font-semibold text-txt-secondary">{label}</h2>
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{
          background: "var(--surface-2)",
          color: "var(--text-muted)",
          border: "1px solid var(--monad-border)",
        }}
      >
        {count}
      </span>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyPositions() {
  return (
    <div className="text-center py-16 space-y-4">
      <TrendingUp
        size={40}
        className="mx-auto"
        style={{ color: "var(--text-muted)" }}
      />
      <div>
        <p className="text-txt-secondary font-medium">No positions yet.</p>
        <p className="text-sm text-txt-muted mt-1">
          Browse open markets and buy outcome shares to get started.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: "rgba(131,110,249,0.12)",
          color: "var(--accent)",
          border: "1px solid rgba(131,110,249,0.25)",
        }}
      >
        Browse markets
      </Link>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PortfolioClient() {
  const { address: userAddress, isConnected } = useAccount();

  const { data: marketsRaw, isLoading: marketsLoading, refetch: refetchAll } =
    useReadContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "getAllMarkets",
      query: { staleTime: 30_000 },
    });

  const marketList = (marketsRaw as Address[] | undefined) ?? [];

  // Batch all position reads in one multicall — avoids N+1 round trips
  const { data: allData, isLoading: dataLoading } = useReadContracts({
    contracts: marketList.flatMap((addr) =>
      POSITION_FUNCTIONS.map((fn, j) => ({
        address: addr,
        abi: MARKET_ABI,
        functionName: fn,
        ...(j === 4 && userAddress ? { args: [userAddress] } : {}),
      }))
    ),
    query: {
      enabled: marketList.length > 0 && !!userAddress,
      staleTime: STALE_MS,
    },
  });

  const isLoading =
    marketsLoading || (marketList.length > 0 && !!userAddress && dataLoading);

  // Build per-market rows
  const rows: MarketRow[] = marketList.map((addr, i) => {
    const base = i * READS_PER_MARKET;
    return {
      address: addr,
      question:       allData?.[base + 0]?.result as string | undefined,
      outcomes:       allData?.[base + 1]?.result as string[] | undefined,
      winningOutcome: allData?.[base + 2]?.result as number | undefined,
      poolBalances:   allData?.[base + 3]?.result as bigint[] | undefined,
      userPosition:   allData?.[base + 4]?.result as bigint[] | undefined,
    };
  });

  // Only show markets where user has any shares
  const myRows = rows.filter((r) =>
    r.userPosition?.some((s) => s > 0n)
  );

  const resolved = (r: MarketRow) =>
    r.winningOutcome !== undefined && (r.winningOutcome as number) >= 0;
  const isClosed = (r: MarketRow) =>
    resolved(r); // closed markets eventually resolve; open = not resolved

  const claimable = myRows.filter(
    (r) => resolved(r) && estimatePayout(r) > 0n
  );
  const open = myRows.filter((r) => !resolved(r));
  const lost = myRows.filter(
    (r) => resolved(r) && estimatePayout(r) === 0n
  );

  // Summary stats
  const totalDeployed = myRows.reduce((acc, r) => {
    return acc + (r.userPosition?.reduce((a, b) => a + b, 0n) ?? 0n);
  }, 0n);
  const totalClaimable = claimable.reduce(
    (acc, r) => acc + estimatePayout(r),
    0n
  );

  // Not connected
  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-txt-muted text-sm mt-1">
            Your positions across all prediction markets.
          </p>
        </div>
        <div
          className="rounded-2xl p-10 text-center space-y-5"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--monad-border)",
          }}
        >
          <p className="text-txt-secondary font-medium">
            Connect your wallet to see your positions.
          </p>
          <ConnectButton label="Connect wallet" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <p className="text-txt-muted text-sm mt-1">
          Your positions across all prediction markets.
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Deployed"
          value={isLoading ? "" : `${fmtMon(totalDeployed)} MON`}
          loading={isLoading}
        />
        <StatCard
          label="Claimable"
          value={isLoading ? "" : `${fmtMon(totalClaimable)} MON`}
          sub={
            !isLoading && claimable.length > 0
              ? `${claimable.length} market${claimable.length > 1 ? "s" : ""}`
              : undefined
          }
          accent={!isLoading && totalClaimable > 0n}
          loading={isLoading}
        />
        <StatCard
          label="Positions"
          value={isLoading ? "" : String(myRows.length)}
          loading={isLoading}
        />
      </div>

      {/* Position lists */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl animate-shimmer"
              style={{ background: "var(--surface-2)" }}
            />
          ))}
        </div>
      ) : myRows.length === 0 ? (
        <EmptyPositions />
      ) : (
        <div className="space-y-6">
          {/* Claimable — most urgent, show first */}
          {claimable.length > 0 && (
            <div className="space-y-3">
              <SectionHeader label="Ready to claim" count={claimable.length} />
              {claimable.map((r) => (
                <PositionCard
                  key={r.address}
                  row={r}
                  onClaimed={refetchAll}
                />
              ))}
            </div>
          )}

          {/* Open positions */}
          {open.length > 0 && (
            <div className="space-y-3">
              <SectionHeader label="Open positions" count={open.length} />
              {open.map((r) => (
                <PositionCard
                  key={r.address}
                  row={r}
                  onClaimed={refetchAll}
                />
              ))}
            </div>
          )}

          {/* Lost positions — least important */}
          {lost.length > 0 && (
            <div className="space-y-3">
              <SectionHeader label="Resolved (no payout)" count={lost.length} />
              {lost.map((r) => (
                <PositionCard
                  key={r.address}
                  row={r}
                  onClaimed={refetchAll}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
