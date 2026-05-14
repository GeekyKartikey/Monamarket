"use client";

import { useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { formatEther, type Address } from "viem";
import { MARKET_ABI } from "@/lib/contracts";
import { BuyPanel } from "@/components/BuyPanel";
import { ResolveButton } from "@/components/ResolveButton";
import { toast } from "sonner";

interface Props {
  params: { address: string };
}

const POLL_MS  = 15_000;
const STALE_MS = 10_000;

export default function MarketPage({ params }: Props) {
  const address = params.address as Address;
  const { address: userAddress, isConnected } = useAccount();

  // Batch static + live reads into one multicall
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address, abi: MARKET_ABI, functionName: "question" },
      { address, abi: MARKET_ABI, functionName: "getOutcomes" },
      { address, abi: MARKET_ABI, functionName: "getPrices" },
      { address, abi: MARKET_ABI, functionName: "getPoolBalances" },
      { address, abi: MARKET_ABI, functionName: "timeRemaining" },
      { address, abi: MARKET_ABI, functionName: "winningOutcome" },
      {
        address,
        abi: MARKET_ABI,
        functionName: "getUserPosition",
        args: [userAddress ?? "0x0000000000000000000000000000000000000000"],
      },
    ],
    query: {
      refetchInterval: POLL_MS,
      staleTime: STALE_MS,
    },
  });

  const question       = data?.[0].result as string | undefined;
  const outcomes       = data?.[1].result as string[] | undefined;
  const prices         = data?.[2].result as bigint[] | undefined;
  const poolBalances   = data?.[3].result as bigint[] | undefined;
  const timeRemaining  = data?.[4].result as bigint | undefined;
  const winningOutcome = data?.[5].result as number | undefined;
  const userPosition   = data?.[6].result as bigint[] | undefined;

  const resolved   = winningOutcome !== undefined && (winningOutcome as number) >= 0;
  const winner     = resolved ? (winningOutcome as number) : -1;
  const totalPool  = poolBalances?.reduce((a, b) => a + b, 0n) ?? 0n;

  const { writeContract, data: claimHash, isPending: claimPending } = useWriteContract();
  const { isLoading: claimConfirming } = useWaitForTransactionReceipt({ hash: claimHash });

  const hasWinningShares =
    resolved && userPosition && winner >= 0 ? userPosition[winner] > 0n : false;

  function formatCountdown(secs: bigint): string {
    const s = Number(secs);
    if (s <= 0) return "Closed";
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    return `${h}h ${m}m`;
  }

  function handleClaim() {
    const toastId = toast.loading("Submitting claim…");
    writeContract(
      { address, abi: MARKET_ABI, functionName: "claim", args: [] },
      {
        onSuccess: () => { toast.success("Claimed!", { id: toastId }); void refetch(); },
        onError: (e) => toast.error(e.message.slice(0, 80), { id: toastId }),
      }
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        {isLoading || !question ? (
          <div className="h-7 bg-monad-border rounded animate-pulse w-2/3" />
        ) : (
          <h1 className="text-xl font-bold text-white">{question}</h1>
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
          <span className="font-mono text-xs text-gray-600 truncate max-w-xs">{address}</span>
          {resolved ? (
            <span className="text-green-400 font-medium">✓ Resolved</span>
          ) : (
            <span>
              Closes in{" "}
              <span className="text-white">
                {timeRemaining !== undefined ? formatCountdown(timeRemaining) : "…"}
              </span>
            </span>
          )}
          <ResolveButton marketAddress={address} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Left: outcome bars + user position */}
        <div className="md:col-span-3 space-y-4">
          <div className="bg-monad-card border border-monad-border rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-300">Outcome Probabilities</h2>
              <span className="text-xs text-gray-500">
                Pool:{" "}
                <span className="text-white font-mono">
                  {parseFloat(formatEther(totalPool)).toFixed(4)} MON
                </span>
              </span>
            </div>

            {isLoading || !outcomes || !prices ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-8 bg-monad-border rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {outcomes.map((label, i) => {
                  const pct = prices[i]
                    ? Number((prices[i] * 100n) / BigInt(1e18))
                    : Math.floor(100 / outcomes.length);
                  const isWinner = resolved && winner === i;
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className={isWinner ? "text-green-400 font-medium" : "text-gray-300"}>
                          {label} {isWinner && "✓"}
                        </span>
                        <span className="font-mono text-white">{pct}%</span>
                      </div>
                      <div className="h-2 bg-monad-border rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isWinner ? "bg-green-500" : "bg-monad-purple"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-600 font-mono">
                        {poolBalances ? parseFloat(formatEther(poolBalances[i])).toFixed(4) : "0"} MON
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* User position */}
          {isConnected && userPosition && outcomes && (
            <div className="bg-monad-card border border-monad-border rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-medium text-gray-300">Your Position</h2>
              <div className="space-y-2">
                {outcomes.map((label, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-400">{label}</span>
                    <span className="font-mono text-white">
                      {parseFloat(formatEther(userPosition[i] ?? 0n)).toFixed(4)} shares
                    </span>
                  </div>
                ))}
              </div>
              {hasWinningShares && (
                <button
                  onClick={handleClaim}
                  disabled={claimPending || claimConfirming}
                  className="w-full mt-2 py-2.5 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {claimPending || claimConfirming ? "Claiming…" : "Claim Winnings"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: buy panel */}
        <div className="md:col-span-2">
          <div className="bg-monad-card border border-monad-border rounded-xl p-5 sticky top-6">
            <h2 className="text-sm font-medium text-gray-300 mb-4">Buy Shares</h2>
            <BuyPanel
              marketAddress={address}
              outcomes={outcomes}
              prices={prices}
              isResolved={resolved}
              isClosed={
                timeRemaining !== undefined && timeRemaining === 0n && !resolved
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
