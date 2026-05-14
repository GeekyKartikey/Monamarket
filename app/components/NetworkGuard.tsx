"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { monadTestnet } from "@/lib/wagmi";

/// Renders a banner + switch button when the user is connected to the wrong chain.
/// Returns null (no render) when not connected or already on the correct chain.
export function NetworkGuard() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === monadTestnet.id) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-xl text-sm"
      style={{
        background: "rgba(245,158,11,0.12)",
        border: "1.5px solid rgba(245,158,11,0.4)",
        color: "var(--warning)",
        backdropFilter: "blur(12px)",
      }}
    >
      <span className="font-medium">Wrong network</span>
      <button
        onClick={() => switchChain({ chainId: monadTestnet.id })}
        disabled={isPending}
        className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
        style={{
          background: "rgba(245,158,11,0.2)",
          border: "1px solid rgba(245,158,11,0.4)",
          color: "var(--warning)",
        }}
      >
        {isPending ? "Switching…" : "Switch to Monad testnet"}
      </button>
    </div>
  );
}
