"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ARC_TESTNET } from "@netfold/shared";
import { useState, type ReactNode } from "react";
import { fallback, http } from "viem";
import { createConfig, WagmiProvider } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const connectors = [
  injected({ shimDisconnect: true }),
  ...(projectId
    ? [
        walletConnect({
          projectId,
          metadata: {
            name: "NETFOLD",
            description: "Multilateral stablecoin net settlement on Arc",
            url:
              typeof window === "undefined"
                ? "http://localhost:3000"
                : window.location.origin,
            icons: [],
          },
        }),
      ]
    : []),
];

const rpcUrls = Array.from(
  new Set([
    process.env.NEXT_PUBLIC_ARC_RPC_URL ??
      "https://rpc.testnet.arc.network",
    "https://rpc.drpc.testnet.arc.network",
    "https://rpc.quicknode.testnet.arc.network",
  ]),
);

const config = createConfig({
  chains: [ARC_TESTNET],
  connectors,
  transports: {
    [ARC_TESTNET.id]: fallback(
      rpcUrls.map((url) =>
        http(url, {
          batch: true,
          retryCount: 1,
          timeout: 10_000,
        }),
      ),
      {
        rank: true,
        retryCount: 1,
      },
    ),
  },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 4_000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
