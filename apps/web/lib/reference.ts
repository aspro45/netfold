import { demoObligations, participants, solveObligations } from "@netfold/solver";
import type { Address } from "@netfold/shared";

export const referenceResult = solveObligations(demoObligations);

export interface GraphParticipant {
  id: string;
  address: Address;
  label: string;
  position: bigint;
  role: string;
}

export interface GraphObligation {
  id: string;
  from: string;
  to: string;
  amount: bigint;
}

export const referenceParticipants: GraphParticipant[] = [
  {
    id: "A",
    address: participants.A,
    label: "Aster Labs",
    position: -35_000_000n,
    role: "Net debtor",
  },
  {
    id: "B",
    address: participants.B,
    label: "Boreal Ops",
    position: 25_000_000n,
    role: "Net creditor",
  },
  {
    id: "C",
    address: participants.C,
    label: "Cinder DAO",
    position: 0n,
    role: "Fully folded",
  },
  {
    id: "D",
    address: participants.D,
    label: "Delta MM",
    position: 10_000_000n,
    role: "Net creditor",
  },
];

export const referenceObligations: GraphObligation[] = demoObligations.map(
  (obligation) => ({
    id: obligation.id.toString(),
    from:
      referenceParticipants.find(
        (participant) => participant.address === obligation.debtor,
      )?.id ?? "?",
    to:
      referenceParticipants.find(
        (participant) => participant.address === obligation.creditor,
      )?.id ?? "?",
    amount: obligation.amount,
  }),
);

export const activityFixture = [
  { time: "T+00", event: "Epoch opened", detail: "USDC / 4 participants" },
  { time: "T+12", event: "6 obligations accepted", detail: "265.00 USDC gross" },
  { time: "T+18", event: "Positions folded", detail: "35.00 USDC residual" },
  { time: "T+24", event: "Funding ready", detail: "A owes 35.00 USDC" },
] as const;
