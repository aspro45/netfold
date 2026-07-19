export type Address = `0x${string}`;
export type Hex32 = `0x${string}`;

export type ObligationStatus =
  | "PROPOSED"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED";

export type EpochStatus =
  | "OPEN"
  | "LOCKED"
  | "FUNDING"
  | "SETTLED"
  | "DEFAULTED"
  | "CANCELLED";

export interface SolverObligation {
  id: bigint;
  epochId: bigint;
  debtor: Address;
  creditor: Address;
  amount: bigint;
}

export interface ParticipantPosition {
  participant: Address;
  position: bigint;
}

export interface SolverResult {
  positions: ParticipantPosition[];
  grossVolume: bigint;
  totalNetDebit: bigint;
  totalNetCredit: bigint;
  netSettlementVolume: bigint;
  liquiditySaved: bigint;
  datasetHash: Hex32;
}

