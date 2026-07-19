import { getAddress, isAddress, type Address } from "viem";

function optionalAddress(value: string | undefined): Address | undefined {
  return value && isAddress(value) ? getAddress(value) : undefined;
}

export const deployment = {
  registry: optionalAddress(process.env.NEXT_PUBLIC_REGISTRY_ADDRESS),
  obligationBook: optionalAddress(
    process.env.NEXT_PUBLIC_OBLIGATION_BOOK_ADDRESS,
  ),
  clearinghouse: optionalAddress(
    process.env.NEXT_PUBLIC_CLEARINGHOUSE_ADDRESS,
  ),
  startBlock: process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK
    ? BigInt(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK)
    : undefined,
} as const;

export const isProtocolConfigured = Boolean(
  deployment.registry && deployment.obligationBook && deployment.clearinghouse,
);
