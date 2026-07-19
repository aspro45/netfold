"use client";

import { useBlockNumber, useReadContract } from "wagmi";
import { clearinghouseAbi } from "@/lib/abis";
import { deployment, isProtocolConfigured } from "@/lib/deployment";
import { useInterfaceStore } from "@/store/interface-store";

export function useLiveProtocol() {
  const selectedEpoch = useInterfaceStore((state) => state.selectedEpoch);
  const block = useBlockNumber({
    query: { refetchInterval: 12_000, retry: 1 },
  });
  const nextEpoch = useReadContract({
    address: deployment.clearinghouse,
    abi: clearinghouseAbi,
    functionName: "nextEpochId",
    query: { enabled: isProtocolConfigured, refetchInterval: 15_000, retry: 1 },
  });
  const epochExists =
    nextEpoch.data !== undefined &&
    selectedEpoch > 0n &&
    selectedEpoch < nextEpoch.data;
  const epoch = useReadContract({
    address: deployment.clearinghouse,
    abi: clearinghouseAbi,
    functionName: "getEpoch",
    args: [selectedEpoch],
    query: {
      enabled: isProtocolConfigured && epochExists,
      refetchInterval: 15_000,
      retry: 1,
    },
  });

  const rpcUnavailable = Boolean(
    block.error || nextEpoch.error || (epochExists && epoch.error),
  );

  return {
    configured: isProtocolConfigured,
    blockNumber: block.data,
    nextEpochId: nextEpoch.data,
    epoch: epoch.data,
    loading:
      block.isLoading ||
      (isProtocolConfigured && nextEpoch.isLoading) ||
      (epochExists && epoch.isLoading),
    rpcUnavailable,
    error: block.error ?? nextEpoch.error ?? epoch.error,
    refresh: async () => {
      await Promise.all([block.refetch(), nextEpoch.refetch()]);
      if (epochExists) await epoch.refetch();
    },
  };
}
