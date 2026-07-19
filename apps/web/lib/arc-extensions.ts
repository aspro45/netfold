import { ARC_ADDRESSES } from "@netfold/shared";
import {
  encodeFunctionData,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

const memoAbi = [
  {
    type: "function",
    name: "memo",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
      { name: "memoId", type: "bytes32" },
      { name: "memoData", type: "bytes" },
    ],
    outputs: [{ name: "returnData", type: "bytes" }],
  },
] as const;

const multicall3FromAbi = [
  {
    type: "function",
    name: "aggregate3",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
] as const;

export const arcExtensionStatus = {
  enabled: false,
  reason:
    "Disabled until the signed Arc Testnet EOA smoke script is confirmed after faucet funding.",
} as const;

export async function isDirectEoaSender(
  publicClient: PublicClient,
  account: Address,
): Promise<boolean> {
  return (await publicClient.getCode({ address: account })) === undefined;
}

export function encodeArcMemo(input: {
  target: Address;
  callData: Hex;
  memoText: string;
  memoId?: Hex;
}): { to: Address; data: Hex } {
  const memoData = stringToHex(input.memoText);
  return {
    to: ARC_ADDRESSES.memo,
    data: encodeFunctionData({
      abi: memoAbi,
      functionName: "memo",
      args: [
        input.target,
        input.callData,
        input.memoId ?? keccak256(memoData),
        memoData,
      ],
    }),
  };
}

export function encodeAtomicArcBatch(
  calls: readonly { target: Address; callData: Hex }[],
): { to: Address; data: Hex } {
  return {
    to: ARC_ADDRESSES.multicall3From,
    data: encodeFunctionData({
      abi: multicall3FromAbi,
      functionName: "aggregate3",
      args: [
        calls.map((call) => ({
          target: call.target,
          allowFailure: false,
          callData: call.callData,
        })),
      ],
    }),
  };
}
