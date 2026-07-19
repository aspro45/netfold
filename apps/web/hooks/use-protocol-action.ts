"use client";

import { ARC_MIN_MAX_FEE_PER_GAS, ARC_TESTNET } from "@netfold/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { Abi, Address, Hash } from "viem";
import { formatUnits } from "viem";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import {
  type TransactionRecord,
  useInterfaceStore,
} from "@/store/interface-store";

interface ContractAction {
  label: string;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}

interface ActionResult {
  hash: Hash;
  gasEstimate: bigint;
  feeEstimate: string;
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) {
    if (/rejected|denied/i.test(error.message)) return "Wallet request rejected";
    return error.message.split("\n")[0] ?? "Transaction failed";
  }
  return "Transaction failed";
}

export function useProtocolAction() {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const queryClient = useQueryClient();
  const upsertTransaction = useInterfaceStore(
    (state) => state.upsertTransaction,
  );
  const [pending, setPending] = useState(false);

  const execute = useCallback(
    async (action: ContractAction): Promise<ActionResult> => {
      if (!address || !walletClient || !publicClient) {
        throw new Error("Connect a wallet first");
      }
      if (chainId !== ARC_TESTNET.id) {
        await switchChainAsync({ chainId: ARC_TESTNET.id });
      }

      const id = crypto.randomUUID();
      const update = (patch: Partial<TransactionRecord>) =>
        upsertTransaction({
          id,
          label: action.label,
          stage: "idle",
          timestamp: Date.now(),
          ...patch,
        });
      setPending(true);

      try {
        update({ stage: "simulating", message: "Simulating on Arc Testnet" });
        const simulation = await publicClient.simulateContract({
          account: address,
          address: action.address,
          abi: action.abi,
          functionName: action.functionName,
          args: action.args,
          maxFeePerGas: ARC_MIN_MAX_FEE_PER_GAS,
        } as never);

        const gasEstimate = await publicClient.estimateContractGas({
          account: address,
          address: action.address,
          abi: action.abi,
          functionName: action.functionName,
          args: action.args,
        } as never);
        const gasPrice = await publicClient.getGasPrice();
        const effectiveGasPrice =
          gasPrice < ARC_MIN_MAX_FEE_PER_GAS
            ? ARC_MIN_MAX_FEE_PER_GAS
            : gasPrice;
        const feeEstimate = `${Number(
          formatUnits(gasEstimate * effectiveGasPrice, 18),
        ).toFixed(6)} USDC`;

        update({
          stage: "wallet",
          message: `Wallet confirmation / est. ${feeEstimate}`,
        });
        const hash = await walletClient.writeContract(simulation.request);
        update({
          stage: "submitted",
          hash,
          message: "Submitted to Arc Testnet",
        });
        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
        });
        if (receipt.status !== "success") {
          update({ stage: "reverted", hash, message: "Transaction reverted" });
          throw new Error("Transaction reverted");
        }
        update({
          stage: "confirmed",
          hash,
          message: `Confirmed in block ${receipt.blockNumber}`,
        });
        await queryClient.invalidateQueries();
        return { hash, gasEstimate, feeEstimate };
      } catch (error) {
        const message = messageFromError(error);
        update({
          stage: /rejected/i.test(message) ? "rejected" : "reverted",
          message,
        });
        throw error;
      } finally {
        setPending(false);
      }
    },
    [
      address,
      chainId,
      publicClient,
      queryClient,
      switchChainAsync,
      upsertTransaction,
      walletClient,
    ],
  );

  return { execute, pending };
}
