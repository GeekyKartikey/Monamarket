"use client";

import { useState } from "react";
import {
  useAccount,
  useBalance,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther, type Address } from "viem";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { MARKET_ABI } from "@/lib/contracts";

interface Props {
  marketAddress: Address;
  outcomes?: string[];
  prices?: bigint[];
  poolBalances?: bigint[];
  userPosition?: bigint[];
  winningOutcome?: number;
  isClosed?: boolean;
  isResolved?: boolean;
  selectedOutcome?: number;
  onOutcomeChange?: (i: number) => void;
  onClaimSuccess?: () => void;
}

type Tab = "buy" | "position";

const QUICK_AMOUNTS = ["0.1", "1", "10"] as const;

// Parimutuel: shares = deposited amount; payout = shares * newTotalPool / newPoolForOutcome
function calcPreview(
  amountWei: bigint,
  outcomeIndex: number,
  poolBalances: bigint[],
  existingShares: bigint
): { shares: string; payout: string; returnPct: string } {
  const totalPool = poolBalances.reduce((a, b) => a + b, 0n);
  const newPool = (poolBalances[outcomeIndex] ?? 0n) + amountWei;
  if (newPool === 0n) return { shares: "—", payout: "—", returnPct: "—" };
  const newTotalPool = totalPool + amountWei;
  const sharesAfter = existingShares + amountWei;
  const payout = (sharesAfter * newTotalPool) / newPool;
  const gain = payout > amountWei ? payout - amountWei : 0n;
  const returnPct =
    amountWei > 0n
      ? ((Number(gain) / Number(amountWei)) * 100).toFixed(1)
      : "0.0";
  return {
    shares: parseFloat(formatEther(sharesAfter)).toFixed(3),
    payout: parseFloat(formatEther(payout)).toFixed(4),
    returnPct,
  };
}

export function BuyPanel({
  marketAddress,
  outcomes,
  prices,
  poolBalances,
  userPosition,
  winningOutcome,
  isClosed,
  isResolved,
  selectedOutcome: selectedOutcomeProp,
  onOutcomeChange,
  onClaimSuccess,
}: Props) {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("buy");
  const [localOutcome, setLocalOutcome] = useState(0);
  const [amount, setAmount] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const selectedOutcome = selectedOutcomeProp ?? localOutcome;
  function selectOutcome(i: number) {
    if (onOutcomeChange) onOutcomeChange(i);
    else setLocalOutcome(i);
  }

  const { data: balance } = useBalance({
    address,
    query: { enabled: !!address },
  });

  const {
    writeContract: buyWrite,
    data: buyHash,
    isPending: buyPending,
  } = useWriteContract();
  const { isLoading: buyConfirming } = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  const {
    writeContract: claimWrite,
    data: claimHash,
    isPending: claimPending,
  } = useWriteContract();
  const { isLoading: claimConfirming } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  const resolved =
    isResolved ??
    (winningOutcome !== undefined && (winningOutcome as number) >= 0);
  const winner =
    resolved && winningOutcome !== undefined && winningOutcome >= 0
      ? winningOutcome
      : -1;
  const tradingDisabled = !!(isClosed || resolved);
  const hasAnyPosition = userPosition?.some((s) => s > 0n) ?? false;
  const hasWinningPosition =
    winner >= 0 &&
    !!(userPosition?.[winner] !== undefined && userPosition[winner] > 0n);

  function setMax() {
    if (!balance) return;
    const maxMon = parseFloat(formatEther(balance.value));
    setAmount(Math.max(0, maxMon - 0.01).toFixed(4));
    setShowSuccess(false);
  }

  // Price percent from pool weights
  function pct(i: number): number {
    if (!prices?.[i]) return outcomes ? Math.floor(100 / outcomes.length) : 50;
    return Number((prices[i] * 100n) / BigInt(1e18));
  }

  // Live parimutuel preview
  let preview: ReturnType<typeof calcPreview> | null = null;
  if (amount && poolBalances && parseFloat(amount) > 0) {
    try {
      preview = calcPreview(
        parseEther(amount),
        selectedOutcome,
        poolBalances,
        userPosition?.[selectedOutcome] ?? 0n
      );
    } catch {
      /* invalid number input */
    }
  }

  // Payout estimate for position tab
  function estimatePayout(i: number): string {
    if (!userPosition || !poolBalances || winner < 0) return "—";
    const shares = userPosition[i];
    const pool = poolBalances[i];
    if (!shares || shares === 0n || !pool || pool === 0n) return "—";
    const totalPool = poolBalances.reduce((a, b) => a + b, 0n);
    return parseFloat(formatEther((shares * totalPool) / pool)).toFixed(4);
  }

  function handleBuy() {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter an amount");
      return;
    }
    const toastId = toast.loading("Confirm in wallet…");
    buyWrite(
      {
        address: marketAddress,
        abi: MARKET_ABI,
        functionName: "buy",
        args: [selectedOutcome],
        value: parseEther(amount),
      },
      {
        onSuccess: () => {
          toast.success("Transaction submitted!", { id: toastId });
          setShowSuccess(true);
          setAmount("");
        },
        onError: (e) => toast.error(e.message.slice(0, 100), { id: toastId }),
      }
    );
  }

  function handleClaim() {
    const toastId = toast.loading("Submitting claim…");
    claimWrite(
      {
        address: marketAddress,
        abi: MARKET_ABI,
        functionName: "claim",
        args: [],
      },
      {
        onSuccess: () => {
          toast.success("Claimed!", { id: toastId });
          onClaimSuccess?.();
        },
        onError: (e) => toast.error(e.message.slice(0, 100), { id: toastId }),
      }
    );
  }

  // Loading skeleton
  if (!outcomes) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 rounded-xl bg-surface-2 animate-shimmer" />
        ))}
      </div>
    );
  }

  const outcomePalette =
    outcomes.length === 2
      ? ["var(--success)", "var(--danger)"]
      : ["#836EF9", "#22c55e", "#f59e0b", "#3b82f6", "#ef4444"];

  return (
    <div className="flex flex-col gap-4">
      {/* Tab switcher — only shown when user has a position */}
      {hasAnyPosition && (
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ background: "var(--surface-2)" }}
        >
          {(["buy", "position"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: tab === t ? "var(--surface)" : "transparent",
                color:
                  tab === t ? "var(--text-primary)" : "var(--text-muted)",
                boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
              }}
            >
              {t === "buy" ? "Buy" : "Position"}
            </button>
          ))}
        </div>
      )}

      {/* ── BUY TAB ──────────────────────────────────────────── */}
      {tab === "buy" && (
        <>
          {resolved && (
            <div
              className="text-center text-xs font-medium py-2 px-3 rounded-xl"
              style={{
                background: "rgba(34,197,94,0.10)",
                color: "var(--success)",
                border: "1px solid rgba(34,197,94,0.20)",
              }}
            >
              Market resolved — check &quot;Position&quot; tab to claim.
            </div>
          )}
          {isClosed && !resolved && (
            <div
              className="text-center text-xs font-medium py-2 px-3 rounded-xl"
              style={{
                background: "rgba(245,158,11,0.10)",
                color: "var(--warning)",
                border: "1px solid rgba(245,158,11,0.20)",
              }}
            >
              Trading closed — awaiting oracle resolution.
            </div>
          )}

          {/* Outcome pills */}
          <div className="flex flex-col gap-2">
            {outcomes.map((label, i) => {
              const isSelected = selectedOutcome === i;
              const color = outcomePalette[i % outcomePalette.length];
              return (
                <button
                  key={i}
                  onClick={() => selectOutcome(i)}
                  disabled={tradingDisabled}
                  className="flex items-center justify-between px-4 rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    minHeight: "44px",
                    background: isSelected
                      ? "rgba(131,110,249,0.08)"
                      : "var(--surface-2)",
                    border: isSelected
                      ? "1.5px solid rgba(131,110,249,0.5)"
                      : "1px solid var(--monad-border)",
                    color: isSelected
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                  }}
                  aria-pressed={isSelected}
                >
                  <span className="truncate text-sm font-medium py-3">
                    {label}
                  </span>
                  <span
                    className="font-mono text-sm font-bold ml-4 shrink-0"
                    style={{ color, fontFeatureSettings: '"tnum"' }}
                  >
                    {pct(i)}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Amount input + quick amounts */}
          <div className="space-y-2">
            <div
              className="flex items-center gap-2 px-4 rounded-xl"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--monad-border)",
              }}
            >
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setShowSuccess(false);
                }}
                disabled={tradingDisabled || !isConnected}
                className="flex-1 bg-transparent py-3.5 text-lg font-mono text-white outline-none placeholder:text-txt-muted disabled:opacity-50"
                style={{ fontFeatureSettings: '"tnum"' }}
              />
              <span className="text-sm font-semibold text-txt-muted shrink-0">
                MON
              </span>
            </div>

            {isConnected && !tradingDisabled && (
              <div className="flex gap-2">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setAmount(q);
                      setShowSuccess(false);
                    }}
                    className="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150"
                    style={{
                      background:
                        amount === q
                          ? "rgba(131,110,249,0.15)"
                          : "var(--surface-2)",
                      color:
                        amount === q ? "var(--accent)" : "var(--text-muted)",
                      border:
                        amount === q
                          ? "1px solid rgba(131,110,249,0.4)"
                          : "1px solid var(--monad-border)",
                    }}
                  >
                    {q}
                  </button>
                ))}
                <button
                  onClick={setMax}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--monad-border)",
                  }}
                >
                  Max
                </button>
              </div>
            )}
          </div>

          {/* Live preview */}
          {preview && (
            <div
              className="rounded-xl px-4 py-3 space-y-1.5 text-xs"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--monad-border)",
              }}
            >
              <div className="flex justify-between text-txt-muted">
                <span>Shares</span>
                <span
                  className="font-mono text-txt-primary"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  {preview.shares}
                </span>
              </div>
              <div className="flex justify-between text-txt-muted">
                <span>Payout if wins</span>
                <span
                  className="font-mono text-txt-primary"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  ~{preview.payout} MON
                </span>
              </div>
              <div className="flex justify-between text-txt-muted">
                <span>Implied return</span>
                <span
                  className="font-mono font-semibold"
                  style={{
                    color:
                      parseFloat(preview.returnPct) >= 0
                        ? "var(--success)"
                        : "var(--danger)",
                    fontFeatureSettings: '"tnum"',
                  }}
                >
                  +{preview.returnPct}%
                </span>
              </div>
            </div>
          )}

          {/* CTA state machine */}
          {!isConnected ? (
            <div className="flex justify-center pt-1">
              <ConnectButton label="Connect to trade" />
            </div>
          ) : showSuccess && buyHash ? (
            <a
              href={`https://testnet.monadexplorer.com/tx/${buyHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold"
              style={{
                background: "rgba(34,197,94,0.12)",
                color: "var(--success)",
                border: "1px solid rgba(34,197,94,0.25)",
              }}
            >
              View on explorer <ExternalLink size={14} />
            </a>
          ) : (
            <button
              onClick={handleBuy}
              disabled={
                tradingDisabled ||
                buyPending ||
                buyConfirming ||
                !amount ||
                parseFloat(amount) <= 0
              }
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: "var(--accent)" }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled)
                  e.currentTarget.style.background = "var(--accent-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--accent)";
              }}
            >
              {buyPending || buyConfirming ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {buyPending ? "Confirm in wallet…" : "Confirming…"}
                </>
              ) : tradingDisabled ? (
                "Market closed"
              ) : !amount || parseFloat(amount) <= 0 ? (
                "Enter an amount"
              ) : (
                `Buy ${outcomes[selectedOutcome]}`
              )}
            </button>
          )}
        </>
      )}

      {/* ── POSITION TAB ─────────────────────────────────────── */}
      {tab === "position" && (
        <>
          {!hasAnyPosition ? (
            <p className="text-sm text-txt-muted text-center py-6">
              No positions in this market yet.
            </p>
          ) : (
            <div className="space-y-2">
              {outcomes.map((label, i) => {
                const shares = userPosition?.[i] ?? 0n;
                if (shares === 0n) return null;
                const isWinner = winner === i;
                const isLoser = winner >= 0 && winner !== i;
                return (
                  <div
                    key={i}
                    className="rounded-xl px-4 py-3"
                    style={{
                      background: isWinner
                        ? "rgba(34,197,94,0.08)"
                        : isLoser
                        ? "rgba(239,68,68,0.06)"
                        : "var(--surface-2)",
                      border: isWinner
                        ? "1px solid rgba(34,197,94,0.25)"
                        : isLoser
                        ? "1px solid rgba(239,68,68,0.15)"
                        : "1px solid var(--monad-border)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-sm font-medium"
                        style={{
                          color: isWinner
                            ? "var(--success)"
                            : isLoser
                            ? "var(--danger)"
                            : "var(--text-secondary)",
                        }}
                      >
                        {label} {isWinner && "✓"}
                      </span>
                      <span
                        className="font-mono text-sm text-txt-primary"
                        style={{ fontFeatureSettings: '"tnum"' }}
                      >
                        {parseFloat(formatEther(shares)).toFixed(4)} MON
                      </span>
                    </div>
                    {isWinner && (
                      <p className="text-xs text-txt-muted mt-1">
                        Payout ≈{" "}
                        <span
                          className="font-mono"
                          style={{ color: "var(--success)" }}
                        >
                          {estimatePayout(i)} MON
                        </span>
                      </p>
                    )}
                  </div>
                );
              })}

              {hasWinningPosition && (
                <button
                  onClick={handleClaim}
                  disabled={claimPending || claimConfirming}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                  style={{
                    background: "rgba(34,197,94,0.15)",
                    color: "var(--success)",
                    border: "1px solid rgba(34,197,94,0.30)",
                  }}
                >
                  {claimPending || claimConfirming ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Claiming…
                    </>
                  ) : (
                    "Claim winnings"
                  )}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
