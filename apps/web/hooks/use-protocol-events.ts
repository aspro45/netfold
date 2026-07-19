"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAbi, type Address, type Hash } from "viem";
import { usePublicClient } from "wagmi";
import { deployment, isProtocolConfigured } from "@/lib/deployment";

const protocolEvents = parseAbi([
  "event ParticipantRegistered(address indexed participant, bytes32 indexed metadataHash)",
  "event EpochCreated(uint256 indexed epochId, address indexed token, address indexed creator, uint64 fundingDuration, uint256 bondAmount)",
  "event ParticipantJoined(uint256 indexed epochId, address indexed participant, uint256 bond)",
  "event ObligationApplied(uint256 indexed epochId, uint256 indexed obligationId, address indexed debtor, address creditor, uint256 amount)",
  "event EpochLocked(uint256 indexed epochId, uint256 grossVolume, uint256 netSettlementVolume, uint256 liquiditySaved, bytes32 datasetHash)",
  "event DebitFunded(uint256 indexed epochId, address indexed debtor, uint256 amount)",
  "event EpochSettled(uint256 indexed epochId)",
  "event EpochDefaulted(uint256 indexed epochId, uint256 slashedBonds)",
  "event CreditClaimed(uint256 indexed epochId, address indexed creditor, uint256 amount)",
  "event ObligationProposed(uint256 indexed obligationId, uint256 indexed epochId, address indexed debtor, address creditor, address token, uint256 amount, bytes32 referenceHash, bytes32 memoHash)",
  "event ObligationAccepted(uint256 indexed obligationId, address indexed creditor)",
  "event ObligationCancelled(uint256 indexed obligationId)",
]);

export interface ProtocolEventRecord {
  id: string;
  name: string;
  detail: string;
  blockNumber: bigint;
  transactionHash: Hash;
}

function eventDetail(args: unknown): string {
  if (!args || typeof args !== "object") return "Canonical contract event";
  const values = args as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof values.epochId === "bigint") {
    parts.push(`epoch #${values.epochId}`);
  }
  if (typeof values.obligationId === "bigint") {
    parts.push(`obligation #${values.obligationId}`);
  }
  if (typeof values.participant === "string") {
    parts.push(`${values.participant.slice(0, 8)}...${values.participant.slice(-6)}`);
  }
  return parts.length > 0 ? parts.join(" / ") : "Canonical contract event";
}

export function useProtocolEvents() {
  const publicClient = usePublicClient();
  const addresses = [
    deployment.registry,
    deployment.obligationBook,
    deployment.clearinghouse,
  ].filter((address): address is Address => Boolean(address));

  return useQuery({
    queryKey: [
      "protocol-events",
      addresses.join(","),
      deployment.startBlock?.toString(),
    ],
    enabled: Boolean(
      publicClient &&
        isProtocolConfigured &&
        deployment.startBlock !== undefined,
    ),
    retry: 1,
    refetchInterval: 30_000,
    queryFn: async (): Promise<ProtocolEventRecord[]> => {
      if (!publicClient || deployment.startBlock === undefined) return [];
      const logs = await publicClient.getLogs({
        address: addresses,
        events: protocolEvents,
        fromBlock: deployment.startBlock,
        toBlock: "latest",
        strict: false,
      });

      return logs
        .filter(
          (log): log is typeof log & {
            blockNumber: bigint;
            transactionHash: Hash;
            eventName: string;
          } =>
            log.blockNumber !== null &&
            log.transactionHash !== null &&
            typeof log.eventName === "string",
        )
        .slice(-120)
        .reverse()
        .map((log, index) => ({
          id: `${log.transactionHash}-${log.logIndex ?? index}`,
          name: log.eventName,
          detail: eventDetail(log.args),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        }));
    },
  });
}
