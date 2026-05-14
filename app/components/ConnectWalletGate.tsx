"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

interface Props {
  children: React.ReactNode;
  label?: string;
}

export function ConnectWalletGate({ children, label = "Connect wallet to continue" }: Props) {
  const { isConnected } = useAccount();

  if (isConnected) return <>{children}</>;

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <p className="text-gray-400 text-sm">{label}</p>
      <ConnectButton />
    </div>
  );
}
