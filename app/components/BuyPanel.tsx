"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther, type Address } from "viem";
import { toast } from "sonner";
import { MARKET_ABI } from "@/lib/contracts";
import { ConnectWalletGate } from "./ConnectWalletGate";

interface Props {
  marketAddress: Address;
  // Accept pre-fetched data from parent to avoid duplicate RPC calls
  outcomes?: string[];
  prices?: bigint[];
  isClosed?: boolean;
  isResolved?: boolean;
}

export function BuyPanel({ marketAddress, outcomes, prices, isClosed, isResolved }: Props) {
  const { isConnected } = useAccount();
  const [selectedOutcome, setSelectedOutcome] = useState(0);
  const [amount, setAmount] = useState("");

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const disabled = isResolved || isClosed || !isConnected;

  function estimatedShares(): string {
    if (!amount || !prices || !prices[selectedOutcome]) return "—";
    try {
      const amountWei = parseEther(amount);
      const price = prices[selectedOutcome];
      if (price === 0n) return "—";
      const shares = (amountWei * BigInt(1e18)) / price;
      return parseFloat(formatEther(shares)).toFixed(4);
    } catch {
      return "—";
    }
  }

  async function handleBuy() {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter an amount");
      return;
    }
    const toastId = toast.loading("Submitting transaction…");
    writeContract(
      {
        address: marketAddress,
        abi: MARKET_ABI,
        functionName: "buy",
        args: [selectedOutcome],
        value: parseEther(amount),
      },
      {
        onSuccess: () => toast.loading("Waiting for confirmation…", { id: toastId }),
        onError: (e) => toast.error(e.message.slice(0, 80), { id: toastId }),
      }
    );
  }

  if (!outcomes) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 bg-monad-border rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isResolved && (
        <div className="text-center text-green-400 text-sm font-medium py-2 bg-green-900/20 border border-green-800 rounded-lg">
          Market resolved — check Portfolio to claim.
        </div>
      )}
      {isClosed && !isResolved && (
        <div className="text-center text-yellow-400 text-sm py-2 bg-yellow-900/20 border border-yellow-800 rounded-lg">
          Trading closed — awaiting resolution.
        </div>
      )}

      {/* Outcome selector */}
      <div className="flex flex-col gap-2">
        {outcomes.map((label, i) => {
          const pct = prices?.[i]
            ? Number((prices[i] * 100n) / BigInt(1e18))
            : Math.floor(100 / outcomes.length);
          return (
            <button
              key={i}
              onClick={() => setSelectedOutcome(i)}
              disabled={disabled}
              className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-all ${
                selectedOutcome === i
                  ? "border-monad-purple bg-monad-purple/10 text-white"
                  : "border-monad-border text-gray-400 hover:border-monad-purple/40"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="truncate">{label}</span>
              <span className="font-mono ml-4 shrink-0">{pct}%</span>
            </button>
          );
        })}
      </div>

      {/* Amount input */}
      <div className="relative">
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={disabled}
          className="w-full bg-monad-dark border border-monad-border rounded-lg px-4 py-3 text-white pr-16 focus:outline-none focus:border-monad-purple disabled:opacity-50"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          MON
        </span>
      </div>

      <div className="text-xs text-gray-500 px-1">
        You&apos;ll receive ≈{" "}
        <span className="text-white font-mono">{estimatedShares()}</span> shares of{" "}
        <span className="text-monad-purple">{outcomes[selectedOutcome]}</span>
      </div>

      <ConnectWalletGate label="Connect wallet to trade">
        <button
          onClick={handleBuy}
          disabled={disabled || isPending || isConfirming}
          className="w-full py-3 rounded-lg bg-monad-purple hover:bg-monad-purple/90 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending || isConfirming ? "Confirming…" : `Buy ${outcomes[selectedOutcome]}`}
        </button>
      </ConnectWalletGate>
    </div>
  );
}
