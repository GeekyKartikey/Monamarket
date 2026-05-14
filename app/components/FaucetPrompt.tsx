"use client";

import { useAccount, useBalance } from "wagmi";
import { monadTestnet } from "@/lib/wagmi";

/// Shows a faucet CTA when the connected wallet balance is below the threshold.
/// Renders inline (not a modal) so it can be placed inside BuyPanel or other flows.
export function FaucetPrompt({ threshold = BigInt("10000000000000000") }: { threshold?: bigint }) {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({
    address,
    chainId: monadTestnet.id,
    query: { enabled: isConnected && !!address, staleTime: 15_000 },
  });

  if (!isConnected || !balance || balance.value >= threshold) return null;

  return (
    <div
      className="rounded-xl p-4 space-y-3 text-sm"
      style={{
        background: "rgba(245,158,11,0.06)",
        border: "1px solid rgba(245,158,11,0.25)",
      }}
    >
      <div>
        <p className="font-semibold" style={{ color: "var(--warning)" }}>
          Low balance
        </p>
        <p className="text-xs text-txt-muted mt-0.5">
          Your wallet has less than 0.01 MON. Get free testnet MON from the faucet.
        </p>
      </div>
      <a
        href="https://faucet.monad.xyz"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
        style={{ color: "var(--warning)" }}
      >
        Open Monad faucet ↗
      </a>
    </div>
  );
}
