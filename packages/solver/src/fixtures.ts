import type { SolverObligation } from "@netfold/shared";
import { getAddress } from "viem";

const A = getAddress("0x00000000000000000000000000000000000000a1");
const B = getAddress("0x00000000000000000000000000000000000000b2");
const C = getAddress("0x00000000000000000000000000000000000000c3");
const D = getAddress("0x00000000000000000000000000000000000000d4");

export const participants = { A, B, C, D } as const;

export const demoObligations: readonly SolverObligation[] = [
  { id: 1n, epochId: 1n, debtor: A, creditor: B, amount: 100_000_000n },
  { id: 2n, epochId: 1n, debtor: B, creditor: C, amount: 70_000_000n },
  { id: 3n, epochId: 1n, debtor: C, creditor: A, amount: 50_000_000n },
  { id: 4n, epochId: 1n, debtor: C, creditor: D, amount: 20_000_000n },
  { id: 5n, epochId: 1n, debtor: D, creditor: B, amount: 10_000_000n },
  { id: 6n, epochId: 1n, debtor: B, creditor: A, amount: 15_000_000n },
] as const;
