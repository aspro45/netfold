"use client";

import { ExternalLink, Radio } from "lucide-react";
import { activityFixture } from "@/lib/reference";
import { useInterfaceStore } from "@/store/interface-store";

export function TransactionTape() {
  const transactions = useInterfaceStore((state) => state.transactions);
  const items =
    transactions.length > 0
      ? transactions.slice(0, 4).map((transaction) => ({
          time: new Date(transaction.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          event: transaction.label,
          detail: transaction.message ?? transaction.stage,
          hash: transaction.hash,
        }))
      : activityFixture;

  return (
    <div className="transaction-tape">
      <div className="tape-label">
        <Radio size={14} aria-hidden="true" />
        {transactions.length > 0 ? "Transaction tape" : "Reference tape"}
      </div>
      <div className="tape-items">
        {items.map((item, index) => (
          <div className="tape-item" key={`${item.time}-${item.event}-${index}`}>
            <time>{item.time}</time>
            <strong>{item.event}</strong>
            <span>{item.detail}</span>
            {"hash" in item && item.hash ? (
              <a
                href={`https://testnet.arcscan.app/tx/${item.hash}`}
                target="_blank"
                rel="noreferrer"
                title="Open transaction on Arcscan"
              >
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
