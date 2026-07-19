"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ARC_TESTNET } from "@netfold/shared";
import {
  CircleAlert,
  CircleCheck,
  Network,
  RefreshCw,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { useLiveProtocol } from "@/hooks/use-live-protocol";
import { shortAddress } from "@/lib/format";
import { deployment } from "@/lib/deployment";

export function CommandBar() {
  const live = useLiveProtocol();

  return (
    <header className="command-bar">
      <Link href="/" className="wordmark" aria-label="NETFOLD clearing floor">
        <span className="wordmark-icon">
          <Waypoints aria-hidden="true" size={19} strokeWidth={2.2} />
        </span>
        <span>NETFOLD</span>
      </Link>

      <div className="command-context" aria-label="Protocol status">
        <span className="context-item">
          <Network size={14} aria-hidden="true" />
          Arc Testnet <b>{ARC_TESTNET.id}</b>
        </span>
        <span
          className={`context-item ${
            live.rpcUnavailable ? "is-exception" : "is-online"
          }`}
        >
          {live.rpcUnavailable ? (
            <CircleAlert size={14} aria-hidden="true" />
          ) : (
            <CircleCheck size={14} aria-hidden="true" />
          )}
          {live.rpcUnavailable
            ? "RPC unavailable"
            : live.loading
              ? "Reading network"
              : `Block ${live.blockNumber?.toString() ?? "pending"}`}
        </span>
        <span className="context-item contract-context">
          Clearinghouse{" "}
          <b>
            {deployment.clearinghouse
              ? shortAddress(deployment.clearinghouse)
              : "not deployed"}
          </b>
        </span>
        <button
          type="button"
          className="icon-button"
          onClick={() => void live.refresh()}
          title="Refresh Arc state"
          aria-label="Refresh Arc state"
        >
          <RefreshCw size={15} aria-hidden="true" />
        </button>
      </div>

      <ConnectButton
        chainStatus="icon"
        accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
        showBalance={false}
      />
    </header>
  );
}

