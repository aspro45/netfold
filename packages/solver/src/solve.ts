import type {
  Address,
  ParticipantPosition,
  SolverObligation,
  SolverResult,
} from "@netfold/shared";
import {
  concat,
  encodePacked,
  getAddress,
  keccak256,
  type Hex,
} from "viem";

function normalize(address: Address): Address {
  return getAddress(address) as Address;
}

export function solveObligations(
  obligations: readonly SolverObligation[],
): SolverResult {
  const positions = new Map<Address, bigint>();
  let grossVolume = 0n;

  for (const obligation of obligations) {
    if (obligation.amount <= 0n) {
      throw new Error("Obligation amount must be positive");
    }
    const debtor = normalize(obligation.debtor);
    const creditor = normalize(obligation.creditor);
    if (debtor === creditor) {
      throw new Error("Self-obligations are invalid");
    }
    positions.set(debtor, (positions.get(debtor) ?? 0n) - obligation.amount);
    positions.set(
      creditor,
      (positions.get(creditor) ?? 0n) + obligation.amount,
    );
    grossVolume += obligation.amount;
  }

  const sortedPositions: ParticipantPosition[] = [...positions.entries()]
    .map(([participant, position]) => ({ participant, position }))
    .sort((left, right) =>
      left.participant
        .toLowerCase()
        .localeCompare(right.participant.toLowerCase()),
    );

  let totalNetDebit = 0n;
  let totalNetCredit = 0n;
  for (const { position } of sortedPositions) {
    if (position < 0n) totalNetDebit += -position;
    if (position > 0n) totalNetCredit += position;
  }
  if (totalNetDebit !== totalNetCredit) {
    throw new Error("Net positions do not conserve value");
  }

  let canonicalPositions: Hex = "0x";
  for (const row of sortedPositions) {
    canonicalPositions = concat([
      canonicalPositions,
      encodePacked(
        ["address", "int256"],
        [row.participant, row.position],
      ),
    ]);
  }
  const datasetHash = keccak256(canonicalPositions);

  return {
    positions: sortedPositions,
    grossVolume,
    totalNetDebit,
    totalNetCredit,
    netSettlementVolume: totalNetDebit,
    liquiditySaved: grossVolume - totalNetDebit,
    datasetHash,
  };
}
