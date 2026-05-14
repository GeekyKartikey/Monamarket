"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { FACTORY_ABI, FACTORY_ADDRESS, MARKET_ABI } from "@/lib/contracts";
import { MarketCard } from "@/components/MarketCard";
import { type Address } from "viem";

const READS_PER_MARKET = 6;
const POLL_MS  = 15_000;
const STALE_MS = 10_000;

// Functions fetched per market, in order
const MARKET_FUNCTIONS = [
  "question",
  "getOutcomes",
  "getPrices",
  "getPoolBalances",
  "timeRemaining",
  "winningOutcome",
] as const;

export default function HomePage() {
  // Step 1: get market addresses
  const { data: markets, isLoading: marketsLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getAllMarkets",
    query: { staleTime: 60_000 },
  });

  const marketList = (markets as Address[] | undefined) ?? [];

  // Step 2: batch ALL market reads in one single multicall
  const { data: allData, isLoading: dataLoading } = useReadContracts({
    contracts: marketList.flatMap((addr) =>
      MARKET_FUNCTIONS.map((fn) => ({
        address: addr,
        abi: MARKET_ABI,
        functionName: fn,
      }))
    ),
    query: {
      enabled: marketList.length > 0,
      refetchInterval: POLL_MS,
      staleTime: STALE_MS,
    },
  });

  // Slice the flat results back into per-market chunks
  const marketData = marketList.map((addr, i) => {
    const base = i * READS_PER_MARKET;
    return {
      address: addr,
      question:       allData?.[base + 0]?.result as string | undefined,
      outcomes:       allData?.[base + 1]?.result as string[] | undefined,
      prices:         allData?.[base + 2]?.result as bigint[] | undefined,
      poolBalances:   allData?.[base + 3]?.result as bigint[] | undefined,
      timeRemaining:  allData?.[base + 4]?.result as bigint | undefined,
      winningOutcome: allData?.[base + 5]?.result as number | undefined,
    };
  });

  const isLoading = marketsLoading || (marketList.length > 0 && dataLoading);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Prediction Markets</h1>
        <p className="text-gray-400 text-sm mt-1">
          Buy outcome shares with MON. Markets resolve automatically via Pyth oracle.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-monad-card border border-monad-border rounded-xl p-5 h-48 animate-pulse"
            />
          ))}
        </div>
      ) : marketList.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p>No markets deployed yet.</p>
          <p className="text-xs mt-2">
            Set{" "}
            <code className="text-monad-purple">NEXT_PUBLIC_FACTORY_ADDRESS</code> in
            .env.local after deploying.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {marketData.map((m) => (
            <MarketCard key={m.address} data={m} />
          ))}
        </div>
      )}
    </div>
  );
}
