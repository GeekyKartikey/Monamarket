"use client";

import { useReadContracts, useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { formatEther, type Address } from "viem";
import { FACTORY_ABI, FACTORY_ADDRESS, MARKET_ABI } from "@/lib/contracts";
import { toast } from "sonner";
import { ConnectWalletGate } from "@/components/ConnectWalletGate";

const STALE_MS = 10_000;

function MarketPosition({ marketAddress, userAddress }: { marketAddress: Address; userAddress: Address }) {
  const { data, refetch } = useReadContracts({
    contracts: [
      { address: marketAddress, abi: MARKET_ABI, functionName: "question" },
      { address: marketAddress, abi: MARKET_ABI, functionName: "getOutcomes" },
      { address: marketAddress, abi: MARKET_ABI, functionName: "winningOutcome" },
      { address: marketAddress, abi: MARKET_ABI, functionName: "getPoolBalances" },
      { address: marketAddress, abi: MARKET_ABI, functionName: "getUserPosition", args: [userAddress] },
    ],
    query: { staleTime: STALE_MS },
  });

  const question       = data?.[0].result as string | undefined;
  const outcomes       = data?.[1].result as string[] | undefined;
  const winningOutcome = data?.[2].result as number | undefined;
  const poolBalances   = data?.[3].result as bigint[] | undefined;
  const userPosition   = data?.[4].result as bigint[] | undefined;

  const { writeContract, data: claimHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: claimHash });

  const resolved = winningOutcome !== undefined && (winningOutcome as number) >= 0;
  const winner   = resolved ? (winningOutcome as number) : -1;

  const totalShares = userPosition?.reduce((a, b) => a + b, 0n) ?? 0n;
  if (totalShares === 0n) return null;

  const hasWinningShares = resolved && userPosition && winner >= 0 && userPosition[winner] > 0n;

  function estimatedPayout(): string {
    if (!resolved || !userPosition || winner < 0 || !poolBalances) return "—";
    const winShares = userPosition[winner];
    if (winShares === 0n || poolBalances[winner] === 0n) return "—";
    const totalPool = poolBalances.reduce((a, b) => a + b, 0n);
    return parseFloat(formatEther((winShares * totalPool) / poolBalances[winner])).toFixed(4);
  }

  function handleClaim() {
    const toastId = toast.loading("Submitting claim…");
    writeContract(
      { address: marketAddress, abi: MARKET_ABI, functionName: "claim", args: [] },
      {
        onSuccess: () => { toast.success("Claimed!", { id: toastId }); void refetch(); },
        onError: (e) => toast.error(e.message.slice(0, 80), { id: toastId }),
      }
    );
  }

  return (
    <div className="bg-monad-card border border-monad-border rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <a
          href={`/market/${marketAddress}`}
          className="text-sm font-medium text-white hover:text-monad-purple transition-colors line-clamp-2"
        >
          {question ?? <span className="h-4 bg-monad-border rounded animate-pulse w-48 inline-block" />}
        </a>
        {resolved
          ? <span className="text-green-400 text-xs font-medium shrink-0">Resolved</span>
          : <span className="text-yellow-400 text-xs shrink-0">Open</span>}
      </div>

      <div className="space-y-1.5">
        {outcomes?.map((label, i) => {
          const shares = userPosition?.[i] ?? 0n;
          if (shares === 0n) return null;
          const isWinner = resolved && winner === i;
          return (
            <div key={i} className="flex justify-between text-sm">
              <span className={isWinner ? "text-green-400" : "text-gray-400"}>
                {label} {isWinner && "✓"}
              </span>
              <span className="font-mono text-white">
                {parseFloat(formatEther(shares)).toFixed(4)} shares
              </span>
            </div>
          );
        })}
      </div>

      {hasWinningShares && (
        <div className="flex items-center justify-between pt-2 border-t border-monad-border">
          <span className="text-xs text-gray-400">
            Payout ≈ <span className="text-green-400 font-mono">{estimatedPayout()} MON</span>
          </span>
          <button
            onClick={handleClaim}
            disabled={isPending || isConfirming}
            className="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {isPending || isConfirming ? "Claiming…" : "Claim"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const { address: userAddress } = useAccount();

  const { data: markets, isLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getAllMarkets",
    query: { staleTime: 30_000 },
  });

  const marketList = markets as Address[] | undefined;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Portfolio</h1>
        <p className="text-gray-400 text-sm mt-1">Your positions across all markets.</p>
      </div>

      <ConnectWalletGate label="Connect your wallet to see your positions">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-32 bg-monad-card border border-monad-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !marketList || marketList.length === 0 ? (
          <p className="text-gray-500 text-sm">No markets deployed yet.</p>
        ) : (
          <div className="space-y-4">
            {marketList.map((addr) => (
              <MarketPosition key={addr} marketAddress={addr} userAddress={userAddress!} />
            ))}
          </div>
        )}
      </ConnectWalletGate>
    </div>
  );
}
