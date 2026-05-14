// Server Component shell — provides metadata; client island handles all chain reads
import type { Metadata } from "next";
import type { Address } from "viem";
import { MarketDetailClient } from "@/components/MarketDetailClient";

interface Props {
  params: { address: string };
}

export function generateMetadata({ params }: Props): Metadata {
  const addr = params.address;
  const short = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  return {
    title: `${short} — Monamarket`,
    description:
      "Prediction market on Monad testnet. Buy outcome shares with MON. Resolves via Pyth oracle.",
  };
}

export default function MarketPage({ params }: Props) {
  return <MarketDetailClient address={params.address as Address} />;
}
