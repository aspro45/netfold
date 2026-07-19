"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CircleAlert, WalletCards } from "lucide-react";
import { LedgerInspector } from "@/components/ledger-inspector";
import { NetworkCanvas } from "@/components/network-canvas";
import { NetworkToolbar } from "@/components/network-toolbar";
import { QuickActions } from "@/components/quick-actions";
import { useLiveProtocol } from "@/hooks/use-live-protocol";
import { useInterfaceStore } from "@/store/interface-store";

export function ClearingFloor() {
  const mobileTab = useInterfaceStore((state) => state.mobileTab);
  const live = useLiveProtocol();

  return (
    <div className={`clearing-floor mobile-tab-${mobileTab}`}>
      <section className="network-workspace" aria-label="Obligation graph">
        <NetworkToolbar />
        {!live.configured ? (
          <div className="configuration-notice">
            <CircleAlert size={15} aria-hidden="true" />
            <span>
              Live contracts are not configured. The canvas below is the
              audited reference fixture, never fallback RPC data.
            </span>
          </div>
        ) : null}
        <NetworkCanvas />
        <QuickActions />
      </section>
      <LedgerInspector />
      <section className="mobile-wallet-panel">
        <WalletCards size={30} aria-hidden="true" />
        <h2>Arc wallet</h2>
        <p>
          Connect to sign obligations, fund net debits, and withdraw credits.
        </p>
        <ConnectButton />
      </section>
    </div>
  );
}

