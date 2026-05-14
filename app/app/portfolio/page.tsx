import type { Metadata } from "next";
import { PortfolioClient } from "@/components/PortfolioClient";

export const metadata: Metadata = {
  title: "Portfolio — Monamarket",
  description: "Your prediction market positions on Monad testnet.",
};

export default function PortfolioPage() {
  return <PortfolioClient />;
}
