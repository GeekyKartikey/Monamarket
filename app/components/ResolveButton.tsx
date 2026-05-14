"use client";

import { useState } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { type Address } from "viem";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { MARKET_ABI } from "@/lib/contracts";
import { fetchPriceUpdateDataAtTime, isBetaFeed } from "@/lib/pyth";

interface Props {
  marketAddress: Address;
  // When provided by the parent's multicall these reads are skipped entirely
  resolveTime?: bigint;
  feedId?: `0x${string}`;
  isResolved?: boolean;
  isDemo?: boolean;
  onResolved?: () => void;
}

export function ResolveButton({
  marketAddress,
  resolveTime: resolveTimeProp,
  feedId: feedIdProp,
  isResolved: isResolvedProp,
  isDemo: isDemoProp,
  onResolved,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);

  // Only hit the chain for values not supplied by the parent
  const { data: isDemoRaw } = useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "isDemo",
    query: { enabled: isDemoProp === undefined },
  });

  const { data: resolveTimeRaw } = useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "resolveTime",
    query: { enabled: resolveTimeProp === undefined },
  });

  const { data: winningOutcomeRaw } = useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "winningOutcome",
    query: { enabled: isResolvedProp === undefined },
  });

  const { data: feedIdRaw } = useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "pythPriceFeedId",
    query: { enabled: feedIdProp === undefined },
  });

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const resolveTime = resolveTimeProp ?? (resolveTimeRaw as bigint | undefined);
  const feedId      = feedIdProp      ?? (feedIdRaw as `0x${string}` | undefined);
  const isDemo      = isDemoProp      ?? (isDemoRaw as boolean | undefined);
  const isResolved  =
    isResolvedProp ??
    (winningOutcomeRaw !== undefined && (winningOutcomeRaw as number) >= 0);

  const nowSecs = BigInt(Math.floor(Date.now() / 1000));
  // Demo markets: resolvable any time. Regular: only after resolveTime.
  const canResolve =
    !isResolved &&
    (isDemo === true || (resolveTime !== undefined && nowSecs >= resolveTime));

  if (!canResolve) return null;

  async function handleResolve() {
    if (!feedId) return;
    setIsLoading(true);
    const toastId = toast.loading("Fetching Pyth price proof…");

    try {
      const useBeta = isBetaFeed(feedId);
      // Demo markets: use current time so the VAA publishTime is always valid.
      // Regular markets: use resolveTime for a historical proof.
      const priceTimestamp = isDemo ? Math.floor(Date.now() / 1000) : Number(resolveTime);
      const updateData = await fetchPriceUpdateDataAtTime(
        feedId,
        priceTimestamp,
        useBeta
      );

      toast.loading("Submitting resolve tx…", { id: toastId });

      writeContract(
        {
          address: marketAddress,
          abi: MARKET_ABI,
          functionName: "resolve",
          args: [updateData],
          value: BigInt(1_000_000), // generous; contract refunds excess
        },
        {
          onSuccess: () => {
            toast.success("Market resolved!", { id: toastId });
            onResolved?.();
          },
          onError: (e) => toast.error(e.message.slice(0, 100), { id: toastId }),
        }
      );
    } catch (e: unknown) {
      toast.error((e as Error).message.slice(0, 100), { id: toastId });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-surface border border-monad-border rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded-lg shrink-0"
          style={{ background: "rgba(131,110,249,0.12)" }}
        >
          <Zap size={18} style={{ color: "var(--accent)" }} />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">
            {isDemo ? "Resolve this demo market." : "This market is ready to resolve."}
          </h3>
          <p className="text-xs text-txt-muted leading-relaxed">
            Anyone can resolve by submitting a Pyth oracle price update.
            Earn a <strong style={{ color: "var(--accent)" }}>0.5% bounty</strong> (max 1 MON) of
            the pool for resolving. A tiny MON fee (~0.000001 MON) is charged by Pyth.
          </p>
        </div>
      </div>

      <button
        onClick={handleResolve}
        disabled={isLoading || isConfirming}
        className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "var(--accent)" }}
        onMouseEnter={(e) =>
          !isLoading && !isConfirming &&
          ((e.target as HTMLButtonElement).style.background = "var(--accent-hover)")
        }
        onMouseLeave={(e) =>
          ((e.target as HTMLButtonElement).style.background = "var(--accent)")
        }
      >
        {isLoading
          ? "Fetching price proof…"
          : isConfirming
          ? "Confirming…"
          : "Resolve market"}
      </button>
    </div>
  );
}
