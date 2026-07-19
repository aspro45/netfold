"use client";

import { CircleDollarSign, Network, Rows3, WalletCards } from "lucide-react";
import {
  type MobileTab,
  useInterfaceStore,
} from "@/store/interface-store";

const tabs: { id: MobileTab; label: string; icon: typeof Network }[] = [
  { id: "graph", label: "Graph", icon: Network },
  { id: "ledger", label: "Ledger", icon: Rows3 },
  { id: "actions", label: "Actions", icon: CircleDollarSign },
  { id: "wallet", label: "Wallet", icon: WalletCards },
];

export function MobileTabs() {
  const active = useInterfaceStore((state) => state.mobileTab);
  const setActive = useInterfaceStore((state) => state.setMobileTab);

  return (
    <nav className="mobile-tabs" aria-label="Mobile workspace tabs">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          type="button"
          key={id}
          className={active === id ? "is-active" : ""}
          onClick={() => setActive(id)}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

