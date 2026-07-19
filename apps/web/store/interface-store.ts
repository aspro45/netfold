"use client";

import type { Hash } from "viem";
import { create } from "zustand";

export type NetworkMode = "gross" | "folded";
export type MobileTab = "graph" | "ledger" | "actions" | "wallet";
export type TransactionStage =
  | "idle"
  | "simulating"
  | "wallet"
  | "submitted"
  | "confirmed"
  | "rejected"
  | "reverted";

export interface TransactionRecord {
  id: string;
  label: string;
  stage: TransactionStage;
  hash?: Hash;
  message?: string;
  timestamp: number;
}

interface InterfaceState {
  networkMode: NetworkMode;
  mobileTab: MobileTab;
  selectedParticipant: string;
  selectedEpoch: bigint;
  transactions: TransactionRecord[];
  setNetworkMode: (mode: NetworkMode) => void;
  setMobileTab: (tab: MobileTab) => void;
  setSelectedParticipant: (id: string) => void;
  setSelectedEpoch: (epochId: bigint) => void;
  upsertTransaction: (record: TransactionRecord) => void;
}

export const useInterfaceStore = create<InterfaceState>((set) => ({
  networkMode: "gross",
  mobileTab: "graph",
  selectedParticipant: "A",
  selectedEpoch: 1n,
  transactions: [],
  setNetworkMode: (networkMode) => set({ networkMode }),
  setMobileTab: (mobileTab) => set({ mobileTab }),
  setSelectedParticipant: (selectedParticipant) => set({ selectedParticipant }),
  setSelectedEpoch: (selectedEpoch) => set({ selectedEpoch }),
  upsertTransaction: (record) =>
    set((state) => {
      const existing = state.transactions.findIndex(
        (transaction) => transaction.id === record.id,
      );
      if (existing === -1) {
        return { transactions: [record, ...state.transactions].slice(0, 30) };
      }
      const transactions = [...state.transactions];
      transactions[existing] = record;
      return { transactions };
    }),
}));

