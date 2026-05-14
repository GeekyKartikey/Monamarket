"use client";

import { useState } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { type Address } from "viem";
import { toast } from "sonner";
import { MARKET_ABI } from "@/lib/contracts";
import { fetchPriceUpdateDataAtTime, isBetaFeed } from "@/lib/pyth";

interface Props {
  marketAddress: Address;
}

export function ResolveButton({ marketAddress }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const publicClient = usePublicClient();

  const { data: resolveTimeRaw } = useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "resolveTime",
  });

  const { data: winningOutcome } = useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "winningOutcome",
  });

  const { data: feedIdRaw } = useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "pythPriceFeedId",
  });

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const resolveTime = resolveTimeRaw as bigint | undefined;
  const nowSecs = BigInt(Math.floor(Date.now() / 1000));
  const isResolved = winningOutcome !== undefined && (winningOutcome as number) >= 0;
  const canResolve = resolveTime !== undefined && nowSecs >= resolveTime && !isResolved;

  if (!canResolve) return null;

  async function handleResolve() {
    if (!resolveTime || !feedIdRaw || !publicClient) return;
    setIsLoading(true);
    const toastId = toast.loading("Fetching Pyth price proof…");

    try {
      const feedId = feedIdRaw as `0x${string}`;
      const useBeta = isBetaFeed(feedId);
      const updateData = await fetchPriceUpdateDataAtTime(
        feedId,
        Number(resolveTime),
        useBeta
      );

      toast.loading("Estimating fee…", { id: toastId });

      // Estimate Pyth update fee from the contract
      const fee = await publicClient.readContract({
        address: marketAddress,
        abi: MARKET_ABI,
        functionName: "pyth" as never,
      });
      void fee; // fee is read on-chain inside resolve()

      toast.loading("Submitting resolve tx…", { id: toastId });

      writeContract(
        {
          address: marketAddress,
          abi: MARKET_ABI,
          functionName: "resolve",
          args: [updateData],
          value: BigInt(1_000_000), // generous fee; contract refunds excess
        },
        {
          onSuccess: () => {
            toast.success("Market resolved!", { id: toastId });
          },
          onError: (e) => {
            toast.error(e.message.slice(0, 100), { id: toastId });
          },
        }
      );
    } catch (e: unknown) {
      toast.error((e as Error).message.slice(0, 100), { id: toastId });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={handleResolve}
      disabled={isLoading || isConfirming}
      className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading || isConfirming ? "Resolving…" : "Resolve Market"}
    </button>
  );
}
