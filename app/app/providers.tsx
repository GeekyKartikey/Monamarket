"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { Toaster } from "sonner";
import { TOKENS } from "@/lib/design-tokens";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: TOKENS.accent,
            accentColorForeground: TOKENS.textPrimary,
            borderRadius: "medium",
            overlayBlur: "small",
          })}
        >
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: TOKENS.surface,
                border: `1px solid ${TOKENS.border}`,
                color: TOKENS.textPrimary,
                fontFamily: "var(--font-inter), system-ui, sans-serif",
              },
            }}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
