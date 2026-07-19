"use client";

import { ArrowUpRight, CircleDot, Copy, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { formatPosition, shortAddress } from "@/lib/format";
import { referenceParticipants } from "@/lib/reference";
import { useInterfaceStore } from "@/store/interface-store";

export function LedgerInspector() {
  const selectedId = useInterfaceStore((state) => state.selectedParticipant);
  const selected =
    referenceParticipants.find((participant) => participant.id === selectedId) ??
    referenceParticipants[0]!;

  return (
    <aside className="ledger-inspector">
      <div className="inspector-header">
        <div>
          <span className="eyebrow">Ledger inspector</span>
          <h2>{selected.label}</h2>
        </div>
        <span
          className={`position-badge ${
            selected.position > 0n
              ? "is-credit"
              : selected.position < 0n
                ? "is-debit"
                : "is-neutral"
          }`}
        >
          {formatPosition(selected.position)}
        </span>
      </div>

      <dl className="ledger-facts">
        <div>
          <dt>Participant</dt>
          <dd>{selected.id}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>{selected.role}</dd>
        </div>
        <div>
          <dt>Accepted legs</dt>
          <dd>{selected.id === "A" || selected.id === "C" ? "3" : "4"}</dd>
        </div>
        <div>
          <dt>Funding state</dt>
          <dd>{selected.position < 0n ? "35.00 due" : "No debit"}</dd>
        </div>
      </dl>

      <div className="address-line">
        <code>{shortAddress(selected.address, 7)}</code>
        <button
          type="button"
          className="icon-button"
          title="Copy participant address"
          aria-label="Copy participant address"
          onClick={() => void navigator.clipboard.writeText(selected.address)}
        >
          <Copy size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="ledger-section">
        <div className="section-title">
          <span>Net settlement</span>
          <CircleDot size={14} aria-hidden="true" />
        </div>
        <div className="settlement-route">
          <span>A</span>
          <i />
          <b>35.00 USDC</b>
          <i />
          <span>B + D</span>
        </div>
      </div>

      <div className="trust-note">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          Contract positions are authoritative. This reference fixture is
          isolated from live reads.
        </p>
      </div>

      <Link
        className="text-action"
        href={`/participants/${selected.address}`}
      >
        Open participant ledger
        <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </aside>
  );
}

